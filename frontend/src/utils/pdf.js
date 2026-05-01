import api from "../lib/api";

/** Opens a protected PDF in a new tab (Bearer via query for GET /pdf only on backend). */
export function openPdf(relativePath) {
  const token =
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem("crm_token") || sessionStorage.getItem("token") || "" : "";
  const base = String(api.defaults.baseURL || "").replace(/\/$/, "");
  const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  const sep = path.includes("?") ? "&" : "?";
  const url = `${base}${path}${sep}access_token=${encodeURIComponent(token)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
