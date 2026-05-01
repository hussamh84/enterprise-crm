import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, DollarSign, Search, TrendingUp, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";

const __filename = import.meta.url;
console.log("CHECK PAGE:", __filename);

export default function DashboardPage() {
  const navigate = useNavigate();
  const now = new Date();
  const { data } = useQuery({
    queryKey: ["kpis"],
    queryFn: async () => (await api.get("/dashboard/kpis")).data,
  });
  const { data: monthlyReport } = useQuery({
    queryKey: ["monthly-report", now.getFullYear(), now.getMonth() + 1],
    queryFn: async () =>
      (
        await api.get(`/reports/monthly?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
      ).data,
  });
  const { data: yearlyReport } = useQuery({
    queryKey: ["yearly-report", now.getFullYear()],
    queryFn: async () => (await api.get(`/reports/yearly?year=${now.getFullYear()}`)).data,
  });
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory-low-stock-dashboard"],
    queryFn: async () => (await api.get("/inventory")).data,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["/clients", "dashboard-recent"],
    queryFn: async () => (await api.get("/clients")).data,
  });

  const totalRevenue = Number(yearlyReport?.totals?.totalRevenue || monthlyReport?.totals?.totalRevenue || 0);
  const inventoryValue = useMemo(
    () =>
      Array.isArray(inventoryItems)
        ? inventoryItems.reduce((sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0), 0)
        : 0,
    [inventoryItems]
  );
  const cards = [
    { title: "Total Clients", value: Number(data?.clients ?? 0), icon: Users },
    { title: "Total Projects", value: Number(data?.projects ?? 0), icon: BriefcaseBusiness },
    { title: "Total Revenue", value: formatCurrency(totalRevenue), icon: DollarSign },
    { title: "Inventory Value", value: formatCurrency(inventoryValue), icon: TrendingUp },
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div key={card.title} className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{card.title}</p>
              <div className="h-8 w-8 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
                <card.icon size={16} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
          </div>
        ))}
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
