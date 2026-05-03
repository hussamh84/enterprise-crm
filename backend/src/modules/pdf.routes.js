const express = require("express");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const env = require("../config/env");
const { COMPANY } = require("../config/company");
const { models } = require("./index");

const router = express.Router();

/** Display-only; keep in sync with frontend `src/utils/defaultDocNotes.js`. */
const DEFAULT_PAYMENT_NOTE_LINES = [
  "70% advance payment is required.",
  "30% is due upon project completion.",
];
const DEFAULT_QUOTATION_NOTE_LINES = [
  "This quotation is valid for 15 days only.",
  ...DEFAULT_PAYMENT_NOTE_LINES,
  "Warranty is 1 year.",
];
const DEFAULT_INVOICE_NOTE_LINES = [...DEFAULT_PAYMENT_NOTE_LINES, "Warranty is 1 year."];

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
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#0f172a")
    .text("Bill To:", 62, top + 10)
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#334155")
    .text(record.clientName || record.name || "Client", 62, top + 30)
    .text(`Phone: ${record.clientPhone || "-"}`, 62, top + 46)
    .text(`Email: ${record.clientEmail || "-"}`, 62, top + 62)
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

const addItemsTable = (doc, rows, top = 356) => {
  const items = rows?.length ? rows : [{ description: "Service", quantity: 1, unitPrice: 0, total: 0 }];
  const x = 50;
  const tableWidth = 500;
  const rowHeight = 30; // equivalent to 8px vertical spacing
  const cellPaddingX = 12; // equivalent to 12px horizontal spacing
  const descriptionWidth = 236;
  const qtyWidth = 70;
  const unitWidth = 97;
  const totalWidth = 97;
  const col1 = x;
  const col2 = col1 + descriptionWidth;
  const col3 = col2 + qtyWidth;
  const col4 = col3 + unitWidth;
  doc.roundedRect(x, top - 4, tableWidth, rowHeight, 4).fillAndStroke("#f8fafc", "#e2e8f0");
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#475569")
    .text("Description", col1 + cellPaddingX, top + 8, { width: descriptionWidth - cellPaddingX * 2, align: "left" })
    .text("Qty", col2, top + 3, { width: qtyWidth, align: "center" })
    .text("Unit Price", col3, top + 8, { width: unitWidth - cellPaddingX, align: "right" })
    .text("Total", col4, top + 8, { width: totalWidth - cellPaddingX, align: "right" });

  let y = top + rowHeight + 6;
  let subtotal = 0;
  items.forEach((item, index) => {
    const qty = Number(item.quantity || item.qty || 1);
    const rate = Number(item.unitPrice || item.rate || 0);
    const amount = Number(item.total != null ? item.total : qty * rate);
    subtotal += amount;
    if (index % 2 === 0) doc.rect(x, y - 4, tableWidth, rowHeight).fill("#fcfdff");
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#0a2540")
      .text(item.description || item.name || "Line Item", col1 + cellPaddingX, y + 8, { width: descriptionWidth - cellPaddingX * 2, align: "left" })
      .text(String(qty), col2, y + 8, { width: qtyWidth, align: "center" })
      .text(formatCurrency(rate), col3, y + 8, { width: unitWidth - cellPaddingX, align: "right" })
      .text(formatCurrency(amount), col4, y + 8, { width: totalWidth - cellPaddingX, align: "right" });
    doc.moveTo(x, y + rowHeight - 4).lineTo(x + tableWidth, y + rowHeight - 4).strokeColor("#eef2f7").stroke();
    y += rowHeight + 2;
  });

  return { y, subtotal };
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
  const y = Math.min(startY + 8, 690);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#374151").text("Notes", 50, y);
  let lineY = y + 16;
  doc.font("Helvetica").fontSize(10).fillColor("#555");
  lines.forEach((item) => {
    doc.text(`• ${item}`, 58, lineY, { width: 492 });
    lineY += 16;
  });
  return lineY;
};

const addQuotationNotes = (doc, startY) => addBulletedNotes(doc, startY, DEFAULT_QUOTATION_NOTE_LINES);

const streamPdf = (res, filename, painter) => {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  doc.pipe(res);
  painter(doc);
  doc.end();
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
        ? String(quotation.walkInCustomerEmail || "").trim() || "-"
        : client?.contacts?.[0]?.email || quotation.clientEmail,
      clientPhone: walkBill
        ? String(quotation.walkInCustomerPhone || "").trim() || "-"
        : client?.contacts?.[0]?.phone || quotation.clientPhone,
      clientAddress: quotation.clientAddress || "-",
    };

    streamPdf(res, `quotation-${quotation._id}.pdf`, (doc) => {
      addWatermark(doc, branding);
      addHeader(doc, {
        title: "Quotation",
        docNoLabel: "Quotation No:",
        docNo: String(quotation.quotationNo || "").trim() || "—",
        branding,
        issueDate: new Date(quotation.createdAt || Date.now()).toLocaleDateString(),
      });
      addStatusBadge(doc, "QUOTATION");
      const tableTop = addPartyBlock(doc, printableQuotation, project);
      const { y, subtotal } = addItemsTable(doc, printableQuotation.items, tableTop + 8);
      const totalsEndY = addTotals(doc, {
        subtotal: printableQuotation.subtotal ?? subtotal,
        discount: printableQuotation.discount,
        tax: printableQuotation.tax,
        grandTotal: printableQuotation.grandTotal,
      }, y);
      const notesEndY = addQuotationNotes(doc, totalsEndY);
      doc
        .fontSize(9)
        .fillColor("#6b7c93")
        .text("Thank you for your business", 50, Math.min(notesEndY + 12, 760));
    });
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
      clientEmail: client?.contacts?.[0]?.email || invoice.clientEmail,
      clientPhone: client?.contacts?.[0]?.phone || client?.phone || invoice.clientPhone,
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

    streamPdf(res, `invoice-${invoice.invoiceNo || invoice._id}.pdf`, (doc) => {
      const invoiceNumber = String(invoice.invoiceNumber || invoice.invoiceNo || "").trim() || "—";
      addWatermark(doc, branding);
      addHeader(doc, {
        title: "Invoice",
        docNoLabel: "Invoice #:",
        docNo: invoiceNumber,
        branding,
        issueDate: new Date(invoice.createdAt || Date.now()).toLocaleDateString(),
      });
      addStatusBadge(doc, badgeLabel);
      const tableTop = addPartyBlock(doc, printableInvoice, project);
      const { y, subtotal: lineSubtotal } = addItemsTable(doc, items, tableTop + 8);
      const summarySubtotal = quotation
        ? Number(quotation.subtotal != null ? quotation.subtotal : lineSubtotal)
        : lineSubtotal;
      const totalsEndY = addTotals(
        doc,
        {
          subtotal: summarySubtotal,
          discount,
          tax,
          grandTotal,
        },
        y
      );
      const summaryBaseY = totalsEndY;
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#0f172a")
        .text(`Status: ${statusLabel}`, 50, summaryBaseY - 8)
        .text(`Paid to date: ${formatCurrency(paid)}`, 50, summaryBaseY + 8)
        .text(`Balance due: ${formatCurrency(remaining)}`, 50, summaryBaseY + 24);
      const notesEndY = addBulletedNotes(doc, summaryBaseY + 36, DEFAULT_INVOICE_NOTE_LINES);
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#6b7c93")
        .text("Thank you for your business", 50, Math.min(notesEndY + 12, 760));
    });
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
