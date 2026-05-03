import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { COMPANY } from "../config/company";
import {
  applyCompanyThemeColors,
  getCompanySettings,
  saveCompanySettings,
} from "../lib/companySettings";

const LOGO_MAX_BYTES = 750_000;

export default function CompanySettingsPage() {
  const initial = useMemo(() => getCompanySettings(), []);
  const [companyName, setCompanyName] = useState(initial.companyName || "");
  const [companyPhone, setCompanyPhone] = useState(initial.companyPhone || "");
  const [companyEmail, setCompanyEmail] = useState(initial.companyEmail || "");
  const [companyAddress, setCompanyAddress] = useState(initial.companyAddress || "");
  const [companyWebsite, setCompanyWebsite] = useState(initial.companyWebsite || "");
  const [companyLogoDataUrl, setCompanyLogoDataUrl] = useState(initial.companyLogoDataUrl || "");
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor || "#0b132b");
  const [secondaryColor, setSecondaryColor] = useState(initial.secondaryColor || "#4f46e5");
  const [logoError, setLogoError] = useState("");
  const [savedHint, setSavedHint] = useState(false);

  useEffect(() => {
    applyCompanyThemeColors(getCompanySettings());
  }, []);

  const onLogoFile = useCallback((file) => {
    setLogoError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("Please choose an image file.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError("Image is too large for browser storage. Use a smaller file (about under 700KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        setLogoError("Could not read image.");
        return;
      }
      setCompanyLogoDataUrl(result);
    };
    reader.onerror = () => setLogoError("Could not read file.");
    reader.readAsDataURL(file);
  }, []);

  const handleSave = () => {
    saveCompanySettings({
      companyName,
      companyPhone,
      companyEmail,
      companyAddress,
      companyWebsite,
      companyLogoDataUrl,
      primaryColor,
      secondaryColor,
    });
    setSavedHint(true);
    window.setTimeout(() => setSavedHint(false), 2500);
  };

  const handleClearLogo = () => {
    setCompanyLogoDataUrl("");
    setLogoError("");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600">
          <Building2 className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="section-title">Company Settings</h1>
          <p className="page-subtitle text-[#6b7c93] mt-1">
            Branding is saved in this browser only (<code className="text-xs bg-slate-100 px-1 rounded">localStorage</code>
            ). Empty fields fall back to workspace API values, then to <strong>{COMPANY.name}</strong>.
          </p>
        </div>
      </div>

      <div className="premium-card p-5 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-[#425466]">Company name</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={COMPANY.name}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#425466]">Phone</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={companyPhone}
              onChange={(e) => setCompanyPhone(e.target.value)}
              type="tel"
              placeholder="Phone"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#425466]">Email</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              type="email"
              placeholder="Email"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-[#425466]">Address</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 min-h-[72px]"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder="Address"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-[#425466]">Website</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              type="url"
              placeholder="https://"
            />
          </label>
        </div>

        <div className="border-t border-slate-100 pt-5 space-y-3">
          <p className="text-sm font-medium text-[#425466]">Company logo</p>
          <p className="text-xs text-[#6b7c93]">Stored as a data URL in this browser only. For production uploads, use Settings → logo URL/API later.</p>
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" accept="image/*" onChange={(e) => onLogoFile(e.target.files?.[0])} />
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#425466] hover:bg-slate-50"
              onClick={handleClearLogo}
            >
              Clear logo
            </button>
          </div>
          {logoError ? <p className="text-sm text-rose-600">{logoError}</p> : null}
          {companyLogoDataUrl ? (
            <img src={companyLogoDataUrl} alt="" className="h-16 w-auto max-w-[200px] object-contain border border-slate-100 rounded" />
          ) : null}
        </div>

        <div className="border-t border-slate-100 pt-5 grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-[#425466]">Primary color</span>
            <div className="mt-1 flex items-center gap-2">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-slate-200 p-1 bg-white" />
              <input
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
              />
            </div>
            <span className="text-xs text-[#6b7c93]">Used for sidebar active item and key accents (CSS variable <code className="text-xs">--primary-color</code>).</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#425466]">Secondary color</span>
            <div className="mt-1 flex items-center gap-2">
              <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-slate-200 p-1 bg-white" />
              <input
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
              />
            </div>
            <span className="text-xs text-[#6b7c93]">CSS variable <code className="text-xs">--secondary-color</code> for links and highlights.</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            className="rounded-lg bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-black"
            onClick={handleSave}
          >
            Save company branding
          </button>
          {savedHint ? <span className="text-sm text-emerald-600">Saved for this browser.</span> : null}
        </div>
      </div>
    </div>
  );
}
