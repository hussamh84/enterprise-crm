import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Download, Filter, Handshake, MessageSquare, Search, Sparkles, Target, Users, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  const inventoryValue = useMemo(
    () =>
      Array.isArray(inventoryItems)
        ? inventoryItems.reduce((sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0), 0)
        : 0,
    [inventoryItems]
  );
  const cards = [
    { title: "Total Leads", value: Number(data?.leads ?? 0), icon: Target, growth: "+12.6%" },
    { title: "Total Meetings", value: Number(data?.tickets ?? 0), icon: MessageSquare, growth: "+8.1%" },
    { title: "Total Revenue", value: formatCurrency(totalRevenue), icon: Wallet, growth: "+15.3%" },
    { title: "Total Deals", value: Number(data?.quotations ?? 0), icon: Handshake, growth: "+6.9%" },
  ];
  const filteredCards = cards.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()));
  const recentClients = [...(Array.isArray(clients) ? clients : [])]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);
  const chartData = [
    { month: "Jan", newLeads: 42, dealsClosed: 18 },
    { month: "Feb", newLeads: 50, dealsClosed: 22 },
    { month: "Mar", newLeads: 58, dealsClosed: 28 },
    { month: "Apr", newLeads: 63, dealsClosed: 31 },
    { month: "May", newLeads: 71, dealsClosed: 36 },
    { month: "Jun", newLeads: 78, dealsClosed: 42 },
  ];
  const meetingSchedule = [
    { id: 1, name: "James Carter", subtitle: "Product Demo Meeting", time: "09:30 AM" },
    { id: 2, name: "Ava Wilson", subtitle: "Contract Negotiation", time: "11:00 AM" },
    { id: 3, name: "Noah Smith", subtitle: "Quarterly Review", time: "02:00 PM" },
    { id: 4, name: "Sophia Davis", subtitle: "Discovery Call", time: "04:15 PM" },
  ];
  const headerDate = "April 12, 2025";
  const [leadSearch, setLeadSearch] = useState("");

  return (
    <div className="space-y-4 bg-[#f8fafc]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Monitor your sales pipeline and operational progress in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <CalendarDays size={14} /> {headerDate}
          </button>
          <button type="button" onClick={() => navigate("/reports")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm hover:bg-slate-50">
            <Download size={14} /> Export
          </button>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-600">
            <Sparkles size={14} /> AI Support
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 h-9 text-slate-500 bg-white max-w-md">
          <Search size={15} className="shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="layout-search-input !min-h-0 h-full py-0 border-0 shadow-none bg-transparent text-sm w-full placeholder:text-slate-400 outline-none"
            placeholder="Search KPI cards..."
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {filteredCards.map((card) => (
          <div key={card.title} className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                <card.icon size={16} />
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">{card.growth}</span>
            </div>
            <div>
              <p className="text-sm text-slate-500">{card.title}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{card.value}</p>
            </div>
            <button type="button" className="mt-4 text-xs font-medium text-slate-500 hover:text-slate-700">
              See details →
            </button>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Leads Performance</h2>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <div>
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-300 mr-1" />
                New Leads
              </div>
              <div>
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-1" />
                Deals Closed
              </div>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="newLeads" fill="#86efac" radius={[8, 8, 0, 0]} barSize={18} />
                <Bar dataKey="dealsClosed" fill="#34d399" radius={[8, 8, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Meeting Schedule</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {meetingSchedule.map((meeting, index) => (
              <li key={meeting.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 text-xs font-medium flex items-center justify-center shrink-0">
                    {meeting.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{meeting.name}</p>
                    <p className="text-xs text-slate-500 truncate">{meeting.subtitle}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{meeting.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Lead List</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 h-9 text-slate-500">
              <Search size={14} />
              <input
                value={leadSearch}
                onChange={(event) => setLeadSearch(event.target.value)}
                placeholder="Search leads..."
                className="border-0 bg-transparent text-sm outline-none"
              />
            </div>
            <button type="button" className="h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1">
              <Filter size={14} /> Filter
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Status</th>
                <th>Contact Date</th>
                <th>Source</th>
                <th>Lead ID</th>
              </tr>
            </thead>
            <tbody>
              {recentClients.length ? (
                recentClients.map((client) => (
                  <tr key={client._id}>
                    <td>{client.name || "-"}</td>
                    <td>{client.name || "Nexlio Co."}</td>
                    <td>
                      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                        Active
                      </span>
                    </td>
                    <td>{new Date(client.createdAt || Date.now()).toLocaleDateString()}</td>
                    <td>{client.email ? "Website" : "Referral"}</td>
                    <td>{String(client._id || "").slice(-6).toUpperCase()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-sm text-slate-500">
                    No lead records available.
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
