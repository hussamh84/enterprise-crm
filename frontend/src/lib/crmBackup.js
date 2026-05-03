export const CRM_BACKUP_VERSION = 1;
export const LAST_EXPORT_STORAGE_KEY = "crm_last_backup_export_at";

export function filterRowsByTenant(rows, tenantId) {
  if (!Array.isArray(rows)) return [];
  if (!tenantId) return rows;
  return rows.filter((r) => !r?.tenantId || r.tenantId === tenantId);
}

export function normalizeRefId(value) {
  if (value && typeof value === "object" && value._id != null) return String(value._id);
  if (value == null || value === "") return value;
  return String(value);
}

export function normalizeQuotationForBackup(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const o = { ...doc };
  o.clientId = normalizeRefId(o.clientId);
  o.projectId = normalizeRefId(o.projectId);
  return o;
}

export function normalizeInvoiceForBackup(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const o = { ...doc };
  o.clientId = normalizeRefId(o.clientId);
  o.projectId = normalizeRefId(o.projectId);
  o.quotationId = normalizeRefId(o.quotationId);
  delete o.clientName;
  delete o.projectName;
  delete o.quotationNo;
  return o;
}

export function sanitizeUserForBackup(user) {
  if (!user || typeof user !== "object") return user;
  const o = { ...user };
  delete o.password;
  delete o.passwordHash;
  delete o.resetToken;
  delete o.resetTokenExpiry;
  delete o.__v;
  delete o.fcmTokens;
  return o;
}

export function buildPaymentsFromInvoices(invoices) {
  if (!Array.isArray(invoices)) return [];
  const out = [];
  for (const inv of invoices) {
    const invoiceId = String(inv._id || "");
    const list = Array.isArray(inv.payments) ? inv.payments : [];
    for (const p of list) {
      out.push({
        invoiceId,
        amount: p?.amount,
        date: p?.date,
      });
    }
  }
  return out;
}

export function validateBackupShape(parsed) {
  const errors = [];
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    errors.push("File must contain a JSON object.");
    return { ok: false, errors };
  }
  if (Number(parsed.version) !== 1) {
    errors.push('Invalid or missing "version" (expected 1).');
  }
  const keys = ["company", "clients", "projects", "quotations", "invoices", "inventory", "payments", "users"];
  for (const k of keys) {
    if (k === "company") {
      if (parsed.company != null && typeof parsed.company !== "object") errors.push('"company" must be an object.');
      continue;
    }
    if (!Array.isArray(parsed[k])) errors.push(`Missing or invalid array: "${k}".`);
  }
  return { ok: errors.length === 0, errors };
}

export function downloadJson(filename, dataObj) {
  const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
