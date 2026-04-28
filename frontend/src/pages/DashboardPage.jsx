import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes, BriefcaseBusiness, DollarSign, Search, TrendingUp, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";

const __filename = import.meta.url;
console.log("CHECK PAGE:", __filename);

export default function DashboardPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [search, setSearch] = useState("");
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
  const inventoryValue = Array.isArray(inventoryItems)
    ? inventoryItems.reduce((sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0), 0)
    : 0;
  const cards = [
    { name: "Total Clients", key: "clients", value: Number(data?.clients ?? 0), icon: Users, growth: "+8.4%" },
    { name: "Total Projects", key: "projects", value: Number(data?.projects ?? 0), icon: BriefcaseBusiness, growth: "+5.2%" },
    { name: "Total Revenue", key: "revenue", value: formatCurrency(totalRevenue), icon: DollarSign, growth: "+12.1%" },
    { name: "Inventory Value", key: "inventory", value: formatCurrency(inventoryValue), icon: Boxes, growth: "+3.6%" },
  ];
  const filteredCards = cards.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
  const recentClients = [...(Array.isArray(clients) ? clients : [])]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 6);
  const chartBars = [
    { label: "Jan", value: Number(monthlyReport?.totals?.totalRevenue || 0) * 0.55 + 20 },
    { label: "Feb", value: Number(monthlyReport?.totals?.totalRevenue || 0) * 0.7 + 26 },
    { label: "Mar", value: Number(monthlyReport?.totals?.totalRevenue || 0) * 0.85 + 32 },
    { label: "Apr", value: Number(monthlyReport?.totals?.totalRevenue || 0) * 0.95 + 38 },
    { label: "May", value: Number(monthlyReport?.totals?.totalRevenue || 0) * 1.05 + 42 },
    { label: "Jun", value: Number(monthlyReport?.totals?.totalRevenue || 0) * 1.15 + 48 },
  ];
  const maxBar = Math.max(...chartBars.map((bar) => bar.value), 1);
  const lowStockCount = Array.isArray(inventoryItems)
    ? inventoryItems.filter((item) => item?.lowStock).length
    : 0;

  return (
    <div className="space-y-6 rounded-2xl bg-[#f8fafc] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="section-title">Executive Dashboard</h1>
          <p className="page-subtitle text-[#6b7c93]">Real-time visibility across sales, project delivery, and support operations.</p>
        </div>
        <button type="button" onClick={() => navigate("/reports")} className="button-primary">
          Generate Report
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 border">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 h-9 text-slate-500 bg-white max-w-md">
          <Search size={15} className="shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="layout-search-input !min-h-0 h-full py-0 border-0 shadow-none bg-transparent text-sm w-full placeholder:text-slate-400 outline-none"
            placeholder="Search dashboard cards..."
          />
        </div>
      </div>

      {lowStockCount > 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-4 border border-rose-200 bg-rose-50 text-rose-700">
          ⚠ {lowStockCount} items low in stock
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {filteredCards.map((card) => (
          <div key={card.key} className="bg-white rounded-xl shadow-sm p-4 border">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{card.name}</p>
                <p className="mt-2 text-2xl font-semibold text-[#0a2540] numeric">{card.value}</p>
              </div>
              <div className="h-10 w-10 rounded-lg border border-slate-200 text-[#0a2540] flex items-center justify-center bg-slate-50">
                <card.icon size={18} />
              </div>
            </div>
            <div className="mt-4 text-xs text-emerald-600 font-medium flex items-center gap-1">
              <TrendingUp size={13} /> {card.growth} from last month
            </div>
          </div>
        ))}
        {!filteredCards.length ? (
          <div className="bg-white rounded-xl shadow-sm p-4 border md:col-span-2 xl:col-span-4 text-sm text-[#6b7c93]">
            No dashboard results found for "{search}".
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-white rounded-xl shadow-sm p-4 border lg:col-span-2">
          <h2 className="text-sm font-semibold text-[#0a2540]">Revenue / Projects Trend</h2>
          <p className="text-xs text-[#6b7c93] mt-1 mb-4">Visual summary for the last period.</p>
          <div className="flex items-end justify-between gap-2 min-h-[210px]">
            {chartBars.map((bar) => (
              <div key={bar.label} className="flex-1 min-w-0 flex flex-col items-center gap-2">
                <div className="w-full max-w-[42px] bg-slate-100 rounded-md h-[170px] flex items-end p-1">
                  <div
                    className="w-full rounded bg-gray-900"
                    style={{ height: `${Math.max(8, (bar.value / maxBar) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">{bar.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border">
          <h2 className="text-sm font-semibold text-[#0a2540]">Upcoming Activity</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="rounded-lg border border-slate-200 text-[#425466] px-3 py-2 flex items-center justify-between">
              <span>Meeting with Al Rayan Group</span>
              <span className="text-xs text-slate-400">10:00 AM</span>
            </li>
            <li className="rounded-lg border border-slate-200 text-[#425466] px-3 py-2 flex items-center justify-between">
              <span>Prepare project handover checklist</span>
              <span className="text-xs text-slate-400">Task</span>
            </li>
            <li className="rounded-lg border border-slate-200 text-[#425466] px-3 py-2 flex items-center justify-between">
              <span>Invoice approval deadline</span>
              <span className="text-xs text-slate-400">Today</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#0a2540]">Recent Clients</h2>
          <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={() => navigate("/clients")}>
            View all
          </button>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Date</th>
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
                    No clients available yet.
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
