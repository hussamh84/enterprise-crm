/** Display line for quotation / project (new + legacy shapes). */
export function formatProjectTypeDisplay(record) {
  if (!record) return "—";
  const pt = String(record.projectType || "").trim();
  const ct = String(record.cctvType || "").trim();
  const lower = pt.toLowerCase();

  if (lower === "cctv" && ct) return `CCTV - ${ct}`;
  if (lower === "cctv" && !ct) return "CCTV";
  if (pt === "CCTV_IP") return "CCTV - IP";
  if (pt === "CCTV_ANALOG") return "CCTV - Analog";
  if (pt === "SOLAR") return "Solar System";
  if (pt === "NETWORK" || pt === "NETWORKING" || lower === "network") return "Network";
  if (lower === "solar system") return "Solar System";
  if (pt) return pt;
  return "—";
}

/** Map stored project → builder primary + cctv for dropdowns. */
export function deriveTypeFromProject(project) {
  if (!project) return { primary: "", cctv: "" };
  const pt = String(project.projectType || "").trim();
  const ct = String(project.cctvType || "").trim();
  const lower = pt.toLowerCase();

  if (lower === "cctv") return { primary: "CCTV", cctv: ct };
  if (pt === "CCTV_IP") return { primary: "CCTV", cctv: "IP" };
  if (pt === "CCTV_ANALOG") return { primary: "CCTV", cctv: "Analog" };
  if (pt === "SOLAR" || lower === "solar system") return { primary: "Solar System", cctv: "" };
  if (pt === "NETWORK" || pt === "NETWORKING" || lower === "network") return { primary: "Network", cctv: "" };
  return { primary: pt || "", cctv: lower === "cctv" ? ct : "" };
}
