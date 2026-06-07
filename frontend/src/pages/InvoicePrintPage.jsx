import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";
import EnterpriseDocHeader from "../components/EnterpriseDocHeader";
import { DEFAULT_INVOICE_NOTES } from "../utils/defaultDocNotes";
import { usePrintAuthToken } from "../hooks/usePrintAuthToken";

const dateValue = (value) => (value ? new Date(value).toLocaleDateString() : "-");

const calculateItemTotal = (item) => {
  if (item?.total != null) return Number(item.total) || 0;
  const qty = Number(item?.qty ?? item?.quantity ?? 0);
  const unitPrice = Number(item?.unitPrice ?? item?.price ?? 0);
  return qty * unitPrice;
};

export default function InvoicePrintPage() {
  const { invoiceId } = useParams();
  usePrintAuthToken();

  const { data: settings } = useQuery({
    queryKey: ["workspace-settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["invoice-print", invoiceId],
    queryFn: async () => (await api.get(`/invoices/${invoiceId}`)).data,
    enabled: Boolean(invoiceId),
  });

  const total = Number(data?.total || 0);
  const paid = Number(data?.paidAmount || 0);
  const remainingAmount = Number(data?.remainingAmount ?? Math.max(total - paid, 0));
  const summarySubtotal = Number(data?.summarySubtotal ?? total);
  const summaryDiscount = Number(data?.summaryDiscount ?? 0);
  const summaryTax = Number(data?.summaryTax ?? 0);
  const items = Array.isArray(data?.items) ? data.items : [];

  useEffect(() => {
    if (!isLoading && data) {
      const markReady = async () => {
        try {
          if (document.fonts?.ready) await document.fonts.ready;
        } catch (e) {
          /* ignore */
        }
        document.body.setAttribute("data-pdf-ready", "true");
      };
      markReady();
    }
  }, [isLoading, data]);

  if (!invoiceId) return null;
  if (isLoading) return <div className="p-8 text-center">Loading invoice...</div>;
  if (isError || !data) return <div className="p-8 text-center text-rose-600">Unable to load invoice.</div>;

  const clientName =
    typeof data.clientId === "object" && data.clientId?.name ? data.clientId.name : data.clientName || "—";
  const projectName =
    typeof data.projectId === "object" && data.projectId?.name ? data.projectId.name : data.projectName || "—";

  return (
    <div className="enterprise-doc p-6 pb-10 max-w-5xl mx-auto quotation-invoice-theme bg-white">
      <div className="enterprise-doc-card">
        <EnterpriseDocHeader
          documentLabel="Invoice"
          title={data.name || "Invoice"}
          reference={data.invoiceNo || "INV"}
          dateStr={dateValue(data.createdAt)}
          settings={settings}
        />
      </div>

      <div className="enterprise-doc-card">
        <div className="p-8 grid md:grid-cols-3 gap-4 text-sm">
          <div><p className="text-xs text-[#64748b] uppercase">Client</p><p dir="auto">{clientName}</p></div>
          <div><p className="text-xs text-[#64748b] uppercase">Project</p><p dir="auto">{projectName}</p></div>
          <div><p className="text-xs text-[#64748b] uppercase">Quotation</p><p>{data.quotationNo || "—"}</p></div>
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
              {(items.length ? items : [{ description: "Invoice amount", quantity: 1, unitPrice: total, total }]).map((item, index) => (
                <tr key={item._id || `item-${index}`}>
                  <td dir="auto">{item.name || item.description || "Item"}</td>
                  <td className="text-center">{Number(item.qty ?? item.quantity ?? 1)}</td>
                  <td className="text-right">{formatCurrency(item.unitPrice ?? item.price ?? 0)}</td>
                  <td className="text-right font-semibold">{formatCurrency(calculateItemTotal(item))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="summary mt-6">
            <div className="row"><span>Subtotal</span><span>{formatCurrency(summarySubtotal)}</span></div>
            <div className="row"><span>Discount</span><span>{formatCurrency(summaryDiscount)}</span></div>
            <div className="row"><span>Tax</span><span>{formatCurrency(summaryTax)}</span></div>
          </div>
          <div className="grand-total">
            <div className="label">Grand Total</div>
            <div className="amount">
              <span className="value">{formatCurrency(total)}</span>
              <span className="currency">SDG</span>
            </div>
          </div>
          <p className="text-sm mt-4">Paid to date: {formatCurrency(paid)}</p>
          <p className="text-sm">Balance due: {formatCurrency(remainingAmount)}</p>

          <div className="notes mt-6">
            <h4>Notes</h4>
            <ul>{DEFAULT_INVOICE_NOTES.map((line) => <li key={line}>{line}</li>)}</ul>
          </div>
        </div>
      </div>
    </div>
  );
}
