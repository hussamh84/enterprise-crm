import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  BriefcaseBusiness,
  Calendar,
  Clock,
  Maximize2,
  RefreshCw,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../lib/api";
import { useCompanyBrandingSnapshot } from "../lib/companySettings";
import { formatCurrency } from "../utils/format";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const C = {
  navy: "#1f3147",
  navyMid: "#23364d",
  turquoise: "#1abc9c",
  orange: "#f39c12",
  red: "#e74c3c",
  green: "#95c11f",
};

function invoiceIsPaid(inv) {
  const status = String(inv?.status || "").toLowerCase();
  const remaining = Number(inv?.remainingAmount ?? NaN);
  return status === "paid" || (Number.isFinite(remaining) && remaining <= 0);
}

function paidInvoiceAmount(inv) {
  return Number(inv?.paidAmount ?? inv?.total ?? inv?.grandTotal ?? inv?.summarySubtotal ?? 0);
}

function clientKey(project) {
  const c = project?.clientId;
  if (c && typeof c === "object") return String(c._id || c.id || "");
  return String(c || "");
}

/** Reference-style status row for table (red / yellow / green) */
function tableStatusPresentation(status) {
  const s = String(status || "").toLowerCase();
  if (s === "completed" || s === "paid") {
    return { label: "Support", badgeClass: "bg-[#95c11f]/20 text-[#95c11f]", barClass: "bg-[#95c11f]" };
  }
  if (s === "pending" || s === "in_progress" || s === "in progress") {
    return { label: "Updating", badgeClass: "bg-amber-100 text-amber-700", barClass: "bg-amber-500" };
  }
  return { label: "Developing", badgeClass: "bg-[#e74c3c]/15 text-[#e74c3c]", barClass: "bg-[#e74c3c]" };
}

function tableActivityPercent(status) {
  const s = String(status || "").toLowerCase();
  if (s === "completed" || s === "paid") return 100;
  if (s === "pending" || s === "in_progress" || s === "in progress") return 55;
  return 72;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: workspaceSettings } = useQuery({
    queryKey: ["workspace-settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });
  const displayCompany = useCompanyBrandingSnapshot(workspaceSettings);

  const { data } = useQuery({
    queryKey: ["kpis"],
    queryFn: async () => (await api.get("/dashboard/kpis")).data,
  });
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory-low-stock-dashboard"],
    queryFn: async () => (await api.get("/inventory")).data,
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

  const salesLineData = useMemo(() => {
    const year = new Date().getFullYear();
    const totals = new Array(12).fill(0);
    const counts = new Array(12).fill(0);
    for (const inv of invoices) {
      if (!invoiceIsPaid(inv)) continue;
      const raw = inv?.paidAt || inv?.updatedAt || inv?.createdAt;
      const d = raw ? new Date(raw) : null;
      if (!d || Number.isNaN(d.getTime()) || d.getFullYear() !== year) continue;
      const m = d.getMonth();
      totals[m] += paidInvoiceAmount(inv);
      counts[m] += 1;
    }
    return MONTH_SHORT.map((label, i) => ({
      label,
      revenue: totals[i],
      paidCount: counts[i],
    }));
  }, [invoices]);

  const lastPaidAt = useMemo(() => {
    let latest = null;
    for (const inv of invoices) {
      if (!invoiceIsPaid(inv)) continue;
      const raw = inv?.paidAt || inv?.updatedAt || inv?.createdAt;
      const d = raw ? new Date(raw) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      if (!latest || d > latest) latest = d;
    }
    return latest;
  }, [invoices]);

  const revenueDotsActive = useMemo(() => {
    const year = new Date().getFullYear();
    const totals = new Array(12).fill(0);
    for (const inv of invoices) {
      if (!invoiceIsPaid(inv)) continue;
      const raw = inv?.paidAt || inv?.updatedAt || inv?.createdAt;
      const d = raw ? new Date(raw) : null;
      if (!d || Number.isNaN(d.getTime()) || d.getFullYear() !== year) continue;
      totals[d.getMonth()] += paidInvoiceAmount(inv);
    }
    const cur = new Date().getMonth();
    return [cur - 2, cur - 1, cur].map((m) => (m >= 0 ? totals[m] > 0 : false));
  }, [invoices]);

  const projectActivityBars = useMemo(() => {
    const sorted = [...projectsList].sort(
      (a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime()
    );
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const buckets = [];
    for (let i = 5; i >= 0; i -= 1) {
      const end = nowMs - i * weekMs;
      const start = end - weekMs;
      const d = new Date(start);
      buckets.push({
        start,
        end,
        label: `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`,
        projects: 0,
        returning: 0,
      });
    }
    const clientsSeen = new Set();
    for (const p of sorted) {
      const cid = clientKey(p);
      const created = new Date(p?.createdAt || 0).getTime();
      if (Number.isNaN(created)) continue;
      const isReturning = Boolean(cid && clientsSeen.has(cid));
      for (const b of buckets) {
        if (created >= b.start && created < b.end) {
          b.projects += 1;
          if (isReturning) b.returning += 1;
          break;
        }
      }
      if (cid) clientsSeen.add(cid);
    }
    return buckets;
  }, [projectsList]);

  const inventoryDonutData = useMemo(() => {
    if (!Array.isArray(inventoryItems) || inventoryItems.length === 0) {
      return [{ name: "Stock", value: Math.max(inventoryValue, 1), color: C.navy }];
    }
    const lines = inventoryItems
      .map((item) => ({
        v: Number(item?.price || 0) * Number(item?.quantity || 0),
      }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v);
    if (lines.length === 0) {
      return [{ name: "Stock", value: 1, color: C.navy }];
    }
    const total = lines.reduce((s, x) => s + x.v, 0);
    const n = lines.length;
    let a = 0;
    let b = 0;
    let c = 0;
    if (n === 1) {
      a = total;
    } else if (n === 2) {
      a = lines[0].v;
      b = lines[1].v;
    } else {
      const i = Math.max(1, Math.floor(n * 0.45));
      const j = Math.max(i + 1, Math.floor(n * 0.8));
      a = lines.slice(0, i).reduce((s, x) => s + x.v, 0);
      b = lines.slice(i, j).reduce((s, x) => s + x.v, 0);
      c = lines.slice(j).reduce((s, x) => s + x.v, 0);
    }
    const out = [];
    if (a > 0) out.push({ name: "Core", value: a, color: C.navy });
    if (b > 0) out.push({ name: "Mid", value: b, color: C.turquoise });
    if (c > 0) out.push({ name: "Tail", value: c, color: C.orange });
    if (out.length === 0) out.push({ name: "Stock", value: Math.max(total, 1), color: C.navy });
    return out;
  }, [inventoryItems, inventoryValue]);

  const tableProjects = useMemo(
    () =>
      [...projectsList]
        .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
        .slice(0, 5),
    [projectsList]
  );

  const mapSidebarStats = useMemo(() => {
    const totalP = projectsList.length;
    const pending = projectsList.filter((p) => {
      const s = String(p?.status || "").toLowerCase();
      return s === "pending" || s === "in_progress" || s === "in progress";
    }).length;
    const queuePct = totalP ? Math.round((pending / totalP) * 100) : 0;

    const paidCount = invoices.filter(invoiceIsPaid).length;
    const invTotal = invoices.length;
    const shipCap = Math.max(invTotal, 1);
    const shipped = paidCount;

    const lowStock = Array.isArray(inventoryItems)
      ? inventoryItems.filter((it) => Number(it?.quantity || 0) <= Number(it?.reorderLevel ?? 5)).length
      : 0;
    const retCap = Math.max(inventoryItems.length, 1);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayPaid = invoices.filter((inv) => {
      if (!invoiceIsPaid(inv)) return false;
      const raw = inv?.paidAt || inv?.updatedAt || inv?.createdAt;
      const d = raw ? new Date(raw) : null;
      return d && !Number.isNaN(d.getTime()) && d >= startOfDay;
    }).length;
    const dayGoal = 150;

    return {
      queuePct,
      shipped,
      shipCap,
      lowStock,
      retCap,
      todayPaid,
      dayGoal,
    };
  }, [projectsList, invoices, inventoryItems]);

  const mapRangeLabel = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const opts = { month: "short", day: "numeric", year: "numeric" };
    return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
  }, []);

  const totalProjects = Number(data?.projects ?? projectsList.length);
  const totalUsers = Number(data?.clients ?? 0);

  const clockTime = `${String(now.getHours()).padStart(2, "0")} ${String(now.getMinutes()).padStart(2, "0")}`;
  const clockDate = now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const revenueDisplay = formatCurrency(paidInvoicesTotal);
  const revenueMeta = lastPaidAt
    ? lastPaidAt.toLocaleString(undefined, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : now.toLocaleString(undefined, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const refCard =
    "rounded-sm border border-gray-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

  function RefPanelHeader({ title, subtitle, compact }) {
    return (
      <header
        className={`flex items-start justify-between gap-2 border-b border-gray-200 ${compact ? "mb-1 pb-1" : "mb-2 pb-2"}`}
      >
        <div className="min-w-0">
          <h2 className="text-[12px] font-bold leading-tight tracking-tight text-[#1a252f]">{title}</h2>
          <p className="mt-0.5 text-[10px] leading-tight text-gray-500">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0 text-gray-500">
          <button type="button" className="rounded p-0.5 hover:bg-gray-100" aria-label="Expand">
            <Maximize2 className="h-3 w-3" strokeWidth={2.25} />
          </button>
          <button type="button" className="rounded p-0.5 hover:bg-gray-100" aria-label="Refresh">
            <RefreshCw className="h-3 w-3" strokeWidth={2.25} />
          </button>
          <button type="button" className="rounded p-0.5 hover:bg-gray-100" aria-label="Settings">
            <Settings className="h-3 w-3" strokeWidth={2.25} />
          </button>
        </div>
      </header>
    );
  }

  /* Layout sidebar lives in <Layout />; this is the Outlet page shell only. */
  return (
    <div
      className="ce-dashboard-reference w-full max-w-full min-h-0 bg-[#F3F4F6] -mx-4 -my-5 text-[#2c3e50] sm:-mx-5"
      data-ce-dashboard="reference-v2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-[#e4e7ec] px-3 py-2 sm:px-4">
        <nav className="text-[10px] font-medium text-gray-600 min-w-0" aria-label="Breadcrumb">
          <span className="text-gray-500">Home</span>
          <span className="mx-1 text-gray-400">&gt;</span>
          <span className="font-bold text-[#1a252f]">Dashboard</span>
          <span className="mx-1.5 text-gray-400">·</span>
          <span className="text-gray-600 truncate align-middle" title={displayCompany.companyName}>
            {displayCompany.companyName}
          </span>
        </nav>
        <button
          type="button"
          onClick={() => navigate("/reports")}
          data-ui="generate-report-btn"
          className="shrink-0 rounded-sm border border-gray-300 bg-white px-3 py-1.5 text-[10px] font-bold text-[#1a252f] shadow-sm hover:bg-gray-50"
        >
          Generate Report
        </button>
      </div>

      <div className="space-y-2.5 px-3 py-2.5 sm:px-4 sm:py-3">
      {/* Row 1: four KPIs — single row at lg+ */}
      <section
        className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-4 lg:gap-2"
        aria-label="Summary metrics"
      >
        <article className={`relative flex h-[135px] ${refCard} p-3`}>
          <button type="button" className="absolute right-1.5 top-1.5 rounded p-0.5 text-gray-400 hover:bg-gray-100" aria-label="Dismiss">
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
          <div className="flex w-full flex-col items-center justify-center text-center leading-none">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-600">Total Revenue</p>
            <p className="mt-0.5 font-mono text-[9px] text-gray-500">{revenueMeta}</p>
            <p className="mt-1.5 text-[22px] font-bold tabular-nums text-[#1a252f]">{revenueDisplay}</p>
            <div className="mt-2 flex gap-1" role="presentation">
              {revenueDotsActive.map((on, i) => (
                <span
                  key={i}
                  className={`h-1 w-1 rounded-full ${on ? "bg-[#2c3e50]" : "bg-gray-300"}`}
                />
              ))}
            </div>
          </div>
        </article>

        <article className={`flex h-[135px] ${refCard} p-3`}>
          <div className="flex w-full items-center gap-2">
            <BriefcaseBusiness className="h-16 w-16 shrink-0 text-black" strokeWidth={2} aria-hidden />
            <div className="min-w-0 flex-1 text-right leading-tight">
              <p className="text-[10px] font-semibold text-gray-600">Total Projects</p>
              <p className="text-[24px] font-bold tabular-nums text-[#1a252f]">{totalProjects}</p>
              <p className="text-[9px] text-gray-500">In your mailbox</p>
            </div>
          </div>
        </article>

        <article className={`flex h-[135px] ${refCard} p-3`}>
          <div className="flex w-full items-center gap-2">
            <UserRound className="h-16 w-16 shrink-0 text-black" strokeWidth={2} aria-hidden />
            <div className="min-w-0 flex-1 text-right leading-tight">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-gray-600">Registered Users</p>
              <p className="text-[24px] font-bold tabular-nums text-[#1a252f]">{totalUsers}</p>
              <p className="text-[9px] text-gray-500">On your website</p>
            </div>
          </div>
        </article>

        <article
          className="flex h-[135px] flex-col justify-center rounded-sm border border-emerald-600/30 p-3 text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          style={{
            background: "linear-gradient(180deg, #1abc9c 0%, #16a085 100%)",
          }}
        >
          <p className="text-center text-[26px] font-bold tabular-nums leading-none tracking-[0.15em]">{clockTime}</p>
          <p className="mt-1.5 text-center text-[10px] font-semibold leading-tight text-white/95">{clockDate}</p>
          <div className="mt-2 flex items-center justify-center gap-6 border-t border-white/25 pt-2">
            <Clock className="h-[15px] w-[15px] text-white" strokeWidth={2.25} aria-hidden />
            <Bell className="h-[15px] w-[15px] text-white" strokeWidth={2.25} aria-hidden />
            <Calendar className="h-[15px] w-[15px] text-white" strokeWidth={2.25} aria-hidden />
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-12 lg:gap-2" aria-label="Charts and project status">
        <article className={`${refCard} flex min-w-0 flex-col p-3 lg:col-span-4`}>
          <RefPanelHeader title="Projects Activity" subtitle="Projects vs returning" />
          <div className="h-[280px] w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={projectActivityBars}
                margin={{ top: 8, right: 4, left: -12, bottom: 6 }}
                barGap={3}
                barCategoryGap="14%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-12}
                  textAnchor="end"
                  height={44}
                />
                <YAxis tick={{ fontSize: 9, fill: "#64748b" }} width={26} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 10, borderRadius: 2, border: "1px solid #e5e7eb" }} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconType="square" iconSize={7} />
                <Bar dataKey="projects" fill={C.navy} radius={[2, 2, 0, 0]} maxBarSize={52} name="Projects" />
                <Bar dataKey="returning" fill={C.turquoise} radius={[2, 2, 0, 0]} maxBarSize={52} name="Returning" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={`${refCard} flex min-w-0 flex-col p-3 lg:col-span-4`}>
          <RefPanelHeader title="Inventory Value" subtitle="Value (last month)" />
          <div className="relative mx-auto h-[280px] w-full max-w-[300px] min-w-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={inventoryDonutData}
                  cx="50%"
                  cy="50%"
                  innerRadius="42%"
                  outerRadius="78%"
                  paddingAngle={1}
                  dataKey="value"
                  stroke="none"
                >
                  {inventoryDonutData.map((entry, index) => (
                    <Cell key={`inv-${index}-${entry.name}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">Inventory Value</p>
              <p className="mt-1 text-lg font-bold tabular-nums leading-none text-[#1a252f]">{formatCurrency(inventoryValue)}</p>
            </div>
          </div>
        </article>

        <article className={`${refCard} min-w-0 p-3 lg:col-span-4`}>
          <RefPanelHeader title="Projects" subtitle="Projects activity" />
          <div className="min-w-0 overflow-hidden">
            <table className="w-full table-fixed text-left text-[11px]">
              <colgroup>
                <col className="w-[38%]" />
                <col className="w-[30%]" />
                <col className="w-[32%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200 text-[9px] font-bold uppercase tracking-wide text-gray-600">
                  <th className="pb-1 pr-1 pt-0.5 font-bold">Project</th>
                  <th className="pb-1 pr-1 font-bold">Status</th>
                  <th className="pb-1 pr-0 font-bold">Activity</th>
                </tr>
              </thead>
              <tbody>
                {tableProjects.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-3 text-center text-[11px] text-gray-400">
                      No projects yet.
                    </td>
                  </tr>
                ) : (
                  tableProjects.map((project) => {
                    const pres = tableStatusPresentation(project?.status);
                    const pct = tableActivityPercent(project?.status);
                    return (
                      <tr key={project?._id} className="border-b border-gray-100 last:border-0">
                        <td className="truncate py-0.5 pr-1 align-middle text-[11px] font-semibold leading-tight text-[#1a252f]" title={project?.name || ""}>
                          {project?.name || "—"}
                        </td>
                        <td className="max-w-0 py-0.5 pr-1 align-middle">
                          <span
                            className={`block max-w-full truncate rounded-sm px-1 py-px text-center text-[9px] font-bold leading-tight ${pres.badgeClass}`}
                          >
                            {pres.label}
                          </span>
                        </td>
                        <td className="py-0.5 align-middle pr-0">
                          <div className="h-1.5 w-full max-w-full overflow-hidden rounded-sm bg-gray-100">
                            <div className={`h-full rounded-sm ${pres.barClass}`} style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section
        className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 lg:gap-2 lg:items-stretch"
        aria-label="Sales analytics"
      >
        <article className={`${refCard} flex min-h-0 min-w-0 flex-col p-3`}>
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2 border-b border-gray-200 pb-2">
            <div>
              <h2 className="text-[12px] font-bold leading-tight text-[#1f3147]">Sales</h2>
              <p className="text-[10px] text-gray-500">Sales activity by period you selected</p>
            </div>
            <span className="rounded-sm border border-gray-200 bg-white px-2 py-0.5 text-[9px] font-semibold text-[#1f3147]">
              {mapRangeLabel}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="min-w-0 text-[9px] text-gray-600">
              <p className="font-bold text-[#1f3147]">In Queue</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-gray-200/90">
                <div className="h-full rounded-sm bg-[#1f3147]" style={{ width: `${mapSidebarStats.queuePct}%` }} />
              </div>
              <p className="mt-0.5 font-bold tabular-nums text-[#1f3147]">{mapSidebarStats.queuePct}%</p>
            </div>
            <div className="min-w-0 text-[9px] text-gray-600">
              <p className="font-bold text-[#1f3147]">Shipped Products</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-gray-200/90">
                <div
                  className="h-full rounded-sm bg-[#1f3147]"
                  style={{ width: `${Math.min(100, (mapSidebarStats.shipped / mapSidebarStats.shipCap) * 100)}%` }}
                />
              </div>
              <p className="mt-0.5 font-bold tabular-nums text-[#1f3147]">
                {mapSidebarStats.shipped}/{mapSidebarStats.shipCap}
              </p>
            </div>
            <div className="min-w-0 text-[9px] text-gray-600">
              <p className="font-bold text-[#1f3147]">Returned Products</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-gray-200/90">
                <div
                  className="h-full rounded-sm bg-[#e74c3c]"
                  style={{ width: `${Math.min(100, (mapSidebarStats.lowStock / mapSidebarStats.retCap) * 100)}%` }}
                />
              </div>
              <p className="mt-0.5 font-bold tabular-nums text-[#e74c3c]">
                {mapSidebarStats.lowStock}/{mapSidebarStats.retCap}
              </p>
            </div>
            <div className="min-w-0 text-[9px] text-gray-600">
              <p className="font-bold text-[#1f3147]">Progress Today</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-gray-200/90">
                <div
                  className="h-full rounded-sm bg-[#1abc9c]"
                  style={{ width: `${Math.min(100, (mapSidebarStats.todayPaid / mapSidebarStats.dayGoal) * 100)}%` }}
                />
              </div>
              <p className="mt-0.5 font-bold tabular-nums text-[#1abc9c]">
                {mapSidebarStats.todayPaid}/{mapSidebarStats.dayGoal}
              </p>
            </div>
          </div>
          <div className="mt-3 min-h-[300px] w-full min-w-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesLineData} margin={{ top: 8, right: 8, left: 4, bottom: 8 }} barCategoryGap="12%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#1f3147" }}
                  width={40}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                />
                <Tooltip
                  contentStyle={{ fontSize: 10, borderRadius: 2, border: "1px solid #e5e7eb" }}
                  formatter={(value) => formatCurrency(Number(value))}
                  labelFormatter={(l) => String(l)}
                />
                <Bar dataKey="revenue" fill={C.navy} radius={[2, 2, 0, 0]} maxBarSize={48} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={`${refCard} flex min-h-0 min-w-0 flex-col p-3`}>
          <RefPanelHeader compact title="Sales" subtitle="Event 'Purchase Button'" />
          <div className="min-h-[300px] w-full min-w-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesLineData} margin={{ top: 8, right: 6, left: 2, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "#64748b" }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={40}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 9, fill: "#1f3147" }}
                  width={38}
                  tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 9, fill: "#1abc9c" }}
                  width={24}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 10, borderRadius: 2, border: "1px solid #e5e7eb" }}
                  formatter={(value, name) =>
                    name === "Revenue" ? formatCurrency(Number(value)) : [value, "Paid invoices"]
                  }
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  stroke={C.navy}
                  strokeWidth={2}
                  dot={{ r: 3, fill: C.navy }}
                  name="Revenue"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="paidCount"
                  stroke={C.turquoise}
                  strokeWidth={2}
                  dot={{ r: 3, fill: C.turquoise }}
                  name="Paid invoices"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
      </div>
    </div>
  );
}
