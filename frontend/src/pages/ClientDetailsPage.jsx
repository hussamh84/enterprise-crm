import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Fragment } from "react";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";
import { formatClientNumber } from "../utils/formatClientNumber";

const __filename = import.meta.url;
console.log("CHECK PAGE:", __filename);

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "projects", label: "Projects" },
  { key: "quotations", label: "Quotations" },
  { key: "invoices", label: "Client Invoices" },
  { key: "timeline", label: "Activity Timeline" },
];

const dateValue = (value) => (value ? new Date(value).toLocaleDateString() : "-");
const dateTimeValue = (value) => (value ? new Date(value).toLocaleString() : "-");

export default function ClientDetailsPage({ initialTab = "overview" }) {
  const { id, clientId: legacyClientId } = useParams();
  const clientId = id || legacyClientId;
  const [activeTab, setActiveTab] = useState(initialTab);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["client-details", clientId],
    queryFn: async () => (await api.get(`/clients/${clientId}/details`)).data,
    enabled: Boolean(clientId),
  });

  const client = data?.client;
  const stats = data?.stats;
  const projects = data?.projects ?? [];
  const quotations = data?.quotations ?? [];
  const timeline = data?.timeline ?? [];
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);
  const { data: clientInvoices = [] } = useQuery({
    queryKey: ["client-invoices", clientId],
    queryFn: async () => (await api.get(`/invoices?clientId=${encodeURIComponent(clientId)}`)).data,
    enabled: Boolean(clientId),
  });
  const primaryContact = useMemo(() => client?.contacts?.[0], [client]);

  if (!clientId) return null;

  if (isLoading) {
    return <div className="premium-card p-8 text-center text-slate-500">Loading client details...</div>;
  }

  if (isError || !client) {
    return <div className="premium-card p-8 text-center text-rose-600">Unable to load client details.</div>;
  }

  return (
    <div className="client-page space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">{client.name}</h1>
          <p className="text-[#6b7c93] mt-1">
            <span className="font-medium text-[#425466]">{formatClientNumber(client)}</span>
            <span className="mx-2">·</span>
            Full client profile, financials, and related operations activity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/sales/new?clientId=${encodeURIComponent(clientId)}`}
            className="btn-primary"
          >
            Sell from Inventory
          </Link>
          <Link
            to={`/projects/new?clientId=${encodeURIComponent(clientId)}`}
            className="rounded-lg bg-gray-900 text-white px-3 py-2 text-sm font-medium hover:bg-black"
            data-ui="create-project-btn"
          >
            Create project
          </Link>
          <Link to="/clients" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#425466] hover:bg-slate-50">
            Back to Clients
          </Link>
        </div>
      </div>

      <div className="premium-card p-2">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                activeTab === tab.key ? "bg-[#eef4ff] text-[#1f3d7a]" : "text-[#425466] hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-5">
          <div className="premium-card p-5">
            <h2 className="font-semibold text-[#0a2540] mb-4">Client Info</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <Field label="Client Name" value={client.name} />
              <Field label="Status" value={client.status || "-"} />
              <Field label="Primary Contact" value={primaryContact?.name || "-"} />
              <Field label="Primary Email" value={primaryContact?.email || "-"} />
              <Field label="Account email" value={client.email || "-"} />
              <Field label="Phone" value={client.phone || "-"} />
            </div>
          </div>
          <div className="premium-card p-5">
            <h2 className="font-semibold text-[#0a2540] mb-4">Summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <Metric label="Total Projects" value={<span className="numeric">{String(stats?.totalProjects || 0)}</span>} />
              <Metric label="Total Quotations" value={<span className="numeric">{String(stats?.totalQuotations ?? quotations.length)}</span>} />
              <Metric label="Total Quoted" value={<span className="currency numeric">{formatCurrency(stats?.totalQuoted)}</span>} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "projects" && (
        <div className="premium-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold text-[#0a2540]">Client projects</h2>
            <Link
              to={`/projects/new?clientId=${encodeURIComponent(clientId)}`}
              className="rounded-lg bg-gray-900 text-white px-3 py-2 text-sm font-medium hover:bg-black"
              data-ui="create-project-btn"
            >
              Create project
            </Link>
          </div>
          {projects.length === 0 ? (
            <p className="text-sm text-[#6b7c93]">No projects found for this client.</p>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div key={project._id} className="rounded-lg border border-slate-200 px-3 py-3 text-sm flex items-center justify-between">
                  <div>
                    <Link to={`/projects/${project._id}`} className="font-medium text-[#635bff] hover:underline">
                      {project.name}
                    </Link>
                    <p className="text-xs text-[#6b7c93] mt-1">{project.projectType || "-"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#0a2540]">{project.status || "-"}</p>
                    <p className="text-xs text-[#6b7c93]">Progress: {Number(project.progress || 0)}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "quotations" && (
        <div className="premium-card p-5">
          <h2 className="font-semibold text-[#0a2540] mb-4">Quotations</h2>
          {quotations.length === 0 ? (
            <p className="text-sm text-[#6b7c93]">No quotations for this client yet.</p>
          ) : (
            <div className="space-y-2">
              {quotations.map((q) => (
                <div key={q._id} className="rounded-lg border border-slate-200 px-3 py-3 text-sm flex items-center justify-between">
                  <div>
                    <Link to={`/quotations/${q._id}`} className="font-medium text-[#635bff] hover:underline">
                      {q.quotationNo || q.name || "Quotation"}
                    </Link>
                    <p className="text-xs text-[#6b7c93] mt-1">{dateValue(q.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#0a2540]">
                      <span className="currency numeric">{formatCurrency(q.grandTotal)}</span>
                    </p>
                    <p className="text-xs text-[#6b7c93]">{q.status || "draft"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "invoices" && (
        <div className="premium-card p-5">
          <h2 className="font-semibold text-[#0a2540] mb-4">Client Invoices</h2>
          {clientInvoices.length === 0 ? (
            <p className="text-sm text-[#6b7c93]">No invoices for this client yet.</p>
          ) : (
            <div className="space-y-2 max-w-full overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="saas-grid-head text-left">
                      <th className="px-3 py-2">Invoice Number</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Paid</th>
                      <th className="px-3 py-2">Remaining</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap w-[220px] max-w-[220px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientInvoices.map((invoice) => {
                      const isExpanded = expandedInvoiceId === invoice._id;
                      const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
                      return (
                        <Fragment key={invoice._id}>
                          <tr key={invoice._id} className="saas-grid-row text-sm border-b border-slate-200">
                            <td className="px-3 py-3 font-medium">{invoice.invoiceNo || invoice.invoiceNumber || "—"}</td>
                            <td className="px-3 py-3"><span className="currency numeric">{formatCurrency(invoice.total || 0)}</span></td>
                            <td className="px-3 py-3"><span className="currency numeric">{formatCurrency(invoice.paidAmount || 0)}</span></td>
                            <td className="px-3 py-3"><span className="currency numeric">{formatCurrency(invoice.remainingAmount || 0)}</span></td>
                            <td className="px-3 py-3">{String(invoice.status || "draft")}</td>
                            <td className="px-3 py-3">{dateValue(invoice.createdAt)}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-right w-[220px] max-w-[220px] overflow-hidden">
                              <div className="flex gap-1 justify-end items-center max-w-full overflow-hidden">
                                <button
                                  type="button"
                                  className="text-xs px-2 py-1 rounded-md shrink-0 bg-slate-100 text-slate-700 hover:bg-slate-200 truncate"
                                  onClick={() => window.open(`/api/invoices/${invoice._id}/pdf`, "_blank")}
                                >
                                  PDF
                                </button>
                                <button
                                  type="button"
                                  className="text-xs px-2 py-1 rounded-md shrink-0 bg-slate-100 text-slate-700 hover:bg-slate-200 truncate"
                                  onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice._id)}
                                >
                                  {isExpanded ? "Hide" : "Payments"}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded ? (
                            <tr className="bg-slate-50">
                              <td colSpan={7} className="px-4 py-3 border-b border-slate-200">
                                <p className="text-xs font-semibold text-[#425466] mb-2">Payment History</p>
                                {payments.length === 0 ? (
                                  <p className="text-sm text-[#6b7c93]">No payments recorded.</p>
                                ) : (
                                  <div className="space-y-1">
                                    {payments.map((payment, idx) => (
                                      <div key={`${invoice._id}-payment-${idx}`} className="text-sm text-[#425466] flex items-center justify-between">
                                        <span>{dateTimeValue(payment?.date)}</span>
                                        <span className="currency numeric">{formatCurrency(payment?.amount || 0)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="premium-card p-5">
          <h2 className="font-semibold text-[#0a2540] mb-4">Activity Timeline</h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-[#6b7c93]">No activity found for this client.</p>
          ) : (
            <div className="space-y-3">
              {timeline.map((entry, index) => (
                <div key={`${entry.entity}-${entry.entityId}-${entry.action}-${index}`} className="rounded-lg border border-slate-200 px-3 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-[#0a2540]">{entry.action}</p>
                    <p className="text-xs text-[#6b7c93]">{dateTimeValue(entry.at)}</p>
                  </div>
                  <p className="text-xs text-[#6b7c93] mt-1">
                    {entry.entity} {entry.entityName ? `• ${entry.entityName}` : ""}
                  </p>
                  {entry.note ? <p className="text-sm text-[#425466] mt-2">{entry.note}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <p className="text-xs text-[#6b7c93] uppercase tracking-[0.08em]">{label}</p>
      <p className="text-sm font-medium text-[#0a2540] mt-1">{value}</p>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <p className="text-xs text-[#6b7c93] uppercase tracking-[0.08em]">{label}</p>
      <p className="text-xl font-semibold text-[#0a2540] mt-2">{value}</p>
    </div>
  );
}
