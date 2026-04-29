import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";

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
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Per project, monthly, and yearly financial performance.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {[
          { key: "project", label: "Per Project" },
          { key: "monthly", label: "Monthly" },
          { key: "yearly", label: "Yearly" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={
              tab === item.key
                ? "btn-primary btn-compact"
                : "btn-secondary btn-compact"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "project" ? (
        <div className="overflow-x-auto">
          <div className="saas-table-shell min-w-full md:min-w-[640px]">
          <div className="saas-grid-head grid grid-cols-12">
            <div className="col-span-5">Project</div>
            <div className="col-span-2 currency-col">Revenue</div>
            <div className="col-span-2 currency-col">Expenses</div>
            <div className="col-span-3 currency-col">Profit</div>
          </div>
          {projects.map((project) => {
            const revenue = Number(project?.totalRevenue || 0);
            const expenses = Number(project?.totalExpenses || 0);
            const profit = Number(project?.profit ?? revenue - expenses);
            const clientName = project?.clientId?.name || "No Client";
            return (
              <div key={project._id} className="saas-grid-row grid grid-cols-12 text-sm">
                <div className="col-span-5 text-[#0a2540] font-medium truncate">
                  {clientName} - {project?.name || "Project"}
                </div>
                <div className="col-span-2 text-[#0a2540] currency-col">
                  <span className="currency numeric">{formatCurrency(revenue)}</span>
                </div>
                <div className="col-span-2 text-[#0a2540] currency-col">
                  <span className="currency numeric">{formatCurrency(expenses)}</span>
                </div>
                <div className={`col-span-3 font-medium currency-col ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  <span className="currency numeric">{formatCurrency(profit)}</span>
                </div>
              </div>
            );
          })}
          {projects.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No projects found.</div>
          ) : null}
          </div>
        </div>
      ) : null}

      {tab === "monthly" ? (
        <div className="saas-table-shell">
          <div className="saas-grid-head grid grid-cols-12">
            <div className="col-span-3">Month</div>
            <div className="col-span-3 currency-col">Revenue</div>
            <div className="col-span-3 currency-col">Expenses</div>
            <div className="col-span-3 currency-col">Profit</div>
          </div>
          {(monthlyReport?.breakdown || []).map((row) => (
            <div key={row.month} className="saas-grid-row grid grid-cols-12 text-sm">
              <div className="col-span-3 text-[#425466]">{row.month}</div>
              <div className="col-span-3 text-[#0a2540] currency-col">
                <span className="currency numeric">{formatCurrency(row.revenue)}</span>
              </div>
              <div className="col-span-3 text-[#0a2540] currency-col">
                <span className="currency numeric">{formatCurrency(row.expenses)}</span>
              </div>
              <div
                className={`col-span-3 font-medium currency-col ${Number(row.profit || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}
              >
                <span className="currency numeric">{formatCurrency(row.profit)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "yearly" ? (
        <div className="saas-table-shell">
          <div className="saas-grid-head grid grid-cols-12">
            <div className="col-span-3">Year</div>
            <div className="col-span-3 currency-col">Revenue</div>
            <div className="col-span-3 currency-col">Expenses</div>
            <div className="col-span-3 currency-col">Profit</div>
          </div>
          {(yearlyReport?.breakdown || []).map((row) => (
            <div key={row.year} className="saas-grid-row grid grid-cols-12 text-sm">
              <div className="col-span-3 text-[#425466]">{row.year}</div>
              <div className="col-span-3 text-[#0a2540] currency-col">
                <span className="currency numeric">{formatCurrency(row.revenue)}</span>
              </div>
              <div className="col-span-3 text-[#0a2540] currency-col">
                <span className="currency numeric">{formatCurrency(row.expenses)}</span>
              </div>
              <div
                className={`col-span-3 font-medium currency-col ${Number(row.profit || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}
              >
                <span className="currency numeric">{formatCurrency(row.profit)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
