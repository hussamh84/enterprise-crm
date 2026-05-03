import { useEffect, useMemo, useState } from "react";
import { COMPANY } from "../config/company";

export const COMPANY_SETTINGS_STORAGE_KEY = "company_settings";

const DEFAULT_PRIMARY = "#0b132b";
const DEFAULT_SECONDARY = "#4f46e5";

function emptyState() {
  return {
    companyName: "",
    companyPhone: "",
    companyEmail: "",
    companyAddress: "",
    companyWebsite: "",
    companyLogoDataUrl: "",
    primaryColor: "",
    secondaryColor: "",
  };
}

function trimOrEmpty(v) {
  return typeof v === "string" ? v.trim() : "";
}

/** Read persisted company / branding overrides (localStorage only). */
export function getCompanySettings() {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(COMPANY_SETTINGS_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}

/** Persist partial company / branding fields and apply theme colors. */
export function saveCompanySettings(partial) {
  const prev = getCompanySettings();
  const next = { ...prev, ...partial };
  window.localStorage.setItem(COMPANY_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  applyCompanyThemeColors(next);
  window.dispatchEvent(new CustomEvent("company-settings-changed"));
  return next;
}

/** Apply --primary-color and --secondary-color from saved settings (or defaults). */
export function applyCompanyThemeColors(state = getCompanySettings()) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const primary = trimOrEmpty(state.primaryColor) || DEFAULT_PRIMARY;
  const secondary = trimOrEmpty(state.secondaryColor) || DEFAULT_SECONDARY;
  root.style.setProperty("--primary-color", primary);
  root.style.setProperty("--secondary-color", secondary);
}

/**
 * Merge API workspace settings with local company_settings.
 * Local non-empty fields win so branding can be changed without code or DB.
 */
export function mergeWorkspaceBranding(apiSettings) {
  const local = getCompanySettings();
  const logoLocal = trimOrEmpty(local.companyLogoDataUrl);
  const logoApi = trimOrEmpty(apiSettings?.companyLogoUrl);

  return {
    ...(apiSettings && typeof apiSettings === "object" ? apiSettings : {}),
    companyName: trimOrEmpty(local.companyName) || trimOrEmpty(apiSettings?.companyName) || COMPANY.name,
    companyPhone: trimOrEmpty(local.companyPhone) || trimOrEmpty(apiSettings?.companyPhone) || COMPANY.phone || "",
    companyEmail: trimOrEmpty(local.companyEmail) || trimOrEmpty(apiSettings?.companyEmail) || COMPANY.email || "",
    companyAddress: trimOrEmpty(local.companyAddress) || trimOrEmpty(apiSettings?.companyAddress) || COMPANY.address || "",
    companyWebsite: trimOrEmpty(local.companyWebsite) || trimOrEmpty(apiSettings?.companyWebsite) || COMPANY.website || "",
    companyLogoUrl: logoLocal || logoApi || "",
  };
}

/** Re-compute merged settings when API data or localStorage overrides change. */
export function useMergedWorkspaceSettings(apiSettings) {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const on = () => setRev((r) => r + 1);
    window.addEventListener("company-settings-changed", on);
    return () => window.removeEventListener("company-settings-changed", on);
  }, []);
  return useMemo(() => mergeWorkspaceBranding(apiSettings), [apiSettings, rev]);
}
