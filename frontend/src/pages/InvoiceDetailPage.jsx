import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import api from "../lib/api";
import { formatMoney } from "../utils/formatCurrency";
import EnterpriseDocHeader from "../components/EnterpriseDocHeader";

const dateValue = (value) => (value ? new Date(value).toLocaleDateString() : "-");

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams();
  const queryClient = useQueryClient();
  const [paymentAmount, setPaymentAmount] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["workspace-settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["invoice-detail", invoiceId],
    queryFn: async () => (await api.get(`/invoices/${invoiceId}`)).data,
    enabled: Boolean(invoiceId),
  });

  const projectId = useMemo(() => {
    if (!data?.projectId) return "";
    return typeof data.projectId === "object" ? String(data.projectId?._id || "") : String(data.projectId || "");
  }, [data]);

  const remainingAmount = Number(data?.remainingAmount ?? Math.max(Number(data?.total || 0) - Number(data?.paidAmount || 0), 0));

  const clientName = useMemo(() => {
    if (!data) return "—";
    if (typeof data.clientId === "object" && data.clientId?.name) return data.clientId.name;
    return data.clientName || "—";
  }, [data]);

  const projectName = useMemo(() => {
    if (!data) return "—";
    if (typeof data.projectId === "object" && data.projectId?.name) return data.projectId.name;
    return data.projectName || "—";
  }, [data]);

  const payMutation = useMutation({
    mutationFn: async (amount) => (await api.patch(`/invoices/${invoiceId}/pay`, { amount })).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      await queryClient.invalidateQueries({ queryKey: ["/invoices"] });
      if (projectId) {
        await queryClient.invalidateQueries({ queryKey: ["project-details", projectId] });
        await queryClient.invalidateQueries({ queryKey: ["project-report", projectId] });
      }
      await queryClient.invalidateQueries({ queryKey: ["monthly-report"] });
      await queryClient.invalidateQueries({ queryKey: ["yearly-report"] });
      await queryClient.invalidateQueries({ queryKey: ["reports-monthly-breakdown"] });
      await queryClient.invalidateQueries({ queryKey: ["reports-yearly-breakdown"] });
      setPaymentAmount("");
    },
  });

  if (!invoiceId) return null;
  if (isLoading) {
    return <div className="enterprise-doc-card p-8 text-center text-slate-500 mx-6 mt-6">Loading invoice...</div>;
  }
  if (isError || !data) {
    return <div className="enterprise-doc-card p-8 text-center text-rose-600 mx-6 mt-6">Unable to load invoice.</div>;
  }

  const docTitle = data.name || "Invoice";
  const refId = String(data._id || invoiceId).slice(-8).toUpperCase();
  const total = Number(data.total || 0);
  const paid = Number(data.paidAmount || 0);

  return (
    <div className="enterprise-doc p-6 pb-10 max-w-5xl mx-auto">
      <div className="flex justify-end enterprise-doc-section">
        <Link
          to="/invoices"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#425466] hover:bg-slate-50 shadow-sm"
        >
          Back to Invoices
        </Link>
      </div>

      <div className="enterprise-doc-card">
        <EnterpriseDocHeader
          documentLabel="Invoice"
          title={docTitle}
          reference={refId}
          dateStr={dateValue(data.createdAt)}
          settings={settings}
        />
        <div className="px-8 pb-6 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              data.status === "paid" || remainingAmount <= 0
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : paid > 0
                  ? "bg-amber-50 text-amber-900 border border-amber-200"
                  : "bg-slate-50 text-slate-700 border border-slate-200"
            }`}
          >
            {remainingAmount <= 0 ? "Paid" : paid > 0 ? "Partial" : data.status || "Unpaid"}
          </span>
        </div>
      </div>

      <div className="enterprise-doc-card">
        <div className="p-8">
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64748b] mb-4">Bill to &amp; reference</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <Field label="Client" value={clientName} />
            <Field label="Project" value={projectName} />
            <Field label="Quotation" value={data.quotationId ? String(data.quotationId) : "—"} />
          </div>
        </div>
      </div>

      <div className="enterprise-doc-card">
        <div className="p-8">
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64748b] mb-4">Amount summary</h3>
          <div className="overflow-x-auto rounded-lg border border-[#eee]">
            <table className="enterprise-doc-table">
              <thead>
                <tr>
                  <th className="text-left">Description</th>
                  <th className="text-right currency-col">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-left text-[#475569]">Invoice total</td>
                  <td className="text-right">
                    <span className="currency">{formatMoney(total)}</span>
                  </td>
                </tr>
                <tr>
                  <td className="text-left text-[#475569]">Paid to date</td>
                  <td className="text-right">
                    <span className="currency">{formatMoney(paid)}</span>
                  </td>
                </tr>
                <tr>
                  <td className="text-left font-medium text-[#0f172a]">Balance due</td>
                  <td className="text-right font-semibold">
                    <span className="currency">{formatMoney(remainingAmount)}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-8 mt-2 border-t border-[#eee]">
            <div className="text-right">
              <p className="text-sm font-semibold text-[#64748b] mb-1">Grand Total</p>
              <p className="enterprise-doc-grand-total">
                <span className="currency enterprise-doc-grand-total-inner">{formatMoney(total)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="enterprise-doc-card">
        <div className="p-8">
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64748b] mb-4">Record payment</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#4f46e5]/25 min-w-[140px]"
              style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
              placeholder="Payment amount"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
              disabled={payMutation.isPending || remainingAmount <= 0}
            />
            <button
              type="button"
              className="h-9 px-4 text-sm rounded-lg bg-[#4f46e5] text-white font-medium hover:bg-[#4338ca] transition disabled:opacity-60 shadow-sm"
              disabled={
                payMutation.isPending ||
                remainingAmount <= 0 ||
                !Number.isFinite(Number(paymentAmount)) ||
                Number(paymentAmount) <= 0
              }
              onClick={() => payMutation.mutate(Number(paymentAmount))}
            >
              {payMutation.isPending ? "Processing..." : "Add Payment"}
            </button>
            {remainingAmount > 0 ? (
              <button
                type="button"
                className="h-9 px-4 text-sm rounded-lg border border-[#e2e8f0] text-[#0f172a] font-medium hover:bg-[#f8fafc] transition disabled:opacity-60"
                disabled={payMutation.isPending}
                onClick={() => payMutation.mutate(remainingAmount)}
              >
                Pay full balance
              </button>
            ) : null}
          </div>
          {remainingAmount <= 0 ? <p className="text-sm text-emerald-700 mt-4 font-medium">This invoice is fully paid.</p> : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="rounded-lg bg-[#f8fafc] border border-[#eee] p-3">
      <p className="text-xs text-[#64748b] uppercase tracking-[0.08em] font-medium">{label}</p>
      <p className="text-sm font-medium text-[#0f172a] mt-1 break-words">{value}</p>
    </div>
  );
}
