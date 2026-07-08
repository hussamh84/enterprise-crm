const fs = require("fs");
const path = require("path");

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const FONT_REGULAR = path.resolve(__dirname, "../../assets/fonts/NotoSansArabic-Regular.ttf");
const FONT_BOLD = path.resolve(__dirname, "../../assets/fonts/NotoSansArabic-Bold.ttf");

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const hasArabic = (text) => ARABIC_RE.test(String(text ?? ""));

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatQuotationProjectType = (quotationLike, project) => {
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

const itemDescription = (item) => String(item?.description || item?.name || "Line Item");

const itemQty = (item) => Number(item?.quantity || item?.qty || 1);

const itemRate = (item) => Number(item?.unitPrice || item?.rate || 0);

const itemAmount = (item) => {
  const qty = itemQty(item);
  const rate = itemRate(item);
  return Number(item?.total != null ? item.total : qty * rate);
};

const fileToDataUri = (filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return "";
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
};

const buildItemsTableHtml = (items, sections = []) => {
  const rows = [];
  const renderItemRow = (item, index) => {
    const desc = itemDescription(item);
    const descClass = hasArabic(desc) ? "desc-cell arabic-desc" : "desc-cell";
    const zebra = index % 2 === 0 ? "row-zebra" : "";
    return `
      <tr class="${zebra}">
        <td class="col-desc ${descClass}">${escapeHtml(desc)}</td>
        <td class="col-qty">${escapeHtml(String(itemQty(item)))}</td>
        <td class="col-money">${escapeHtml(formatCurrency(itemRate(item)))}</td>
        <td class="col-money">${escapeHtml(formatCurrency(itemAmount(item)))}</td>
      </tr>`;
  };

  if (sections.length > 0) {
    sections.forEach((sec, si) => {
      const secItems = items.filter((item) => (Number(item.sectionIndex) || 0) === si);
      if (!secItems.length) return;
      const title = String(sec.title || `Section ${si + 1}`).toUpperCase();
      const secClass = hasArabic(title) ? "section-row arabic-desc" : "section-row";
      rows.push(`
        <tr class="${secClass}">
          <td colspan="4">${escapeHtml(title)}</td>
        </tr>`);
      secItems.forEach((item, idx) => rows.push(renderItemRow(item, idx)));
    });
  } else {
    (items.length ? items : [{ description: "Service", quantity: 1, unitPrice: 0, total: 0 }]).forEach((item, idx) => {
      rows.push(renderItemRow(item, idx));
    });
  }

  return `
    <table class="items-table">
      <thead>
        <tr>
          <th class="col-desc">Description</th>
          <th class="col-qty">Qty</th>
          <th class="col-money">Unit Price</th>
          <th class="col-money">Total</th>
        </tr>
      </thead>
      <tbody>${rows.join("")}</tbody>
    </table>`;
};

const buildTotalsHtml = ({ subtotal, discount = {}, tax = 0, grandTotal }) => {
  const discountAmount = Number(discount.amount != null ? discount.amount : discount || 0);
  const discountLabel =
    discount.type === "percentage" ? `Discount (${Number(discount.value || 0)}%)` : "Discount";
  const calculatedTotal = grandTotal != null ? Number(grandTotal) : subtotal - discountAmount + Number(tax);

  return `
    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(subtotal))}</span></div>
      <div class="totals-row"><span>${escapeHtml(discountLabel)}</span><span>${escapeHtml(formatCurrency(discountAmount))}</span></div>
      <div class="totals-row"><span>Tax</span><span>${escapeHtml(formatCurrency(Number(tax || 0)))}</span></div>
      <div class="totals-divider"></div>
      <div class="grand-total">
        <span>Grand Total</span>
        <span class="grand-total-amount">
          <strong>${escapeHtml(formatCurrency(calculatedTotal))}</strong>
          <span class="currency">SDG</span>
        </span>
      </div>
    </div>`;
};

const buildDocumentHtml = ({
  title,
  docNoLabel,
  docNo,
  issueDate,
  badgeLabel,
  showBadge = true,
  branding,
  record,
  project,
  items,
  sections = [],
  totals,
  notes = [],
  footerLines = [],
}) => {
  const logoDataUri = fileToDataUri(branding?.companyLogoPath);
  const typeLine = formatQuotationProjectType(record, project);
  const phone = String(record?.clientPhone || "").trim();
  const email = String(record?.clientEmail || "").trim();
  const clientName = record?.clientName || record?.name || "Client";
  const projectName = project?.name || record?.projectName || "-";

  return `<!DOCTYPE html>
<html lang="ar" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&amp;family=Noto+Sans+Arabic:wght@400;700&amp;display=block" rel="stylesheet">
  <style>
    @font-face {
      font-family: "Noto Sans Arabic";
      src: url("./fonts/NotoSansArabic-Regular.ttf") format("truetype");
      font-weight: 400;
      font-style: normal;
      font-display: block;
    }
    @font-face {
      font-family: "Noto Sans Arabic";
      src: url("./fonts/NotoSansArabic-Bold.ttf") format("truetype");
      font-weight: 700;
      font-style: normal;
      font-display: block;
    }
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    html, body, table, th, td {
      font-family: "Noto Sans Arabic", "Cairo", Arial, sans-serif;
    }
    body {
      margin: 0;
      color: #0f172a;
      font-size: 10pt;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { position: relative; }
    .watermark {
      position: fixed;
      top: 38%;
      left: 50%;
      width: 280px;
      height: 280px;
      transform: translate(-50%, -50%);
      opacity: 0.05;
      z-index: 0;
      pointer-events: none;
    }
    .content { position: relative; z-index: 1; }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      padding-bottom: 14px;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 16px;
    }
    .brand { display: flex; align-items: flex-start; min-width: 0; }
    .brand img { width: 110px; height: auto; object-fit: contain; }
    .brand-meta { color: #64748b; font-size: 9pt; line-height: 1.3; margin-top: 10px; }
    .brand-meta strong { display: block; color: #0f172a; font-size: 10pt; line-height: 1.1; margin: 0 0 4px; }
    .doc-meta { text-align: right; min-width: 220px; }
    .doc-meta h1 {
      margin: 0;
      font-size: 24pt;
      line-height: 1;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #0f172a;
    }
    .doc-meta p { margin: 4px 0 0; color: #475569; font-size: 9pt; }
    .badge {
      display: inline-block;
      margin: 10px 0 14px auto;
      padding: 4px 14px;
      border-radius: 8px;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #4f46e5;
      background: rgba(79, 70, 229, 0.12);
    }
    .badge.paid { color: #16a34a; background: rgba(22, 163, 74, 0.12); }
    .badge.unpaid { color: #dc2626; background: rgba(220, 38, 38, 0.12); }
    .party-block {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-bottom: 16px;
    }
    .party-block h3 {
      margin: 0 0 6px;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
    }
    .party-block p { margin: 0 0 4px; color: #334155; }
    .items-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 9pt;
    }
    .items-table thead tr {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .items-table th {
      padding: 8px 10px;
      color: #475569;
      font-size: 8.5pt;
      font-weight: 700;
      text-align: left;
    }
    .items-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #eef2f7;
      vertical-align: top;
      color: #0a2540;
    }
    .items-table .row-zebra { background: #fafcff; }
    .items-table .section-row td {
      background: #e2e8f0;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0f172a;
      border-bottom: none;
    }
    .col-desc { width: 48%; }
    .col-qty { width: 12%; text-align: center; }
    .col-money { width: 20%; text-align: right; white-space: nowrap; }
    .items-table th.col-qty { text-align: center; }
    .items-table th.col-money { text-align: right; }
    .arabic-desc, .arabic-text {
      direction: rtl;
      unicode-bidi: isolate;
    }
    .desc-cell, .arabic-text {
      text-align: left;
    }
    .totals {
      width: 220px;
      margin-left: auto;
      margin-top: 18px;
      font-size: 10pt;
    }
    .totals-row, .grand-total {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 6px;
    }
    .totals-divider {
      border-top: 1px solid #e5e7eb;
      margin: 8px 0;
    }
    .grand-total {
      font-size: 13pt;
      font-weight: 700;
      align-items: baseline;
    }
    .grand-total-amount { display: inline-flex; align-items: baseline; gap: 5px; }
    .currency { color: #64748b; font-size: 11pt; font-weight: 400; opacity: 0.7; }
    .notes { margin-top: 18px; }
    .notes h4 { margin: 0 0 8px; font-size: 10pt; color: #374151; }
    .notes li { margin: 0 0 4px; color: #555; font-size: 9pt; }
    .footer-lines { margin-top: 12px; color: #0f172a; font-size: 9pt; }
    .thank-you {
      position: fixed;
      right: 0;
      bottom: 0;
      margin: 0;
      color: #6b7c93;
      font-size: 9pt;
      text-align: right;
    }
  </style>
</head>
<body>
  <div class="page">
    ${logoDataUri ? `<img class="watermark" src="${logoDataUri}" alt="" />` : ""}
    <div class="content">
      <div class="header">
        <div class="brand">
          ${logoDataUri ? `<img src="${logoDataUri}" alt="" />` : ""}
        </div>
        <div class="doc-meta">
          <h1>${escapeHtml(title)}</h1>
          <div class="brand-meta">
            <strong>${escapeHtml(branding?.companyName || "")}</strong>
            ${branding?.companyAddress ? `<div>${escapeHtml(branding.companyAddress)}</div>` : ""}
            ${branding?.companyPhone ? `<div>${escapeHtml(branding.companyPhone)}</div>` : ""}
            ${branding?.companyEmail ? `<div>${escapeHtml(branding.companyEmail)}</div>` : ""}
          </div>
          <p>${escapeHtml(docNoLabel)} ${escapeHtml(docNo)}</p>
          <p>Issue Date: ${escapeHtml(issueDate)}</p>
        </div>
      </div>

      ${showBadge ? `<div class="badge ${badgeLabel === "PAID" ? "paid" : badgeLabel === "UNPAID" ? "unpaid" : ""}">${escapeHtml(badgeLabel)}</div>` : ""}

      <div class="party-block">
        <div>
          <h3>Bill To</h3>
          <p class="${hasArabic(clientName) ? "arabic-text" : ""}">${escapeHtml(clientName)}</p>
          ${phone ? `<p>${escapeHtml(phone)}</p>` : ""}
          ${email ? `<p>${escapeHtml(email)}</p>` : ""}
        </div>
        <div>
          <h3>Project</h3>
          <p class="${hasArabic(projectName) ? "arabic-text" : ""}">${escapeHtml(projectName)}</p>
          <h3 style="margin-top:12px;">Project Type</h3>
          <p class="${hasArabic(typeLine) ? "arabic-text" : ""}">${escapeHtml(typeLine)}</p>
        </div>
      </div>

      ${buildItemsTableHtml(items, sections)}
      ${buildTotalsHtml(totals)}

      ${footerLines.length ? `<div class="footer-lines">${footerLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}</div>` : ""}

      ${notes.length ? `<div class="notes"><h4>Notes</h4><ul>${notes.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul></div>` : ""}

      <div class="thank-you">Thank you for your business</div>
    </div>
  </div>
  <script>
    (async function () {
      try {
        if (document.fonts && document.fonts.check) {
          document.fonts.check('12px "Noto Sans Arabic"');
          document.fonts.check('12px "Cairo"');
        }
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
      } catch (e) {}
      document.body.setAttribute("data-fonts-ready", "true");
    })();
  </script>
</body>
</html>`;
};

const buildQuotationHtml = ({ branding, record, project, items, sections, totals, notes }) =>
  buildDocumentHtml({
    title: "Quotation",
    docNoLabel: "Quotation No:",
    docNo: String(record?.quotationNo || "").trim() || "—",
    issueDate: new Date(record?.createdAt || Date.now()).toLocaleDateString(),
    badgeLabel: "QUOTATION",
    showBadge: false,
    branding,
    record,
    project,
    items,
    sections,
    totals,
    notes,
  });

const buildInvoiceHtml = ({
  branding,
  record,
  project,
  items,
  totals,
  notes,
  invoiceNumber,
  statusLabel,
  paid,
  remaining,
  badgeLabel,
}) =>
  buildDocumentHtml({
    title: "Invoice",
    docNoLabel: "Invoice #:",
    docNo: invoiceNumber,
    issueDate: new Date(record?.createdAt || Date.now()).toLocaleDateString(),
    badgeLabel,
    branding,
    record,
    project,
    items,
    totals,
    notes,
    footerLines: [
      `Status: ${statusLabel}`,
      `Paid to date: ${formatCurrency(paid)}`,
      `Balance due: ${formatCurrency(remaining)}`,
    ],
  });

const FONT_PATHS = {
  regular: FONT_REGULAR,
  bold: FONT_BOLD,
};

module.exports = {
  buildQuotationHtml,
  buildInvoiceHtml,
  itemDescription,
  FONT_PATHS,
};
