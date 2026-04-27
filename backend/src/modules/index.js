const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { makeEntityModel, buildCrudRouter } = require("./shared");
const { incrementClientCounter, Counter } = require("./clients/counter.model");
const { clientNumberField } = require("./clients/client.model");
const { AppError } = require("../utils/appError");
const { User } = require("./auth/auth.routes");

console.log("CHECK PAGE:", __filename);

const router = express.Router();
const uploadsDir = path.resolve(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || ".png");
      cb(null, `logo-${Date.now()}${ext}`);
    },
  }),
});

const Lead = makeEntityModel("Lead", {
  score: { type: Number, default: 0 },
  stage: { type: String, default: "lead" },
  source: String,
  phone: String,
  email: String,
  convertedClientId: String,
  convertedAt: Date,
});
const Client = makeEntityModel("Client", {
  isDeleted: { type: Boolean, default: false },
  ...clientNumberField,
  phone: { type: String, default: "", trim: true },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    set: (value) => (value == null ? undefined : value),
    validate: {
      validator: (value) => {
        if (value == null || value === "") return true;
        if (typeof value !== "string") return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
      },
      message: "Invalid email format",
    },
  },
  contacts: [{ name: String, email: String, phone: String }],
});
Client.schema.virtual("clientCode").get(function clientCodeGetter() {
  if (this.clientNumber == null || this.clientNumber === undefined) return "";
  const n = Math.floor(Number(this.clientNumber));
  if (Number.isNaN(n)) return "";
  return String(n).padStart(4, "0");
});
Client.schema.set("toJSON", { virtuals: true });
Client.schema.set("toObject", { virtuals: true });
Client.schema.index({ tenantId: 1, clientNumber: 1 }, { unique: true, sparse: true });
const Activity = makeEntityModel("Activity", { type: String, dueAt: Date, reminderAt: Date });
const SiteVisit = makeEntityModel("SiteVisit", { visitDate: Date, assignedTechnician: String, report: String, images: [String] });
const Quotation = makeEntityModel("Quotation", {
  clientId: { type: String, required: true },
  projectId: { type: String, required: true },
  status: { type: String, default: "draft" },
  items: [
    {
      description: { type: String, trim: true },
      quantity: { type: Number, default: 1 },
      unitPrice: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
  ],
  discount: {
    type: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "fixed",
    },
    value: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  tax: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
});
const Project = makeEntityModel("Project", {
  clientId: { type: String, required: true },
  status: { type: String, enum: ["active", "completed"], default: "active" },
  milestone: String,
  progress: Number,
  budget: Number,
  projectCost: Number,
  profit: Number,
  totalRevenue: { type: Number, default: 0 },
  totalExpenses: { type: Number, default: 0 },
  startDate: Date,
  endDate: Date,
  projectType: {
    type: String,
    enum: ["CCTV_ANALOG", "CCTV_IP", "NETWORK", "SOLAR"],
    default: "NETWORK",
  },
  cctvType: { type: String, enum: ["Analog", "IP", ""], default: "" },
});
const Invoice = makeEntityModel("Invoice", {
  clientId: { type: String, required: true },
  projectId: { type: String, required: true },
  quotationId: { type: String },
  total: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number, default: 0 },
  paidAt: { type: Date, default: null },
  status: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
});
const ExpenseSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    createdBy: { type: String },
    updatedBy: { type: String },
    deletedAt: { type: Date, default: null },
    auditLog: [
      {
        action: String,
        at: { type: Date, default: Date.now },
        by: String,
        note: String,
      },
    ],
    projectId: { type: String, required: true, index: true },
    title: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, default: 0 },
    date: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);
const Expense = mongoose.models.Expense || mongoose.model("Expense", ExpenseSchema);
const InventoryItem = makeEntityModel("InventoryItem", { sku: String, quantity: Number, lowStockThreshold: Number });
const Ticket = makeEntityModel("Ticket", { priority: String, slaStatus: String, assignedTo: String });
const SettingsSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    currency: { type: String, default: "SDG", trim: true },
    locale: { type: String, default: "en-US", trim: true },
    companyName: { type: String, default: "Config Engineering", trim: true },
    companyAddress: { type: String, default: "Sudan, Khartoum - Omdurman, Al Abraj St.", trim: true },
    companyPhone: { type: String, default: "+249 912679849, +249 124000486", trim: true },
    companyLogoUrl: { type: String, default: "", trim: true },
    backgroundImageUrl: { type: String, default: "", trim: true },
    createdBy: { type: String },
    updatedBy: { type: String },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
const Settings = mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);

const getTenantId = (req) => req.user?.tenantId || req.tenantId;

const ensureClientProjectLink = async ({ tenantId, clientId, projectId }) => {
  const [client, project] = await Promise.all([
    Client.findOne({ _id: clientId, tenantId, deletedAt: null, isDeleted: { $ne: true } }),
    Project.findOne({ _id: projectId, tenantId, deletedAt: null }),
  ]);
  if (!client) throw new AppError("Client not found", 404);
  if (!project) throw new AppError("Project not found", 404);
  if (String(project.clientId) !== String(clientId)) {
    throw new AppError("Project does not belong to the selected client", 400);
  }
  return { client, project };
};

const createInvoiceFromQuotation = async ({ quotation, req, note }) => {
  const tenantId = getTenantId(req);
  if (!tenantId) throw new AppError("Tenant context is required", 400);
  const total = Number(quotation.grandTotal ?? quotation.subtotal ?? 0);
  const existing = await Invoice.findOne({
    tenantId,
    quotationId: String(quotation._id),
    deletedAt: null,
  });
  if (existing) return existing;

  return Invoice.create({
    tenantId,
    name: quotation.name || `Invoice ${String(quotation._id).slice(-6)}`,
    clientId: String(quotation.clientId),
    projectId: String(quotation.projectId),
    quotationId: String(quotation._id),
    total,
    paidAmount: 0,
    remainingAmount: total,
    status: "unpaid",
    createdBy: req.user?.id,
    updatedBy: req.user?.id,
    auditLog: [{ action: "invoice.create_from_quotation", by: req.user?.id, note: note || "Created from quotation" }],
  });
};

const calculateProjectFinancials = async ({ tenantId, projectId }) => {
  const [expenses, invoices] = await Promise.all([
    Expense.find({ tenantId, projectId: String(projectId), deletedAt: null }).lean(),
    Invoice.find({ tenantId, projectId: String(projectId), deletedAt: null }).lean(),
  ]);

  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totalRevenue = invoices.reduce((sum, invoice) => {
    const paidAmount = Number(invoice.paidAmount ?? 0);
    if (paidAmount > 0) return sum + paidAmount;
    if (invoice.status === "paid") return sum + Number(invoice.total || 0);
    return sum;
  }, 0);
  const profit = totalRevenue - totalExpenses;
  return { totalRevenue, totalExpenses, profit };
};

const syncProjectFinancialsForProject = async ({ tenantId, projectId, userId }) => {
  const snapshot = await calculateProjectFinancials({ tenantId, projectId });
  await Project.findOneAndUpdate(
    { _id: String(projectId), tenantId, deletedAt: null },
    {
      totalRevenue: snapshot.totalRevenue,
      totalExpenses: snapshot.totalExpenses,
      profit: snapshot.profit,
      updatedBy: userId,
      $push: {
        auditLog: {
          action: "project.financials.sync",
          by: userId,
          note: `Revenue ${snapshot.totalRevenue}, Expenses ${snapshot.totalExpenses}, Profit ${snapshot.profit}`,
        },
      },
    }
  );
  return snapshot;
};

const createClientFromLead = async ({ lead, req, note }) => {
  const tenantId = getTenantId(req);
  if (!tenantId) throw new AppError("Tenant context is required", 400);
  if (!lead?.name || !String(lead.name).trim()) throw new AppError("Lead name is required", 400);

  const existingClientByEmail =
    lead.email && String(lead.email).trim()
      ? await Client.findOne({
          tenantId,
          deletedAt: null,
          isDeleted: { $ne: true },
          email: String(lead.email).trim().toLowerCase(),
        })
      : null;
  if (existingClientByEmail) return existingClientByEmail;

  const nextNo = await incrementClientCounter(tenantId);
  return Client.create({
    tenantId,
    name: String(lead.name).trim(),
    email: lead.email ? String(lead.email).trim().toLowerCase() : undefined,
    phone: lead.phone ? String(lead.phone).trim() : "",
    clientNumber: nextNo,
    status: "active",
    createdBy: req.user?.id,
    updatedBy: req.user?.id,
    auditLog: [{ action: "lead.convert_to_client", by: req.user?.id, note: note || "Converted from lead" }],
  });
};

router.post("/leads/:id/convert", async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return next(new AppError("Tenant context is required", 400));
    const lead = await Lead.findOne({ _id: req.params.id, tenantId, deletedAt: null });
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const existingConvertedClient =
      lead.convertedClientId && String(lead.convertedClientId).trim()
        ? await Client.findOne({
            _id: String(lead.convertedClientId),
            tenantId,
            deletedAt: null,
            isDeleted: { $ne: true },
          })
        : null;

    const client =
      existingConvertedClient ||
      (await createClientFromLead({
        lead,
        req,
        note: "Manual conversion from leads module",
      }));

    lead.stage = "converted";
    lead.status = "converted";
    lead.convertedClientId = String(client._id);
    lead.convertedAt = new Date();
    lead.updatedBy = req.user?.id;
    lead.auditLog = [
      ...(Array.isArray(lead.auditLog) ? lead.auditLog : []),
      { action: "lead.convert", by: req.user?.id, note: `Converted to client ${client.name}` },
    ];
    await lead.save();

    res.json({
      message: "Lead converted successfully",
      lead,
      client,
    });
  } catch (error) {
    next(error);
  }
});

router.use("/leads", buildCrudRouter({
  model: Lead,
  entity: "lead",
  postCreate: async ({ doc, req }) => {
    if (doc.stage === "won") {
      const linkedClient = await createClientFromLead({
        lead: doc,
        req,
        note: "Auto-created from won lead",
      });
      await Project.create({
        tenantId: doc.tenantId,
        name: `${doc.name} Implementation`,
        clientId: String(linkedClient._id),
        status: "active",
        createdBy: doc.createdBy,
        updatedBy: doc.updatedBy,
        auditLog: [{ action: "automation.lead_won_create_project", by: doc.createdBy, note: "Auto-created from lead" }],
      });
    }
  },
}));
router.post("/clients", async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      console.warn("[clients.create] Validation failed: tenantId missing", {
        userId: req.user?.id || null,
      });
      return next(new AppError("Tenant context is required", 400));
    }

    console.info("[clients.create] Incoming request body", {
      tenantId,
      userId: req.user?.id || null,
      body: req.body,
    });

    const rawName = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const rawPhone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    if (!rawName) {
      console.warn("[clients.create] Validation failed: name is required", {
        tenantId,
        userId: req.user?.id || null,
      });
      return next(new AppError("Client name is required", 400));
    }
    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      console.warn("[clients.create] Validation failed: invalid email format", {
        tenantId,
        userId: req.user?.id || null,
      });
      return next(new AppError("Invalid email format", 400));
    }

    const nextClientNumber = await incrementClientCounter(tenantId);
    const payload = {
      ...req.body,
      name: rawName,
      email: rawEmail || undefined,
      phone: rawPhone,
      clientNumber: nextClientNumber,
      tenantId,
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
      auditLog: [{ action: "client.create", by: req.user?.id, note: "Created client" }],
    };
    console.info("[clients.create] Creating client with payload", {
      tenantId,
      userId: req.user?.id || null,
      payload,
    });

    const client = await Client.create(payload);

    console.info("[clients.create] Client created", {
      clientId: String(client._id),
      tenantId,
      userId: req.user?.id || null,
      savedClient: client,
    });

    return res.status(201).json(client);
  } catch (error) {
    console.error("[clients.create] Failed to create client", {
      tenantId: req.user?.tenantId || req.tenantId || null,
      userId: req.user?.id || null,
      message: error.message,
    });
    if (error.name === "ValidationError") {
      return next(new AppError(error.message || "Invalid client payload", 400));
    }
    return next(error);
  }
});
router.get("/clients", async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return next(new AppError("Tenant context is required", 400));
    }

    const clients = await Client.find({ tenantId, deletedAt: null, isDeleted: { $ne: true } }).sort({
      clientNumber: -1,
      createdAt: -1,
    });
    console.info("[clients.list] Returned clients for tenant", {
      tenantId,
      count: clients.length,
      userId: req.user?.id || null,
    });

    return res.json(clients);
  } catch (error) {
    console.error("[clients.list] Failed to fetch clients", {
      tenantId: req.user?.tenantId || req.tenantId || null,
      userId: req.user?.id || null,
      message: error.message,
    });
    return next(error);
  }
});
router.delete("/clients/:id", async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return next(new AppError("Tenant context is required", 400));
    }

    const doc = await Client.findOneAndUpdate(
      { _id: req.params.id, tenantId, deletedAt: null, isDeleted: { $ne: true } },
      {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: req.user?.id,
        $push: { auditLog: { action: "client.delete", by: req.user?.id, note: "Soft deleted client (isDeleted=true)" } },
      },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: "Client not found" });
    return res.json({ message: "Deleted", doc });
  } catch (error) {
    return next(error);
  }
});
const updateClientById = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return next(new AppError("Tenant context is required", 400));
    }

    const updates = {};
    if (typeof req.body?.name === "string") {
      const name = req.body.name.trim();
      if (!name) return next(new AppError("Client name is required", 400));
      updates.name = name;
    }
    if (typeof req.body?.phone === "string") {
      updates.phone = req.body.phone.trim();
    }
    if (typeof req.body?.email === "string") {
      const email = req.body.email.trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return next(new AppError("Invalid email format", 400));
      }
      updates.email = email || undefined;
    }
    if (typeof req.body?.address === "string") {
      updates.address = req.body.address.trim();
    }
    if (typeof req.body?.notes === "string") {
      updates.notes = req.body.notes.trim();
    }

    const updatedClient = await Client.findOneAndUpdate(
      { _id: req.params.id, tenantId, deletedAt: null, isDeleted: { $ne: true } },
      {
        $set: {
          ...updates,
          updatedBy: req.user?.id,
        },
        $push: { auditLog: { action: "client.update", by: req.user?.id, note: "Updated client details" } },
      },
      { new: true, runValidators: true }
    );

    if (!updatedClient) return res.status(404).json({ message: "Client not found" });
    return res.json(updatedClient);
  } catch (error) {
    return next(error);
  }
};
router.put("/clients/:id", updateClientById);
router.patch("/clients/:id", updateClientById);
router.use("/clients", buildCrudRouter({ model: Client, entity: "client" }));
router.use("/activities", buildCrudRouter({ model: Activity, entity: "activity" }));
router.use("/site-visits", buildCrudRouter({ model: SiteVisit, entity: "site_visit" }));
const computeQuotationTotals = (payload = {}) => {
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const items = rawItems.map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const total = Number((quantity * unitPrice).toFixed(2));
    return {
      description: item.description || "",
      quantity,
      unitPrice,
      total,
    };
  });

  const subtotal = Number(items.reduce((sum, item) => sum + Number(item.total || 0), 0).toFixed(2));
  const discountType = payload.discount?.type === "percentage" ? "percentage" : "fixed";
  const discountValue = Number(payload.discount?.value || 0);
  const discountAmount = discountType === "percentage"
    ? Number(((subtotal * discountValue) / 100).toFixed(2))
    : Number(discountValue.toFixed(2));
  const tax = Number(payload.tax || 0);
  const grandTotal = Number((subtotal - discountAmount + tax).toFixed(2));

  return {
    items,
    subtotal,
    discount: {
      type: discountType,
      value: discountValue,
      amount: discountAmount,
    },
    tax,
    grandTotal,
  };
};

router.get("/quotations", async (req, res, next) => {
  try {
    const docs = await Quotation.find({ tenantId: req.tenantId, deletedAt: null }).sort({ createdAt: -1 });
    const quotationObjects = docs.map((doc) => (typeof doc.toObject === "function" ? doc.toObject() : doc));
    const clientIds = [...new Set(quotationObjects.map((doc) => String(doc.clientId || "")).filter(Boolean))];

    const clients = clientIds.length
      ? await Client.find({
          _id: { $in: clientIds },
          tenantId: req.tenantId,
          deletedAt: null,
          isDeleted: { $ne: true },
        })
          .select("_id name email")
          .lean()
      : [];

    const clientMap = Object.fromEntries(clients.map((client) => [String(client._id), client]));

    const enrichedQuotations = quotationObjects.map((quotation) => {
      const rawClientId = String(quotation.clientId || "");
      const client = clientMap[rawClientId];
      return {
        ...quotation,
        clientId: client
          ? { _id: String(client._id), name: client.name || "", email: client.email || "" }
          : quotation.clientId,
      };
    });

    res.json(enrichedQuotations);
  } catch (error) {
    next(error);
  }
});

router.get("/quotations/:id", async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const quotation = await Quotation.findOne({ _id: req.params.id, tenantId, deletedAt: null });
    if (!quotation) return res.status(404).json({ message: "Quotation not found" });
    const [client, project] = await Promise.all([
      quotation.clientId ? Client.findOne({ _id: quotation.clientId, tenantId, deletedAt: null }) : null,
      quotation.projectId ? Project.findOne({ _id: quotation.projectId, tenantId, deletedAt: null }) : null,
    ]);
    res.json({
      quotation,
      client,
      project,
      clientName: client?.name || "",
      projectName: project?.name || "",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/quotations", async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return next(new AppError("Tenant context is required", 400));
    const clientId = String(req.body?.clientId || "").trim();
    const projectId = String(req.body?.projectId || "").trim();
    if (!clientId) return res.status(400).json({ message: "clientId is required" });
    if (!projectId) return res.status(400).json({ message: "projectId is required" });
    await ensureClientProjectLink({ tenantId, clientId, projectId });

    const calculated = computeQuotationTotals(req.body);
    const payload = {
      ...req.body,
      clientId,
      projectId,
      ...calculated,
      status: "draft",
      tenantId,
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
      auditLog: [{ action: "quotation.create", by: req.user?.id, note: "Created quotation" }],
    };
    const doc = await Quotation.create(payload);
    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
});

router.put("/quotations/:id", async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return next(new AppError("Tenant context is required", 400));
    const clientId = String(req.body?.clientId || "").trim();
    const projectId = String(req.body?.projectId || "").trim();
    if (!clientId) return res.status(400).json({ message: "clientId is required" });
    if (!projectId) return res.status(400).json({ message: "projectId is required" });
    await ensureClientProjectLink({ tenantId, clientId, projectId });

    const calculated = computeQuotationTotals(req.body);
    const doc = await Quotation.findOneAndUpdate(
      { _id: req.params.id, tenantId, deletedAt: null },
      {
        ...req.body,
        clientId,
        projectId,
        ...calculated,
        updatedBy: req.user?.id,
        $push: { auditLog: { action: "quotation.update", by: req.user?.id, note: "Updated quotation" } },
      },
      { new: true }
    );
    res.json(doc);
  } catch (error) {
    next(error);
  }
});

router.patch("/quotations/:id/approve", async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return next(new AppError("Tenant context is required", 400));
    const before = await Quotation.findOne({ _id: req.params.id, tenantId, deletedAt: null });
    if (!before) return res.status(404).json({ message: "Quotation not found" });
    if (before.projectId == null || String(before.projectId).trim() === "") {
      return res.status(400).json({
        message: "Quotation must be linked to a project before approval.",
      });
    }

    const doc = await Quotation.findOneAndUpdate(
      { _id: req.params.id, tenantId, deletedAt: null },
      {
        status: "approved",
        updatedBy: req.user?.id,
        $push: {
          auditLog: {
            action: "quotation.approve",
            by: req.user?.id,
            note: "Approved quotation",
          },
        },
      },
      { new: true }
    );

    if (!doc) return res.status(404).json({ message: "Quotation not found" });

    const invoice = await createInvoiceFromQuotation({
      quotation: doc,
      req,
      note: "Auto-created when quotation approved",
    });
    const out = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
    out.invoice = invoice;
    res.json(out);
  } catch (error) {
    next(error);
  }
});

router.delete("/quotations/:id", async (req, res, next) => {
  try {
    const doc = await Quotation.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, deletedAt: null },
      {
        deletedAt: new Date(),
        updatedBy: req.user?.id,
        $push: { auditLog: { action: "quotation.delete", by: req.user?.id, note: "Soft deleted quotation" } },
      },
      { new: true }
    );
    res.json({ message: "Deleted", doc });
  } catch (error) {
    next(error);
  }
});

router.get("/clients/:id/details", async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const client = await Client.findOne({ _id: req.params.id, tenantId, deletedAt: null });
    if (!client) return res.status(404).json({ message: "Client not found" });

    const projects = await Project.find({ clientId: String(client._id), tenantId, deletedAt: null }).sort({ createdAt: -1 });
    const quotations = await Quotation.find({ clientId: String(client._id), tenantId, deletedAt: null }).sort({
      createdAt: -1,
    });

    const timelineFromAudit = (entity, docs) =>
      docs.flatMap((doc) =>
        (doc.auditLog || []).map((entry) => ({
          at: entry.at || doc.updatedAt || doc.createdAt,
          action: entry.action || `${entity}.update`,
          note: entry.note || "",
          by: entry.by || null,
          entity,
          entityId: String(doc._id),
          entityName: doc.name || null,
        }))
      );

    const timeline = [
      ...timelineFromAudit("client", [client]),
      ...timelineFromAudit("project", projects),
      ...timelineFromAudit("quotation", quotations),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const totalQuoted = quotations.reduce(
      (sum, q) => sum + Number(q.grandTotal ?? q.subtotal ?? 0),
      0
    );

    res.json({
      client,
      stats: {
        totalProjects: projects.length,
        totalQuotations: quotations.length,
        totalQuoted,
      },
      projects,
      quotations,
      timeline,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:id/details", async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const project = await Project.findOne({ _id: req.params.id, tenantId, deletedAt: null });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const client = project.clientId
      ? await Client.findOne({ _id: project.clientId, tenantId, deletedAt: null })
      : null;

    const quotations = await Quotation.find({ projectId: String(project._id), tenantId, deletedAt: null }).sort({ createdAt: -1 });
    const expenses = await Expense.find({ projectId: String(project._id), tenantId, deletedAt: null }).sort({ date: -1, createdAt: -1 });

    const totalQuoted = quotations.reduce((sum, q) => sum + Number(q.grandTotal ?? q.subtotal ?? 0), 0);
    const totalExpenses = Number(project.totalExpenses ?? expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0));
    const totalRevenue = Number(project.totalRevenue ?? 0);
    const progress = Number(project.progress || 0);
    const calculatedProfit = Number(project.profit ?? totalRevenue - totalExpenses);

    res.json({
      project,
      client,
      quotations,
      expenses,
      quotationSummary: {
        totalQuoted,
        quotationCount: quotations.length,
      },
      profitability: {
        totalRevenue,
        totalExpenses,
        calculatedProfit,
      },
      progress,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/projects", async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return next(new AppError("Tenant context is required", 400));
    const clientId = String(req.body?.clientId || "").trim();
    if (!clientId) return res.status(400).json({ message: "clientId is required" });
    const client = await Client.findOne({ _id: clientId, tenantId, deletedAt: null, isDeleted: { $ne: true } });
    if (!client) return res.status(404).json({ message: "Client not found" });

    const payload = {
      ...req.body,
      clientId,
      totalRevenue: Number(req.body?.totalRevenue || 0),
      totalExpenses: Number(req.body?.totalExpenses || 0),
      profit: Number(req.body?.profit || 0),
      tenantId,
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
      auditLog: [{ action: "project.create", by: req.user?.id, note: "Created project" }],
    };
    const project = await Project.create(payload);
    return res.status(201).json(project);
  } catch (error) {
    return next(error);
  }
});

router.get("/projects", async (req, res, next) => {
  try {
    const docs = await Project.find({ tenantId: req.tenantId, deletedAt: null }).sort({ createdAt: -1 });
    const projectObjects = docs.map((doc) => (typeof doc.toObject === "function" ? doc.toObject() : doc));
    const clientIds = [...new Set(projectObjects.map((doc) => String(doc.clientId || "")).filter(Boolean))];

    const clients = clientIds.length
      ? await Client.find({
          _id: { $in: clientIds },
          tenantId: req.tenantId,
          deletedAt: null,
          isDeleted: { $ne: true },
        })
          .select("_id name email")
          .lean()
      : [];

    const clientMap = Object.fromEntries(clients.map((client) => [String(client._id), client]));

    const enrichedProjects = projectObjects.map((project) => {
      const rawClientId = String(project.clientId || "");
      const client = clientMap[rawClientId];
      return {
        ...project,
        clientId: client
          ? { _id: String(client._id), name: client.name || "", email: client.email || "" }
          : project.clientId,
      };
    });

    return res.json(enrichedProjects);
  } catch (error) {
    return next(error);
  }
});

router.use("/projects", buildCrudRouter({ model: Project, entity: "project" }));
router.get("/invoices", async (req, res, next) => {
  try {
    const docs = await Invoice.find({ tenantId: req.tenantId, deletedAt: null }).sort({ createdAt: -1 });
    const invoiceObjects = docs.map((doc) => (typeof doc.toObject === "function" ? doc.toObject() : doc));

    const clientIds = [...new Set(invoiceObjects.map((doc) => String(doc.clientId || "")).filter(Boolean))];
    const projectIds = [...new Set(invoiceObjects.map((doc) => String(doc.projectId || "")).filter(Boolean))];

    const [clients, projects] = await Promise.all([
      clientIds.length
        ? Client.find({ _id: { $in: clientIds }, tenantId: req.tenantId, deletedAt: null, isDeleted: { $ne: true } })
            .select("_id name")
            .lean()
        : [],
      projectIds.length
        ? Project.find({ _id: { $in: projectIds }, tenantId: req.tenantId, deletedAt: null })
            .select("_id name")
            .lean()
        : [],
    ]);

    const clientMap = Object.fromEntries(clients.map((client) => [String(client._id), client]));
    const projectMap = Object.fromEntries(projects.map((project) => [String(project._id), project]));

    const enriched = invoiceObjects.map((invoice) => {
      const rawClientId = String(invoice.clientId || "");
      const rawProjectId = String(invoice.projectId || "");
      const client = clientMap[rawClientId] || null;
      const project = projectMap[rawProjectId] || null;
      return {
        ...invoice,
        clientId: client ? { _id: client._id, name: client.name } : { _id: invoice.clientId, name: "" },
        projectId: project ? { _id: project._id, name: project.name } : { _id: invoice.projectId, name: "" },
        clientName: client?.name || "",
        projectName: project?.name || "",
      };
    });

    res.json(enriched);
  } catch (error) {
    next(error);
  }
});
router.get("/invoices/:id", async (req, res, next) => {
  try {
    const doc = await Invoice.findOne({ _id: req.params.id, tenantId: req.tenantId, deletedAt: null });
    if (!doc) return res.status(404).json({ message: "Invoice not found" });
    res.json(doc);
  } catch (error) {
    next(error);
  }
});
router.post("/invoices", async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return next(new AppError("Tenant context is required", 400));
    const clientId = String(req.body?.clientId || "").trim();
    const projectId = String(req.body?.projectId || "").trim();
    if (!clientId) return res.status(400).json({ message: "clientId is required" });
    if (!projectId) return res.status(400).json({ message: "projectId is required" });
    await ensureClientProjectLink({ tenantId, clientId, projectId });
    const total = Number(req.body?.total ?? 0);
    if (!Number.isFinite(total) || total < 0) return res.status(400).json({ message: "total must be >= 0" });

    const requestedPaid = req.body?.status === "paid";
    const paidAmount = requestedPaid ? total : Number(req.body?.paidAmount || 0);
    const safePaidAmount = Number.isFinite(paidAmount) && paidAmount >= 0 ? Math.min(paidAmount, total) : 0;
    const remainingAmount = Math.max(total - safePaidAmount, 0);
    const status = safePaidAmount >= total ? "paid" : "unpaid";

    const doc = await Invoice.create({
      ...req.body,
      clientId,
      projectId,
      total,
      paidAmount: safePaidAmount,
      remainingAmount,
      paidAt: status === "paid" ? new Date() : null,
      tenantId,
      status,
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
      auditLog: [{ action: "invoice.create", by: req.user?.id, note: "Created invoice" }],
    });
    await syncProjectFinancialsForProject({ tenantId, projectId, userId: req.user?.id });
    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
});
router.patch("/invoices/:id/pay", async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, tenantId: req.tenantId, deletedAt: null });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const fallbackAmount = Number(invoice.remainingAmount || invoice.total || 0);
    const amount = req.body?.amount === undefined ? fallbackAmount : Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "amount must be greater than 0" });

    const total = Number(invoice.total || 0);
    const currentPaid = Number(invoice.paidAmount || 0);
    const nextPaidAmount = Math.min(currentPaid + amount, total);
    const remainingAmount = Math.max(total - nextPaidAmount, 0);
    const status = remainingAmount <= 0 ? "paid" : "unpaid";

    invoice.paidAmount = nextPaidAmount;
    invoice.remainingAmount = remainingAmount;
    invoice.status = status;
    invoice.paidAt = status === "paid" ? new Date() : invoice.paidAt;
    invoice.updatedBy = req.user?.id;
    invoice.auditLog = [
      ...(Array.isArray(invoice.auditLog) ? invoice.auditLog : []),
      { action: "invoice.pay", by: req.user?.id, note: `Payment recorded: ${amount}` },
    ];
    await invoice.save();

    await syncProjectFinancialsForProject({
      tenantId: req.tenantId,
      projectId: invoice.projectId,
      userId: req.user?.id,
    });
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});
router.get("/expenses", async (req, res, next) => {
  try {
    const filters = { tenantId: req.tenantId, deletedAt: null };
    if (req.query.projectId) filters.projectId = String(req.query.projectId);
    const docs = await Expense.find(filters).sort({ date: -1, createdAt: -1 });
    res.json(docs);
  } catch (error) {
    next(error);
  }
});
router.post("/expenses", async (req, res, next) => {
  try {
    const projectId = String(req.body?.projectId || "").trim();
    const title = String(req.body?.title || req.body?.description || "").trim();
    const description = String(req.body?.description || title).trim();
    const amount = Number(req.body?.amount || 0);
    const date = req.body?.date ? new Date(req.body.date) : new Date();
    if (!projectId) return res.status(400).json({ message: "projectId is required" });
    if (!title) return res.status(400).json({ message: "title is required" });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "amount must be greater than 0" });
    if (Number.isNaN(date.getTime())) return res.status(400).json({ message: "Invalid date" });

    const payload = {
      projectId,
      title,
      description,
      amount,
      date,
      tenantId: req.tenantId,
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
      auditLog: [{ action: "expense.create", by: req.user?.id, note: "Created expense" }],
    };
    const doc = await Expense.create(payload);
    await syncProjectFinancialsForProject({ tenantId: req.tenantId, projectId, userId: req.user?.id });
    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
});
router.put("/expenses/:id", async (req, res, next) => {
  try {
    const updates = {};
    if (typeof req.body?.title === "string") {
      const title = req.body.title.trim();
      if (!title) return res.status(400).json({ message: "title is required" });
      updates.title = title;
    }
    if (typeof req.body?.description === "string") {
      const description = req.body.description.trim();
      if (!description) return res.status(400).json({ message: "description is required" });
      updates.description = description;
    }
    if (req.body?.amount !== undefined) {
      const amount = Number(req.body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "amount must be greater than 0" });
      updates.amount = amount;
    }
    if (req.body?.date !== undefined) {
      const parsedDate = new Date(req.body.date);
      if (Number.isNaN(parsedDate.getTime())) return res.status(400).json({ message: "Invalid date" });
      updates.date = parsedDate;
    }
    const doc = await Expense.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, deletedAt: null },
      {
        ...updates,
        updatedBy: req.user?.id,
        $push: { auditLog: { action: "expense.update", by: req.user?.id, note: "Updated expense" } },
      },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: "Expense not found" });
    await syncProjectFinancialsForProject({ tenantId: req.tenantId, projectId: doc.projectId, userId: req.user?.id });
    res.json(doc);
  } catch (error) {
    next(error);
  }
});
router.delete("/expenses/:id", async (req, res, next) => {
  try {
    const doc = await Expense.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, deletedAt: null },
      {
        deletedAt: new Date(),
        updatedBy: req.user?.id,
        $push: { auditLog: { action: "expense.delete", by: req.user?.id, note: "Deleted expense" } },
      },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: "Expense not found" });
    await syncProjectFinancialsForProject({ tenantId: req.tenantId, projectId: doc.projectId, userId: req.user?.id });
    res.json({ message: "Deleted", doc });
  } catch (error) {
    next(error);
  }
});

router.get("/reports/project/:id", async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenantId: req.tenantId, deletedAt: null });
    if (!project) return res.status(404).json({ message: "Project not found" });
    const snapshot = await syncProjectFinancialsForProject({
      tenantId: req.tenantId,
      projectId: project._id,
      userId: req.user?.id,
    });
    res.json({
      projectId: String(project._id),
      revenue: snapshot.totalRevenue,
      expenses: snapshot.totalExpenses,
      profit: snapshot.profit,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/reports/monthly", async (req, res, next) => {
  try {
    const now = new Date();
    const year = Number(req.query.year || now.getFullYear());
    const monthParam = req.query.month !== undefined ? Number(req.query.month) : null;
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
    const tenantId = req.tenantId;

    const [invoices, expenses] = await Promise.all([
      Invoice.find({ tenantId, deletedAt: null, paidAt: { $gte: start, $lt: end } }),
      Expense.find({ tenantId, deletedAt: null, date: { $gte: start, $lt: end } }),
    ]);
    const monthlyBreakdown = Array.from({ length: 12 }, (_unused, index) => ({
      month: index + 1,
      revenue: 0,
      expenses: 0,
      profit: 0,
    }));
    invoices.forEach((invoice) => {
      const paidDate = invoice.paidAt ? new Date(invoice.paidAt) : null;
      if (!paidDate || Number.isNaN(paidDate.getTime())) return;
      const monthIndex = paidDate.getUTCMonth();
      monthlyBreakdown[monthIndex].revenue += Number(invoice.paidAmount ?? invoice.total ?? 0);
    });
    expenses.forEach((expense) => {
      const expenseDate = expense.date ? new Date(expense.date) : null;
      if (!expenseDate || Number.isNaN(expenseDate.getTime())) return;
      const monthIndex = expenseDate.getUTCMonth();
      monthlyBreakdown[monthIndex].expenses += Number(expense.amount || 0);
    });
    monthlyBreakdown.forEach((row) => {
      row.profit = row.revenue - row.expenses;
    });
    const filtered =
      monthParam && monthParam >= 1 && monthParam <= 12
        ? [monthlyBreakdown[monthParam - 1]]
        : monthlyBreakdown;
    const totalRevenue = filtered.reduce((sum, row) => sum + row.revenue, 0);
    const totalExpenses = filtered.reduce((sum, row) => sum + row.expenses, 0);
    const totalProfit = totalRevenue - totalExpenses;

    res.json({
      period: { year, month: monthParam },
      totals: {
        totalRevenue,
        totalExpenses,
        totalProfit,
      },
      breakdown: filtered,
      counts: { invoices: invoices.length, expenses: expenses.length },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/reports/yearly", async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    const [invoices, expenses] = await Promise.all([
      Invoice.find({ tenantId, deletedAt: null, paidAt: { $ne: null } }),
      Expense.find({ tenantId, deletedAt: null }),
    ]);
    const yearlyMap = new Map();
    invoices.forEach((invoice) => {
      const paidDate = invoice.paidAt ? new Date(invoice.paidAt) : null;
      if (!paidDate || Number.isNaN(paidDate.getTime())) return;
      const year = paidDate.getUTCFullYear();
      const row = yearlyMap.get(year) || { year, revenue: 0, expenses: 0, profit: 0 };
      row.revenue += Number(invoice.paidAmount ?? invoice.total ?? 0);
      yearlyMap.set(year, row);
    });
    expenses.forEach((expense) => {
      const expenseDate = expense.date ? new Date(expense.date) : null;
      if (!expenseDate || Number.isNaN(expenseDate.getTime())) return;
      const year = expenseDate.getUTCFullYear();
      const row = yearlyMap.get(year) || { year, revenue: 0, expenses: 0, profit: 0 };
      row.expenses += Number(expense.amount || 0);
      yearlyMap.set(year, row);
    });
    const breakdown = [...yearlyMap.values()].sort((a, b) => a.year - b.year).map((row) => ({
      ...row,
      profit: row.revenue - row.expenses,
    }));
    const totalRevenue = breakdown.reduce((sum, row) => sum + row.revenue, 0);
    const totalExpenses = breakdown.reduce((sum, row) => sum + row.expenses, 0);
    const totalProfit = totalRevenue - totalExpenses;

    res.json({
      totals: {
        totalRevenue,
        totalExpenses,
        totalProfit,
      },
      breakdown,
      counts: { invoices: invoices.length, expenses: expenses.length },
    });
  } catch (error) {
    next(error);
  }
});

router.use("/inventory", buildCrudRouter({ model: InventoryItem, entity: "inventory" }));
router.use("/tickets", buildCrudRouter({ model: Ticket, entity: "ticket" }));

router.get("/settings", async (req, res, next) => {
  try {
    let settings = await Settings.findOne({ tenantId: req.tenantId, deletedAt: null });
    if (!settings) {
      settings = await Settings.create({
        tenantId: req.tenantId,
        currency: "SDG",
        locale: "en-US",
        companyName: "Config Engineering",
        companyAddress: "Sudan, Khartoum - Omdurman, Al Abraj St.",
        companyPhone: "+249 912679849, +249 124000486",
        createdBy: req.user?.id,
        updatedBy: req.user?.id,
      });
    }
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.put("/settings", async (req, res, next) => {
  try {
    const incomingCurrency = typeof req.body?.currency === "string" ? req.body.currency.trim().toUpperCase() : undefined;
    const incomingLocale = typeof req.body?.locale === "string" ? req.body.locale.trim() : undefined;
    const incomingCompanyName = typeof req.body?.companyName === "string" ? req.body.companyName.trim() : undefined;
    const incomingCompanyAddress = typeof req.body?.companyAddress === "string" ? req.body.companyAddress.trim() : undefined;
    const incomingCompanyPhone = typeof req.body?.companyPhone === "string" ? req.body.companyPhone.trim() : undefined;
    const incomingCompanyLogoUrl = typeof req.body?.companyLogoUrl === "string" ? req.body.companyLogoUrl.trim() : undefined;
    const incomingBackgroundImageUrl = typeof req.body?.backgroundImageUrl === "string" ? req.body.backgroundImageUrl.trim() : undefined;
    const updates = {
      ...(incomingCurrency ? { currency: incomingCurrency } : {}),
      ...(incomingLocale ? { locale: incomingLocale } : {}),
      ...(incomingCompanyName !== undefined ? { companyName: incomingCompanyName } : {}),
      ...(incomingCompanyAddress !== undefined ? { companyAddress: incomingCompanyAddress } : {}),
      ...(incomingCompanyPhone !== undefined ? { companyPhone: incomingCompanyPhone } : {}),
      ...(incomingCompanyLogoUrl !== undefined ? { companyLogoUrl: incomingCompanyLogoUrl } : {}),
      ...(incomingBackgroundImageUrl !== undefined ? { backgroundImageUrl: incomingBackgroundImageUrl } : {}),
      updatedBy: req.user?.id,
    };

    const settings = await Settings.findOneAndUpdate(
      { tenantId: req.tenantId, deletedAt: null },
      {
        $set: updates,
        $setOnInsert: {
          tenantId: req.tenantId,
          currency: "SDG",
          locale: "en-US",
          companyName: "Config Engineering",
          companyAddress: "Sudan, Khartoum - Omdurman, Al Abraj St.",
          companyPhone: "+249 912679849, +249 124000486",
          createdBy: req.user?.id,
        },
      },
      { new: true, upsert: true }
    );

    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.post("/settings/logo", logoUpload.single("logo"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Logo file is required" });
    const logoPath = `/uploads/${req.file.filename}`;
    const settings = await Settings.findOneAndUpdate(
      { tenantId: req.tenantId, deletedAt: null },
      {
        $set: {
          companyLogoUrl: logoPath,
          updatedBy: req.user?.id,
        },
        $setOnInsert: {
          tenantId: req.tenantId,
          currency: "SDG",
          locale: "en-US",
          companyName: "Config Engineering",
          companyAddress: "Sudan, Khartoum - Omdurman, Al Abraj St.",
          companyPhone: "+249 912679849, +249 124000486",
          createdBy: req.user?.id,
        },
      },
      { new: true, upsert: true }
    );
    res.json({ message: "Logo uploaded", companyLogoUrl: logoPath, settings });
  } catch (error) {
    next(error);
  }
});

router.get("/users", async (req, res, next) => {
  try {
    const users = await User.find({ tenantId: req.tenantId }).select("-passwordHash -resetToken -resetTokenExpiry").sort({ createdAt: -1 });
    const normalized = users.map((user) => ({
      ...user.toObject(),
      role: user.role === "company_admin" ? "admin" : "employee",
    }));
    res.json(normalized);
  } catch (error) {
    next(error);
  }
});

router.get("/users/me", async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.user.id, tenantId: req.tenantId }).select("-passwordHash -resetToken -resetTokenExpiry");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      ...user.toObject(),
      role: user.role === "company_admin" ? "admin" : "employee",
    });
  } catch (error) {
    next(error);
  }
});

router.put("/users/me", async (req, res, next) => {
  try {
    const updates = {};
    if (typeof req.body?.fullName === "string" && req.body.fullName.trim()) {
      updates.fullName = req.body.fullName.trim();
      updates.name = updates.fullName;
    }
    if (typeof req.body?.email === "string" && req.body.email.trim()) {
      const email = req.body.email.trim().toLowerCase();
      const taken = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (taken) return res.status(400).json({ message: "Email already in use" });
      updates.email = email;
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "Nothing to update" });
    }
    const user = await User.findOneAndUpdate({ _id: req.user.id, tenantId: req.tenantId }, updates, { new: true }).select("-passwordHash -resetToken -resetTokenExpiry");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      ...user.toObject(),
      role: user.role === "company_admin" ? "admin" : "employee",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/users", async (req, res, next) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const role = String(req.body?.role || "employee").trim().toLowerCase();
    const mappedRole = role === "admin" ? "company_admin" : "sales";
    const password = String(req.body?.password || "Password123!");
    if (!fullName || !email) return res.status(400).json({ message: "fullName and email are required" });
    if (!["admin", "employee"].includes(role)) return res.status(400).json({ message: "role must be admin or employee" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already exists" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      tenantId: req.tenantId,
      fullName,
      email,
      role: mappedRole,
      passwordHash,
    });
    res.status(201).json({
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role,
      tenantId: user.tenantId,
    });
  } catch (error) {
    next(error);
  }
});

router.put("/users/:id", async (req, res, next) => {
  try {
    const updates = {};
    if (typeof req.body?.fullName === "string") updates.fullName = req.body.fullName.trim();
    if (typeof req.body?.role === "string") {
      const role = req.body.role.trim().toLowerCase();
      updates.role = role === "admin" ? "company_admin" : "sales";
    }
    if (typeof req.body?.email === "string") updates.email = req.body.email.trim().toLowerCase();
    const user = await User.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId }, updates, { new: true }).select("-passwordHash -resetToken -resetTokenExpiry");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      ...user.toObject(),
      role: user.role === "company_admin" ? "admin" : "employee",
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/users/:id", async (req, res, next) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (error) {
    next(error);
  }
});

router.post("/users/:id/reset-password", async (req, res, next) => {
  try {
    const newPassword = String(req.body?.newPassword || "Password123!");
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { passwordHash, resetToken: null, resetTokenExpiry: null },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Password reset successful" });
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard/kpis", async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const [leads, projects, quotations, invoices, tickets] = await Promise.all([
      Lead.countDocuments({ tenantId, deletedAt: null }),
      Project.countDocuments({ tenantId, deletedAt: null }),
      Quotation.countDocuments({ tenantId, deletedAt: null }),
      Invoice.countDocuments({ tenantId, deletedAt: null }),
      Ticket.countDocuments({ tenantId, deletedAt: null }),
    ]);
    res.json({ leads, projects, quotations, invoices, tickets });
  } catch (error) {
    next(error);
  }
});

router.get("/search", async (req, res, next) => {
  try {
    const q = req.query.q || "";
    const tenantId = req.tenantId;
    const [leads, clients, projects] = await Promise.all([
      Lead.find({ tenantId, name: { $regex: q, $options: "i" }, deletedAt: null }).limit(5),
      Client.find({ tenantId, name: { $regex: q, $options: "i" }, deletedAt: null }).limit(5),
      Project.find({ tenantId, name: { $regex: q, $options: "i" }, deletedAt: null }).limit(5),
    ]);
    res.json({ leads, clients, projects });
  } catch (error) {
    next(error);
  }
});

module.exports = {
  moduleRouter: router,
  models: {
    Lead,
    Client,
    Counter,
    Activity,
    SiteVisit,
    Quotation,
    Project,
    Invoice,
    Expense,
    InventoryItem,
    Ticket,
    Settings,
  },
};
