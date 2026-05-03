const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const { buildTenantBackupPayload } = require("./tenantBackupPayload");

const BACKUP_DIR = path.resolve(__dirname, "../../backups");
const STATUS_FILE = path.join(BACKUP_DIR, "auto-backup-status.json");
const MAX_AUTO_BACKUP_FILES = 30;
const CRON_EXPRESSION = "0 2 * * *";

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function safeTenantSlug(tenantId) {
  return String(tenantId || "unknown")
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 64);
}

async function distinctTenantIds() {
  const { Settings, Client } = require("../modules/index").models;
  const User = require("../modules/users/user.model");
  const [fromSettings, fromClients, fromUsers] = await Promise.all([
    Settings.distinct("tenantId", { deletedAt: null }),
    Client.distinct("tenantId", { deletedAt: null }),
    User.distinct("tenantId"),
  ]);
  const merged = [...new Set([...(fromSettings || []), ...(fromClients || []), ...(fromUsers || [])].filter(Boolean))];
  return merged.length ? merged : ["default"];
}

function rotateAutoBackups() {
  ensureBackupDir();
  const names = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("backup-auto-") && f.endsWith(".json"));
  const withStat = names
    .map((name) => {
      const fp = path.join(BACKUP_DIR, name);
      try {
        return { name, fp, mtime: fs.statSync(fp).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);
  const victims = withStat.slice(MAX_AUTO_BACKUP_FILES);
  for (const v of victims) {
    try {
      fs.unlinkSync(v.fp);
    } catch {
      /* ignore */
    }
  }
}

function writeStatus(payload) {
  try {
    ensureBackupDir();
    fs.writeFileSync(STATUS_FILE, JSON.stringify(payload, null, 2), "utf8");
  } catch (e) {
    console.error("[auto-backup] failed to write status file", e);
  }
}

function readStatus() {
  try {
    const raw = fs.readFileSync(STATUS_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function runAutoBackupJob() {
  ensureBackupDir();
  const startedAt = new Date().toISOString();
  const datePart = startedAt.slice(0, 10);
  const status = {
    lastRunAt: startedAt,
    lastRunOk: true,
    lastError: null,
    tenants: {},
    totalAutoBackups: 0,
  };

  try {
    const tenants = await distinctTenantIds();
    for (const tenantId of tenants) {
      const slug = safeTenantSlug(tenantId);
      const payload = await buildTenantBackupPayload(tenantId);
      const fname = `backup-auto-${datePart}-${slug}.json`;
      const fp = path.join(BACKUP_DIR, fname);
      fs.writeFileSync(fp, JSON.stringify(payload, null, 2), "utf8");
      status.tenants[slug] = { file: fname, ok: true, exportedAt: payload.exportedAt };
    }
    rotateAutoBackups();
    const count = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("backup-auto-") && f.endsWith(".json")).length;
    status.totalAutoBackups = count;
  } catch (e) {
    console.error("[auto-backup] job failed", e);
    status.lastRunOk = false;
    status.lastError = e.message || String(e);
  }

  writeStatus(status);
  return status;
}

function countAutoBackupsForSlug(slug) {
  ensureBackupDir();
  const suf = `-${slug}.json`;
  return fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith("backup-auto-") && f.endsWith(suf)).length;
}

function getLatestAutoBackupFileForSlug(slug) {
  ensureBackupDir();
  const suf = `-${slug}.json`;
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("backup-auto-") && f.endsWith(suf))
    .map((name) => {
      const fp = path.join(BACKUP_DIR, name);
      try {
        return { name, fp, mtime: fs.statSync(fp).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);
  return files[0] || null;
}

function getAutoBackupStatusForTenant(tenantId) {
  const slug = safeTenantSlug(tenantId);
  ensureBackupDir();
  const globalStatus = readStatus();
  const allAuto = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith("backup-auto-") && f.endsWith(".json"));
  const latest = getLatestAutoBackupFileForSlug(slug);
  return {
    autoBackupEnabled: true,
    schedule: "Daily at 02:00 UTC",
    cronExpression: CRON_EXPRESSION,
    lastRunAt: globalStatus?.lastRunAt || null,
    lastRunOk: globalStatus?.lastRunOk !== false,
    lastError: globalStatus?.lastError || null,
    totalSavedBackups: allAuto.length,
    tenantBackupsCount: countAutoBackupsForSlug(slug),
    latestTenantBackupFile: latest?.name || null,
    latestTenantBackupAt: latest ? new Date(latest.mtime).toISOString() : null,
  };
}

function startBackupScheduler() {
  cron.schedule(
    CRON_EXPRESSION,
    () => {
      runAutoBackupJob().catch((e) => console.error("[auto-backup] cron error", e));
    },
    { timezone: "UTC" }
  );
  console.log(`[auto-backup] scheduled daily (${CRON_EXPRESSION} UTC), directory: ${BACKUP_DIR}`);
  setTimeout(() => {
    runAutoBackupJob().catch((e) => console.error("[auto-backup] initial run error", e));
  }, 180_000);
}

module.exports = {
  startBackupScheduler,
  runAutoBackupJob,
  readStatus,
  getAutoBackupStatusForTenant,
  getLatestAutoBackupFileForSlug,
  safeTenantSlug,
  BACKUP_DIR,
  STATUS_FILE,
};
