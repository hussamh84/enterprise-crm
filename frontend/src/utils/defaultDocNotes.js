/**
 * Default display-only payment and document notes (not tied to billing logic).
 * Keep wording aligned with backend `pdf.routes.js`.
 */
export const DEFAULT_PAYMENT_TERM_LINES = [
  "70% advance payment is required.",
  "30% is due upon project completion.",
];

export const DEFAULT_INVOICE_NOTES = [...DEFAULT_PAYMENT_TERM_LINES, "Warranty is 1 year."];

/** Backward-compat defaults for quotations saved before per-quotation notes existed. */
export const QUOTATION_NOTES_DEFAULTS = {
  validity: "1 day",
  advancePercent: 70,
  warranty: "1 year",
};

/** Builds the editable Notes section for a quotation: validity, advance/remaining payment, warranty, extra notes. */
export const buildQuotationNoteLines = (quotation) => {
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
