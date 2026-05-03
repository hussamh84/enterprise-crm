/**
 * Default display-only payment and document notes (not tied to billing logic).
 * Keep wording aligned with `DEFAULT_QUOTATION_NOTE_LINES` / invoice lines in backend `pdf.routes.js`.
 */
export const DEFAULT_PAYMENT_TERM_LINES = [
  "70% advance payment is required.",
  "30% is due upon project completion.",
];

export const DEFAULT_QUOTATION_NOTES = [
  "This quotation is valid for 15 days only.",
  ...DEFAULT_PAYMENT_TERM_LINES,
  "Warranty is 1 year.",
];

export const DEFAULT_INVOICE_NOTES = [...DEFAULT_PAYMENT_TERM_LINES, "Warranty is 1 year."];
