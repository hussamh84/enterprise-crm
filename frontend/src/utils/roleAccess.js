const TECHNICIAN_ROLES = new Set(["technician", "employee", "sales", "team_member"]);
const ADMIN_ROLES = new Set(["admin", "company_admin"]);

export const normalizeRole = (role) => String(role || "").trim().toLowerCase();

export const isTechnician = (role) => TECHNICIAN_ROLES.has(normalizeRole(role));

export const isAdmin = (role) => ADMIN_ROLES.has(normalizeRole(role));
