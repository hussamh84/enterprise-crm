const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export const hasArabic = (text) => ARABIC_RE.test(String(text ?? ""));

const firstStrongDirection = (text) => {
  for (const ch of String(text ?? "")) {
    if (/\s/.test(ch)) continue;
    if (ARABIC_RE.test(ch)) return "rtl";
    if (/[A-Za-z0-9]/.test(ch)) return "ltr";
  }
  return null;
};

export const arabicTextProps = (text) => {
  if (!hasArabic(text)) return {};
  const direction = firstStrongDirection(text);
  return {
    className: direction === "ltr" ? "arabic-text arabic-text-mixed" : "arabic-text",
    dir: "auto",
  };
};

/** Explicit RTL + Noto Sans Arabic for quotation/invoice PDF print pages. */
export const arabicPdfTextProps = (text) => {
  if (!hasArabic(text)) return {};
  return {
    className: "arabic-pdf-text",
    dir: "rtl",
  };
};
