import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DatabaseBackup, Download, Upload } from "lucide-react";
import api from "../lib/api";
import {
  CRM_BACKUP_VERSION,
  LAST_EXPORT_STORAGE_KEY,
  buildPaymentsFromInvoices,
  downloadJson,
  filterRowsByTenant,
  normalizeInvoiceForBackup,
  normalizeQuotationForBackup,
  sanitizeUserForBackup,
  validateBackupShape,
} from "../lib/crmBackup";
import { useAuthStore } from "../store/authStore";

export default function BackupRestorePage() {
  const queryClient = useQueryClient();
  const tenantId = useAuthStore((s) => s.user?.tenantId || "");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [restoreResult, setRestoreResult] = useState(null);
  const [pendingBackup, setPendingBackup] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const lastExportLabel = useMemo(() => {
    try {
      const raw = localStorage.getItem(LAST_EXPORT_STORAGE_KEY);
      if (!raw) return "No backup exported in this browser yet.";
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return "Last export: unknown date";
      return `Last export in this browser: ${d.toLocaleString()}`;
    } catch {
      return "";
    }
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setRestoreError("");
    setRestoreResult(null);
    try {
      const [
        clientsRes,
        projectsRes,
        quotationsRes,
        invoicesRes,
        inventoryRes,
        usersRes,
        settingsRes,
      ] = await Promise.all([
        api.get("/clients"),
        api.get("/projects"),
        api.get("/quotations"),
        api.get("/invoices"),
        api.get("/inventory"),
        api.get("/users"),
        api.get("/settings"),
      ]);

      const clients = filterRowsByTenant(clientsRes.data, tenantId);
      const projects = filterRowsByTenant(projectsRes.data, tenantId);
      const quotationsRaw = filterRowsByTenant(quotationsRes.data, tenantId);
      const quotations = quotationsRaw.map(normalizeQuotationForBackup);
      const invoicesRaw = filterRowsByTenant(invoicesRes.data, tenantId);
      const invoices = invoicesRaw.map(normalizeInvoiceForBackup);
      const inventory = filterRowsByTenant(inventoryRes.data, tenantId);
      const users = (Array.isArray(usersRes.data) ? usersRes.data : [])
        .filter((u) => !tenantId || !u?.tenantId || u.tenantId === tenantId)
        .map(sanitizeUserForBackup);
      const company = settingsRes.data && typeof settingsRes.data === "object" ? { ...settingsRes.data } : {};
      delete company.__v;

      const payments = buildPaymentsFromInvoices(invoices);

      const exportedAt = new Date().toISOString();
      const payload = {
        version: CRM_BACKUP_VERSION,
        exportedAt,
        meta: {
          tenantId: tenantId || null,
          app: "enterprise-crm",
        },
        company,
        clients,
        projects,
        quotations,
        invoices,
        inventory,
        payments,
        users,
      };

      const safeName = `crm-backup-${exportedAt.slice(0, 19).replace(/[:T]/g, "-")}.json`;
      downloadJson(safeName, payload);
      localStorage.setItem(LAST_EXPORT_STORAGE_KEY, exportedAt);
    } catch (e) {
      console.error(e);
      setRestoreError(e?.response?.data?.message || e.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  }, [tenantId]);

  const readFileJson = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result || "");
          resolve(JSON.parse(text));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsText(file, "UTF-8");
    });

  const handlePickRestoreFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setRestoreError("");
    setRestoreResult(null);
    try {
      const parsed = await readFileJson(file);
      const local = validateBackupShape(parsed);
      if (!local.ok) {
        setRestoreError(local.errors.join(" "));
        return;
      }
      const { data: remote } = await api.post("/backup/validate", { backup: parsed });
      if (!remote?.ok) {
        setRestoreError((remote?.errors && remote.errors.join?.(" ")) || "Server rejected this backup file.");
        return;
      }
      setPendingBackup(parsed);
      setConfirmChecked(false);
      setConfirmOpen(true);
    } catch (e) {
      console.error(e);
      setRestoreError("Invalid or unreadable JSON backup file.");
    }
  };

  const runRestore = async () => {
    if (!pendingBackup || !confirmChecked) return;
    setImporting(true);
    setRestoreError("");
    setRestoreResult(null);
    try {
      const { data } = await api.post("/backup/restore", { backup: pendingBackup });
      setRestoreResult(data);
      setConfirmOpen(false);
      setPendingBackup(null);
      await queryClient.invalidateQueries();
    } catch (e) {
      const msg =
        e?.response?.data?.errors?.join?.("; ") ||
        e?.response?.data?.message ||
        e.message ||
        "Restore failed.";
      setRestoreError(msg);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600">
          <DatabaseBackup className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="section-title">Backup &amp; Restore</h1>
          <p className="page-subtitle text-[#6b7c93] mt-1">
            Export a full JSON snapshot of your workspace, or restore from a previously exported file. Automatic cloud
            backups are not enabled in this phase.
          </p>
        </div>
      </div>

      <div className="premium-card p-5 border-amber-200 bg-amber-50/40">
        <h2 className="text-sm font-semibold text-amber-900">Important</h2>
        <ul className="mt-2 text-sm text-amber-950/90 list-disc pl-5 space-y-1">
          <li>Exports do not include password hashes, tokens, or sessions.</li>
          <li>
            <strong>Restore</strong> upserts records by <code className="text-xs bg-white/80 px-1 rounded">_id</code>{" "}
            and may overwrite existing data for this workspace.
          </li>
          <li>
            PDFs generated on the server use database settings. After restoring, open <strong>Settings</strong> and
            verify company branding if PDFs look out of date.
          </li>
        </ul>
      </div>

      <div className="premium-card p-5 space-y-4">
        <h2 className="text-base font-semibold text-[#0a2540]">Export backup</h2>
        <p className="text-sm text-[#6b7c93]">
          Downloads JSON including clients, projects, quotations, invoices (with embedded payments), inventory, users
          (without secrets), and company settings.
        </p>
        <p className="text-xs text-[#64748b]">{lastExportLabel}</p>
        <button
          type="button"
          disabled={exporting}
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0B132B] text-white px-4 py-2.5 text-sm font-medium hover:bg-black disabled:opacity-60"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          {exporting ? "Preparing…" : "Export system backup"}
        </button>
      </div>

      <div className="premium-card p-5 space-y-4">
        <h2 className="text-base font-semibold text-[#0a2540]">Restore backup</h2>
        <p className="text-sm text-[#6b7c93]">
          Upload a JSON file produced by this page. The server validates structure and tenant metadata before applying
          changes sequentially on the server (validated first).
        </p>
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-[#425466] cursor-pointer hover:bg-slate-50">
          <Upload className="h-4 w-4 shrink-0" aria-hidden />
          <span>Restore from JSON file</span>
          <input type="file" accept="application/json,.json" className="hidden" onChange={handlePickRestoreFile} />
        </label>
        {restoreError ? <p className="text-sm text-rose-600">{restoreError}</p> : null}
        {restoreResult?.ok ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-900">
            <p className="font-medium">Restore completed</p>
            <pre className="mt-2 text-xs overflow-auto whitespace-pre-wrap">{JSON.stringify(restoreResult.restored, null, 2)}</pre>
            {restoreResult.warnings?.length ? (
              <ul className="mt-2 list-disc pl-5 text-xs">
                {restoreResult.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
          <div className="premium-card max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-semibold text-[#0a2540]">Confirm restore</h3>
            <p className="mt-2 text-sm text-[#64748b]">
              Restoring may <strong>overwrite</strong> existing clients, projects, quotations, invoices, inventory,
              company settings, and user profiles for this workspace. This cannot be undone from here.
            </p>
            <label className="mt-4 flex items-start gap-2 text-sm text-[#334155] cursor-pointer">
              <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} className="mt-1" />
              <span>I understand and want to continue.</span>
            </label>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-[#425466] hover:bg-slate-50"
                onClick={() => {
                  setConfirmOpen(false);
                  setPendingBackup(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!confirmChecked || importing}
                onClick={runRestore}
                className="rounded-lg bg-rose-600 text-white px-4 py-2 text-sm font-medium hover:bg-rose-700 disabled:opacity-50"
              >
                {importing ? "Restoring…" : "Restore now"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
