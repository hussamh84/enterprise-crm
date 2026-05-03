/** Canonical quotation workflow statuses (API / DB). */
export const QUOTATION_STATUS_VALUES = ["draft", "sent", "approved", "rejected", "converted_to_project"];

const LABELS = {
  draft: "Draft",
  sent: "Sent",
  approved: "Approved",
  rejected: "Rejected",
  converted_to_project: "Converted To Project",
};

export function normalizeQuotationStatus(value, fallback = "draft") {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (raw === "convertedtoproject" || raw === "converted_to_project") return "converted_to_project";
  if (QUOTATION_STATUS_VALUES.includes(raw)) return raw;
  return fallback;
}

export function formatQuotationStatusLabel(value) {
  const key = normalizeQuotationStatus(value);
  return LABELS[key] || String(value || "Draft");
}
