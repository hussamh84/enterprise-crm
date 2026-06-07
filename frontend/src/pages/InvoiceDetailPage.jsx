import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";
import { openPdf } from "../utils/pdf";
import EnterpriseDocHeader from "../components/EnterpriseDocHeader";
import { DEFAULT_INVOICE_NOTES } from "../utils/defaultDocNotes";
import { arabicTextProps } from "../utils/arabicText";

const dateValue = (value) => (value ? new Date(value).toLocaleDateString() : "-");

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams();
  const queryClient = useQueryClient();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [projectCompletedToast, setProjectCompletedToast] = useState(false);

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
    onSuccess: async (data) => {
      if (data?.projectAutoCompleted) {
        setProjectCompletedToast(true);
        window.setTimeout(() => setProjectCompletedToast(false), 6000);
      }
      await queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] });
      await queryClient.invalidateQueries({ queryKey: ["/invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["/projects"] });
      if (projectId) {
        await queryClient.invalidateQueries({ queryKey: ["project-details", projectId] });
        await queryClient.invalidateQueries({ queryKey: ["project-report", projectId] });
      }
      await queryClient.invalidateQueries({ queryKey: ["monthly-report"] });
      await queryClient.invalidateQueries({ queryKey: ["yearly-report"] });
      await queryClient.invalidateQueries({ queryKey: ["reports-monthly-breakdown"] });
      await queryClient.invalidateQueries({ queryKey: ["reports-yearly-breakdown"] });
      setPaymentAmount("");
      openPdf(`/invoices/${invoiceId}/pdf`);
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
  const refId = data.invoiceNo || "INV";
  const total = Number(data.total || 0);
  const paid = Number(data.paidAmount || 0);
  const summarySubtotal = Number(data.summarySubtotal ?? total);
  const summaryDiscount = Number(data.summaryDiscount ?? 0);
  const summaryTax = Number(data.summaryTax ?? 0);

  return (
    <div className="enterprise-doc p-6 pb-10 max-w-5xl mx-auto quotation-invoice-theme relative">
      {projectCompletedToast ? (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg text-white px-4 py-3 text-sm shadow-lg max-w-md text-center bg-[var(--primary-color)]"
          role="status"
        >
          Project automatically marked as completed
        </div>
      ) : null}
      <div className="flex justify-end gap-2 flex-wrap enterprise-doc-section">
        <button
          type="button"
          onClick={() => openPdf(`/invoices/${invoiceId}/pdf`)}
          className="rounded-lg bg-[#111827] text-white px-3 py-2 text-sm font-medium hover:bg-black shadow-sm"
        >
          Print PDF
        </button>
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
            <Field label="Quotation" value={data.quotationNo || "—"} />
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
                  <th className="text-right currency-col total">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-left text-[#475569]">Invoice total</td>
                  <td className="numeric text-right currency-col total">
                    <span className="numeric">{formatCurrency(total)}</span>
                  </td>
                </tr>
                <tr>
                  <td className="text-left text-[#475569]">Paid to date</td>
                  <td className="numeric text-right currency-col total">
                    <span className="numeric">{formatCurrency(paid)}</span>
                  </td>
                </tr>
                <tr>
                  <td className="text-left font-medium text-[#0f172a]">Balance due</td>
                  <td className="numeric text-right font-semibold currency-col total">
                    <span className="numeric">{formatCurrency(remainingAmount)}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="summary">
            <div className="row">
              <span>Subtotal</span>
              <span className="numeric">{formatCurrency(summarySubtotal)}</span>
            </div>
            <div className="row">
              <span>Discount</span>
              <span className="numeric">{formatCurrency(summaryDiscount)}</span>
            </div>
            <div className="row">
              <span>Tax</span>
              <span className="numeric">{formatCurrency(summaryTax)}</span>
            </div>
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

      <div className="enterprise-doc-card">
        <div className="p-8">
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64748b] mb-4">Notes</h3>
          <div className="notes text-sm text-[#475569]">
            <ul className="list-disc pl-5 space-y-1">
              {DEFAULT_INVOICE_NOTES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
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
              className="min-w-[140px]"
              placeholder="Payment amount"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
              disabled={payMutation.isPending || remainingAmount <= 0}
            />
            <button
              type="button"
              className="btn-primary"
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
                className="btn-secondary"
                disabled={payMutation.isPending}
                onClick={() => payMutation.mutate(remainingAmount)}
              >
                Pay full balance
              </button>
            ) : null}
          </div>
          {remainingAmount <= 0 ? <p className="text-sm text-emerald-700 mt-4 font-medium">This invoice is fully paid.</p> : null}
          {payMutation.isError ? (
            <p className="text-sm text-rose-600 mt-3 font-medium">
              {payMutation.error?.response?.data?.message || "Payment failed. Please try again."}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  const text = String(value ?? "");
  return (
    <div className="rounded-lg bg-[#f8fafc] border border-[#eee] p-3">
      <p className="text-xs text-[#64748b] uppercase tracking-[0.08em] font-medium">{label}</p>
      <p className="text-sm font-medium text-[#0f172a] mt-1 break-words" {...arabicTextProps(text)}>{text}</p>
    </div>
  );
}
