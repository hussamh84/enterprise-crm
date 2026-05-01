import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, DollarSign, Search, TrendingUp, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function invoiceIsPaid(inv) {
  const status = String(inv?.status || "").toLowerCase();
  const remaining = Number(inv?.remainingAmount ?? NaN);
  return status === "paid" || (Number.isFinite(remaining) && remaining <= 0);
}

function paidInvoiceAmount(inv) {
  return Number(inv?.paidAmount ?? inv?.total ?? inv?.grandTotal ?? inv?.summarySubtotal ?? 0);
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["kpis"],
    queryFn: async () => (await api.get("/dashboard/kpis")).data,
  });
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory-low-stock-dashboard"],
    queryFn: async () => (await api.get("/inventory")).data,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["/clients", "dashboard-recent"],
    queryFn: async () => (await api.get("/clients")).data,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["/invoices", "dashboard-kpi-paid-revenue"],
    queryFn: async () => {
      const raw = (await api.get("/invoices")).data;
      return Array.isArray(raw) ? raw : [];
    },
  });
  const { data: projectsList = [] } = useQuery({
    queryKey: ["/projects", "dashboard-charts"],
    queryFn: async () => {
      const raw = (await api.get("/projects")).data;
      return Array.isArray(raw) ? raw : [];
    },
  });

  const inventoryValue = useMemo(
    () =>
      Array.isArray(inventoryItems)
        ? inventoryItems.reduce((sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0), 0)
        : 0,
    [inventoryItems]
  );

  const paidInvoicesTotal = useMemo(() => {
    let total = 0;
    for (const inv of invoices) {
      if (!invoiceIsPaid(inv)) continue;
      total += paidInvoiceAmount(inv);
    }
    return total;
  }, [invoices]);

  const revenueTrendData = useMemo(() => {
    const year = new Date().getFullYear();
    const totals = new Array(12).fill(0);
    for (const inv of invoices) {
      if (!invoiceIsPaid(inv)) continue;
      const raw = inv?.paidAt || inv?.updatedAt || inv?.createdAt;
      const d = raw ? new Date(raw) : null;
      if (!d || Number.isNaN(d.getTime()) || d.getFullYear() !== year) continue;
      totals[d.getMonth()] += paidInvoiceAmount(inv);
    }
    return MONTH_SHORT.map((month, i) => ({ month, revenue: totals[i] }));
  }, [invoices]);

  const projectsStatusData = useMemo(() => {
    let active = 0;
    let completed = 0;
    for (const p of projectsList) {
      const s = String(p?.status || "").toLowerCase();
      if (s === "completed" || s === "paid") completed += 1;
      else active += 1;
    }
    return [
      { segment: "Active", count: active },
      { segment: "Completed", count: completed },
    ];
  }, [projectsList]);

  const recentProjects = useMemo(
    () =>
      [...projectsList]
        .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
        .slice(0, 5),
    [projectsList]
  );

  const recentInvoices = useMemo(
    () =>
      [...invoices]
        .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
        .slice(0, 5),
    [invoices]
  );

  const projectStatusMeta = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "completed" || s === "paid") {
      return { label: "Completed", className: "bg-green-100 text-green-700" };
    }
    if (s === "pending" || s === "in_progress" || s === "in progress") {
      return { label: "Pending", className: "bg-yellow-100 text-yellow-700" };
    }
    return { label: "Active", className: "bg-blue-100 text-blue-700" };
  };

  const projectProgress = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "completed" || s === "paid") return 100;
    if (s === "pending" || s === "in_progress" || s === "in progress") return 45;
    return 70;
  };

  const invoicePaymentMeta = (invoice) => {
    const total = Number(invoice?.total ?? invoice?.grandTotal ?? 0);
    const paid = Number(invoice?.paidAmount ?? 0);
    const remaining = Number(invoice?.remainingAmount ?? Math.max(total - paid, 0));
    const status = String(invoice?.status || "").toLowerCase();
    if (status === "paid" || remaining <= 0) {
      return { label: "Paid", className: "bg-green-100 text-green-700" };
    }
    if (paid > 0 || status === "partial") {
      return { label: "Partial", className: "bg-yellow-100 text-yellow-700" };
    }
    return { label: "Unpaid", className: "bg-red-100 text-red-700" };
  };

  const cards = [
    {
      title: "Total Revenue",
      value: formatCurrency(paidInvoicesTotal),
      subtitle: "Paid invoices",
      icon: DollarSign,
    },
    {
      title: "Total Projects",
      value: String(Number(data?.projects ?? 0)),
      subtitle: "Active + completed",
      icon: BriefcaseBusiness,
    },
    {
      title: "Total Clients",
      value: String(Number(data?.clients ?? 0)),
      subtitle: "Registered customers",
      icon: Users,
    },
    {
      title: "Inventory Value",
      value: formatCurrency(inventoryValue),
      subtitle: "Current stock value",
      icon: TrendingUp,
    },
  ];
  const recentClients = [...(Array.isArray(clients) ? clients : [])]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 6);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-4 bg-gray-50 rounded-lg p-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{today}</span>
          <button
            type="button"
            onClick={() => navigate("/reports")}
            data-ui="generate-report-btn"
            style={{
              backgroundColor: "#111827",
              color: "#ffffff",
              border: "none",
            }}
            className="px-3 py-1.5 rounded text-sm hover:opacity-90"
          >
            Generate Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-500">{card.title}</p>
                  <p className="mt-3 truncate text-3xl font-semibold tracking-tight text-slate-900">{card.value}</p>
                  <p className="mt-2 text-xs text-slate-500">{card.subtitle}</p>
                </div>
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0B132B]/10 text-[#0B132B]"
                  aria-hidden
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="mb-6 text-lg font-semibold text-slate-900">Revenue Overview</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} width={72} />
                <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={(label) => String(label)} />
                <Line type="monotone" dataKey="revenue" stroke="#0B132B" strokeWidth={2} dot={{ r: 3, fill: "#0B132B" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="mb-6 text-lg font-semibold text-slate-900">Projects Overview</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectsStatusData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="segment" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} allowDecimals={false} width={40} />
                <Tooltip formatter={(value) => [value, "Projects"]} />
                <Bar dataKey="count" fill="#0B132B" radius={[6, 6, 0, 0]} name="Projects" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Recent Projects</h3>
          <div className="space-y-3">
            {recentProjects.length === 0 ? (
              <p className="text-sm text-slate-500">No projects available.</p>
            ) : (
              recentProjects.map((project) => {
                const meta = projectStatusMeta(project?.status);
                const progress = projectProgress(project?.status);
                return (
                  <div key={project?._id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{project?.name || "Project"}</p>
                        <p className="truncate text-xs text-slate-500">
                          {project?.clientId?.name || "No client"} •{" "}
                          {new Date(project?.createdAt || Date.now()).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-[#0B132B]"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-600">{progress}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Recent Invoices</h3>
          <div className="space-y-3">
            {recentInvoices.length === 0 ? (
              <p className="text-sm text-slate-500">No invoices available.</p>
            ) : (
              recentInvoices.map((invoice) => {
                const meta = invoicePaymentMeta(invoice);
                return (
                  <div key={invoice?._id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {invoice?.invoiceNo || invoice?.invoiceNumber || `INV-${String(invoice?._id || "").slice(-6)}`}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {invoice?.clientId?.name || invoice?.clientName || "No client"} •{" "}
                          {new Date(invoice?.createdAt || Date.now()).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      {formatCurrency(
                        Number(invoice?.total ?? invoice?.grandTotal ?? invoice?.paidAmount ?? 0)
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Recent Clients</h2>
          <Search size={14} className="text-slate-400" />
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Added On</th>
              </tr>
            </thead>
            <tbody>
              {recentClients.length ? (
                recentClients.map((client) => (
                  <tr key={client._id}>
                    <td>{client.name || "-"}</td>
                    <td>{client.email || "-"}</td>
                    <td>{client.phone || "-"}</td>
                    <td>{new Date(client.createdAt || Date.now()).toLocaleDateString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-sm text-slate-500">
                    No client records available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
