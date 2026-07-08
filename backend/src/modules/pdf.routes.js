const express = require("express");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { streamHtmlPdf, streamUrlPdf } = require("../services/htmlPdfRenderer");
const {
  buildQuotationHtml,
  buildInvoiceHtml,
} = require("../templates/documentPdfTemplate");
const env = require("../config/env");
const { COMPANY } = require("../config/company");
const { models } = require("./index");

const router = express.Router();

/** Display-only; keep in sync with frontend `src/utils/defaultDocNotes.js`. */
const DEFAULT_PAYMENT_NOTE_LINES = [
  "70% advance payment is required.",
  "30% is due upon project completion.",
];
const DEFAULT_INVOICE_NOTE_LINES = [...DEFAULT_PAYMENT_NOTE_LINES, "Warranty is 1 year."];

/** Backward-compat defaults for quotations saved before per-quotation notes existed. */
const QUOTATION_NOTES_DEFAULTS = {
  validity: "1 day",
  advancePercent: 70,
  warranty: "1 year",
};

/** Builds the editable Notes section for a quotation PDF: validity, advance/remaining payment, warranty, extra notes. */
const buildQuotationNoteLines = (quotation) => {
  const validity = String(quotation?.quotationValidity || "").trim() || QUOTATION_NOTES_DEFAULTS.validity;
  const rawAdvance = quotation?.advancePaymentPercent;
  const advance =
    rawAdvance === null || rawAdvance === undefined || rawAdvance === ""
      ? QUOTATION_NOTES_DEFAULTS.advancePercent
      : Math.min(100, Math.max(0, Number(rawAdvance)));
  const remaining = Math.max(0, 100 - advance);
  const warranty = String(quotation?.warranty || "").trim() || QUOTATION_NOTES_DEFAULTS.warranty;

  const lines = [
    `Quotation validity: ${validity}`,
    `Advance payment: ${advance}%`,
    `Remaining payment: ${remaining}%`,
    `Warranty: ${warranty}`,
  ];

  const additional = String(quotation?.additionalNotes || "").trim();
  if (additional) {
    additional
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => lines.push(line));
  }

  return lines;
};

const pickBrandingField = (settingsValue, envValue, defaultValue) => {
  const s = typeof settingsValue === "string" ? settingsValue.trim() : "";
  if (s) return s;
  const e = typeof envValue === "string" ? envValue.trim() : "";
  if (e) return e;
  return typeof defaultValue === "string" ? defaultValue : "";
};

const resolveLogoPath = (configuredPath) => {
  const candidates = [];
  if (typeof configuredPath === "string" && configuredPath.trim()) {
    const trimmed = configuredPath.trim();
    if (trimmed === COMPANY.logo || trimmed === "/logo.png") {
      candidates.push(path.resolve(process.cwd(), "../frontend/public/logo.png"));
    } else if (trimmed.startsWith("/uploads/")) {
      candidates.push(path.resolve(process.cwd(), `.${trimmed}`));
    } else {
      candidates.push(trimmed);
    }
  }
  // Force default branding logo path.
  candidates.push(path.resolve(process.cwd(), "../frontend/public/logo.png"));

  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
};

const resolveBranding = async (tenantId) => {
  const settings = await models.Settings.findOne({ tenantId, deletedAt: null });
  const logoConfigured =
    (typeof settings?.companyLogoUrl === "string" && settings.companyLogoUrl.trim()) ||
    (typeof env.companyLogoPath === "string" && env.companyLogoPath.trim()) ||
    COMPANY.logo;
  const logoPath = resolveLogoPath(logoConfigured);
  return {
    companyName: pickBrandingField(settings?.companyName, env.companyName, COMPANY.name),
    companyAddress: pickBrandingField(settings?.companyAddress, env.companyAddress, COMPANY.address),
    companyPhone: pickBrandingField(settings?.companyPhone, env.companyPhone, COMPANY.phone),
    companyEmail: pickBrandingField(settings?.companyEmail, env.companyEmail, COMPANY.email),
    companyTaxId: env.companyTaxId,
    companyLogoPath: logoPath,
  };
};

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const A4_HEIGHT = 841.89;
const PAGE_MARGIN_TOP = 50;
const PAGE_MARGIN_BOTTOM = 50;
const USABLE_BOTTOM = A4_HEIGHT - PAGE_MARGIN_BOTTOM;

const sanitizeForFilename = (str) =>
  String(str || "").trim().replace(/[^a-zA-Z0-9\-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

const getInvoiceStatusLabel = (invoice, remaining, paid) => {
  const raw = String(invoice?.status || "").toLowerCase();
  if (remaining <= 0 || raw === "paid") return "Paid";
  if (paid > 0 || raw === "partial") return "Partial";
  return "Draft";
};

const addWatermark = (doc, branding) => {
  if (!branding.companyLogoPath) return;
  doc.save();
  doc.opacity(0.05);
  doc.image(branding.companyLogoPath, 120, 250, { fit: [340, 340], align: "center", valign: "center" });
  doc.restore();
};

const addHeader = (doc, { title, docNoLabel = "Quotation No:", docNo, branding, issueDate }) => {
  const topY = 42;
  if (branding.companyLogoPath) {
    doc.image(branding.companyLogoPath, 50, 34, { fit: [140, 140] });
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(26)
    .fillColor("#0f172a")
    .text(title.toUpperCase(), 330, topY, { width: 220, align: "right" })
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#475569")
    .text(`${docNoLabel} ${docNo}`, 330, topY + 40, { width: 220, align: "right" })
    .text(`Issue Date: ${issueDate}`, 330, topY + 56, { width: 220, align: "right" });

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#64748b")
    .text(branding.companyName, 50, 158, { width: 500 })
    .text(branding.companyAddress, 50, 174, { width: 500 })
    .text(branding.companyPhone, 50, 188, { width: 500 })
    .text(branding.companyEmail, 50, 202, { width: 500 });

  doc.moveTo(50, 222).lineTo(550, 222).strokeColor("#e2e8f0").stroke();
};

const addStatusBadge = (doc, label, x = 462, y = 232) => {
  const width = 88;
  const color = label === "PAID" ? "#16a34a" : label === "UNPAID" ? "#dc2626" : "#4f46e5";
  doc.save();
  doc.roundedRect(x, y, width, 20, 8).fillOpacity(0.12).fill(color).fillOpacity(1);
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(color)
    .text(label, x, y + 6, { width, align: "center" });
  doc.restore();
};

const formatQuotationProjectTypePdf = (quotationLike, project) => {
  const qPt = String(quotationLike?.projectType || "").trim();
  const qCt = String(quotationLike?.cctvType || "").trim();
  if (qPt.toLowerCase() === "cctv" && qCt) return `CCTV - ${qCt}`;
  if (qPt) return qPt;
  const pPt = String(project?.projectType || "").trim();
  const pCt = String(project?.cctvType || "").trim();
  const up = pPt.toUpperCase();
  if (pPt.toLowerCase() === "cctv" && pCt) return `CCTV - ${pCt}`;
  if (up === "CCTV_IP") return "CCTV - IP";
  if (up === "CCTV_ANALOG") return "CCTV - Analog";
  if (up === "SOLAR") return "Solar System";
  if (up === "NETWORK" || pPt === "Network") return "Network";
  if (pPt) return pPt;
  return "—";
};

const addPartyBlock = (doc, record, project) => {
  const top = 250;
  const blockH = 104;
  doc.roundedRect(50, top, 500, blockH, 6).fillAndStroke("#ffffff", "#e2e8f0");
  const typeLine = formatQuotationProjectTypePdf(record, project);

  const phone = String(record.clientPhone || "").trim();
  const email = String(record.clientEmail || "").trim();

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#0f172a")
    .text("Bill To:", 62, top + 10)
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#334155")
    .text(record.clientName || record.name || "Client", 62, top + 30);

  let leftY = top + 46;
  if (phone) {
    doc.text(phone, 62, leftY);
    leftY += 16;
  }
  if (email) {
    doc.text(email, 62, leftY);
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#64748b")
    .text("Project", 300, top + 14)
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#334155")
    .text(project?.name || record.projectName || "-", 300, top + 28, { width: 230 })
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#64748b")
    .text("Project Type", 300, top + 52)
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#334155")
    .text(typeLine, 300, top + 66, { width: 230 });

  return top + blockH + 10;
};

const addQuotationMetaBlock = (doc, quotation) => {
  doc
    .roundedRect(360, 146, 190, 80, 8)
    .fillAndStroke("#ffffff", "#e6ebf1");

  doc
    .fontSize(9)
    .fillColor("#6b7c93")
    .text("Quotation Status", 372, 156)
    .fontSize(11)
    .fillColor("#0a2540")
    .text(String(quotation.status || "Draft").toUpperCase(), 372, 170, { width: 166, align: "right" })
    .fontSize(9)
    .fillColor("#6b7c93")
    .text("Prepared On", 372, 188)
    .fontSize(10)
    .fillColor("#0a2540")
    .text(new Date(quotation.createdAt || Date.now()).toLocaleDateString(), 372, 202, { width: 166, align: "right" });
};

const TABLE_HEADER_H = 26;
const TABLE_MIN_ROW_H = 24;
const TABLE_CELL_PAD_X = 10;
const TABLE_FONT_SIZE = 9;

const drawTableHeader = (doc, hTop, col1, col2, col3, col4, tableWidth, descW, qtyW, unitW) => {
  doc.roundedRect(col1, hTop, tableWidth, TABLE_HEADER_H, 4).fillAndStroke("#f8fafc", "#e2e8f0");
  doc
    .font("Helvetica-Bold")
    .fontSize(TABLE_FONT_SIZE)
    .fillColor("#475569")
    .text("Description", col1 + TABLE_CELL_PAD_X, hTop + 8, { width: descW - TABLE_CELL_PAD_X * 2, align: "left", lineBreak: false })
    .text("Qty", col2, hTop + 8, { width: qtyW, align: "center", lineBreak: false })
    .text("Unit Price", col3, hTop + 8, { width: unitW - TABLE_CELL_PAD_X, align: "right", lineBreak: false })
    .text("Total", col4, hTop + 8, { width: unitW - TABLE_CELL_PAD_X, align: "right", lineBreak: false });
  return hTop + TABLE_HEADER_H;
};

const addSectionHeader = (doc, title, y) => {
  const h = 24;
  if (y + h + 10 > USABLE_BOTTOM) {
    doc.addPage();
    y = PAGE_MARGIN_TOP;
  }
  doc.rect(50, y, 500, h).fillColor("#e2e8f0").fill();
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#0f172a")
    .text(String(title || "").toUpperCase(), 62, y + 8, { lineBreak: false });
  return y + h + 4;
};

const addItemsTable = (doc, rows, top = 356) => {
  const items = rows?.length ? rows : [{ description: "Service", quantity: 1, unitPrice: 0, total: 0 }];
  const x = 50;
  const tableWidth = 500;
  const descW = 242;
  const qtyW = 62;
  const unitW = 98;
  const col1 = x;
  const col2 = col1 + descW;
  const col3 = col2 + qtyW;
  const col4 = col3 + unitW;

  let y = drawTableHeader(doc, top, col1, col2, col3, col4, tableWidth, descW, qtyW, unitW) + 2;
  let subtotal = 0;

  items.forEach((item, index) => {
    const qty = Number(item.quantity || item.qty || 1);
    const rate = Number(item.unitPrice || item.rate || 0);
    const amount = Number(item.total != null ? item.total : qty * rate);
    subtotal += amount;

    const descText = String(item.description || item.name || "Line Item");
    // Measure actual wrapped height so we allocate the right row height
    const descH = doc.font("Helvetica").fontSize(TABLE_FONT_SIZE).heightOfString(descText, {
      width: descW - TABLE_CELL_PAD_X * 2,
    });
    const rowH = Math.max(descH + 14, TABLE_MIN_ROW_H);

    // If this row won't fit on the current page, start a fresh page with a new header
    if (y + rowH > USABLE_BOTTOM - 20) {
      doc.addPage();
      y = PAGE_MARGIN_TOP;
      y = drawTableHeader(doc, y, col1, col2, col3, col4, tableWidth, descW, qtyW, unitW) + 2;
    }

    // Zebra stripe
    if (index % 2 === 0) {
      doc.rect(x, y, tableWidth, rowH).fill("#fafcff");
    }

    // Description (top-aligned within row)
    doc.font("Helvetica").fontSize(TABLE_FONT_SIZE).fillColor("#0a2540");
    doc.text(descText, col1 + TABLE_CELL_PAD_X, y + 7, {
      width: descW - TABLE_CELL_PAD_X * 2,
      align: "left",
      lineBreak: true,
    });

    // Qty / Unit Price / Total — vertically centred
    const midY = y + Math.max((rowH - TABLE_FONT_SIZE) / 2, 7);
    doc
      .text(String(qty), col2, midY, { width: qtyW, align: "center", lineBreak: false })
      .text(formatCurrency(rate), col3, midY, { width: unitW - TABLE_CELL_PAD_X, align: "right", lineBreak: false })
      .text(formatCurrency(amount), col4, midY, { width: unitW - TABLE_CELL_PAD_X, align: "right", lineBreak: false });

    doc.moveTo(x, y + rowH).lineTo(x + tableWidth, y + rowH).strokeColor("#eef2f7").lineWidth(0.5).stroke();
    y += rowH;
  });

  return { y: y + 6, subtotal };
};

const addTotals = (doc, { subtotal, discount = {}, tax = 0, grandTotal, total }, startY) => {
  const discountAmount = Number(discount.amount != null ? discount.amount : discount || 0);
  const discountLabel = discount.type === "percentage"
    ? `Discount (${Number(discount.value || 0)}%)`
    : "Discount";
  const calculatedTotal = grandTotal != null
    ? Number(grandTotal)
    : total != null
      ? Number(total)
      : subtotal - discountAmount + Number(tax);

  // Totals block height: 3 rows × 18 + divider 12 + grand-total 22 + padding = ~100px
  if (startY + 100 > USABLE_BOTTOM) {
    doc.addPage();
    startY = PAGE_MARGIN_TOP;
  }

  let y = startY + 18;
  const summaryX = 330;
  const summaryWidth = 220;

  [
    ["Subtotal", subtotal],
    [discountLabel, discountAmount],
    ["Tax", Number(tax || 0)],
  ].forEach(([label, amount]) => {
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(label, summaryX, y, { width: 90, align: "left" })
      .text(formatCurrency(amount), summaryX + 90, y, { width: 130, align: "right" });
    y += 18;
  });

  y += 2;
  doc.moveTo(summaryX, y).lineTo(summaryX + summaryWidth, y).strokeColor("#e5e7eb").stroke();
  y += 10;

  /* Grand total: tight cluster, flex-end style (no space-between, no wide split). */
  const pageContentRight = 545;
  const gapLabelToAmount = 10;
  const gapAmountToSdg = 5;

  const labelText = "Grand Total";
  doc.font("Helvetica-Bold").fontSize(14);
  const labelW = doc.widthOfString(labelText);

  const amountText = formatCurrency(calculatedTotal);
  doc.font("Helvetica-Bold").fontSize(14);
  const amountW = doc.widthOfString(amountText);

  doc.font("Helvetica").fontSize(12);
  const sdgText = "SDG";
  const sdgW = doc.widthOfString(sdgText);

  const clusterW = labelW + gapLabelToAmount + amountW + gapAmountToSdg + sdgW;
  let x = pageContentRight - clusterW;

  doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f172a");
  doc.text(labelText, x, y, { lineBreak: false });
  x += labelW + gapLabelToAmount;
  doc.text(amountText, x, y, { lineBreak: false });
  x += amountW + gapAmountToSdg;

  doc.save();
  doc.opacity(0.7);
  doc.font("Helvetica").fontSize(12).fillColor("#64748b");
  doc.text(sdgText, x, y + 1, { lineBreak: false });
  doc.restore();

  y += 22;
  return y;
};

const addBulletedNotes = (doc, startY, lines) => {
  // Keep the notes heading + all bullet lines together on one page
  const notesH = 20 + lines.length * 16;
  if (startY + notesH > USABLE_BOTTOM) {
    doc.addPage();
    startY = PAGE_MARGIN_TOP;
  }
  const y = startY + 8;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#374151").text("Notes", 50, y);
  let lineY = y + 16;
  doc.font("Helvetica").fontSize(9).fillColor("#555");
  lines.forEach((item) => {
    doc.text(`• ${item}`, 58, lineY, { width: 492 });
    lineY += 15;
  });
  return lineY;
};

const streamPdf = (res, filename, painter) => {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  doc.pipe(res);
  painter(doc);
  doc.end();
};

const computeItemsSubtotal = (items = []) =>
  items.reduce((sum, item) => {
    const qty = Number(item.quantity || item.qty || 1);
    const rate = Number(item.unitPrice || item.rate || 0);
    const amount = Number(item.total != null ? item.total : qty * rate);
    return sum + amount;
  }, 0);

const frontendBaseUrl = String(env.frontendUrl || env.clientOrigin || "").replace(/\/$/, "");

const tryStreamFrontendPrintPdf = async (res, filename, printPath, accessToken) => {
  if (!frontendBaseUrl || !accessToken) return false;
  const printUrl = `${frontendBaseUrl}${printPath}?access_token=${encodeURIComponent(accessToken)}`;
  try {
    await streamUrlPdf(res, filename, printUrl);
    return true;
  } catch (error) {
    console.warn("[PDF] Frontend print rendering failed, falling back to server HTML:", error.message);
    return false;
  }
};

router.get("/quotations/:id/pdf", async (req, res, next) => {
  try {
    const branding = await resolveBranding(req.tenantId);
    const quotation = await models.Quotation.findOne({ _id: req.params.id, tenantId: req.tenantId, deletedAt: null });
    if (!quotation) return res.status(404).json({ message: "Quotation not found" });
    const client = quotation.clientId
      ? await models.Client.findOne({ _id: quotation.clientId, tenantId: req.tenantId, deletedAt: null })
      : null;
    const project = quotation.projectId
      ? await models.Project.findOne({ _id: quotation.projectId, tenantId: req.tenantId, deletedAt: null })
      : null;
    const walkBill = String(quotation.walkInCustomerName || "").trim();
    const printableQuotation = {
      ...quotation.toObject(),
      clientName: walkBill || client?.name || quotation.clientName,
      projectName: project?.name || quotation.projectName,
      clientEmail: walkBill
        ? String(quotation.walkInCustomerEmail || "").trim() || ""
        : client?.contacts?.[0]?.email || client?.email || quotation.clientEmail || "",
      clientPhone: walkBill
        ? String(quotation.walkInCustomerPhone || "").trim() || ""
        : client?.contacts?.[0]?.phone || client?.phone || quotation.clientPhone || "",
      clientAddress: quotation.clientAddress || "-",
    };

    const qClientName = sanitizeForFilename(printableQuotation.clientName || "Client");
    const qNumber = sanitizeForFilename(quotation.quotationNo || String(quotation._id));
    const quotationFilename = `${qClientName}-Quotation-${qNumber}.pdf`;

    const rawSections = Array.isArray(printableQuotation.sections) ? printableQuotation.sections : [];
    const allItems = Array.isArray(printableQuotation.items) ? printableQuotation.items : [];
    const accessToken = String(req.query.access_token || "");
    const usedFrontendPrint = await tryStreamFrontendPrintPdf(
      res,
      quotationFilename,
      `/print/quotations/${req.params.id}`,
      accessToken
    );
    if (usedFrontendPrint) return;

    const combinedSubtotal = computeItemsSubtotal(allItems);
    const html = buildQuotationHtml({
      branding,
      record: printableQuotation,
      project,
      items: allItems,
      sections: rawSections,
      totals: {
        subtotal: printableQuotation.subtotal ?? combinedSubtotal,
        discount: printableQuotation.discount,
        tax: printableQuotation.tax,
        grandTotal: printableQuotation.grandTotal,
      },
      notes: buildQuotationNoteLines(printableQuotation),
    });

    await streamHtmlPdf(res, quotationFilename, html);
  } catch (error) {
    next(error);
  }
});

router.get("/invoices/:id/pdf", async (req, res, next) => {
  try {
    const branding = await resolveBranding(req.tenantId);
    const invoice = await models.Invoice.findOne({ _id: req.params.id, tenantId: req.tenantId, deletedAt: null });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    const quotation = invoice.quotationId
      ? await models.Quotation.findOne({ _id: String(invoice.quotationId), tenantId: req.tenantId, deletedAt: null })
      : null;
    const client = invoice.clientId
      ? await models.Client.findOne({ _id: invoice.clientId, tenantId: req.tenantId, deletedAt: null })
      : null;
    const project = invoice.projectId
      ? await models.Project.findOne({ _id: invoice.projectId, tenantId: req.tenantId, deletedAt: null })
      : null;
    const printableInvoice = {
      ...invoice.toObject(),
      clientName: client?.name || invoice.clientName,
      projectName: project?.name || invoice.projectName,
      clientEmail: client?.contacts?.[0]?.email || client?.email || invoice.clientEmail || "",
      clientPhone: client?.contacts?.[0]?.phone || client?.phone || invoice.clientPhone || "",
    };
    const total = Number(invoice.total || 0);
    const paid = Number(invoice.paidAmount || 0);
    const remaining = Number(invoice.remainingAmount ?? Math.max(total - paid, 0));
    const statusLabel = getInvoiceStatusLabel(invoice, remaining, paid);
    const badgeLabel = statusLabel.toUpperCase();
    const invoiceItems = Array.isArray(invoice.items) ? invoice.items : [];
    const items = quotation?.items?.length
      ? quotation.items
      : invoiceItems.length
        ? invoiceItems
        : [{ description: "Invoice amount", quantity: 1, unitPrice: total, total }];
    const discount = quotation?.discount && typeof quotation.discount === "object"
      ? quotation.discount
      : { amount: 0 };
    const tax = quotation ? Number(quotation.tax ?? 0) : 0;
    const grandTotal = total;

    const invoiceNumber = String(invoice.invoiceNumber || invoice.invoiceNo || "").trim() || "—";

    const accessToken = String(req.query.access_token || "");
    const usedFrontendPrint = await tryStreamFrontendPrintPdf(
      res,
      `invoice-${invoice.invoiceNo || invoice._id}.pdf`,
      `/print/invoices/${req.params.id}`,
      accessToken
    );
    if (usedFrontendPrint) return;

    const lineSubtotal = computeItemsSubtotal(items);
    const summarySubtotal = quotation
      ? Number(quotation.subtotal != null ? quotation.subtotal : lineSubtotal)
      : lineSubtotal;

    const html = buildInvoiceHtml({
      branding,
      record: printableInvoice,
      project,
      items,
      totals: {
        subtotal: summarySubtotal,
        discount,
        tax,
        grandTotal,
      },
      notes: DEFAULT_INVOICE_NOTE_LINES,
      invoiceNumber,
      statusLabel,
      paid,
      remaining,
      badgeLabel,
    });

    await streamHtmlPdf(res, `invoice-${invoice.invoiceNo || invoice._id}.pdf`, html);
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:id/pdf", async (req, res, next) => {
  try {
    const branding = await resolveBranding(req.tenantId);
    const project = await models.Project.findOne({ _id: req.params.id, tenantId: req.tenantId, deletedAt: null });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const client = project.clientId
      ? await models.Client.findOne({ _id: project.clientId, tenantId: req.tenantId, deletedAt: null })
      : null;

    streamPdf(res, `project-${project._id}.pdf`, (doc) => {
      addWatermark(doc, branding);
      addHeader(doc, {
        title: "Project",
        docNoLabel: "Project ID:",
        docNo: String(project._id),
        branding,
        issueDate: new Date(project.createdAt || Date.now()).toLocaleDateString(),
      });

      doc
        .roundedRect(50, 250, 500, 180, 6)
        .fillAndStroke("#ffffff", "#e2e8f0");

      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor("#0f172a")
        .text(project.name || "Project", 66, 268);

      const rows = [
        ["Client", client?.name || "—"],
        ["Status", String(project.status || "—").toUpperCase()],
        ["Start Date", project.startDate ? new Date(project.startDate).toLocaleDateString() : "—"],
        ["End Date", project.endDate ? new Date(project.endDate).toLocaleDateString() : "—"],
        ["Revenue", formatCurrency(project.totalRevenue || 0)],
        ["Expenses", formatCurrency(project.totalExpenses || 0)],
        ["Profit", formatCurrency(project.profit || 0)],
      ];

      let y = 300;
      rows.forEach(([label, value]) => {
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor("#475569")
          .text(`${label}:`, 66, y, { width: 120 })
          .font("Helvetica")
          .fillColor("#0f172a")
          .text(String(value), 188, y, { width: 340 });
        y += 20;
      });
    });
  } catch (error) {
    next(error);
  }
});

module.exports = { pdfRouter: router };
