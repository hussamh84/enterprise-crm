import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, DollarSign, Search, TrendingUp, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";

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
      const status = String(inv?.status || "").toLowerCase();
      const remaining = Number(inv?.remainingAmount ?? NaN);
      const isPaid = status === "paid" || (Number.isFinite(remaining) && remaining <= 0);
      if (!isPaid) continue;
      const amount = Number(
        inv?.paidAmount ?? inv?.total ?? inv?.grandTotal ?? inv?.summarySubtotal ?? 0
      );
      total += amount;
    }
    return total;
  }, [invoices]);

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
