const express = require("express");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const env = require("../config/env");
const { models } = require("./index");

console.log("CHECK PAGE:", __filename);

const router = express.Router();
const PDF_COMPANY = {
  name: "Config Engineering",
  address: "Sudan, Omdurman, Al Abraj St.",
  phone: "Phone No: +249 912679849 - +249 124000486",
  email: "Email: configengineering.sd@gmail.com",
};

const resolveLogoPath = (configuredPath) => {
  const candidates = [];
  if (typeof configuredPath === "string" && configuredPath.trim()) {
    const trimmed = configuredPath.trim();
    if (trimmed === "/logo.png") {
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
  const logoPath = resolveLogoPath(settings?.companyLogoUrl || env.companyLogoPath || "/logo.png");
  return {
    companyName: PDF_COMPANY.name,
    companyAddress: PDF_COMPANY.address,
    companyPhone: PDF_COMPANY.phone,
    companyEmail: PDF_COMPANY.email,
    companyTaxId: env.companyTaxId,
    companyLogoPath: logoPath,
  };
};

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatSdgMoney = (value = 0) => `SDG ${formatCurrency(value)}`;

const formatInvoiceNumber = (id = "") => {
  const short = String(id).slice(-6).toUpperCase();
  return `QTN-2026-${short}`;
};

const addWatermark = (doc, branding) => {
  if (!branding.companyLogoPath) return;
  doc.save();
  doc.opacity(0.05);
  doc.image(branding.companyLogoPath, 120, 250, { fit: [340, 340], align: "center", valign: "center" });
  doc.restore();
};

const addHeader = (doc, { title, docNo, branding, issueDate, dueDate }) => {
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
    .text(`Quotation No: ${docNo}`, 330, topY + 40, { width: 220, align: "right" })
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

const addPartyBlock = (doc, record, project) => {
  const top = 250;
  doc.roundedRect(50, top, 500, 90, 6).fillAndStroke("#ffffff", "#e2e8f0");
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
    .text(`Project: ${project?.name || record.projectName || "-"}`, 300, top + 30, { width: 230 });
  return top + 100;
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
      .text(formatSdgMoney(rate), col3, y + 8, { width: unitWidth - cellPaddingX, align: "right" })
      .text(formatSdgMoney(amount), col4, y + 8, { width: totalWidth - cellPaddingX, align: "right" });
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
  doc.moveTo(350, y - 8).lineTo(550, y - 8).strokeColor("#cbd5e1").stroke();

  [
    ["Subtotal", subtotal],
    [discountLabel, -discountAmount],
    ["Tax", Number(tax || 0)],
    ["Grand Total", calculatedTotal, true],
  ].forEach(([label, amount, bold]) => {
    doc
      .fontSize(bold ? 13 : 10)
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fillColor(bold ? "#1d4ed8" : "#0f172a")
      .text(label, 380, y, { width: 90, align: "right" })
      .text(formatSdgMoney(amount), 470, y, { width: 110, align: "right" });
    y += bold ? 24 : 18;
  });
  return y;
};

const addQuotationNotes = (doc, startY) => {
  const y = Math.min(startY + 8, 690);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#374151")
    .text("Notes", 50, y);

  const notes = [
    "This quotation is valid for 15 days only.",
    "30% advance payment is required, 70% after completion.",
    "Warranty is 1 year.",
  ];

  let lineY = y + 16;
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#555");
  notes.forEach((item) => {
    doc.text(`• ${item}`, 58, lineY, { width: 492 });
    lineY += 16;
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
    const printableQuotation = {
      ...quotation.toObject(),
      clientName: client?.name || quotation.clientName,
      projectName: project?.name || quotation.projectName,
      clientEmail: client?.contacts?.[0]?.email || quotation.clientEmail,
      clientPhone: client?.contacts?.[0]?.phone || quotation.clientPhone,
      clientAddress: quotation.clientAddress || "-",
    };

    streamPdf(res, `quotation-${quotation._id}.pdf`, (doc) => {
      addWatermark(doc, branding);
      addHeader(doc, {
        title: "Quotation",
        docNo: formatInvoiceNumber(quotation._id),
        branding,
        issueDate: new Date(quotation.createdAt || Date.now()).toLocaleDateString(),
        dueDate: "-",
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

module.exports = { pdfRouter: router };
