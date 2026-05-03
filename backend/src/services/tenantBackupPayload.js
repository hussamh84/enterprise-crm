/**
 * Build the same CRM backup JSON shape as manual export (version 1), for a single tenant.
 * Used by automatic daily backups (and can be reused elsewhere).
 */

const User = require("../modules/users/user.model");

function loadModels() {
  return require("../modules/index").models;
}

function buildPaymentsFromInvoices(invoices) {
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

function sanitizeUserForExport(user) {
  if (!user || typeof user !== "object") return user;
  const o = { ...user };
  delete o.password;
  delete o.passwordHash;
  delete o.resetToken;
  delete o.resetTokenExpiry;
  delete o.__v;
  delete o.fcmTokens;
  if (o.role === "company_admin") o.role = "admin";
  else if (o.role === "sales") o.role = "employee";
  return o;
}

async function buildTenantBackupPayload(tenantId) {
  const tid = String(tenantId || "").trim();
  if (!tid) throw new Error("tenantId is required");

  const { Client, Project, Quotation, Invoice, InventoryItem, Settings } = loadModels();

  const [clients, projects, quotations, invoices, inventory, settings, usersRaw] = await Promise.all([
    Client.find({ tenantId: tid, deletedAt: null }).lean(),
    Project.find({ tenantId: tid, deletedAt: null }).lean(),
    Quotation.find({ tenantId: tid, deletedAt: null }).lean(),
    Invoice.find({ tenantId: tid, deletedAt: null }).lean(),
    InventoryItem.find({ tenantId: tid, deletedAt: null }).lean(),
    Settings.findOne({ tenantId: tid, deletedAt: null }).lean(),
    User.find({ tenantId: tid }).select("-passwordHash -resetToken -resetTokenExpiry").lean(),
  ]);

  const users = (usersRaw || []).map(sanitizeUserForExport);
  const company = settings && typeof settings === "object" ? { ...settings } : {};
  delete company.__v;

  const payments = buildPaymentsFromInvoices(invoices);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    meta: {
      tenantId: tid,
      app: "enterprise-crm",
      source: "automatic",
    },
    company,
    clients: clients || [],
    projects: projects || [],
    quotations: quotations || [],
    invoices: invoices || [],
    inventory: inventory || [],
    payments,
    users,
  };
}

module.exports = {
  buildTenantBackupPayload,
  buildPaymentsFromInvoices,
  sanitizeUserForExport,
};
