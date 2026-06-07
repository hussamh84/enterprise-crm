import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";
import EnterpriseDocHeader from "../components/EnterpriseDocHeader";
import PdfArabicText from "../components/PdfArabicText";
import { formatProjectTypeDisplay } from "../utils/projectTypeDisplay";
import { DEFAULT_QUOTATION_NOTES } from "../utils/defaultDocNotes";
import { usePrintAuthToken } from "../hooks/usePrintAuthToken";
import { hasArabic } from "../utils/arabicText";

const dateValue = (value) => (value ? new Date(value).toLocaleDateString() : "-");

const normalizeItems = (quotation) => {
  if (Array.isArray(quotation?.items)) return quotation.items;
  if (Array.isArray(quotation?.lines)) return quotation.lines;
  return [];
};

const calculateItemTotal = (item) => {
  if (item?.total != null) return Number(item.total) || 0;
  const qty = Number(item?.qty ?? item?.quantity ?? 0);
  const unitPrice = Number(item?.unitPrice ?? item?.price ?? 0);
  return qty * unitPrice;
};

const waitForPrintFonts = async () => {
  try {
    if (document.fonts?.load) {
      await Promise.all([
        document.fonts.load('400 16px "Noto Sans Arabic"'),
        document.fonts.load('700 16px "Noto Sans Arabic"'),
      ]);
    }
    if (document.fonts?.ready) await document.fonts.ready;
  } catch (e) {
    /* ignore */
  }
};

export default function QuotationPrintPage() {
  const { id } = useParams();
  usePrintAuthToken();

  const { data: settings } = useQuery({
    queryKey: ["workspace-settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["quotation-print", id],
    queryFn: async () => (await api.get(`/quotations/${id}`)).data,
    enabled: Boolean(id),
  });

  const quotation = data?.quotation ?? data;
  const client = data?.client;
  const project = data?.project;
  const clientName =
    data?.clientName ||
    client?.name ||
    String(quotation?.walkInCustomerName || "").trim() ||
    quotation?.clientName;
  const projectName = data?.projectName || project?.name || quotation?.projectName;
  const projectTypeLine = formatProjectTypeDisplay({
    projectType: quotation?.projectType || project?.projectType,
    cctvType: quotation?.cctvType || project?.cctvType,
  });
  const items = normalizeItems(quotation);
  const totalFromItems = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const total = Number(quotation?.grandTotal ?? quotation?.totalPrice ?? quotation?.total ?? totalFromItems ?? 0);

  useEffect(() => {
    if (!isLoading && quotation) {
      const markReady = async () => {
        await waitForPrintFonts();
        document.body.setAttribute("data-pdf-ready", "true");
      };
      markReady();
    }
  }, [isLoading, quotation]);

  if (!id) return null;
  if (isLoading) return <div className="p-8 text-center">Loading quotation...</div>;
  if (isError || !quotation) return <div className="p-8 text-center text-rose-600">Unable to load quotation.</div>;

  const docTitle = quotation.name || "Quotation";
  const refId = quotation?.quotationNo || "QTN";
  const rawSections = Array.isArray(quotation?.sections) ? quotation.sections : [];

  return (
    <div className="enterprise-doc p-6 pb-10 max-w-5xl mx-auto quotation-invoice-theme bg-white">
      <div className="enterprise-doc-card">
        <EnterpriseDocHeader
          documentLabel="Quotation"
          title={docTitle}
          reference={refId}
          dateStr={dateValue(quotation.createdAt)}
          settings={settings}
        />
      </div>

      <div className="enterprise-doc-card">
        <div className="p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-[#64748b] uppercase">Client</p>
              <p><PdfArabicText>{clientName || "—"}</PdfArabicText></p>
            </div>
            <div>
              <p className="text-xs text-[#64748b] uppercase">Project</p>
              <p><PdfArabicText>{projectName || "—"}</PdfArabicText></p>
            </div>
            <div>
              <p className="text-xs text-[#64748b] uppercase">Project Type</p>
              <p><PdfArabicText>{projectTypeLine}</PdfArabicText></p>
            </div>
            <div><p className="text-xs text-[#64748b] uppercase">Created</p><p>{dateValue(quotation.createdAt)}</p></div>
          </div>
        </div>
      </div>

      <div className="enterprise-doc-card">
        <div className="p-8">
          <table className="enterprise-doc-table w-full">
            <thead>
              <tr>
                <th className="text-left">Description</th>
                <th className="text-center w-24">Qty</th>
                <th className="text-right">Unit price</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rawSections.length > 0
                ? rawSections.flatMap((sec, si) => {
                    const secItems = items.filter((item) => (Number(item.sectionIndex) || 0) === si);
                    return [
                      sec.title ? (
                        <tr key={`sec-${si}`}>
                          <td colSpan={4} className={`bg-slate-100 font-bold text-xs ${hasArabic(sec.title) ? "" : "uppercase"}`}>
                            <PdfArabicText>{sec.title}</PdfArabicText>
                          </td>
                        </tr>
                      ) : null,
                      ...secItems.map((item, idx) => (
                        <tr key={item._id || `${si}-${idx}`}>
                          <td>
                            <PdfArabicText>{item.name || item.description || "Item"}</PdfArabicText>
                          </td>
                          <td className="text-center">{Number(item.qty ?? item.quantity ?? 0)}</td>
                          <td className="text-right">{formatCurrency(item.unitPrice ?? item.price ?? 0)}</td>
                          <td className="text-right font-semibold">{formatCurrency(calculateItemTotal(item))}</td>
                        </tr>
                      )),
                    ].filter(Boolean);
                  })
                : items.map((item, index) => (
                    <tr key={item._id || `item-${index}`}>
                      <td>
                        <PdfArabicText>{item.name || item.description || "Item"}</PdfArabicText>
                      </td>
                      <td className="text-center">{Number(item.qty ?? item.quantity ?? 0)}</td>
                      <td className="text-right">{formatCurrency(item.unitPrice ?? item.price ?? 0)}</td>
                      <td className="text-right font-semibold">{formatCurrency(calculateItemTotal(item))}</td>
                    </tr>
                  ))}
            </tbody>
          </table>

          <div className="flex justify-end pt-6 mt-4 border-t border-[#eee]">
            <div className="totals-box text-right w-full max-w-[440px]">
              <div className="summary">
                <div className="row"><span>Subtotal</span><span>{formatCurrency(quotation?.subtotal ?? totalFromItems)}</span></div>
                <div className="row"><span>Discount</span><span>{formatCurrency(quotation?.discount?.amount ?? 0)}</span></div>
                <div className="row"><span>Tax</span><span>{formatCurrency(quotation?.tax ?? 0)}</span></div>
              </div>
              <div className="grand-total">
                <div className="label">Grand Total</div>
                <div className="amount">
                  <span className="value">{formatCurrency(total)}</span>
                  <span className="currency">SDG</span>
                </div>
              </div>
            </div>
          </div>

          <div className="notes">
            <h4>Notes</h4>
            <ul>
              {DEFAULT_QUOTATION_NOTES.map((line) => (
                <li key={line}>
                  <PdfArabicText>{line}</PdfArabicText>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
