import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { formatCurrency, formatMoney } from "../utils/formatCurrency";
import EnterpriseDocHeader from "../components/EnterpriseDocHeader";

const __filename = import.meta.url;
console.log("CHECK PAGE:", __filename);

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

export default function QuotationViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["workspace-settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["quotation-view", id],
    queryFn: async () => (await api.get(`/quotations/${id}`)).data,
    enabled: Boolean(id),
  });

  const quotation = data?.quotation ?? data;
  const client = data?.client;
  const project = data?.project;
  const clientName = data?.clientName || client?.name || quotation?.clientName;
  const projectName = data?.projectName || project?.name || quotation?.projectName;

  const items = normalizeItems(quotation);
  const totalFromItems = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const total = Number(quotation?.grandTotal ?? quotation?.totalPrice ?? quotation?.total ?? totalFromItems ?? 0);
  const status = (quotation?.status || "draft").toLowerCase();
  const isApproved = status === "approved";

  const approveMutation = useMutation({
    mutationFn: async () => (await api.patch(`/quotations/${id}/approve`)).data,
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ["/quotations"] });
      await queryClient.invalidateQueries({ queryKey: ["/invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["quotation-view", id] });
      const invoiceId = payload?.invoice?._id;
      if (invoiceId) navigate(`/invoices/${invoiceId}`);
      else navigate("/invoices");
    },
  });

  const printPdf = async () => {
    try {
      const res = await api.get(`/quotations/${id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(url), 3000);
    } catch {
      /* ignore */
    }
  };

  if (!id) return null;

  if (isLoading) {
    return <div className="enterprise-doc-card p-8 text-center text-slate-500 mx-6 mt-6">Loading quotation...</div>;
  }

  if (isError || !quotation) {
    return <div className="enterprise-doc-card p-8 text-center text-rose-600 mx-6 mt-6">Unable to load quotation details.</div>;
  }

  const docTitle = quotation.name || "Quotation";
  const refId = quotation?.quotationNo || "QTN";

  return (
    <div className="enterprise-doc p-6 pb-10 max-w-5xl mx-auto">
      <div className="enterprise-doc-section page-header">
        <span className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#475569]">
          {status}
        </span>
        <div className="header-actions">
          {isApproved ? (
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">Edit</span>
          ) : (
            <Link
              to={`/quotations/${id}/edit`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#425466] hover:bg-slate-50 shadow-sm"
            >
              Edit
            </Link>
          )}
          <button
            type="button"
            onClick={() => printPdf()}
            className="rounded-lg bg-[#4f46e5] text-white px-3 py-2 text-sm font-medium hover:bg-[#4338ca] shadow-sm"
          >
            Print PDF
          </button>
          {!isApproved ? (
            <button
              type="button"
              disabled={approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              {approveMutation.isPending ? "Approving…" : "Approve"}
            </button>
          ) : null}
          <Link to="/quotations" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#425466] hover:bg-slate-50 shadow-sm">
            Back
          </Link>
        </div>
      </div>

      {approveMutation.isError ? <p className="text-sm text-rose-600 mb-4">Could not approve quotation. Try again.</p> : null}

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
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64748b] mb-4">Client &amp; project</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <InfoField label="Client" value={clientName || "—"} />
            <InfoField label="Project" value={projectName || "—"} />
            <InfoField label="Created" value={dateValue(quotation.createdAt)} />
            <InfoField label="Status" value={status} />
          </div>
        </div>
      </div>

      <div className="enterprise-doc-card">
        <div className="p-8">
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64748b] mb-4">Line items</h3>
          {items.length === 0 ? (
            <p className="text-sm text-[#64748b]">No quotation items found.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-[#eee]">
                <table className="enterprise-doc-table">
                  <thead>
                    <tr>
                      <th className="text-left">Description</th>
                      <th className="text-center w-24">Qty</th>
                      <th className="text-right currency-col unit-price">Unit price</th>
                      <th className="text-right currency-col total">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const qty = Number(item.qty ?? item.quantity ?? 0);
                      const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
                      const rowTotal = calculateItemTotal(item);
                      return (
                        <tr key={item._id || `${item.name || "item"}-${index}`}>
                          <td className="text-left font-medium">{item.name || item.description || "Item"}</td>
                          <td className="text-center text-[#475569]">{qty}</td>
                          <td className="numeric text-right text-[#475569] currency-col unit-price">
                            <span className="numeric">{formatCurrency(unitPrice)}</span>
                          </td>
                          <td className="numeric text-right font-semibold text-[#0f172a] currency-col total">
                            <input
                              className="input-field total-field numeric"
                              value={formatCurrency(rowTotal)}
                              readOnly
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end pt-6 mt-4 border-t border-[#eee]">
                <div className="totals-box text-right min-w-[200px]">
                  <div className="grand-total">
                    <span>Grand Total</span>
                    <span className="amount">
                      <span className="numeric">{formatCurrency(total)}</span>
                      <span className="currency">SDG</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="notes">
                <h4>Notes</h4>
                <ul>
                  <li>This quotation is valid for 15 days only.</li>
                  <li>30% advance payment is required, 70% after completion.</li>
                  <li>Warranty is 1 year.</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div className="rounded-lg bg-[#f8fafc] border border-[#eee] p-3">
      <p className="text-xs text-[#64748b] uppercase tracking-[0.08em] font-medium">{label}</p>
      <p className="text-sm font-medium text-[#0f172a] mt-1">{value}</p>
    </div>
  );
}
