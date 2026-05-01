import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { BriefcaseBusiness, DollarSign, Users, Clock3 } from "lucide-react";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";

const WORLD_GEO =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const cardBase =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]";

const clockCardBase =
  "rounded-2xl p-5 text-white shadow-[0_12px_30px_rgba(11,19,43,0.35)] bg-gradient-to-br from-[#0B132B] via-[#12305A] to-[#0EA5A5]";

function toNumber(value) {
  return Number(value || 0);
}

function getMonthIndex(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return -1;
  return date.getMonth();
}

function getInvoiceAmount(invoice) {
  return toNumber(
    invoice?.paidAmount ??
      invoice?.total ??
      invoice?.grandTotal ??
      invoice?.summarySubtotal ??
      0
  );
}

function getProjectProgress(project) {
  const status = String(project?.status || "").toLowerCase();
  if (status === "completed" || status === "paid") return 100;
  if (status === "partial") return 65;
  if (status === "active") return 55;
  if (status === "in_progress" || status === "in progress") return 40;
  return 25;
}

function statusBadgeClass(status) {
  const value = String(status || "").toLowerCase();
  if (value === "completed" || value === "paid") return "bg-emerald-100 text-emerald-700";
  if (value === "partial") return "bg-amber-100 text-amber-700";
  if (value === "active") return "bg-cyan-100 text-cyan-700";
  if (value === "in_progress" || value === "in progress") return "bg-indigo-100 text-indigo-700";
  return "bg-slate-100 text-slate-700";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function DashboardV2() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: projects = [] } = useQuery({
    queryKey: ["/projects", "dashboard-v2"],
    queryFn: async () => safeArray((await api.get("/projects")).data),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["/users", "dashboard-v2"],
    queryFn: async () => safeArray((await api.get("/users")).data),
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["/invoices", "dashboard-v2"],
    queryFn: async () => safeArray((await api.get("/invoices")).data),
  });
  const { data: inventory = [] } = useQuery({
    queryKey: ["/inventory", "dashboard-v2"],
    queryFn: async () => safeArray((await api.get("/inventory")).data),
  });

  const totalRevenue = useMemo(
    () =>
      invoices
        .filter((inv) => {
          const status = String(inv?.status || "").toLowerCase();
          return status === "paid" || toNumber(inv?.remainingAmount) <= 0;
        })
        .reduce((sum, inv) => sum + getInvoiceAmount(inv), 0),
    [invoices]
  );

  const inventoryTotal = useMemo(
    () =>
      inventory.reduce(
        (sum, item) => sum + toNumber(item?.quantity) * toNumber(item?.price ?? item?.sellingPrice),
        0
      ),
    [inventory]
  );

  const soldValue = useMemo(
    () =>
      invoices.reduce((sum, invoice) => {
        const rows = safeArray(invoice?.items || invoice?.lines);
        const linesTotal = rows.reduce(
          (rowSum, row) =>
            rowSum + toNumber(row?.total ?? toNumber(row?.quantity) * toNumber(row?.unitPrice ?? row?.price)),
          0
        );
        return sum + linesTotal;
      }, 0),
    [invoices]
  );

  const inventoryDonutData = useMemo(() => {
    const sold = Math.min(soldValue, inventoryTotal);
    const remaining = Math.max(inventoryTotal - sold, 0);
    return [
      { name: "Total Value", value: inventoryTotal, color: "#0B132B" },
      { name: "Sold Value", value: sold, color: "#14B8A6" },
      { name: "Remaining", value: remaining, color: "#CBD5E1" },
    ];
  }, [inventoryTotal, soldValue]);

  const projectActivityData = useMemo(() => {
    const active = new Array(12).fill(0);
    const completed = new Array(12).fill(0);
    projects.forEach((project) => {
      const idx = getMonthIndex(project?.createdAt);
      if (idx < 0) return;
      const status = String(project?.status || "").toLowerCase();
      if (status === "completed" || status === "paid") completed[idx] += 1;
      else active[idx] += 1;
    });
    return MONTHS.map((m, idx) => ({ month: m, Active: active[idx], Completed: completed[idx] }));
  }, [projects]);

  const salesTrendData = useMemo(() => {
    const totals = new Array(12).fill(0);
    invoices.forEach((inv) => {
      const idx = getMonthIndex(inv?.createdAt);
      if (idx < 0) return;
      totals[idx] += getInvoiceAmount(inv);
    });
    return MONTHS.map((m, idx) => ({ month: m, revenue: totals[idx] }));
  }, [invoices]);

  const latestProjects = useMemo(
    () =>
      [...projects]
        .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
        .slice(0, 6),
    [projects]
  );

  const mapPoints = useMemo(() => {
    const points = projects
      .map((project) => {
        const lat =
          project?.lat ??
          project?.latitude ??
          project?.location?.lat ??
          project?.location?.latitude ??
          project?.clientId?.lat ??
          project?.clientId?.latitude;
        const lng =
          project?.lng ??
          project?.longitude ??
          project?.location?.lng ??
          project?.location?.longitude ??
          project?.clientId?.lng ??
          project?.clientId?.longitude;
        if (lat == null || lng == null) return null;
        return { coordinates: [Number(lng), Number(lat)], count: 1 };
      })
      .filter(Boolean);

    if (points.length > 0) return points;
    return [{ coordinates: [32.5599, 15.5007], count: projects.length || 0 }];
  }, [projects]);

  const paidInvoicesCount = useMemo(
    () =>
      invoices.filter((inv) => {
        const status = String(inv?.status || "").toLowerCase();
        return status === "paid" || toNumber(inv?.remainingAmount) <= 0;
      }).length,
    [invoices]
  );

  const kpiCards = [
    {
      title: "Total Revenue",
      value: formatCurrency(totalRevenue),
      subtitle: `${paidInvoicesCount} paid invoices`,
      Icon: DollarSign,
    },
    {
      title: "Total Projects",
      value: String(projects.length),
      subtitle: "Live projects records",
      Icon: BriefcaseBusiness,
    },
    {
      title: "Registered Users",
      value: String(users.length),
      subtitle: "System users",
      Icon: Users,
    },
  ];

  return (
    <div className="space-y-6 rounded-2xl bg-slate-100/80 p-3">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {kpiCards.map(({ title, value, subtitle, Icon }) => (
          <div key={title} className={cardBase}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
                <p className="mt-2 text-4xl font-semibold text-[#0B132B]">{value}</p>
                <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
              </div>
              <div className="rounded-xl bg-slate-100 p-2 text-[#0B132B]">
                <Icon size={18} />
              </div>
            </div>
          </div>
        ))}

        <div className={clockCardBase}>
          <div className="flex items-center justify-between text-white/80">
            <span className="text-xs uppercase tracking-wide">Live Clock</span>
            <Clock3 size={16} />
          </div>
          <p className="mt-2 text-5xl font-semibold leading-none">
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="mt-2 text-sm text-white/90">
            {now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={`${cardBase} xl:col-span-5`}>
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-[#0B132B]">Projects Activity</h3>
            <p className="text-sm text-slate-500">Projects created monthly (active vs completed)</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectActivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="Active" fill="#0B132B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Completed" fill="#14B8A6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${cardBase} xl:col-span-4`}>
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-[#0B132B]">Inventory Value</h3>
            <p className="text-sm text-slate-500">Total, sold, and remaining value</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={inventoryDonutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={95}
                  paddingAngle={3}
                >
                  {inventoryDonutData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {inventoryDonutData.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-slate-600">{entry.name}</span>
                </div>
                <span className="font-medium text-[#0B132B]">{formatCurrency(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardBase} xl:col-span-3`}>
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-[#0B132B]">Projects</h3>
            <p className="text-sm text-slate-500">Latest project activity</p>
          </div>
          <div className="space-y-3">
            {latestProjects.length === 0 ? (
              <p className="text-sm text-slate-500">No projects yet.</p>
            ) : (
              latestProjects.map((project) => (
                <div key={project?._id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="truncate pr-2 text-sm font-medium text-[#0B132B]">
                      {project?.name || "Project"}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(project?.status)}`}>
                      {project?.status || "active"}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-[#0B132B]"
                      style={{ width: `${getProjectProgress(project)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={`${cardBase} xl:col-span-8`}>
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-[#0B132B]">Operations Map</h3>
            <p className="text-sm text-slate-500">Sudan-focused project distribution</p>
          </div>
          <div className="h-[360px] w-full overflow-hidden rounded-xl border border-slate-200">
            <ComposableMap projection="geoMercator" projectionConfig={{ scale: 520 }}>
              <ZoomableGroup center={[32.5599, 15.5007]} zoom={2.8}>
                <Geographies geography={WORLD_GEO}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="#E2E8F0"
                        stroke="#CBD5E1"
                        style={{
                          default: { outline: "none" },
                          hover: { fill: "#CBD5E1", outline: "none" },
                          pressed: { outline: "none" },
                        }}
                      />
                    ))
                  }
                </Geographies>
                {mapPoints.map((point, idx) => (
                  <Marker key={`${point.coordinates.join("-")}-${idx}`} coordinates={point.coordinates}>
                    <circle r={6} fill="#0B132B" stroke="#ffffff" strokeWidth={2} />
                    <text textAnchor="middle" y={-14} style={{ fontSize: 10, fill: "#0B132B", fontWeight: 600 }}>
                      {point.count}
                    </text>
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>
          </div>
        </div>

        <div className={`${cardBase} xl:col-span-4`}>
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-[#0B132B]">Sales</h3>
            <p className="text-sm text-slate-500">Monthly invoice revenue trend</p>
          </div>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Line type="monotone" dataKey="revenue" stroke="#0B132B" strokeWidth={3} dot={{ r: 3 }} />
                <Area type="monotone" dataKey="revenue" fill="#0B132B" fillOpacity={0.08} strokeOpacity={0} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
