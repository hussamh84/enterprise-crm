import { useEffect, useMemo, useState } from "react";
import { COMPANY, resolveCompanyLogoSrc } from "../config/company";

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

/**
 * Raw persisted overrides (localStorage only). All higher-level branding
 * should be derived via {@link getCompanyBranding}.
 */
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

/** Persist partial fields; applies CSS variables and notifies listeners. */
export function saveCompanySettings(partial) {
  const prev = getCompanySettings();
  const next = { ...prev, ...partial };
  window.localStorage.setItem(COMPANY_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  applyCompanyThemeColors(next);
  window.dispatchEvent(new CustomEvent("company-settings-changed"));
  return next;
}

/**
 * Apply theme colors on :root using setProperty (safe if values missing).
 */
export function applyCompanyThemeColors(state = getCompanySettings()) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const primary = trimOrEmpty(state.primaryColor) || DEFAULT_PRIMARY;
  const secondary = trimOrEmpty(state.secondaryColor) || DEFAULT_SECONDARY;
  root.style.setProperty("--primary-color", primary);
  root.style.setProperty("--secondary-color", secondary);
}

/**
 * Internal merge: localStorage (getCompanySettings) overrides API workspace fields.
 * Server-generated PDFs cannot read localStorage; use on-screen document views for local branding.
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

/**
 * Single branding snapshot for UI: always starts from getCompanySettings()
 * overrides, then API, then COMPANY. Includes resolved `logo` for &lt;img src&gt;.
 */
export function getCompanyBranding(apiSettings) {
  const merged = mergeWorkspaceBranding(apiSettings);
  const rawLogo = merged.companyLogoUrl || "";
  const local = getCompanySettings();
  return {
    companyName: merged.companyName || "Company Name",
    companyPhone: merged.companyPhone,
    companyEmail: merged.companyEmail,
    companyAddress: merged.companyAddress,
    companyWebsite: merged.companyWebsite,
    companyLogoUrl: rawLogo,
    logo: resolveCompanyLogoSrc(rawLogo || ""),
    primaryColor: trimOrEmpty(local.primaryColor) || DEFAULT_PRIMARY,
    secondaryColor: trimOrEmpty(local.secondaryColor) || DEFAULT_SECONDARY,
  };
}

/**
 * Reactive branding for React: updates when `company-settings-changed` fires.
 */
export function useCompanyBrandingSnapshot(apiSettings) {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const on = () => setRev((r) => r + 1);
    window.addEventListener("company-settings-changed", on);
    return () => window.removeEventListener("company-settings-changed", on);
  }, []);
  return useMemo(() => getCompanyBranding(apiSettings), [apiSettings, rev]);
}

/** @deprecated Use useCompanyBrandingSnapshot — alias for compatibility */
export const useMergedWorkspaceSettings = useCompanyBrandingSnapshot;
