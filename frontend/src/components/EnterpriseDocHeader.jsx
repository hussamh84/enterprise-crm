import { onCompanyLogoImgError } from "../config/company";
import { useCompanyBrandingSnapshot } from "../lib/companySettings";

/**
 * Enterprise-style document header: logo + company left, document title block right.
 */
export default function EnterpriseDocHeader({
  documentLabel,
  title,
  reference,
  dateStr,
  settings,
}) {
  const merged = useCompanyBrandingSnapshot(settings);
  const companyName = merged.companyName;
  const address = merged.companyAddress;
  const phone = merged.companyPhone;
  const email = merged.companyEmail;
  const website = merged.companyWebsite;

  return (
    <div className="enterprise-doc-header flex flex-wrap items-start justify-between gap-8 px-8 pt-8 pb-6 border-b border-[#eee]">
      <div className="flex flex-wrap items-start gap-5 min-w-0">
        <img
          src={merged.logo}
          alt=""
          className="h-16 w-auto max-w-[200px] object-contain shrink-0"
          onError={onCompanyLogoImgError}
        />
        <div className="min-w-0 space-y-1 text-[#475569] text-sm leading-relaxed" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
          <p className="text-[#0f172a] font-semibold text-base">{companyName}</p>
          {address ? <p>{address}</p> : null}
          {phone ? <p>{phone}</p> : null}
          {email ? <p>{email}</p> : null}
          {website ? (
            <p>
              <a href={website.startsWith("http") ? website : `https://${website}`} className="text-[color:var(--secondary-color)] underline">
                {website}
              </a>
            </p>
          ) : null}
        </div>
      </div>
      <div className="text-right ml-auto shrink-0" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b] mb-1">{documentLabel}</p>
        <h2 className="text-2xl font-bold text-[#0f172a] tracking-tight leading-tight">{title}</h2>
        {reference ? <p className="text-sm text-[#64748b] mt-2">Ref: {reference}</p> : null}
        {dateStr ? <p className="text-sm text-[#64748b] mt-1">Date: {dateStr}</p> : null}
      </div>
    </div>
  );
}
