const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");
const { makeEntityModel, buildCrudRouter } = require("./shared");
const { incrementClientCounter, Counter } = require("./clients/counter.model");
const { clientNumberField } = require("./clients/client.model");
const { AppError } = require("../utils/appError");
const { requireAdmin } = require("../middlewares/requireAdmin");
const { User } = require("./auth/auth.routes");
const { sendMulticast } = require("../services/fcm");
const { COMPANY } = require("../config/company");

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
const inventoryImportUpload = multer({ storage: multer.memoryStorage() });

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
const Visit = makeEntityModel("Visit", {
  technicianId: { type: String, required: true, trim: true },
  projectId: { type: String, required: true, trim: true, index: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  time: { type: Date, required: true, default: Date.now },
  accuracy: { type: Number, default: null },
  distance: { type: Number, default: 0 },
  status: { type: String, enum: ["ON_SITE", "OUTSIDE"], default: "OUTSIDE" },
});
const Quotation = makeEntityModel("Quotation", {
  clientId: { type: String, default: "" },
  customerKind: { type: String, enum: ["existing", "walkin"], default: "existing" },
  walkInCustomerName: { type: String, trim: true, default: "" },
  walkInCustomerPhone: { type: String, trim: true, default: "" },
  walkInCustomerEmail: { type: String, trim: true, default: "" },
  customerName: { type: String, trim: true, default: "" },
  customerPhone: { type: String, trim: true, default: "" },
  customerEmail: { type: String, trim: true, default: "" },
  saleType: { type: String, enum: ["stock", "external_purchase"], default: "stock" },
  purchaseCost: { type: Number, min: 0, default: 0 },
  supplierName: { type: String, trim: true, default: "" },
  supplierPhone: { type: String, trim: true, default: "" },
  projectId: { type: String, default: null },
  source: { type: String, enum: ["project", "inventory"], default: "project" },
  quotationNo: { type: String, trim: true },
  /** draft | sent | approved | rejected | converted_to_project */
  status: { type: String, default: "draft" },
  items: [
    {
      productId: { type: String, default: "" },
      name: { type: String, trim: true, default: "" },
      description: { type: String, trim: true },
      quantity: { type: Number, default: 1 },
      price: { type: Number, default: 0 },
      unitPrice: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      sourceType: { type: String, enum: ["inventory", "market_purchase", "service"], default: "inventory" },
      purchasePrice: { type: Number, min: 0, default: 0 },
      serviceCost: { type: Number, min: 0, default: 0 },
      supplier: { type: String, trim: true, default: "" },
      purchaseReference: { type: String, trim: true, default: "" },
      addToInventory: { type: Boolean, default: false },
      sectionIndex: { type: Number, default: 0 },
    },
  ],
  sections: [
    {
      title: { type: String, trim: true, default: "" },
      notes: { type: String, trim: true, default: "" },
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
  projectType: { type: String, trim: true, default: "" },
  cctvType: { type: String, trim: true, default: "" },
});
const Project = makeEntityModel("Project", {
  clientId: { type: String, required: true },
  quotationId: { type: String, default: null, index: true },
  status: { type: String, enum: ["active", "partial", "completed"], default: "active" },
  milestone: String,
  progress: Number,
  budget: Number,
  projectCost: Number,
  profit: Number,
  totalRevenue: { type: Number, default: 0 },
  totalExpenses: { type: Number, default: 0 },
  startDate: Date,
  endDate: Date,
  projectType: { type: String, trim: true, default: "Network" },
  cctvType: { type: String, trim: true, default: "" },
});
const Invoice = makeEntityModel("Invoice", {
  clientId: { type: String, required: true },
  customerName: { type: String, trim: true, default: "" },
  customerPhone: { type: String, trim: true, default: "" },
  customerEmail: { type: String, trim: true, default: "" },
  saleType: { type: String, enum: ["stock", "external_purchase"], default: "stock" },
  purchaseCost: { type: Number, min: 0, default: 0 },
  supplierName: { type: String, trim: true, default: "" },
  supplierPhone: { type: String, trim: true, default: "" },
  projectId: { type: String, default: null },
  source: { type: String, enum: ["project", "inventory"], default: "project" },
  quotationId: { type: String },
  items: [
    {
      productId: { type: String, default: "" },
      name: { type: String, trim: true, default: "" },
      description: { type: String, trim: true, default: "" },
      quantity: { type: Number, default: 1 },
      price: { type: Number, default: 0 },
      unitPrice: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      sourceType: { type: String, enum: ["inventory", "market_purchase", "service"], default: "inventory" },
      purchasePrice: { type: Number, min: 0, default: 0 },
      serviceCost: { type: Number, min: 0, default: 0 },
      supplier: { type: String, trim: true, default: "" },
      purchaseReference: { type: String, trim: true, default: "" },
      addToInventory: { type: Boolean, default: false },
    },
  ],
  invoiceNo: { type: String, trim: true },
  total: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number, default: 0 },
  payments: [
    {
      amount: { type: Number, default: 0 },
      date: { type: Date, default: Date.now },
    },
  ],
  paidAt: { type: Date, default: null },
  status: { type: String, enum: ["draft", "unpaid", "partial", "paid"], default: "draft" },
  stockDeducted: { type: Boolean, default: false },
  profit: { type: Number, default: 0 },
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
const InventoryItemSchema = new mongoose.Schema(
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
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    category: { type: String, required: true, trim: true },
    supplier: { type: String, trim: true, default: "" },
    price: { type: Number, required: true, min: 0, default: 0 },
    sellingPrice: { type: Number, min: 0, default: 0 },
    cost: { type: Number, min: 0, default: 0 },
    costPrice: { type: Number, min: 0, default: 0 },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    minQuantity: { type: Number, required: true, min: 0, default: 0 },
    unit: { type: String, required: true, trim: true, default: "pcs" },
    status: { type: String, default: "active" },
  },
  { timestamps: true }
);
InventoryItemSchema.index({ tenantId: 1, name: 1 });
InventoryItemSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
const InventoryItem = mongoose.models.InventoryItem || mongoose.model("InventoryItem", InventoryItemSchema);
const InventoryUsageSchema = new mongoose.Schema(
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
    inventoryItemId: { type: String, required: true, index: true },
    quotationId: { type: String, index: true },
    invoiceId: { type: String, index: true },
    projectId: { type: String, index: true },
    clientId: { type: String, index: true },
    sku: { type: String, trim: true, uppercase: true },
    productName: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    unitPrice: { type: Number, min: 0, default: 0 },
    amount: { type: Number, min: 0, default: 0 },
    source: { type: String, enum: ["quotation", "invoice"], default: "quotation" },
    status: { type: String, default: "planned" },
  },
  { timestamps: true }
);
InventoryUsageSchema.index(
  { tenantId: 1, inventoryItemId: 1, quotationId: 1, source: 1, deletedAt: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
const InventoryUsage = mongoose.models.InventoryUsage || mongoose.model("InventoryUsage", InventoryUsageSchema);
const Ticket = makeEntityModel("Ticket", { priority: String, slaStatus: String, assignedTo: String });
const SettingsSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    currency: { type: String, default: "SDG", trim: true },
    locale: { type: String, default: "en-US", trim: true },
    companyName: { type: String, default: COMPANY.name, trim: true },
    companyAddress: { type: String, default: COMPANY.address, trim: true },
    companyPhone: { type: String, default: COMPANY.phone, trim: true },
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

const generateDocumentNo = async ({ model, prefix, tenantId }) => {
  const year = new Date().getFullYear();
  const count = await model.countDocuments({
    tenantId,
    deletedAt: null,
    createdAt: {
      $gte: new Date(`${year}-01-01`),
      $lt: new Date(`${year + 1}-01-01`),
    },
  });
  const seq = String(count + 1).padStart(5, "0");
  return `${prefix}-${year}-${seq}`;
};

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

/** When a quotation has no project, still verify the client exists (builder allows client-only quotes). */
const ensureQuotationClientContext = async ({ tenantId, clientId, projectId }) => {
  const pid = String(projectId || "").trim();
  if (pid) {
    await ensureClientProjectLink({ tenantId, clientId, projectId: pid });
    return;
  }
  const client = await Client.findOne({ _id: clientId, tenantId, deletedAt: null, isDeleted: { $ne: true } });
  if (!client) throw new AppError("Client not found", 404);
};

const resolveClientForSale = async ({ req, tenantId, source, clientIdRaw, walkInCustomer }) => {
  const clientId = String(clientIdRaw || "").trim();
  if (clientId) return clientId;
  if (source !== "inventory") return "";
  const name = String(walkInCustomer?.name || "").trim();
  if (!name) return "";
  // Keep walk-in sales independent from the client database.
  return String(new mongoose.Types.ObjectId());
};

const resolveQuotationClientAndProject = ({
  customerKind,
  clientIdRaw,
  projectIdRaw,
  walkInName,
  walkInPhone,
  walkInEmail,
}) => {
  const isWalkIn = String(customerKind || "").toLowerCase() === "walkin";
  const walkName = String(walkInName || "").trim();
  const clientId = String(clientIdRaw || "").trim();
  const projectId = String(projectIdRaw || "").trim();

  if (isWalkIn) {
    if (!walkName) {
      return { error: new AppError("Customer name is required for walk-in quotations", 400) };
    }
    const existingId = String(clientIdRaw || "").trim();
    const stableClientId =
      existingId && mongoose.Types.ObjectId.isValid(existingId)
        ? existingId
        : String(new mongoose.Types.ObjectId());
    return {
      isWalkIn: true,
      clientId: stableClientId,
      projectId: "",
      walkInCustomerName: walkName,
      walkInCustomerPhone: String(walkInPhone || "").trim(),
      walkInCustomerEmail: String(walkInEmail || "").trim().toLowerCase(),
      customerName: walkName,
      customerPhone: String(walkInPhone || "").trim(),
      customerEmail: String(walkInEmail || "").trim().toLowerCase(),
    };
  }

  if (!clientId) {
    return { error: new AppError("clientId is required", 400) };
  }
  return {
    isWalkIn: false,
    clientId,
    projectId,
    walkInCustomerName: "",
    walkInCustomerPhone: "",
    walkInCustomerEmail: "",
  };
};

const QUOTATION_ALLOWED_STATUSES = new Set(["draft", "sent", "approved", "rejected", "converted_to_project"]);

const normalizeQuotationStatus = (value, fallback = "draft") => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (raw === "convertedtoproject") return "converted_to_project";
  if (QUOTATION_ALLOWED_STATUSES.has(raw)) return raw;
  return fallback;
};

const calculateInvoiceProfitFromItems = async ({ tenantId, items = [] }) => {
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) return 0;
  const inventoryBacked = safeItems.filter((item) => {
    const st = String(item?.sourceType || "").toLowerCase();
    return st !== "market_purchase" && st !== "service";
  });
  const productIds = [...new Set(inventoryBacked.map((item) => String(item?.productId || "").trim()).filter(Boolean))];

  const products = productIds.length
    ? await InventoryItem.find({
        tenantId,
        _id: { $in: productIds },
        deletedAt: null,
      })
        .select("_id cost")
        .lean()
    : [];
  const productCostMap = Object.fromEntries(products.map((product) => [String(product._id), Number(product.cost || 0)]));

  const totalProfit = safeItems.reduce((sum, item) => {
    const qty = Number(item?.quantity || item?.qty || 0);
    if (!Number.isFinite(qty) || qty <= 0) return sum;
    const sellPrice = Number(item?.unitPrice ?? item?.price ?? 0);
    const st = String(item?.sourceType || "").toLowerCase();
    if (st === "market_purchase") {
      const buy = Number(item?.purchasePrice ?? 0);
      return sum + (sellPrice - buy) * qty;
    }
    if (st === "service") {
      const cost = Number(item?.serviceCost ?? 0);
      return sum + (sellPrice - cost) * qty;
    }
    const productId = String(item?.productId || "").trim();
    if (!productId) return sum;
    const purchaseCost = Number(productCostMap[productId] || 0);
    return sum + (sellPrice - purchaseCost) * qty;
  }, 0);

  return Number(totalProfit.toFixed(2));
};

const calculateInvoiceProfitFromQuotation = async ({ tenantId, quotationId }) => {
  if (!quotationId) return 0;
  const quotation = await Quotation.findOne({ _id: String(quotationId), tenantId, deletedAt: null }).lean();
  if (!quotation) return 0;
  const items = Array.isArray(quotation.items) ? quotation.items : [];
  return calculateInvoiceProfitFromItems({ tenantId, items });
};

/** COGS from quotation lines linked to a project (inventory cost + market purchase price + service cost). */
const sumProcurementCostFromQuotations = async ({ tenantId, quotations = [] }) => {
  const allItems = quotations.flatMap((q) => (Array.isArray(q.items) ? q.items : []));
  if (!allItems.length) return 0;
  const invLines = allItems.filter((item) => {
    const st = String(item?.sourceType || "").toLowerCase();
    return st !== "market_purchase" && st !== "service";
  });
  const productIds = [...new Set(invLines.map((item) => String(item?.productId || "").trim()).filter(Boolean))];
  const products = productIds.length
    ? await InventoryItem.find({ tenantId, _id: { $in: productIds }, deletedAt: null }).select("_id cost").lean()
    : [];
  const costMap = Object.fromEntries(products.map((p) => [String(p._id), Number(p.cost || 0)]));
  let sum = 0;
  for (const item of allItems) {
    const st = String(item?.sourceType || "").toLowerCase();
    const qty = Number(item?.quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (st === "market_purchase") {
      sum += Number(item.purchasePrice || 0) * qty;
      continue;
    }
    if (st === "service") {
      sum += Number(item.serviceCost || 0) * qty;
      continue;
    }
    const pid = String(item?.productId || "").trim();
    if (pid) sum += Number(costMap[pid] || 0) * qty;
  }
  return Number(sum.toFixed(2));
};

/** On create only: optional checkbox adds market lines into inventory (never automatic on update). */
const applyMarketPurchaseInventoryAdds = async ({ tenantId, quotation, userId }) => {
  const q = quotation?.toObject ? quotation.toObject() : quotation;
  const items = Array.isArray(q?.items) ? q.items : [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (String(item.sourceType || "").toLowerCase() !== "market_purchase") continue;
    if (!item.addToInventory) continue;
    const name = String(item.name || item.description || "").trim();
    if (!name) continue;
    const qty = Number(item.quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const cost = Number(item.purchasePrice || 0);
    const sell = Number(item.unitPrice ?? item.price ?? 0);
    const sku = `MP-${String(q._id).slice(-8)}-${i + 1}-${Date.now().toString(36)}`.toUpperCase().slice(0, 40);
    try {
      await InventoryItem.create({
        tenantId,
        name,
        sku,
        category: "Market Purchase",
        supplier: String(item.supplier || ""),
        price: sell,
        cost,
        quantity: qty,
        minQuantity: 0,
        unit: "pcs",
        createdBy: userId,
        updatedBy: userId,
        auditLog: [
          {
            action: "inventory.create_from_market_quotation",
            by: userId,
            note: `From quotation ${q.quotationNo || q._id}`,
          },
        ],
      });
    } catch (err) {
      if (err?.code === 11000) continue;
      throw err;
    }
  }
};

const normalizeInventorySaleItems = async ({ tenantId, items = [], enforceInventoryPrice = false }) => {
  const safeItems = Array.isArray(items) ? items : [];
  const productIds = [...new Set(safeItems.map((item) => String(item?.productId || "").trim()).filter(Boolean))];
  if (!productIds.length) return [];
  const products = await InventoryItem.find({
    tenantId,
    _id: { $in: productIds },
    deletedAt: null,
  })
    .select("_id name price")
    .lean();
  const productMap = Object.fromEntries(products.map((product) => [String(product._id), product]));

  return safeItems
    .map((item) => {
      const productId = String(item?.productId || "").trim();
      if (!productId) return null;
      const product = productMap[productId];
      if (!product) throw new AppError("Each sale item must reference a valid inventory product.", 400);
      const quantity = Number(item?.quantity || item?.qty || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) return null;
      const requestedPrice = Number(item?.unitPrice ?? item?.price ?? product.price ?? 0);
      const unitPrice = enforceInventoryPrice ? Number(product.price ?? 0) : (Number.isFinite(requestedPrice) ? requestedPrice : 0);
      const total = Number((quantity * unitPrice).toFixed(2));
      const resolvedName = String(product.name || item?.name || item?.description || "").trim();
      return {
        productId,
        name: resolvedName,
        description: resolvedName,
        quantity,
        price: unitPrice,
        unitPrice,
        total,
      };
    })
    .filter(Boolean);
};

const deductInventoryForInvoice = async ({ invoice, tenantId, userId, session = null }) => {
  if (!invoice || invoice.stockDeducted) return invoice;
  const source = String(invoice.source || "project").toLowerCase();
  const saleType = String(invoice.saleType || "stock").toLowerCase();
  if (source === "inventory" && saleType === "external_purchase") {
    invoice.stockDeducted = false;
    return invoice;
  }
  let items = [];
  if (source === "inventory") {
    items = (Array.isArray(invoice.items) ? invoice.items : []).filter(
      (item) => String(item?.productId || "").trim() && Number(item?.quantity || item?.qty || 0) > 0
    );
  } else {
    if (!invoice.quotationId) return invoice;
    const quotation = await Quotation.findOne({
      _id: String(invoice.quotationId),
      tenantId,
      deletedAt: null,
    }).session(session);
    if (!quotation) return invoice;
    items = (Array.isArray(quotation.items) ? quotation.items : []).filter((item) => {
      const st = String(item?.sourceType || "").toLowerCase();
      return st !== "market_purchase" && st !== "service" &&
        String(item?.productId || "").trim() &&
        Number(item?.quantity || 0) > 0;
    });
  }
  if (!items.length) return invoice;

  const productIds = [...new Set(items.map((item) => String(item.productId).trim()))];
  const products = await InventoryItem.find({
    _id: { $in: productIds },
    tenantId,
    deletedAt: null,
  }).session(session);
  const productMap = Object.fromEntries(products.map((product) => [String(product._id), product]));

  for (const item of items) {
    const productId = String(item.productId).trim();
    const product = productMap[productId];
    const qty = Number(item.quantity || item.qty || 0);
    if (!product) throw new AppError("Not enough stock", 400);
    if (qty <= 0) continue;
    if (Number(product.quantity || 0) - qty < 0) {
      throw new AppError("Not enough stock", 400);
    }
  }

  for (const item of items) {
    const productId = String(item.productId).trim();
    const product = productMap[productId];
    const qty = Number(item.quantity || item.qty || 0);
    if (!product || qty <= 0) continue;
    product.quantity = Number(product.quantity || 0) - qty;
    product.updatedBy = userId;
    product.auditLog = [
      ...(Array.isArray(product.auditLog) ? product.auditLog : []),
      {
        action: "inventory.stock.deduct",
        by: userId,
        note: `Deducted ${qty} from invoice ${invoice.invoiceNo || invoice._id}`,
      },
    ];
    await product.save({ session });
  }

  invoice.stockDeducted = true;
  invoice.updatedBy = userId;
  invoice.auditLog = [
    ...(Array.isArray(invoice.auditLog) ? invoice.auditLog : []),
    {
      action: "invoice.stock_deducted",
      by: userId,
      note: "Stock deducted from linked quotation items",
    },
  ];
  await invoice.save({ session });
  return invoice;
};

const syncInventoryUsageForQuotation = async ({ tenantId, quotation, userId }) => {
  if (!quotation?._id) return;
  const quotationId = String(quotation._id);
  await InventoryUsage.deleteMany({ tenantId, quotationId, source: "quotation" });

  const items = Array.isArray(quotation.items) ? quotation.items : [];
  const candidateItems = items.filter((item) => {
    const st = String(item?.sourceType || "").toLowerCase();
    return st !== "market_purchase" && st !== "service" && String(item?.productId || "").trim();
  });
  if (!candidateItems.length) return;

  const inventoryIds = [...new Set(candidateItems.map((item) => String(item.productId).trim()))];
  const inventoryRows = await InventoryItem.find({
    tenantId,
    _id: { $in: inventoryIds },
    deletedAt: null,
  })
    .select("_id sku name")
    .lean();
  const inventoryMap = Object.fromEntries(inventoryRows.map((row) => [String(row._id), row]));

  const usageDocs = candidateItems
    .map((item) => {
      const inventoryItemId = String(item.productId || "").trim();
      const inv = inventoryMap[inventoryItemId];
      if (!inv) return null;
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
      const amount = Number((quantity * unitPrice).toFixed(2));
      return {
        tenantId,
        inventoryItemId,
        quotationId,
        invoiceId: null,
        projectId: String(quotation.projectId || ""),
        clientId: String(quotation.clientId || ""),
        sku: inv.sku || "",
        productName: item.name || item.description || inv.name || "",
        quantity,
        unitPrice,
        amount,
        source: "quotation",
        status: String(quotation.status || "draft").toLowerCase() === "approved" ? "approved" : "planned",
        createdBy: userId,
        updatedBy: userId,
        auditLog: [{ action: "inventory.usage.sync", by: userId, note: "Synced from quotation items" }],
      };
    })
    .filter(Boolean);

  if (usageDocs.length) {
    await InventoryUsage.insertMany(usageDocs, { ordered: false });
  }
};

const createInvoiceFromQuotation = async ({ quotation, req, note }) => {
  const tenantId = getTenantId(req);
  if (!tenantId) throw new AppError("Tenant context is required", 400);
  const total = Number(quotation.grandTotal ?? quotation.subtotal ?? 0);
  const quotationSaleType = String(quotation.saleType || "stock").toLowerCase() === "external_purchase" ? "external_purchase" : "stock";
  const quotationPurchaseCost = Number(quotation.purchaseCost || 0);
  const calculatedProfit = await calculateInvoiceProfitFromQuotation({
    tenantId,
    quotationId: quotation._id,
  });
  const existing = await Invoice.findOne({
    tenantId,
    quotationId: String(quotation._id),
    deletedAt: null,
  });
  if (existing) {
    if (Number(existing.profit || 0) !== calculatedProfit) {
      existing.profit = calculatedProfit;
      existing.updatedBy = req.user?.id;
      existing.auditLog = [
        ...(Array.isArray(existing.auditLog) ? existing.auditLog : []),
        {
          action: "invoice.profit.sync",
          by: req.user?.id,
          note: `Profit synchronized from quotation: ${calculatedProfit}`,
        },
      ];
      await existing.save();
    }
    if (!existing.stockDeducted) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const invoiceInSession = await Invoice.findOne({
            _id: existing._id,
            tenantId,
            deletedAt: null,
          }).session(session);
          if (invoiceInSession && !invoiceInSession.stockDeducted) {
            await deductInventoryForInvoice({
              invoice: invoiceInSession,
              tenantId,
              userId: req.user?.id,
              session,
            });
          }
        });
      } finally {
        await session.endSession();
      }
    }
    await InventoryUsage.updateMany(
      { tenantId, quotationId: String(quotation._id), source: "quotation", deletedAt: null },
      {
        invoiceId: String(existing._id),
        status: "approved",
        updatedBy: req.user?.id,
        $push: {
          auditLog: {
            action: "inventory.usage.attach_invoice",
            by: req.user?.id,
            note: "Attached existing invoice to quotation usage",
          },
        },
      }
    );
    if (existing.projectId) {
      await syncProjectFinancialsForProject({
        tenantId,
        projectId: String(existing.projectId),
        userId: req.user?.id,
      });
    }
    return existing;
  }
  const invoiceNo = await generateDocumentNo({ model: Invoice, prefix: "INV", tenantId });
  const invoiceLineItems = (Array.isArray(quotation.items) ? quotation.items : []).map((row) =>
    typeof row?.toObject === "function" ? row.toObject() : { ...row }
  );

  let invoice = null;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const created = await Invoice.create(
        [{
          tenantId,
          invoiceNo,
          name: quotation.name || invoiceNo,
          clientId: String(quotation.clientId),
          projectId: quotation.projectId ? String(quotation.projectId) : null,
          source: "project",
          saleType: quotationSaleType,
          purchaseCost: Number.isFinite(quotationPurchaseCost) && quotationPurchaseCost >= 0 ? quotationPurchaseCost : 0,
          supplierName: String(quotation.supplierName || ""),
          supplierPhone: String(quotation.supplierPhone || ""),
          customerName: String(quotation.walkInCustomerName || quotation.customerName || ""),
          customerPhone: String(quotation.walkInCustomerPhone || quotation.customerPhone || ""),
          customerEmail: String(quotation.walkInCustomerEmail || quotation.customerEmail || ""),
          quotationId: String(quotation._id),
          items: invoiceLineItems,
          total,
          profit:
            quotationSaleType === "external_purchase"
              ? Number((total - (Number.isFinite(quotationPurchaseCost) && quotationPurchaseCost >= 0 ? quotationPurchaseCost : 0)).toFixed(2))
              : calculatedProfit,
          paidAmount: 0,
          remainingAmount: total,
          status: "unpaid",
          createdBy: req.user?.id,
          updatedBy: req.user?.id,
          auditLog: [{ action: "invoice.create_from_quotation", by: req.user?.id, note: note || "Created from quotation" }],
        }],
        { session }
      );
      invoice = created[0];
      await deductInventoryForInvoice({
        invoice,
        tenantId,
        userId: req.user?.id,
        session,
      });
    });
  } finally {
    await session.endSession();
  }
  await InventoryUsage.updateMany(
    { tenantId, quotationId: String(quotation._id), source: "quotation", deletedAt: null },
    {
      invoiceId: String(invoice._id),
      status: "approved",
      updatedBy: req.user?.id,
      $push: {
        auditLog: {
          action: "inventory.usage.attach_invoice",
          by: req.user?.id,
          note: "Linked invoice generated from quotation",
        },
      },
    }
  );
  if (invoice?.projectId) {
    await syncProjectFinancialsForProject({
      tenantId,
      projectId: String(invoice.projectId),
      userId: req.user?.id,
    });
  }
  return invoice;
};

const calculateProjectFinancials = async ({ tenantId, projectId }) => {
  const pid = String(projectId);
  const [expenses, invoices, quotations] = await Promise.all([
    Expense.find({ tenantId, projectId: pid, deletedAt: null }).lean(),
    Invoice.find({ tenantId, projectId: pid, deletedAt: null }).lean(),
    Quotation.find({ tenantId, projectId: pid, deletedAt: null }).lean(),
  ]);

  const expenseLedger = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const quotationProcurementCost = await sumProcurementCostFromQuotations({ tenantId, quotations });
  const totalExpenses = Number((expenseLedger + quotationProcurementCost).toFixed(2));
  const totalRevenue = invoices.reduce((sum, invoice) => {
    const paidAmount = Number(invoice.paidAmount ?? 0);
    if (paidAmount > 0) return sum + paidAmount;
    if (invoice.status === "paid") return sum + Number(invoice.total || 0);
    return sum;
  }, 0);
  const profit = Number((totalRevenue - totalExpenses).toFixed(2));
  return { totalRevenue, totalExpenses, profit, quotationProcurementCost };
};

const normalizeInvoiceStatus = (inv) => String(inv?.status || "").toLowerCase();

const deriveProjectStatusFromInvoices = (invoices) => {
  if (!invoices.length) return null;
  const allPaid = invoices.every((inv) => normalizeInvoiceStatus(inv) === "paid");
  if (allPaid) return "completed";
  const anyPaidOrPartial = invoices.some((inv) => {
    const s = normalizeInvoiceStatus(inv);
    return s === "paid" || s === "partial" || Number(inv.paidAmount || 0) > 0;
  });
  const anyNotFullyPaid = invoices.some((inv) => normalizeInvoiceStatus(inv) !== "paid");
  if (anyPaidOrPartial && anyNotFullyPaid) return "partial";
  return "active";
};

const syncProjectCompletionFromInvoices = async ({ tenantId, projectId, userId }) => {
  const pid = String(projectId);
  const invoices = await Invoice.find({ tenantId, projectId: pid, deletedAt: null }).lean();
  if (!invoices.length) {
    return { projectAutoCompleted: false, projectStatus: null };
  }
  const nextStatus = deriveProjectStatusFromInvoices(invoices);
  const project = await Project.findOne({ _id: pid, tenantId, deletedAt: null }).lean();
  if (!project) {
    return { projectAutoCompleted: false, projectStatus: null };
  }
  const prev = String(project.status || "active").toLowerCase();
  if (prev === nextStatus) {
    return { projectAutoCompleted: false, projectStatus: nextStatus };
  }
  await Project.findOneAndUpdate(
    { _id: pid, tenantId, deletedAt: null },
    {
      status: nextStatus,
      updatedBy: userId,
      $push: {
        auditLog: {
          action: "project.status.sync",
          by: userId,
          note: `Auto status from invoices: ${nextStatus}`,
        },
      },
    }
  );
  const projectAutoCompleted = nextStatus === "completed" && prev !== "completed";
  return { projectAutoCompleted, projectStatus: nextStatus };
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
          note: `Revenue ${snapshot.totalRevenue}, Expenses ${snapshot.totalExpenses} (incl. procurement ${snapshot.quotationProcurementCost || 0}), Profit ${snapshot.profit}`,
        },
      },
    }
  );
  const completion = await syncProjectCompletionFromInvoices({ tenantId, projectId, userId });
  return { ...snapshot, ...completion };
};

const pickQuotationProjectTypeFields = (body = {}) => {
  const projectType = typeof body?.projectType === "string" ? body.projectType.trim() : "";
  let cctvType = typeof body?.cctvType === "string" ? body.cctvType.trim() : "";
  if (projectType.toLowerCase() !== "cctv") cctvType = "";
  return { projectType, cctvType };
};

const syncProjectTypesFromQuotation = async ({ tenantId, projectId, projectType, cctvType, userId }) => {
  const pid = String(projectId || "").trim();
  if (!pid || !String(projectType || "").trim()) return;
  const pt = String(projectType || "").trim();
  const safeCctv = pt.toLowerCase() === "cctv" ? String(cctvType || "").trim() : "";
  await Project.findOneAndUpdate(
    { _id: pid, tenantId, deletedAt: null },
    {
      projectType: pt,
      cctvType: safeCctv,
      updatedBy: userId,
      $push: {
        auditLog: {
          action: "project.type.from_quotation",
          by: userId,
          note: `Synced from quotation: ${pt}${safeCctv ? ` - ${safeCctv}` : ""}`,
        },
      },
    }
  );
};

const normalizeNewProjectTypePayload = (body = {}) => {
  let projectType = typeof body?.projectType === "string" ? body.projectType.trim() : "";
  let cctvType = typeof body?.cctvType === "string" ? body.cctvType.trim() : "";
  const legacy = projectType.toUpperCase();
  if (legacy === "CCTV_IP") {
    projectType = "CCTV";
    cctvType = cctvType || "IP";
  } else if (legacy === "CCTV_ANALOG") {
    projectType = "CCTV";
    cctvType = cctvType || "Analog";
  } else if (legacy === "SOLAR") {
    projectType = "Solar System";
    cctvType = "";
  } else if (legacy === "NETWORK" || legacy === "NETWORKING") {
    projectType = "Network";
    cctvType = "";
  }
  if (projectType.toLowerCase() !== "cctv") cctvType = "";
  return {
    projectType: projectType || "Network",
    cctvType,
  };
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
    const clients = await Client.find({ isDeleted: { $ne: true } })
      .sort({
        clientNumber: -1,
        createdAt: -1,
      })
      .lean();
    const doctorIds = clients.map((client) => String(client.id || client._id));
    const visitStats = doctorIds.length
      ? await Visit.collection.aggregate([
          {
            $match: {
              deletedAt: null,
            },
          },
          {
            $lookup: {
              from: Project.collection.name,
              let: { visitProjectId: "$projectId" },
              pipeline: [
                { $match: { $expr: { $eq: [{ $toString: "$_id" }, { $toString: "$$visitProjectId" }] } } },
                { $project: { clientId: 1 } },
              ],
              as: "visitProject",
            },
          },
          {
            $addFields: {
              resolved_doctor_id: {
                $ifNull: [
                  { $convert: { input: "$doctor_id", to: "string", onError: null, onNull: null } },
                  { $convert: { input: { $arrayElemAt: ["$visitProject.clientId", 0] }, to: "string", onError: null, onNull: null } },
                ],
              },
              resolved_visit_date: { $ifNull: ["$created_at", { $ifNull: ["$createdAt", "$time"] }] },
            },
          },
          { $match: { resolved_doctor_id: { $in: doctorIds } } },
          {
            $group: {
              _id: "$resolved_doctor_id",
              visit_count: { $sum: 1 },
              last_visit_at: { $max: "$resolved_visit_date" },
            },
          },
        ]).toArray()
      : [];
    const visitStatsByDoctorId = new Map(visitStats.map((row) => [String(row._id), row]));
    const clientsWithVisitStats = clients.map((client) => {
      const doctorId = String(client.id || client._id);
      const stats = visitStatsByDoctorId.get(doctorId);
      return {
        ...client,
        id: doctorId,
        doctor_name: client.name || "",
        visit_count: Number(stats?.visit_count || 0),
        last_visit_at: stats?.last_visit_at ? new Date(stats.last_visit_at).toISOString() : null,
      };
    });
    console.log("RESULT COUNT:", clients.length);
    console.log("CLIENT API ROW:", clientsWithVisitStats[0] || null);

    return res.json(clientsWithVisitStats);
  } catch (error) {
    console.error("[clients.list] Failed to fetch clients", {
      tenantId: req.user?.tenantId || req.tenantId || null,
      userId: req.user?.id || null,
      message: error.message,
    });
    return next(error);
  }
});
router.delete("/clients/:id", requireAdmin, async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return next(new AppError("Tenant context is required", 400));
    }

    const doc = await Client.findOneAndUpdate(
      { _id: req.params.id, isDeleted: { $ne: true } },
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
    if (typeof req.body?.status === "string") {
      updates.status = req.body.status.trim() || "active";
    }
    if (Array.isArray(req.body?.contacts)) {
      updates.contacts = req.body.contacts.map((c) => ({
        name: typeof c?.name === "string" ? c.name.trim() : "",
        email: typeof c?.email === "string" ? c.email.trim().toLowerCase() : "",
        phone: typeof c?.phone === "string" ? c.phone.trim() : "",
      }));
    }
    if (typeof req.body?.address === "string") {
      updates.address = req.body.address.trim();
    }
    if (typeof req.body?.notes === "string") {
      updates.notes = req.body.notes.trim();
    }

    const updatedClient = await Client.findOneAndUpdate(
      { _id: req.params.id, isDeleted: { $ne: true } },
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
router.post("/notifications/register-device", async (req, res, next) => {
  try {
    const tenantId = req.tenantId || getTenantId(req);
    const userId = String(req.user?.id || "").trim();
    const token = String(req.body?.token || "").trim();
    if (!tenantId) return next(new AppError("Tenant context is required", 400));
    if (!userId) return next(new AppError("User context is required", 401));
    if (!token) return next(new AppError("token is required", 400));

    await User.findOneAndUpdate(
      { _id: userId, tenantId },
      { $addToSet: { fcmTokens: token } },
      { new: true }
    );
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});
router.post("/notifications/technician-complete", async (req, res, next) => {
  try {
    const tenantId = req.tenantId || getTenantId(req);
    if (!tenantId) return next(new AppError("Tenant context is required", 400));

    // Fire-and-forget async delivery to admins, does not block UX
    setImmediate(async () => {
      try {
        const admins = await User.find({
          tenantId,
          role: { $in: ["admin", "company_admin"] },
          fcmTokens: { $exists: true, $ne: [] },
        })
          .select("fcmTokens")
          .lean();
        const adminTokens = [...new Set(admins.flatMap((admin) => admin.fcmTokens || []))];
        await sendMulticast({
          tokens: adminTokens,
          title: "Visit Completed",
          body: "Technician submitted visit report",
          data: {
            event: "visit_completed",
            taskId: String(req.body?.taskId || ""),
            projectId: String(req.body?.projectId || req.body?.taskId || ""),
          },
        });
      } catch (err) {
        console.warn("Async technician-complete notification failed", err?.message || err);
      }
    });
    return res.json({ queued: true });
  } catch (error) {
    return next(error);
  }
});
router.post("/visit/checkin", async (req, res, next) => {
  try {
    const tenantId = req.tenantId || getTenantId(req);
    if (!tenantId) {
      return next(new AppError("Tenant context is required", 400));
    }

    const technicianId = String(req.body?.technicianId || req.user?.id || "").trim();
    const projectId = String(req.body?.projectId || req.body?.taskId || "").trim();
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);
    const accuracy = req.body?.accuracy == null ? null : Number(req.body.accuracy);
    const projectLatitude = Number(req.body?.projectLatitude);
    const projectLongitude = Number(req.body?.projectLongitude);
    const checkInTime = req.body?.time ? new Date(req.body.time) : new Date();
    const taskId = String(req.body?.taskId || "").trim();
    const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3;
      const phi1 = (lat1 * Math.PI) / 180;
      const phi2 = (lat2 * Math.PI) / 180;
      const dPhi = ((lat2 - lat1) * Math.PI) / 180;
      const dLambda = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    if (!technicianId) {
      return next(new AppError("technicianId is required", 400));
    }
    if (!projectId) {
      return next(new AppError("projectId is required", 400));
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return next(new AppError("Valid latitude and longitude are required", 400));
    }
    if (!Number.isFinite(projectLatitude) || !Number.isFinite(projectLongitude)) {
      return next(new AppError("Valid project coordinates are required", 400));
    }
    if (accuracy !== null && !Number.isFinite(accuracy)) {
      return next(new AppError("accuracy must be a number", 400));
    }
    if (Number.isNaN(checkInTime.getTime())) {
      return next(new AppError("Valid check-in time is required", 400));
    }
    const distance = getDistanceMeters(latitude, longitude, projectLatitude, projectLongitude);
    const status = distance <= 100 ? "ON_SITE" : "OUTSIDE";

    const report = `CHECK_IN\nTIME: ${checkInTime.toISOString()}\nLAT: ${latitude}\nLNG: ${longitude}\nPROJECT_LAT: ${projectLatitude}\nPROJECT_LNG: ${projectLongitude}\nDISTANCE_M: ${distance.toFixed(2)}${taskId ? `\nTASK: ${taskId}` : ""}`;
    const checkIn = await SiteVisit.create({
      tenantId,
      visitDate: checkInTime,
      assignedTechnician: String(req.user?.email || req.user?.id || "technician"),
      report,
      images: [],
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
      auditLog: [{ action: "visit.checkin", by: req.user?.id, note: "Technician GPS check-in" }],
    });
    const visit = await Visit.create({
      tenantId,
      technicianId,
      projectId,
      latitude,
      longitude,
      time: checkInTime,
      accuracy,
      distance: Number(distance.toFixed(2)),
      status,
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
      auditLog: [{ action: "visit.checkin", by: req.user?.id, note: "Technician GPS check-in" }],
    });

    if (status === "ON_SITE") {
      setImmediate(async () => {
        try {
          const admins = await User.find({
            tenantId,
            role: { $in: ["admin", "company_admin"] },
            fcmTokens: { $exists: true, $ne: [] },
          })
            .select("fcmTokens")
            .lean();
          const adminTokens = [...new Set(admins.flatMap((admin) => admin.fcmTokens || []))];
          await sendMulticast({
            tokens: adminTokens,
            title: "Technician Arrived",
            body: "Technician is now on site",
            data: {
              event: "technician_arrived",
              visitId: String(visit._id),
              projectId,
              technicianId,
            },
          });
        } catch (err) {
          console.warn("Async ON_SITE notification failed", err?.message || err);
        }
      });
    }

    return res.status(201).json({
      message: "Check-in saved",
      checkInId: checkIn._id,
      visitId: visit._id,
      technicianId,
      projectId,
      latitude,
      longitude,
      accuracy,
      projectLatitude,
      projectLongitude,
      distanceMeters: Number(distance.toFixed(2)),
      status,
      time: checkInTime.toISOString(),
      taskId: taskId || null,
    });
  } catch (error) {
    return next(error);
  }
});
router.get("/visit", async (req, res, next) => {
  try {
    const tenantId = req.tenantId || getTenantId(req);
    if (!tenantId) return next(new AppError("Tenant context is required", 400));

    const projectId = String(req.query?.projectId || "").trim();
    const query = { tenantId, deletedAt: null };
    if (projectId) query.projectId = projectId;

    const visits = await Visit.find(query).sort({ time: -1 }).limit(200).lean();
    return res.json(visits);
  } catch (error) {
    return next(error);
  }
});
router.get("/visit/:projectId", async (req, res, next) => {
  try {
    const tenantId = req.tenantId || getTenantId(req);
    if (!tenantId) return next(new AppError("Tenant context is required", 400));

    const projectId = String(req.params?.projectId || "").trim();
    if (!projectId) return next(new AppError("projectId is required", 400));

    const visits = await Visit.find({ tenantId, projectId, deletedAt: null }).sort({ time: -1 }).lean();
    return res.json(visits);
  } catch (error) {
    return next(error);
  }
});
router.use("/site-visits", buildCrudRouter({ model: SiteVisit, entity: "site_visit" }));
const computeQuotationTotals = async ({ tenantId, payload = {} }) => {
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const source = String(payload?.source || "project").toLowerCase();
  const isInventorySource = source === "inventory";
  if (isInventorySource && rawItems.some((item) => {
    const st = String(item?.sourceType || "").toLowerCase();
    return st === "market_purchase" || st === "service";
  })) {
    throw new AppError("Market purchase and service lines are not valid for inventory quotations.", 400);
  }
  const nonMarketLines = rawItems.filter((item) => {
    const st = String(item?.sourceType || "").toLowerCase();
    return st !== "market_purchase" && st !== "service";
  });
  const productIds = [...new Set(nonMarketLines.map((item) => String(item?.productId || "").trim()).filter(Boolean))];
  if (isInventorySource && rawItems.some((item) => !String(item?.productId || "").trim())) {
    throw new AppError("Each quotation item must reference an inventory product.", 400);
  }
  const inventoryItems = productIds.length
    ? await InventoryItem.find({
        tenantId,
        _id: { $in: productIds },
        deletedAt: null,
      })
        .select("_id name price")
        .lean()
    : [];
  const inventoryMap = Object.fromEntries(inventoryItems.map((item) => [String(item._id), item]));

  const items = rawItems.map((item) => {
    const lineSource = String(item.sourceType || "").toLowerCase();
    if (!isInventorySource && lineSource === "market_purchase") {
      const manualName = String(item.description || item.name || "").trim();
      if (!manualName) {
        throw new AppError("Each market purchase line needs a description.", 400);
      }
      const quantity = Number(item.quantity || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new AppError("Invalid quantity on market purchase line.", 400);
      }
      const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
      const purchasePrice = Number(item.purchasePrice ?? 0);
      if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
        throw new AppError("Market purchase lines require a valid purchase price.", 400);
      }
      const total = Number((quantity * unitPrice).toFixed(2));
      return {
        productId: "",
        name: manualName,
        description: manualName,
        price: unitPrice,
        quantity,
        unitPrice,
        total,
        sourceType: "market_purchase",
        purchasePrice,
        serviceCost: 0,
        supplier: String(item.supplier || "").trim(),
        purchaseReference: String(item.purchaseReference || "").trim(),
        addToInventory: Boolean(item.addToInventory),
      };
    }

    if (!isInventorySource && lineSource === "service") {
      const manualName = String(item.description || item.name || "").trim();
      if (!manualName) {
        throw new AppError("Each service line needs a description.", 400);
      }
      const quantity = Number(item.quantity || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new AppError("Invalid quantity on service line.", 400);
      }
      const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
      const serviceCost = Number(item.serviceCost ?? 0);
      const total = Number((quantity * unitPrice).toFixed(2));
      return {
        productId: "",
        name: manualName,
        description: manualName,
        price: unitPrice,
        quantity,
        unitPrice,
        total,
        sourceType: "service",
        purchasePrice: 0,
        serviceCost,
        supplier: "",
        purchaseReference: "",
        addToInventory: false,
      };
    }

    const productId = String(item.productId || "").trim();
    if (!productId) {
      if (isInventorySource) {
        throw new AppError("Each quotation item must reference an inventory product.", 400);
      }
      const manualName = String(item.description || item.name || "").trim();
      if (!manualName) {
        throw new AppError("Each quotation line needs a description or a linked inventory product.", 400);
      }
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
      const total = Number((quantity * unitPrice).toFixed(2));
      return {
        productId: "",
        name: manualName,
        description: manualName,
        price: unitPrice,
        quantity,
        unitPrice,
        total,
        sourceType: "inventory",
        purchasePrice: 0,
        serviceCost: 0,
        supplier: "",
        purchaseReference: "",
        addToInventory: false,
      };
    }
    const inventoryProduct = inventoryMap[productId];
    if (!inventoryProduct) {
      throw new AppError("Each quotation item must reference a valid inventory product.", 400);
    }
    const resolvedName = String(inventoryProduct.name || "").trim();
    const quantity = Number(item.quantity || 0);
    const requestedPrice = Number(item.unitPrice ?? item.price ?? inventoryProduct.price ?? 0);
    const unitPrice = isInventorySource
      ? (Number.isFinite(requestedPrice) ? requestedPrice : Number(inventoryProduct.price ?? 0))
      : Number(inventoryProduct.price ?? 0);
    const total = Number((quantity * unitPrice).toFixed(2));
    return {
      productId,
      name: resolvedName,
      description: resolvedName,
      price: unitPrice,
      quantity,
      unitPrice,
      total,
      sourceType: "inventory",
      purchasePrice: 0,
      serviceCost: 0,
      supplier: "",
      purchaseReference: "",
      addToInventory: false,
    };
  }).map((computed, idx) => ({
    ...computed,
    sectionIndex: Math.max(0, Number(rawItems[idx]?.sectionIndex) || 0),
  }));

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
    sections: Array.isArray(payload.sections)
      ? payload.sections.map((s) => ({
          title: String(s?.title || "").trim(),
          notes: String(s?.notes || "").trim(),
        }))
      : [],
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
      const walkLabel = String(quotation.walkInCustomerName || "").trim();
      return {
        ...quotation,
        clientId: client
          ? { _id: String(client._id), name: client.name || "", email: client.email || "" }
          : walkLabel
            ? { _id: rawClientId, name: `${walkLabel} (walk-in)`, email: quotation.walkInCustomerEmail || "" }
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
    const walkName = String(quotation.walkInCustomerName || "").trim();
    res.json({
      quotation,
      client,
      project,
      clientName: walkName || client?.name || "",
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
    const source = String(req.body?.source || "project").toLowerCase() === "inventory" ? "inventory" : "project";
    const saleType = String(req.body?.saleType || "stock").toLowerCase() === "external_purchase" ? "external_purchase" : "stock";
    const purchaseCost = Number(req.body?.purchaseCost || 0);

    let clientId = "";
    let projectId = source === "inventory" ? null : String(req.body?.projectId || "").trim();
    let walkInCustomerName = "";
    let walkInCustomerPhone = "";
    let walkInCustomerEmail = "";
    let customerKind = "existing";
    let customerName = "";
    let customerPhone = "";
    let customerEmail = "";

    if (source === "inventory") {
      clientId = await resolveClientForSale({
        req,
        tenantId,
        source,
        clientIdRaw: req.body?.clientId,
        walkInCustomer: req.body?.walkInCustomer,
      });
      if (!clientId) return res.status(400).json({ message: "clientId is required" });
    } else {
      customerKind = String(req.body?.customerKind || "existing").toLowerCase() === "walkin" ? "walkin" : "existing";
      const walkInName = String(req.body?.walkInCustomerName || req.body?.walkInCustomer?.name || "").trim();
      const walkInPhone = String(req.body?.walkInCustomerPhone || req.body?.walkInCustomer?.phone || "").trim();
      const walkInMail = String(req.body?.walkInCustomerEmail || req.body?.walkInCustomer?.email || "").trim();
      const resolved = resolveQuotationClientAndProject({
        customerKind,
        clientIdRaw: req.body?.clientId,
        projectIdRaw: req.body?.projectId,
        walkInName,
        walkInPhone,
        walkInEmail: walkInMail,
      });
      if (resolved.error) return next(resolved.error);
      clientId = resolved.clientId;
      projectId = resolved.projectId;
      if (resolved.isWalkIn) {
        walkInCustomerName = resolved.walkInCustomerName;
        walkInCustomerPhone = resolved.walkInCustomerPhone;
        walkInCustomerEmail = resolved.walkInCustomerEmail;
        customerName = resolved.customerName;
        customerPhone = resolved.customerPhone;
        customerEmail = resolved.customerEmail;
      } else {
        await ensureQuotationClientContext({ tenantId, clientId, projectId });
      }
    }

    const quotationNo = await generateDocumentNo({ model: Quotation, prefix: "QTN", tenantId });

    const calculated = source === "inventory"
      ? {
          subtotal: Number(req.body?.total ?? 0),
          grandTotal: Number(req.body?.total ?? 0),
          tax: 0,
          discount: { type: "fixed", value: 0, amount: 0 },
        }
      : await computeQuotationTotals({ tenantId, payload: req.body });
    const typeFields = pickQuotationProjectTypeFields(req.body);
    const payload = {
      ...req.body,
      quotationNo,
      name: String(req.body?.name || "").trim() || quotationNo,
      clientId,
      customerKind: source === "inventory" ? "existing" : customerKind,
      walkInCustomerName,
      walkInCustomerPhone,
      walkInCustomerEmail,
      customerName:
        source === "inventory"
          ? String(req.body?.walkInCustomer?.name || "").trim()
          : customerName || String(req.body?.customerName || "").trim(),
      customerPhone:
        source === "inventory"
          ? String(req.body?.walkInCustomer?.phone || "").trim()
          : customerPhone || String(req.body?.customerPhone || "").trim(),
      customerEmail:
        source === "inventory"
          ? String(req.body?.walkInCustomer?.email || "").trim()
          : customerEmail || String(req.body?.customerEmail || "").trim(),
      saleType,
      purchaseCost: Number.isFinite(purchaseCost) && purchaseCost >= 0 ? purchaseCost : 0,
      supplierName: String(req.body?.supplierName || "").trim(),
      supplierPhone: String(req.body?.supplierPhone || "").trim(),
      projectId: source === "inventory" ? null : projectId || null,
      source,
      ...calculated,
      ...typeFields,
      status: "draft",
      tenantId,
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
      auditLog: [{ action: "quotation.create", by: req.user?.id, note: "Created quotation" }],
    };
    const doc = await Quotation.create(payload);
    await applyMarketPurchaseInventoryAdds({ tenantId, quotation: doc, userId: req.user?.id });
    await syncInventoryUsageForQuotation({ tenantId, quotation: doc, userId: req.user?.id });
    if (source === "project" && doc.projectId && typeFields.projectType) {
      await syncProjectTypesFromQuotation({
        tenantId,
        projectId: doc.projectId,
        projectType: typeFields.projectType,
        cctvType: typeFields.cctvType,
        userId: req.user?.id,
      });
    }
    if (source === "project" && doc.projectId) {
      await syncProjectFinancialsForProject({
        tenantId,
        projectId: String(doc.projectId),
        userId: req.user?.id,
      });
    }
    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
});

router.put("/quotations/:id", async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return next(new AppError("Tenant context is required", 400));
    const existing = await Quotation.findOne({ _id: req.params.id, tenantId, deletedAt: null });
    if (!existing) return res.status(404).json({ message: "Quotation not found" });
    const prevStatus = normalizeQuotationStatus(existing.status);
    if (prevStatus === "converted_to_project") {
      return res.status(400).json({ message: "This quotation was converted to a project and cannot be edited." });
    }

    const source = String(req.body?.source || "project").toLowerCase() === "inventory" ? "inventory" : "project";

    let clientId = "";
    let projectId = source === "inventory" ? null : String(req.body?.projectId || "").trim();
    let walkInCustomerName = "";
    let walkInCustomerPhone = "";
    let walkInCustomerEmail = "";
    let customerKind = "existing";
    let customerName = "";
    let customerPhone = "";
    let customerEmail = "";

    if (source === "inventory") {
      clientId = String(req.body?.clientId || "").trim();
      if (!clientId) return res.status(400).json({ message: "clientId is required" });
    } else {
      customerKind = String(req.body?.customerKind || "existing").toLowerCase() === "walkin" ? "walkin" : "existing";
      const walkInName = String(req.body?.walkInCustomerName || req.body?.walkInCustomer?.name || "").trim();
      const walkInPhone = String(req.body?.walkInCustomerPhone || req.body?.walkInCustomer?.phone || "").trim();
      const walkInMail = String(req.body?.walkInCustomerEmail || req.body?.walkInCustomer?.email || "").trim();
      const resolved = resolveQuotationClientAndProject({
        customerKind,
        clientIdRaw: req.body?.clientId,
        projectIdRaw: req.body?.projectId,
        walkInName,
        walkInPhone,
        walkInEmail: walkInMail,
      });
      if (resolved.error) return next(resolved.error);
      clientId = resolved.clientId;
      projectId = resolved.projectId;
      if (resolved.isWalkIn) {
        walkInCustomerName = resolved.walkInCustomerName;
        walkInCustomerPhone = resolved.walkInCustomerPhone;
        walkInCustomerEmail = resolved.walkInCustomerEmail;
        customerName = resolved.customerName;
        customerPhone = resolved.customerPhone;
        customerEmail = resolved.customerEmail;
      } else {
        await ensureQuotationClientContext({ tenantId, clientId, projectId });
      }
    }

    const calculated = await computeQuotationTotals({ tenantId, payload: req.body });
    const typeFields = pickQuotationProjectTypeFields(req.body);
    const hasBodyStatus =
      req.body &&
      Object.prototype.hasOwnProperty.call(req.body, "status") &&
      req.body.status !== "" &&
      req.body.status != null;
    let nextStatus = hasBodyStatus ? normalizeQuotationStatus(req.body.status, prevStatus) : prevStatus;
    if (nextStatus === "converted_to_project" && prevStatus !== "converted_to_project") {
      return res.status(400).json({ message: "Use Convert to Project to set this status." });
    }

    const doc = await Quotation.findOneAndUpdate(
      { _id: req.params.id, tenantId, deletedAt: null },
      {
        ...req.body,
        clientId,
        projectId: source === "inventory" ? null : projectId || null,
        customerKind: source === "inventory" ? "existing" : customerKind,
        walkInCustomerName: source === "inventory" ? "" : walkInCustomerName,
        walkInCustomerPhone: source === "inventory" ? "" : walkInCustomerPhone,
        walkInCustomerEmail: source === "inventory" ? "" : walkInCustomerEmail,
        customerName:
          source === "inventory"
            ? String(req.body?.walkInCustomer?.name || "").trim()
            : customerName || String(req.body?.customerName || "").trim(),
        customerPhone:
          source === "inventory"
            ? String(req.body?.walkInCustomer?.phone || "").trim()
            : customerPhone || String(req.body?.customerPhone || "").trim(),
        customerEmail:
          source === "inventory"
            ? String(req.body?.walkInCustomer?.email || "").trim()
            : customerEmail || String(req.body?.customerEmail || "").trim(),
        source,
        ...calculated,
        ...typeFields,
        status: nextStatus,
        updatedBy: req.user?.id,
        $push: { auditLog: { action: "quotation.update", by: req.user?.id, note: "Updated quotation" } },
      },
      { new: true }
    );
    if (doc) {
      await syncInventoryUsageForQuotation({ tenantId, quotation: doc, userId: req.user?.id });
      if (source === "project" && doc.projectId && typeFields.projectType) {
        await syncProjectTypesFromQuotation({
          tenantId,
          projectId: doc.projectId,
          projectType: typeFields.projectType,
          cctvType: typeFields.cctvType,
          userId: req.user?.id,
        });
      }
      if (source === "project" && doc.projectId) {
        await syncProjectFinancialsForProject({
          tenantId,
          projectId: String(doc.projectId),
          userId: req.user?.id,
        });
      }
    }
    res.json(doc);
  } catch (error) {
    next(error);
  }
});

router.post("/quotations/:id/convert-to-project", async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return next(new AppError("Tenant context is required", 400));
    const quotation = await Quotation.findOne({ _id: req.params.id, tenantId, deletedAt: null });
    if (!quotation) return res.status(404).json({ message: "Quotation not found" });

    const st = normalizeQuotationStatus(quotation.status);
    if (st === "converted_to_project") {
      return res.status(400).json({ message: "This quotation is already converted to a project." });
    }
    if (st !== "approved") {
      return res.status(400).json({ message: "Only approved quotations can be converted to a project." });
    }
    if (String(quotation.projectId || "").trim()) {
      return res.status(400).json({ message: "This quotation is already linked to a project." });
    }

    const clientId = String(quotation.clientId || "").trim();
    if (!clientId) return res.status(400).json({ message: "Quotation must have a client to create a project." });

    const client = await Client.findOne({ _id: clientId, tenantId, deletedAt: null, isDeleted: { $ne: true } });
    if (!client) return res.status(400).json({ message: "Client not found for this quotation." });

    const qObj = typeof quotation.toObject === "function" ? quotation.toObject() : { ...quotation };
    const { projectType: normPt, cctvType: normCctv } = normalizeNewProjectTypePayload({
      projectType: qObj.projectType,
      cctvType: qObj.cctvType,
    });
    const projectTitle = String(quotation.name || quotation.quotationNo || "Project").trim() || "Project";
    const grandTotal = Number(quotation.grandTotal ?? quotation.subtotal ?? 0);

    const project = await Project.create({
      name: projectTitle,
      clientId,
      quotationId: String(quotation._id),
      budget: grandTotal,
      totalRevenue: grandTotal,
      projectType: normPt,
      cctvType: normCctv,
      tenantId,
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
      auditLog: [
        {
          action: "project.create_from_quotation",
          by: req.user?.id,
          note: `From quotation ${quotation.quotationNo || quotation._id}`,
        },
      ],
    });

    const updatedQuote = await Quotation.findOneAndUpdate(
      { _id: quotation._id, tenantId, deletedAt: null },
      {
        projectId: String(project._id),
        status: "converted_to_project",
        updatedBy: req.user?.id,
        $push: {
          auditLog: {
            action: "quotation.convert_to_project",
            by: req.user?.id,
            note: `Linked project ${project._id}`,
          },
        },
      },
      { new: true }
    );

    await Invoice.updateMany(
      { tenantId, quotationId: String(quotation._id), deletedAt: null },
      { $set: { projectId: String(project._id), updatedBy: req.user?.id } }
    );

    if (updatedQuote) {
      await syncInventoryUsageForQuotation({ tenantId, quotation: updatedQuote, userId: req.user?.id });
    }
    await syncProjectFinancialsForProject({ tenantId, projectId: String(project._id), userId: req.user?.id });

    res.status(201).json({ quotation: updatedQuote, project });
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
    const beforeStatus = normalizeQuotationStatus(before.status);
    if (beforeStatus === "converted_to_project") {
      return res.status(400).json({ message: "This quotation was converted to a project." });
    }
    if (beforeStatus === "approved") {
      const invoice = await createInvoiceFromQuotation({
        quotation: before,
        req,
        note: "Invoice ensured for approved quotation",
      });
      const out = typeof before.toObject === "function" ? before.toObject() : { ...before };
      out.invoice = invoice;
      return res.json(out);
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
    await syncInventoryUsageForQuotation({ tenantId, quotation: doc, userId: req.user?.id });

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
    if (doc) {
      await InventoryUsage.updateMany(
        { tenantId: req.tenantId, quotationId: String(doc._id), source: "quotation", deletedAt: null },
        {
          deletedAt: new Date(),
          updatedBy: req.user?.id,
          $push: { auditLog: { action: "inventory.usage.delete", by: req.user?.id, note: "Soft deleted with quotation" } },
        }
      );
    }
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
    const visitQuery = { tenantId, deletedAt: null, doctor_id: String(client._id) };
    const [totalVisits, lastVisit] = await Promise.all([
      Visit.countDocuments(visitQuery),
      Visit.findOne(visitQuery).sort({ time: -1 }).select("time").lean(),
    ]);

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
        totalVisits,
        lastVisit: lastVisit?.time || null,
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
    const inventoryUsage = await InventoryUsage.find({
      projectId: String(project._id),
      tenantId,
      deletedAt: null,
      source: "quotation",
    })
      .sort({ createdAt: -1 })
      .lean();

    const totalQuoted = quotations.reduce((sum, q) => sum + Number(q.grandTotal ?? q.subtotal ?? 0), 0);
    const progress = Number(project.progress || 0);
    const financialSnapshot = await calculateProjectFinancials({ tenantId, projectId: String(project._id) });
    const totalExpenses = financialSnapshot.totalExpenses;
    const totalRevenue = financialSnapshot.totalRevenue;
    const calculatedProfit = financialSnapshot.profit;
    const quotationProcurementCost = financialSnapshot.quotationProcurementCost;
    const inventorySummary = {
      totalItemsUsed: inventoryUsage.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
      totalUsageAmount: inventoryUsage.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      uniqueProducts: new Set(inventoryUsage.map((row) => String(row.inventoryItemId || ""))).size,
    };

    res.json({
      project,
      client,
      quotations,
      expenses,
      inventoryUsage,
      inventorySummary,
      quotationSummary: {
        totalQuoted,
        quotationCount: quotations.length,
      },
      profitability: {
        totalRevenue,
        totalExpenses,
        calculatedProfit,
        quotationProcurementCost,
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

    const { projectType: normPt, cctvType: normCctv } = normalizeNewProjectTypePayload(req.body);
    const payload = {
      ...req.body,
      clientId,
      projectType: normPt,
      cctvType: normCctv,
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
        })
          .select("_id name email")
          .lean()
      : [];
    console.log("RESULT COUNT:", docs.length);

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

router.put("/projects/:id", async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const wantCompleted = String(req.body?.status || "").toLowerCase() === "completed";
    if (wantCompleted) {
      const invoices = await Invoice.find({ tenantId, projectId: String(req.params.id), deletedAt: null }).lean();
      if (
        invoices.length &&
        !invoices.every((inv) => String(inv.status || "").toLowerCase() === "paid")
      ) {
        return res.status(400).json({
          message: "Cannot mark project completed until all invoices are fully paid.",
        });
      }
    }
    const doc = await Project.findOneAndUpdate(
      { _id: req.params.id, tenantId, deletedAt: null },
      {
        ...req.body,
        updatedBy: req.user?.id,
        $push: { auditLog: { action: "project.update", by: req.user?.id, note: "Updated record" } },
      },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: "Project not found" });
    return res.json(doc);
  } catch (error) {
    return next(error);
  }
});

router.delete("/projects/:id", requireAdmin, async (req, res, next) => {
  try {
    const doc = await Project.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, deletedAt: null },
      { deletedAt: new Date(), updatedBy: req.user?.id },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: "Project not found" });
    return res.json({ message: "Deleted" });
  } catch (error) {
    return next(error);
  }
});

router.use("/projects", buildCrudRouter({ model: Project, entity: "project" }));
router.get("/invoices", async (req, res, next) => {
  try {
    const clientId = String(req.query?.clientId || "").trim();
    const query = clientId ? { clientId } : {};
    const docs = await Invoice.find(query).sort({ createdAt: -1 });
    const invoiceObjects = docs.map((doc) => (typeof doc.toObject === "function" ? doc.toObject() : doc));

    const clientIds = [...new Set(invoiceObjects.map((doc) => String(doc.clientId || "")).filter(Boolean))];
    const projectIds = [...new Set(invoiceObjects.map((doc) => String(doc.projectId || "")).filter(Boolean))];
    const quotationIds = [...new Set(invoiceObjects.map((doc) => String(doc.quotationId || "")).filter(Boolean))];

    const [clients, projects, quotations] = await Promise.all([
      clientIds.length
        ? Client.find({ _id: { $in: clientIds } })
            .select("_id name")
            .lean()
        : [],
      projectIds.length
        ? Project.find({ _id: { $in: projectIds } })
            .select("_id name")
            .lean()
        : [],
      quotationIds.length
        ? Quotation.find({ _id: { $in: quotationIds } })
            .select("_id quotationNo")
            .lean()
        : [],
    ]);
    console.log("RESULT COUNT:", docs.length);

    const clientMap = Object.fromEntries(clients.map((client) => [String(client._id), client]));
    const projectMap = Object.fromEntries(projects.map((project) => [String(project._id), project]));
    const quotationMap = Object.fromEntries(quotations.map((quotation) => [String(quotation._id), quotation]));

    const enriched = invoiceObjects.map((invoice) => {
      const rawClientId = String(invoice.clientId || "");
      const rawProjectId = String(invoice.projectId || "");
      const rawQuotationId = String(invoice.quotationId || "");
      const client = clientMap[rawClientId] || null;
      const project = projectMap[rawProjectId] || null;
      const quotation = quotationMap[rawQuotationId] || null;
      return {
        ...invoice,
        clientId: client
          ? { _id: client._id, name: client.name }
          : { _id: invoice.clientId, name: invoice.customerName || "" },
        projectId: project ? { _id: project._id, name: project.name } : { _id: invoice.projectId, name: "" },
        quotationNo: quotation?.quotationNo || "",
        clientName: client?.name || invoice.customerName || "",
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
    const invoice = typeof doc.toObject === "function" ? doc.toObject() : doc;
    const quotation = invoice.quotationId
      ? await Quotation.findOne({ _id: String(invoice.quotationId), tenantId: req.tenantId, deletedAt: null })
          .select("quotationNo subtotal discount tax grandTotal")
          .lean()
      : null;
    const subtotal = quotation ? Number(quotation.subtotal ?? 0) : Number(invoice.total || 0);
    const discountAmount = quotation ? Number(quotation.discount?.amount ?? 0) : 0;
    const taxAmount = quotation ? Number(quotation.tax ?? 0) : 0;
    const inventoryUsage = await InventoryUsage.find({
      tenantId: req.tenantId,
      invoiceId: String(req.params.id),
      deletedAt: null,
      source: "quotation",
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      ...invoice,
      quotationNo: quotation?.quotationNo || "",
      summarySubtotal: subtotal,
      summaryDiscount: discountAmount,
      summaryTax: taxAmount,
      inventoryUsage,
    });
  } catch (error) {
    next(error);
  }
});
router.post("/invoices", async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return next(new AppError("Tenant context is required", 400));
    const source = String(req.body?.source || "project").toLowerCase() === "inventory" ? "inventory" : "project";
    const saleType = String(req.body?.saleType || "stock").toLowerCase() === "external_purchase" ? "external_purchase" : "stock";
    const purchaseCost = Number(req.body?.purchaseCost || 0);
    const clientId = await resolveClientForSale({
      req,
      tenantId,
      source,
      clientIdRaw: req.body?.clientId,
      walkInCustomer: req.body?.walkInCustomer,
    });
    const projectId = source === "inventory" ? null : String(req.body?.projectId || "").trim();
    if (!clientId) return res.status(400).json({ message: "clientId is required" });
    if (source === "project") {
      if (!projectId) return res.status(400).json({ message: "projectId is required" });
      await ensureClientProjectLink({ tenantId, clientId, projectId });
    }

    const normalizedItems = source === "inventory"
      ? (
        saleType === "external_purchase"
          ? (Array.isArray(req.body?.items) ? req.body.items : [])
              .map((item) => {
                const quantity = Number(item?.quantity || item?.qty || 0);
                const unitPrice = Number(item?.unitPrice ?? item?.price ?? 0);
                if (!Number.isFinite(quantity) || quantity <= 0) return null;
                const resolvedName = String(item?.name || item?.description || "External Item").trim();
                return {
                  productId: "",
                  name: resolvedName,
                  description: resolvedName,
                  quantity,
                  price: unitPrice,
                  unitPrice,
                  total: Number((quantity * unitPrice).toFixed(2)),
                };
              })
              .filter(Boolean)
          : await normalizeInventorySaleItems({ tenantId, items: req.body?.items, enforceInventoryPrice: false })
      )
      : [];
    const total = source === "inventory"
      ? Number(normalizedItems.reduce((sum, item) => sum + Number(item.total || 0), 0).toFixed(2))
      : Number(req.body?.total ?? 0);
    if (!Number.isFinite(total) || total < 0) return res.status(400).json({ message: "total must be >= 0" });

    const requestedPaid = req.body?.status === "paid";
    const paidAmount = requestedPaid ? total : Number(req.body?.paidAmount || 0);
    const safePaidAmount = Number.isFinite(paidAmount) && paidAmount >= 0 ? Math.min(paidAmount, total) : 0;
    const remainingAmount = Math.max(total - safePaidAmount, 0);
    const status = safePaidAmount >= total ? "paid" : safePaidAmount > 0 ? "partial" : "draft";
    const calculatedProfit = source === "inventory"
      ? (
        saleType === "external_purchase"
          ? Number((total - (Number.isFinite(purchaseCost) && purchaseCost >= 0 ? purchaseCost : 0)).toFixed(2))
          : await calculateInvoiceProfitFromItems({ tenantId, items: normalizedItems })
      )
      : await calculateInvoiceProfitFromQuotation({
          tenantId,
          quotationId: req.body?.quotationId,
        });
    const invoiceNo = await generateDocumentNo({ model: Invoice, prefix: "INV", tenantId });

    let doc = null;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const created = await Invoice.create(
          [{
            ...req.body,
            invoiceNo,
            name: String(req.body?.name || "").trim() || invoiceNo,
            clientId,
            customerName: String(req.body?.walkInCustomer?.name || "").trim(),
            customerPhone: String(req.body?.walkInCustomer?.phone || "").trim(),
            customerEmail: String(req.body?.walkInCustomer?.email || "").trim(),
            saleType,
            purchaseCost: Number.isFinite(purchaseCost) && purchaseCost >= 0 ? purchaseCost : 0,
            supplierName: String(req.body?.supplierName || "").trim(),
            supplierPhone: String(req.body?.supplierPhone || "").trim(),
            projectId,
            source,
            items: source === "inventory" ? normalizedItems : (Array.isArray(req.body?.items) ? req.body.items : []),
            total,
            profit: calculatedProfit,
            paidAmount: safePaidAmount,
            remainingAmount,
            paidAt: status === "paid" ? new Date() : null,
            tenantId,
            status,
            createdBy: req.user?.id,
            updatedBy: req.user?.id,
            auditLog: [{ action: "invoice.create", by: req.user?.id, note: "Created invoice" }],
          }],
          { session }
        );
        doc = created[0];
        await deductInventoryForInvoice({
          invoice: doc,
          tenantId,
          userId: req.user?.id,
          session,
        });
      });
    } finally {
      await session.endSession();
    }
    if (projectId) {
      await syncProjectFinancialsForProject({ tenantId, projectId, userId: req.user?.id });
    }
    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
});
router.patch("/invoices/:id/pay", async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, tenantId: req.tenantId, deletedAt: null });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const fallbackAmount = Number(invoice.remainingAmount || invoice.totalAmount || invoice.total || 0);
    const paymentAmount = req.body?.amount === undefined ? fallbackAmount : Number(req.body.amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ message: "amount must be greater than 0" });
    }

    const totalAmount = Number(invoice.totalAmount || invoice.total || 0);
    const currentPaidAmount = Number(invoice.paidAmount || 0);
    const nextPaidAmount = currentPaidAmount + paymentAmount;
    if (nextPaidAmount > totalAmount) {
      return res.status(400).json({ message: "Overpayment not allowed" });
    }
    const remainingAmount = totalAmount - nextPaidAmount;
    const status = remainingAmount > 0 ? "partial" : "paid";

    const session = await mongoose.startSession();
    let updatedInvoice = null;
    try {
      await session.withTransaction(async () => {
        const invoiceInSession = await Invoice.findOne({
          _id: req.params.id,
          tenantId: req.tenantId,
          deletedAt: null,
        }).session(session);
        if (!invoiceInSession) throw new AppError("Invoice not found", 404);

        // Accumulate payment instead of overwriting previous paid amount.
        invoiceInSession.paidAmount = nextPaidAmount;
        invoiceInSession.remainingAmount = remainingAmount;
        invoiceInSession.status = status;
        invoiceInSession.payments = [
          ...(Array.isArray(invoiceInSession.payments) ? invoiceInSession.payments : []),
          { amount: paymentAmount, date: new Date() },
        ];
        invoiceInSession.paidAt = status === "paid" ? new Date() : invoiceInSession.paidAt;
        invoiceInSession.updatedBy = req.user?.id;
        invoiceInSession.auditLog = [
          ...(Array.isArray(invoiceInSession.auditLog) ? invoiceInSession.auditLog : []),
          { action: "invoice.pay", by: req.user?.id, note: `Payment recorded: ${paymentAmount}` },
        ];
        if (status === "paid" && !invoiceInSession.stockDeducted) {
          await deductInventoryForInvoice({
            invoice: invoiceInSession,
            tenantId: req.tenantId,
            userId: req.user?.id,
            session,
          });
        } else {
          await invoiceInSession.save({ session });
        }
        updatedInvoice = invoiceInSession;
      });
    } finally {
      await session.endSession();
    }

    let syncResult = null;
    if (invoice.projectId) {
      syncResult = await syncProjectFinancialsForProject({
        tenantId: req.tenantId,
        projectId: invoice.projectId,
        userId: req.user?.id,
      });
    }
    const paidDoc = updatedInvoice || invoice;
    const out =
      paidDoc && typeof paidDoc.toObject === "function"
        ? paidDoc.toObject()
        : paidDoc
          ? { ...paidDoc }
          : {};
    if (syncResult?.projectAutoCompleted) {
      out.projectAutoCompleted = true;
    }
    res.json(out);
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

router.get("/reports/project/:id", requireAdmin, async (req, res, next) => {
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

router.get("/reports/monthly", requireAdmin, async (req, res, next) => {
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
    invoices.forEach((invoice) => {
      const paidDate = invoice.paidAt ? new Date(invoice.paidAt) : null;
      if (!paidDate || Number.isNaN(paidDate.getTime())) return;
      const monthIndex = paidDate.getUTCMonth();
      const invoiceProfit = Number(invoice.profit || 0);
      const invoiceTotal = Number(invoice.total || 0);
      const paidAmount = Number(invoice.paidAmount ?? invoiceTotal);
      const realizedRatio = invoiceTotal > 0 ? Math.min(Math.max(paidAmount / invoiceTotal, 0), 1) : 0;
      monthlyBreakdown[monthIndex].profit += Number((invoiceProfit * realizedRatio).toFixed(2));
    });
    monthlyBreakdown.forEach((row) => {
      row.profit = Number((row.profit - row.expenses).toFixed(2));
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

router.get("/reports/yearly", requireAdmin, async (req, res, next) => {
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
      const invoiceProfit = Number(invoice.profit || 0);
      const invoiceTotal = Number(invoice.total || 0);
      const paidAmount = Number(invoice.paidAmount ?? invoiceTotal);
      const realizedRatio = invoiceTotal > 0 ? Math.min(Math.max(paidAmount / invoiceTotal, 0), 1) : 0;
      row.profit += Number((invoiceProfit * realizedRatio).toFixed(2));
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
      profit: Number((row.profit - row.expenses).toFixed(2)),
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

router.get("/inventory/search", async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return next(new AppError("Tenant context is required", 400));
    const q = String(req.query?.q || "").trim();
    if (!q) return res.json([]);
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const docs = await InventoryItem.find({
      tenantId,
      deletedAt: null,
      name: { $regex: escaped, $options: "i" },
    })
      .sort({ name: 1 })
      .limit(15)
      .select("_id name sku price unit category quantity")
      .lean();
    res.json(docs);
  } catch (error) {
    next(error);
  }
});

router.get("/inventory/sample", async (_req, res, next) => {
  try {
    const sampleRows = [
      {
        "Product Name": "Camera 2MP",
        SKU: "CAM-001",
        Quantity: 10,
        "Cost Price": 50000,
        "Selling Price": 65000,
        Category: "CCTV",
        Supplier: "Default Supplier",
      },
      {
        "Product Name": "Analog cam",
        SKU: "CAM-002",
        Quantity: 6,
        "Cost Price": 42000,
        "Selling Price": 54000,
        Category: "CCTV",
        Supplier: "Default Supplier",
      },
      {
        "Product Name": "Cam cable",
        SKU: "CAB-001",
        Quantity: 100,
        "Cost Price": 6000,
        "Selling Price": 8000,
        Category: "Accessories",
        Supplier: "Default Supplier",
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleRows, {
      header: ["Product Name", "SKU", "Quantity", "Cost Price", "Selling Price", "Category", "Supplier"],
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="inventory-import-sample.xlsx"');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.get("/inventory/export", async (req, res, next) => {
  try {
    const docs = await InventoryItem.find({ tenantId: req.tenantId, deletedAt: null }).sort({ createdAt: -1 }).lean();
    const rows = docs.map((item) => ({
      "Product Name": String(item?.name || ""),
      SKU: String(item?.sku || ""),
      Quantity: Number(item?.quantity || 0),
      "Cost Price": Number(item?.costPrice ?? item?.cost ?? 0),
      "Selling Price": Number(item?.sellingPrice ?? item?.price ?? 0),
      Category: String(item?.category || ""),
      Supplier: String(item?.supplier || ""),
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ["Product Name", "SKU", "Quantity", "Cost Price", "Selling Price", "Category", "Supplier"],
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="inventory-export.xlsx"');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.post("/inventory/import", inventoryImportUpload.single("file"), async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return next(new AppError("Tenant context is required", 400));
    if (!req.file?.buffer) return res.status(400).json({ message: "Excel file is required" });

    const fileName = String(req.file.originalname || "").toLowerCase();
    if (!(fileName.endsWith(".xlsx") || fileName.endsWith(".xls"))) {
      return res.status(400).json({ message: "Wrong format. Upload .xlsx or .xls file." });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames?.[0];
    if (!firstSheetName) return res.status(400).json({ message: "Wrong format. File has no sheet." });
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    const requiredColumns = ["Product Name", "SKU", "Quantity", "Selling Price", "Category"];
    const headerRow = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0 })?.[0] || [];
    const missingColumns = requiredColumns.filter((column) => !headerRow.includes(column));
    if (missingColumns.length > 0) {
      return res.status(400).json({
        message: `Missing required columns: ${missingColumns.join(", ")}`,
      });
    }
    if (!Array.isArray(jsonRows) || jsonRows.length === 0) {
      return res.status(400).json({ message: "Wrong format. File has no data rows." });
    }

    const rowErrors = [];
    const validRows = [];
    jsonRows.forEach((row, idx) => {
      const rowNumber = idx + 2; // +1 for 0-index and +1 for header
      const name = String(row["Product Name"] || row.Name || "").trim();
      const sku = String(row.SKU || "").trim().toUpperCase();
      const category = String(row.Category || "").trim();
      const sellingPriceRaw = row["Selling Price"] === "" || row["Selling Price"] === undefined
        ? row.Price
        : row["Selling Price"];
      const sellingPrice = Number(sellingPriceRaw);
      const costPriceRaw = row["Cost Price"];
      const costPrice = costPriceRaw === "" || costPriceRaw === undefined ? 0 : Number(costPriceRaw);
      const quantity = Number(row.Quantity);
      const supplier = String(row.Supplier || "").trim();

      if (!name || !sku || !category || !Number.isFinite(sellingPrice) || !Number.isFinite(quantity) || !Number.isFinite(costPrice)) {
        rowErrors.push({
          row: rowNumber,
          sku: sku || null,
          reason: "Each row must include valid Product Name, SKU, Category, Selling Price, Quantity, and numeric Cost Price.",
        });
      }
      if (
        Number.isFinite(sellingPrice) &&
        Number.isFinite(costPrice) &&
        Number.isFinite(quantity) &&
        (sellingPrice < 0 || costPrice < 0 || quantity < 0)
      ) {
        rowErrors.push({
          row: rowNumber,
          sku: sku || null,
          reason: "Cost Price, Selling Price and Quantity must be >= 0.",
        });
      }
      if (!rowErrors.some((errorItem) => errorItem.row === rowNumber)) {
        validRows.push({ name, sku, category, costPrice, sellingPrice, quantity, supplier });
      }
    });

    let created = 0;
    let updated = 0;
    for (const row of validRows) {
      const { name, sku, category, costPrice, sellingPrice, quantity, supplier } = row;
      const existing = await InventoryItem.findOne({ tenantId, sku, deletedAt: null });
      if (existing) {
        existing.name = name;
        existing.category = category;
        existing.price = sellingPrice;
        existing.sellingPrice = sellingPrice;
        existing.cost = costPrice;
        existing.costPrice = costPrice;
        existing.supplier = supplier;
        existing.quantity = quantity;
        existing.updatedBy = req.user?.id;
        existing.auditLog = [
          ...(Array.isArray(existing.auditLog) ? existing.auditLog : []),
          { action: "inventory.import_update", by: req.user?.id, note: "Updated from Excel import" },
        ];
        await existing.save();
        updated += 1;
      } else {
        await InventoryItem.create({
          tenantId,
          name,
          sku,
          category,
          price: sellingPrice,
          sellingPrice,
          cost: costPrice,
          costPrice,
          supplier,
          quantity,
          unit: "pcs",
          createdBy: req.user?.id,
          updatedBy: req.user?.id,
          auditLog: [{ action: "inventory.import_create", by: req.user?.id, note: "Created from Excel import" }],
        });
        created += 1;
      }
    }

    if (created + updated === 0 && rowErrors.length > 0) {
      return res.status(400).json({
        message: "No rows imported. Please fix the file and try again.",
        summary: { created: 0, updated: 0, total: 0, failed: rowErrors.length },
        errors: rowErrors,
      });
    }

    return res.status(rowErrors.length > 0 ? 207 : 200).json({
      message: rowErrors.length > 0 ? "Inventory import completed with some row errors." : "Inventory import completed",
      summary: { created, updated, total: created + updated, failed: rowErrors.length },
      errors: rowErrors,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/inventory/:id/usage", async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return next(new AppError("Tenant context is required", 400));
    const inventoryItem = await InventoryItem.findOne({ _id: req.params.id, tenantId, deletedAt: null }).lean();
    if (!inventoryItem) return res.status(404).json({ message: "Inventory item not found" });

    const usage = await InventoryUsage.find({
      tenantId,
      inventoryItemId: String(req.params.id),
      deletedAt: null,
      source: "quotation",
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      inventoryItem,
      usage,
      summary: {
        totalQuantity: usage.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
        totalAmount: usage.reduce((sum, row) => sum + Number(row.amount || 0), 0),
        linkedQuotations: new Set(usage.map((row) => String(row.quotationId || ""))).size,
        linkedInvoices: new Set(usage.map((row) => String(row.invoiceId || ""))).size,
        linkedProjects: new Set(usage.map((row) => String(row.projectId || ""))).size,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/inventory", async (req, res, next) => {
  try {
    const docs = await InventoryItem.find({}).sort({ createdAt: -1 }).lean();
    console.log("RESULT COUNT:", docs.length);
    const enriched = docs.map((item) => {
      const quantity = Number(item.quantity || 0);
      const minQuantity = Number(item.minQuantity || 0);
      const sellingPrice = Number(item.sellingPrice ?? item.price ?? 0);
      const costPrice = Number(item.costPrice ?? item.cost ?? 0);
      return {
        ...item,
        sellingPrice,
        costPrice,
        profitMargin: sellingPrice - costPrice,
        // Backward-compatible aliases for existing frontend flows.
        price: sellingPrice,
        cost: costPrice,
        lowStock: quantity <= minQuantity,
      };
    });
    res.json(enriched);
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
        companyName: COMPANY.name,
        companyAddress: COMPANY.address,
        companyPhone: COMPANY.phone,
        createdBy: req.user?.id,
        updatedBy: req.user?.id,
      });
    }
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.put("/settings", requireAdmin, async (req, res, next) => {
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
          companyName: COMPANY.name,
          companyAddress: COMPANY.address,
          companyPhone: COMPANY.phone,
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

router.post("/settings/logo", requireAdmin, logoUpload.single("logo"), async (req, res, next) => {
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
          companyName: COMPANY.name,
          companyAddress: COMPANY.address,
          companyPhone: COMPANY.phone,
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

router.get("/users", requireAdmin, async (req, res, next) => {
  try {
    const users = await User.find({}).select("-passwordHash -resetToken -resetTokenExpiry").sort({ createdAt: -1 });
    console.log("RESULT COUNT:", users.length);
    const normalized = users.map((user) => ({
      ...user.toObject(),
      role: (user.role === "admin" || user.role === "company_admin") ? "admin" : "employee",
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
      role: (user.role === "admin" || user.role === "company_admin") ? "admin" : "employee",
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
      role: (user.role === "admin" || user.role === "company_admin") ? "admin" : "employee",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/users", requireAdmin, async (req, res, next) => {
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

router.put("/users/:id", requireAdmin, async (req, res, next) => {
  try {
    const updates = {};
    if (typeof req.body?.fullName === "string") updates.fullName = req.body.fullName.trim();
    if (typeof req.body?.role === "string") {
      const inputRole = req.body.role.trim().toLowerCase();
      const newDbRole = inputRole === "admin" ? "company_admin" : "sales";
      if (newDbRole === "sales") {
        const current = await User.findOne({ _id: req.params.id, tenantId: req.tenantId }).select("role").lean();
        const isCurrentlyAdmin = current?.role === "admin" || current?.role === "company_admin";
        if (isCurrentlyAdmin) {
          const adminCount = await User.countDocuments({ tenantId: req.tenantId, role: { $in: ["admin", "company_admin"] } });
          if (adminCount <= 1) {
            return res.status(400).json({ message: "Cannot demote the last admin. Promote another user to admin first." });
          }
        }
      }
      updates.role = newDbRole;
    }
    if (typeof req.body?.email === "string") updates.email = req.body.email.trim().toLowerCase();
    const user = await User.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenantId }, updates, { new: true }).select("-passwordHash -resetToken -resetTokenExpiry");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      ...user.toObject(),
      role: (user.role === "admin" || user.role === "company_admin") ? "admin" : "employee",
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/users/:id", requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (error) {
    next(error);
  }
});

router.post("/users/:id/reset-password", requireAdmin, async (req, res, next) => {
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
    const [leads, clients, projects, quotations, invoices, tickets, revenueAgg] = await Promise.all([
      Lead.countDocuments({ tenantId, deletedAt: null }),
      Client.countDocuments({ tenantId, deletedAt: null }),
      Project.countDocuments({ tenantId, deletedAt: null }),
      Quotation.countDocuments({ tenantId, deletedAt: null }),
      Invoice.countDocuments({ tenantId, deletedAt: null }),
      Ticket.countDocuments({ tenantId, deletedAt: null }),
      Invoice.aggregate([
        { $match: { tenantId, deletedAt: null } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $ifNull: ["$total", 0] } },
          },
        },
      ]),
    ]);
    const totalRevenue = Number(revenueAgg?.[0]?.totalRevenue || 0);
    res.json({ leads, clients, projects, quotations, invoices, tickets, totalRevenue });
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
    Visit,
    Quotation,
    Project,
    Invoice,
    Expense,
    InventoryItem,
    InventoryUsage,
    Ticket,
    Settings,
  },
};
