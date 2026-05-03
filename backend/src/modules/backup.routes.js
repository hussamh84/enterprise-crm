const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./users/user.model");

const router = express.Router();

const REQUIRED_ARRAY_KEYS = ["clients", "projects", "quotations", "invoices", "inventory", "payments", "users"];

const SETTINGS_KEYS = [
  "currency",
  "locale",
  "companyName",
  "companyAddress",
  "companyPhone",
  "companyLogoUrl",
  "backgroundImageUrl",
];

function loadModels() {
  return require("./index").models;
}

function validateBackupPayload(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push("Backup must be a JSON object.");
    return { ok: false, errors };
  }
  if (Number(raw.version) !== 1) {
    errors.push('Invalid or missing "version" (expected 1).');
  }
  if (raw.company != null && typeof raw.company !== "object") {
    errors.push('"company" must be an object.');
  }
  for (const key of REQUIRED_ARRAY_KEYS) {
    if (!Array.isArray(raw[key])) {
      errors.push(`Missing or invalid array: "${key}".`);
    }
  }
  const summary = {
    clients: Array.isArray(raw.clients) ? raw.clients.length : 0,
    projects: Array.isArray(raw.projects) ? raw.projects.length : 0,
    quotations: Array.isArray(raw.quotations) ? raw.quotations.length : 0,
    invoices: Array.isArray(raw.invoices) ? raw.invoices.length : 0,
    inventory: Array.isArray(raw.inventory) ? raw.inventory.length : 0,
    payments: Array.isArray(raw.payments) ? raw.payments.length : 0,
    users: Array.isArray(raw.users) ? raw.users.length : 0,
  };
  return { ok: errors.length === 0, errors, summary };
}

function assertObjectId(id, label, errors) {
  if (id == null || id === "") return null;
  const s = String(id);
  if (!mongoose.Types.ObjectId.isValid(s)) {
    errors.push(`Invalid ObjectId for ${label}: ${s}`);
    return null;
  }
  return new mongoose.Types.ObjectId(s);
}

function normalizeRef(value) {
  if (value && typeof value === "object" && value._id != null) return String(value._id);
  if (value == null || value === "") return value;
  return String(value);
}

function stripMongoMeta(doc, tenantId) {
  const o = typeof doc === "object" && doc ? { ...doc } : {};
  delete o.__v;
  o.tenantId = tenantId;
  return o;
}

function compactDoc(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

function mapBackupRoleToDb(role) {
  const r = String(role || "").toLowerCase();
  if (r === "admin") return "company_admin";
  return "sales";
}

router.post("/validate", (req, res) => {
  try {
    const body = req.body?.backup != null ? req.body.backup : req.body;
    const result = validateBackupPayload(body);
    if (!result.ok) {
      return res.status(400).json({ ok: false, errors: result.errors });
    }
    return res.json({ ok: true, summary: result.summary });
  } catch (e) {
    return res.status(400).json({ ok: false, errors: [e.message || "Invalid JSON"] });
  }
});

/** Sequential upsert (no multi-document transaction — compatible with standalone MongoDB). */
router.post("/restore", async (req, res, next) => {
  const restored = {
    clients: 0,
    projects: 0,
    quotations: 0,
    invoices: 0,
    inventory: 0,
    usersUpdated: 0,
    usersCreated: 0,
    usersSkipped: 0,
    settings: false,
  };
  const warnings = [];

  try {
    const tenantId = String(req.user?.tenantId || req.tenantId || "").trim();
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant context is required." });
    }

    const raw = req.body?.backup != null ? req.body.backup : req.body;
    const validation = validateBackupPayload(raw);
    if (!validation.ok) {
      return res.status(400).json({ ok: false, errors: validation.errors });
    }

    if (raw.meta && raw.meta.tenantId && String(raw.meta.tenantId) !== tenantId) {
      return res.status(400).json({
        ok: false,
        errors: [`Backup tenant "${raw.meta.tenantId}" does not match your workspace "${tenantId}".`],
      });
    }

    const idErrors = [];
    const { Client, Project, Quotation, Invoice, InventoryItem, Settings } = loadModels();

    for (const doc of raw.clients || []) {
      const _id = assertObjectId(doc._id, "client", idErrors);
      if (!_id) continue;
      const payload = compactDoc(stripMongoMeta(doc, tenantId));
      payload._id = _id;
      await Client.replaceOne({ _id, tenantId }, payload, { upsert: true });
      restored.clients += 1;
    }

    for (const doc of raw.projects || []) {
      const _id = assertObjectId(doc._id, "project", idErrors);
      if (!_id) continue;
      const payload = compactDoc(stripMongoMeta(doc, tenantId));
      payload._id = _id;
      payload.clientId = normalizeRef(payload.clientId);
      await Project.replaceOne({ _id, tenantId }, payload, { upsert: true });
      restored.projects += 1;
    }

    for (const doc of raw.quotations || []) {
      const _id = assertObjectId(doc._id, "quotation", idErrors);
      if (!_id) continue;
      const payload = compactDoc(stripMongoMeta(doc, tenantId));
      payload._id = _id;
      payload.clientId = normalizeRef(payload.clientId);
      payload.projectId = normalizeRef(payload.projectId);
      await Quotation.replaceOne({ _id, tenantId }, payload, { upsert: true });
      restored.quotations += 1;
    }

    for (const doc of raw.invoices || []) {
      const _id = assertObjectId(doc._id, "invoice", idErrors);
      if (!_id) continue;
      const payload = compactDoc(stripMongoMeta(doc, tenantId));
      payload._id = _id;
      payload.clientId = normalizeRef(payload.clientId);
      payload.projectId = normalizeRef(payload.projectId);
      payload.quotationId = normalizeRef(payload.quotationId);
      delete payload.clientName;
      delete payload.projectName;
      delete payload.quotationNo;
      await Invoice.replaceOne({ _id, tenantId }, payload, { upsert: true });
      restored.invoices += 1;
    }

    for (const doc of raw.inventory || []) {
      const _id = assertObjectId(doc._id, "inventory", idErrors);
      if (!_id) continue;
      const payload = compactDoc(stripMongoMeta(doc, tenantId));
      payload._id = _id;
      await InventoryItem.replaceOne({ _id, tenantId }, payload, { upsert: true });
      restored.inventory += 1;
    }

    if (raw.company && typeof raw.company === "object") {
      const c = stripMongoMeta(raw.company, tenantId);
      delete c._id;
      const cleaned = {};
      for (const k of SETTINGS_KEYS) {
        if (c[k] !== undefined) cleaned[k] = c[k];
      }
      if (Object.keys(cleaned).length) {
        await Settings.findOneAndUpdate(
          { tenantId, deletedAt: null },
          { $set: { ...cleaned, tenantId, updatedBy: req.user?.id } },
          { upsert: true, new: true }
        );
        restored.settings = true;
      }
    }

    const tempHash = await bcrypt.hash(`Restored-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, 10);

    for (const doc of raw.users || []) {
      const email = typeof doc.email === "string" ? doc.email.trim().toLowerCase() : "";
      if (!email) {
        restored.usersSkipped += 1;
        continue;
      }
      const fullName = String(doc.fullName || doc.name || "").trim() || email;
      const dbRole = mapBackupRoleToDb(doc.role);
      const existing = await User.findOne({ email, tenantId });
      if (existing) {
        existing.fullName = fullName;
        existing.name = fullName;
        existing.role = dbRole;
        existing.tenantId = tenantId;
        await existing.save();
        restored.usersUpdated += 1;
      } else {
        await User.create({
          email,
          fullName,
          name: fullName,
          role: dbRole,
          tenantId,
          passwordHash: tempHash,
        });
        restored.usersCreated += 1;
        warnings.push(`New user "${email}" was restored with a temporary password — use Forgot Password before first login.`);
      }
    }

    if (idErrors.length) {
      return res.status(400).json({ ok: false, errors: idErrors });
    }

    return res.json({ ok: true, restored, warnings });
  } catch (err) {
    return next(err);
  }
});

module.exports = { backupRouter: router };
