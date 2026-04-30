import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";
import { openPdf } from "../utils/pdf";

export default function QuotationsPage() {
  const navigate = useNavigate();
  const { data: quotations = [], isLoading, refetch } = useQuery({
    queryKey: ["/quotations"],
    queryFn: async () => (await api.get("/quotations")).data,
  });

  const refreshQuotations = async () => {
    await refetch();
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/quotations/${id}`);
      await refreshQuotations();
    } catch (err) {
      console.error("DELETE QUOTATION ERROR:", err);
    }
  };

  const handleConvertToInvoice = async (id) => {
    try {
      const res = await api.patch(`/quotations/${id}/approve`);
      await refreshQuotations();
      const invoiceId = res?.data?.invoice?._id;
      if (invoiceId) navigate(`/invoices/${invoiceId}`);
    } catch (err) {
      console.error("CONVERT QUOTATION ERROR:", err);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Quotations</h1>
          <p className="page-subtitle">Manage all quotations with full actions.</p>
        </div>
        <Link to="/quotations/new" className="button-primary">
          Create Quotation
        </Link>
      </div>

      {isLoading ? <div className="text-sm text-slate-500">Loading quotations...</div> : null}

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="saas-table-shell border-0 rounded-none">
            <div className="saas-grid-head grid grid-cols-12">
              <div className="col-span-3">Client</div>
              <div className="col-span-2">Amount</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-3">Actions</div>
            </div>

            {!isLoading && quotations.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No quotations found.</div>
            ) : null}

            {quotations.map((q) => {
              const clientName = q?.clientId?.name || q?.clientName || "No Client";
              const amount = Number(q?.grandTotal ?? q?.subtotal ?? q?.total ?? 0);
              const status = String(q?.status || "draft");
              return (
                <div key={q._id} className="saas-grid-row grid grid-cols-12 items-center">
                  <div className="col-span-3">{clientName}</div>
                  <div className="col-span-2 text-sm text-slate-600">{formatCurrency(amount)}</div>
                  <div className="col-span-2 text-sm">{status}</div>
                  <div className="col-span-2 text-sm text-slate-600">{new Date(q.createdAt || Date.now()).toLocaleDateString()}</div>
                  <div className="col-span-3 p-2 whitespace-nowrap text-right">
                    <div className="flex items-center gap-1 flex-nowrap justify-end">
                      <Link to={`/quotations/${q._id}`} className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700">View</Link>
                      <Link to={`/quotations/${q._id}/edit`} className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700">Edit</Link>
                      <button type="button" className="text-xs px-2 py-1 rounded-md bg-black text-white" onClick={() => handleConvertToInvoice(q._id)}>Approve</button>
                      <button type="button" className="text-xs px-2 py-1 rounded-md bg-gray-200 text-gray-800" onClick={() => openPdf(`/quotations/${q._id}/pdf`)}>PDF</button>
                      <button type="button" className="text-xs px-2 py-1 rounded-md bg-red-100 text-red-600" onClick={() => handleDelete(q._id)}>Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
