import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BriefcaseBusiness, Headset, Search, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { formatMoney } from "../utils/formatCurrency";

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

  const totalRevenue = Number(yearlyReport?.totals?.totalRevenue || monthlyReport?.totals?.totalRevenue || 0);
  const totalExpenses = Number(yearlyReport?.totals?.totalExpenses || monthlyReport?.totals?.totalExpenses || 0);
  const totalProfit = Number(yearlyReport?.totals?.totalProfit || monthlyReport?.totals?.totalProfit || 0);

  const cards = [
    { name: "Leads", label: "Leads", value: data?.leads ?? 0, icon: Activity },
    { name: "Projects", label: "Projects", value: data?.projects ?? 0, icon: BriefcaseBusiness },
    { name: "Quotations", label: "Quotations", value: data?.quotations ?? 0, icon: BriefcaseBusiness },
    { name: "Tickets", label: "Tickets", value: data?.tickets ?? 0, icon: Headset },
  ];
  const filteredCards = cards.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="section-title">Executive Dashboard</h1>
          <p className="page-subtitle text-[#6b7c93]">Real-time visibility across sales, project delivery, and support operations.</p>
        </div>
        <button type="button" onClick={() => navigate("/reports")} className="btn-primary">
          Generate Report
        </button>
      </div>

      <div className="premium-card p-5">
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

      <div className="grid md:grid-cols-4 gap-3">
        {filteredCards.map((card) => (
          <div key={card.label} className="premium-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#6b7c93] text-sm">{card.label}</p>
                <p className="text-2xl font-semibold mt-2 text-[#0a2540] tabular-nums">{card.value}</p>
              </div>
              <div className="h-10 w-10 rounded-lg border border-slate-200 text-[#0a2540] flex items-center justify-center bg-slate-50">
                <card.icon size={18} />
              </div>
            </div>
            <div className="mt-4 text-xs text-emerald-600 font-medium flex items-center gap-1">
              <TrendingUp size={13} /> +12.4% from last month
            </div>
          </div>
        ))}
        {!filteredCards.length ? (
          <div className="premium-card p-5 md:col-span-4 text-sm text-[#6b7c93]">
            No dashboard results found for "{search}".
          </div>
        ) : null}
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="premium-card p-5">
          <p className="text-[#6b7c93] text-sm">Total Revenue</p>
          <p className="text-xl font-semibold mt-2 text-[#0a2540]">
            <span className="currency">{formatMoney(totalRevenue)}</span>
          </p>
        </div>
        <div className="premium-card p-5">
          <p className="text-[#6b7c93] text-sm">Total Expenses</p>
          <p className="text-xl font-semibold mt-2 text-[#0a2540]">
            <span className="currency">{formatMoney(totalExpenses)}</span>
          </p>
        </div>
        <div className="premium-card p-5">
          <p className="text-[#6b7c93] text-sm">Total Profit</p>
          <p className={`text-xl font-semibold mt-2 ${totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            <span className="currency">{formatMoney(totalProfit)}</span>
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="premium-card p-5">
          <p className="text-[#6b7c93] text-sm">Monthly Report</p>
          <p className="text-xs text-[#94a3b8] mt-1">
            {now.toLocaleString("default", { month: "long" })} {now.getFullYear()}
          </p>
          <div className="mt-3 space-y-1.5 text-sm">
            <p className="flex items-center justify-between gap-2"><span className="text-[#6b7c93]">Total Revenue</span><span className="font-medium text-[#0a2540] shrink-0"><span className="currency">{formatMoney(monthlyReport?.totals?.totalRevenue)}</span></span></p>
            <p className="flex items-center justify-between gap-2"><span className="text-[#6b7c93]">Total Expenses</span><span className="font-medium text-[#0a2540] shrink-0"><span className="currency">{formatMoney(monthlyReport?.totals?.totalExpenses)}</span></span></p>
            <p className="flex items-center justify-between gap-2"><span className="text-[#6b7c93]">Total Profit</span><span className="font-semibold text-[#0a2540] shrink-0"><span className="currency">{formatMoney(monthlyReport?.totals?.totalProfit)}</span></span></p>
          </div>
        </div>
        <div className="premium-card p-5">
          <p className="text-[#6b7c93] text-sm">Yearly Report</p>
          <p className="text-xs text-[#94a3b8] mt-1">{now.getFullYear()}</p>
          <div className="mt-3 space-y-1.5 text-sm">
            <p className="flex items-center justify-between gap-2"><span className="text-[#6b7c93]">Total Revenue</span><span className="font-medium text-[#0a2540] shrink-0"><span className="currency">{formatMoney(yearlyReport?.totals?.totalRevenue)}</span></span></p>
            <p className="flex items-center justify-between gap-2"><span className="text-[#6b7c93]">Total Expenses</span><span className="font-medium text-[#0a2540] shrink-0"><span className="currency">{formatMoney(yearlyReport?.totals?.totalExpenses)}</span></span></p>
            <p className="flex items-center justify-between gap-2"><span className="text-[#6b7c93]">Total Profit</span><span className="font-semibold text-[#0a2540] shrink-0"><span className="currency">{formatMoney(yearlyReport?.totals?.totalProfit)}</span></span></p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="premium-card p-5 lg:col-span-2">
          <h2 className="text-[#0a2540]">Performance Snapshot</h2>
          <p className="text-sm text-[#6b7c93] mb-4">Pipeline conversion, installation velocity, and revenue trend.</p>
          <div className="grid grid-cols-3 gap-3">
            {["Lead Conversion", "Project Completion", "Quotation Approval"].map((kpi, idx) => (
              <div key={kpi} className="rounded-lg border border-slate-200 p-4">
                <p className="text-xs text-[#6b7c93]">{kpi}</p>
                <p className="text-2xl font-semibold mt-2 text-[#0a2540]">{[38, 74, 81][idx]}%</p>
              </div>
            ))}
          </div>
        </div>
        <div className="premium-card p-5">
          <h2 className="text-[#0a2540]">Today's Priorities</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="rounded-lg border border-slate-200 text-[#425466] px-3 py-2">Follow-up high-score solar leads</li>
            <li className="rounded-lg border border-slate-200 text-[#425466] px-3 py-2">Resolve critical support tickets</li>
            <li className="rounded-lg border border-slate-200 text-[#425466] px-3 py-2">Approve pending quotations</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
