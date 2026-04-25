import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { formatCurrency } from "../utils/formatCurrency";

const dateValue = (value) => (value ? new Date(value).toLocaleDateString() : "-");

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams();
  const queryClient = useQueryClient();
  const [paymentAmount, setPaymentAmount] = useState("");

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
  if (isLoading) return <div className="premium-card p-8 text-center text-slate-500">Loading invoice...</div>;
  if (isError || !data) return <div className="premium-card p-8 text-center text-rose-600">Unable to load invoice.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-[#6b7c93]">Invoice</p>
          <h1 className="section-title mt-1">{data.name || `Invoice ${String(data._id).slice(-6)}`}</h1>
        </div>
        <Link to="/invoices" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#425466] hover:bg-slate-50">
          Back to Invoices
        </Link>
      </div>

      <div className="premium-card p-5">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <Field label="Client ID" value={typeof data.clientId === "object" ? data.clientId?._id || "-" : data.clientId || "-"} />
          <Field label="Project ID" value={typeof data.projectId === "object" ? data.projectId?._id || "-" : data.projectId || "-"} />
          <Field label="Total" value={formatCurrency(data.total)} />
          <Field label="Status" value={data.status || "unpaid"} />
          <Field label="Paid Amount" value={formatCurrency(data.paidAmount || 0)} />
          <Field label="Remaining Amount" value={formatCurrency(remainingAmount)} />
          <Field label="Paid At" value={dateValue(data.paidAt)} />
          <Field label="Created" value={dateValue(data.createdAt)} />
          <Field label="Quotation ID" value={data.quotationId || "-"} />
        </div>
      </div>

      <div className="premium-card p-5">
        <h2 className="text-base font-semibold text-[#0a2540] mb-3">Add Payment</h2>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0.01"
            step="0.01"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#d6e4ff]"
            placeholder="Payment amount"
            value={paymentAmount}
            onChange={(event) => setPaymentAmount(event.target.value)}
            disabled={payMutation.isPending || remainingAmount <= 0}
          />
          <button
            type="button"
            className="h-8 px-3 text-sm rounded-md bg-[#635bff] text-white hover:opacity-90 transition disabled:opacity-60"
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
              className="h-8 px-3 text-sm rounded-md border border-slate-200 text-[#425466] hover:bg-slate-50 transition"
              disabled={payMutation.isPending}
              onClick={() => payMutation.mutate(remainingAmount)}
            >
              Pay Full
            </button>
          ) : null}
        </div>
        {remainingAmount <= 0 ? <p className="text-xs text-emerald-700 mt-2">Invoice is fully paid.</p> : null}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <p className="text-xs text-[#6b7c93] uppercase tracking-[0.08em]">{label}</p>
      <p className="text-sm font-medium text-[#0a2540] mt-1 break-all">{value}</p>
    </div>
  );
}
