import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { formatCurrency } from "../utils/formatCurrency";

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
    return <div className="premium-card p-8 text-center text-slate-500">Loading quotation...</div>;
  }

  if (isError || !quotation) {
    return <div className="premium-card p-8 text-center text-rose-600">Unable to load quotation details.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="premium-card p-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-[#6b7c93]">Quotation</p>
          <h1 className="section-title mt-1">{quotation.name || quotation._id || id}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#d6e4ff] bg-[#eef4ff] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#1f3d7a]">
            {status}
          </span>
          {isApproved ? (
            <span className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-400">Edit</span>
          ) : (
            <Link to={`/quotations/${id}/edit`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-[#425466] hover:bg-slate-50">
              Edit
            </Link>
          )}
          <button
            type="button"
            onClick={() => printPdf()}
            className="rounded-lg bg-[#635bff] text-white px-3 py-2 text-sm font-medium hover:bg-[#5849ff]"
          >
            Print
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
          <Link to="/quotations" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#425466] hover:bg-slate-50">
            Back
          </Link>
        </div>
      </div>

      {approveMutation.isError ? (
        <p className="text-sm text-rose-600 px-1">Could not approve quotation. Try again.</p>
      ) : null}

      <div className="premium-card p-5">
        <h2 className="font-semibold text-[#0a2540] mb-4">Client &amp; project</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <InfoField label="Client" value={clientName || "-"} />
          <InfoField label="Project" value={projectName || "-"} />
          <InfoField label="Created" value={dateValue(quotation.createdAt)} />
          <InfoField label="Status" value={status} />
        </div>
      </div>

      <div className="premium-card p-5">
        <h2 className="font-semibold text-[#0a2540] mb-4">Items</h2>
        {items.length === 0 ? (
          <p className="text-sm text-[#6b7c93]">No quotation items found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-[#6b7c93]">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Unit price</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const qty = Number(item.qty ?? item.quantity ?? 0);
                  const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
                  const rowTotal = calculateItemTotal(item);
                  return (
                    <tr key={item._id || `${item.name || "item"}-${index}`} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-3 font-medium text-[#0a2540]">{item.name || item.description || "Item"}</td>
                      <td className="px-3 py-3 text-[#425466]">{qty}</td>
                      <td className="px-3 py-3 text-[#425466]">{formatCurrency(unitPrice)}</td>
                      <td className="px-3 py-3 text-right font-semibold text-[#0a2540]">{formatCurrency(rowTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="premium-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#6b7c93] uppercase tracking-[0.08em]">Total</p>
          <p className="text-2xl font-semibold text-[#0a2540]">{formatCurrency(total)}</p>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <p className="text-xs text-[#6b7c93] uppercase tracking-[0.08em]">{label}</p>
      <p className="text-sm font-medium text-[#0a2540] mt-1">{value}</p>
    </div>
  );
}
