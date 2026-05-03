export const COMPANY = {
  name: "Config Engineering Workspace",
  email: "",
  phone: "",
  address: "",
  website: "",
  logo: "/logo.png",
};

/** Public or API-backed logo URL for <img src> */
export function resolveCompanyLogoSrc(logoPath) {
  if (!logoPath) return COMPANY.logo;
  if (logoPath.startsWith("http")) return logoPath;
  if (logoPath.startsWith("/uploads/")) {
    const apiBase = String(import.meta.env.VITE_API_URL || "").replace(/\/api(?:\/v1)?\/?$/, "");
    return apiBase ? `${apiBase}${logoPath}` : logoPath;
  }
  return logoPath;
}

export function onCompanyLogoImgError(event) {
  event.currentTarget.onerror = null;
  const fallback = COMPANY.logo;
  if (!event.currentTarget.src.endsWith(fallback)) {
    event.currentTarget.src = fallback;
    return;
  }
  event.currentTarget.src = "/favicon.svg";
}
