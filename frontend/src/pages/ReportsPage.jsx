import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { formatCurrency } from "../utils/formatCurrency";

export default function ReportsPage() {
  const [tab, setTab] = useState("project");
  const now = new Date();

  const { data: projects = [] } = useQuery({
    queryKey: ["/projects", "reports-page"],
    queryFn: async () => (await api.get("/projects")).data,
  });

  const { data: monthlyReport } = useQuery({
    queryKey: ["reports-monthly-breakdown", now.getFullYear()],
    queryFn: async () => (await api.get(`/reports/monthly?year=${now.getFullYear()}`)).data,
  });

  const { data: yearlyReport } = useQuery({
    queryKey: ["reports-yearly-breakdown"],
    queryFn: async () => (await api.get("/reports/yearly")).data,
  });

  return (
    <div className="space-y-3 p-4">
      <div>
        <h1 className="text-lg font-semibold text-[#0a2540]">Reports</h1>
        <p className="text-xs text-gray-500">Per project, monthly, and yearly financial performance.</p>
      </div>

      <div className="flex items-center gap-2">
        {[
          { key: "project", label: "Per Project" },
          { key: "monthly", label: "Monthly" },
          { key: "yearly", label: "Yearly" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`h-8 px-3 text-sm rounded-md border transition ${
              tab === item.key
                ? "bg-[#eef4ff] border-[#d6e4ff] text-[#1f3d7a]"
                : "border-slate-200 text-[#425466] bg-white hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "project" ? (
        <div className="bg-white rounded-xl shadow-sm p-4 overflow-x-auto">
          <div className="grid grid-cols-12 py-2 border-b border-slate-100 text-xs font-semibold text-gray-500 uppercase">
            <div className="col-span-5">Project</div>
            <div className="col-span-2">Revenue</div>
            <div className="col-span-2">Expenses</div>
            <div className="col-span-3">Profit</div>
          </div>
          {projects.map((project) => {
            const revenue = Number(project?.totalRevenue || 0);
            const expenses = Number(project?.totalExpenses || 0);
            const profit = Number(project?.profit ?? revenue - expenses);
            const clientName = project?.clientId?.name || "No Client";
            return (
              <div key={project._id} className="grid grid-cols-12 py-2 border-b border-slate-100 last:border-b-0 text-sm">
                <div className="col-span-5 text-[#0a2540] font-medium truncate">
                  {clientName} - {project?.name || "Project"}
                </div>
                <div className="col-span-2 text-[#0a2540]">{formatCurrency(revenue)}</div>
                <div className="col-span-2 text-[#0a2540]">{formatCurrency(expenses)}</div>
                <div className={`col-span-3 font-medium ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatCurrency(profit)}
                </div>
              </div>
            );
          })}
          {projects.length === 0 ? (
            <div className="py-3 text-xs text-gray-500">No projects found.</div>
          ) : null}
        </div>
      ) : null}

      {tab === "monthly" ? (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="grid grid-cols-12 py-2 border-b border-slate-100 text-xs font-semibold text-gray-500 uppercase">
            <div className="col-span-3">Month</div>
            <div className="col-span-3">Revenue</div>
            <div className="col-span-3">Expenses</div>
            <div className="col-span-3">Profit</div>
          </div>
          {(monthlyReport?.breakdown || []).map((row) => (
            <div key={row.month} className="grid grid-cols-12 py-2 border-b border-slate-100 last:border-b-0 text-sm">
              <div className="col-span-3 text-[#425466]">{row.month}</div>
              <div className="col-span-3 text-[#0a2540]">{formatCurrency(row.revenue)}</div>
              <div className="col-span-3 text-[#0a2540]">{formatCurrency(row.expenses)}</div>
              <div className={`col-span-3 font-medium ${Number(row.profit || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatCurrency(row.profit)}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "yearly" ? (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="grid grid-cols-12 py-2 border-b border-slate-100 text-xs font-semibold text-gray-500 uppercase">
            <div className="col-span-3">Year</div>
            <div className="col-span-3">Revenue</div>
            <div className="col-span-3">Expenses</div>
            <div className="col-span-3">Profit</div>
          </div>
          {(yearlyReport?.breakdown || []).map((row) => (
            <div key={row.year} className="grid grid-cols-12 py-2 border-b border-slate-100 last:border-b-0 text-sm">
              <div className="col-span-3 text-[#425466]">{row.year}</div>
              <div className="col-span-3 text-[#0a2540]">{formatCurrency(row.revenue)}</div>
              <div className="col-span-3 text-[#0a2540]">{formatCurrency(row.expenses)}</div>
              <div className={`col-span-3 font-medium ${Number(row.profit || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatCurrency(row.profit)}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
