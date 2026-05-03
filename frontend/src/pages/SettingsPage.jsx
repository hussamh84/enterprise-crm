import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { useCompanyBrandingSnapshot } from "../lib/companySettings";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["/settings", "admin"],
    queryFn: async () => (await api.get("/settings")).data,
  });

  const [draftForm, setDraftForm] = useState(null);
  const baseForm = useMemo(
    () => ({
      companyName: settings?.companyName || "",
      companyAddress: settings?.companyAddress || "",
      companyPhone: settings?.companyPhone || "",
      companyLogoUrl: settings?.companyLogoUrl || "",
      backgroundImageUrl: settings?.backgroundImageUrl || "",
      currency: settings?.currency || "SDG",
      locale: settings?.locale || "en-US",
    }),
    [settings]
  );
  const form = draftForm || baseForm;
  const [logoFile, setLogoFile] = useState(null);
  const branding = useCompanyBrandingSnapshot(settings);

  const updateSettings = useMutation({
    mutationFn: async () => api.put("/settings", form),
    onSuccess: () => {
      setDraftForm(null);
      queryClient.invalidateQueries({ queryKey: ["/settings"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-settings"] });
    },
  });
  const uploadLogo = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("logo", logoFile);
      return api.post("/settings/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: ({ data }) => {
      const logoPath = data?.companyLogoUrl || "";
      setDraftForm((prev) => ({ ...(prev || baseForm), companyLogoUrl: logoPath }));
      setLogoFile(null);
      queryClient.invalidateQueries({ queryKey: ["/settings"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-settings"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Settings</h1>
        <p className="text-[#6b7c93] mt-1">Configure {branding.companyName} branding and global settings.</p>
      </div>

      <div className="premium-card p-5 grid md:grid-cols-2 gap-4">
        <Field label="Company Name" value={form.companyName} onChange={(value) => setDraftForm((prev) => ({ ...(prev || baseForm), companyName: value }))} />
        <Field label="Company Phone" value={form.companyPhone} onChange={(value) => setDraftForm((prev) => ({ ...(prev || baseForm), companyPhone: value }))} />
        <Field label="Company Address" value={form.companyAddress} onChange={(value) => setDraftForm((prev) => ({ ...(prev || baseForm), companyAddress: value }))} />
        <Field label="Company Logo URL / Path" value={form.companyLogoUrl} onChange={(value) => setDraftForm((prev) => ({ ...(prev || baseForm), companyLogoUrl: value }))} />
        <Field label="Global Background Image URL" value={form.backgroundImageUrl} onChange={(value) => setDraftForm((prev) => ({ ...(prev || baseForm), backgroundImageUrl: value }))} />
        <Field label="Currency" value={form.currency} onChange={(value) => setDraftForm((prev) => ({ ...(prev || baseForm), currency: value }))} />
        <Field label="Locale" value={form.locale} onChange={(value) => setDraftForm((prev) => ({ ...(prev || baseForm), locale: value }))} />
      </div>

      <div className="premium-card p-5 space-y-3">
        <p className="text-sm font-medium text-[#425466]">Upload Company Logo</p>
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#425466] hover:bg-slate-50 disabled:opacity-60"
            disabled={!logoFile || uploadLogo.isPending}
            onClick={() => uploadLogo.mutate()}
          >
            {uploadLogo.isPending ? "Uploading..." : "Upload Logo"}
          </button>
        </div>
      </div>

      <div>
        <button
          type="button"
          className="rounded-lg bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-black disabled:opacity-60"
          disabled={isLoading || updateSettings.isPending}
          onClick={() => updateSettings.mutate()}
        >
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className="premium-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#0a2540]">Data protection</p>
          <p className="text-sm text-[#6b7c93] mt-1">Export or restore a full JSON backup of this workspace.</p>
        </div>
        <Link
          to="/settings/backup"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-[#425466] hover:bg-slate-50"
        >
          Backup &amp; Restore
        </Link>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label className="text-sm font-medium text-[#425466]">{label}</label>
      <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
