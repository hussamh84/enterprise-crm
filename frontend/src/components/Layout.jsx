import { Bell, Briefcase, LayoutDashboard, LogOut, Search, Settings, ShieldCheck, UserCircle2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../lib/api";
import { syncCurrencyConfig } from "../config/currency";
import { useAuthStore } from "../store/authStore";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Briefcase },
  { to: "/clients", label: "Clients", icon: UserCircle2 },
  { to: "/quotations", label: "Quotations", icon: Settings },
  { to: "/projects", label: "Projects", icon: ShieldCheck },
  { to: "/invoices", label: "Invoices", icon: Settings },
  { to: "/inventory", label: "Inventory", icon: Briefcase },
  { to: "/tickets", label: "Support", icon: ShieldCheck },
  { to: "/users", label: "Users", icon: Users },
  { to: "/reports", label: "Reports", icon: Briefcase },
  { to: "/settings", label: "Settings", icon: Settings },
];

const resolveLogoSrc = (logoPath) => {
  if (!logoPath) return "/logo.png";
  if (logoPath.startsWith("http")) return logoPath;
  if (logoPath.startsWith("/uploads/")) return `http://localhost:5000${logoPath}`;
  return logoPath;
};

const handleLogoError = (event) => {
  event.currentTarget.onerror = null;
  // Fallback to bundled public asset if dynamic path fails.
  if (!event.currentTarget.src.endsWith("/logo.png")) {
    event.currentTarget.src = "/logo.png";
    return;
  }
  // Final fallback so image placeholder never breaks layout.
  event.currentTarget.src = "/favicon.svg";
};

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [theme, setTheme] = useState(() => localStorage.getItem("ce_theme") || "light");
  const { data: settings } = useQuery({
    queryKey: ["workspace-settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });

  useEffect(() => {
    if (settings) syncCurrencyConfig(settings);
    if (settings?.backgroundImageUrl) {
      document.documentElement.style.setProperty("--app-bg-image", `url("${settings.backgroundImageUrl}")`);
    }
  }, [settings]);

  useEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
    localStorage.setItem("ce_theme", theme);
  }, [theme]);

  return (
    <div className="flex min-h-screen gap-3 px-4 py-4">
      <aside className="w-64 h-screen bg-white border-r border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <img
                src={resolveLogoSrc(settings?.companyLogoUrl)}
                onError={handleLogoError}
                alt="Config Engineering Logo"
                className="h-[56px] w-auto max-w-[180px] object-contain bg-transparent border-0 shadow-none"
              />
              <div>
                <p className="muted-label">Enterprise Suite</p>
                <h1 className="text-base font-semibold mt-1 text-[#0a2540]">{settings?.companyName || "Config Engineering"}</h1>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
          <nav className="space-y-2">
            <p className="muted-label px-1 mb-2">Workspace</p>
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-4 py-2 text-sm transition ${
                      isActive
                        ? "bg-[#eef4ff] text-[#1f3d7a] border border-[#d6e4ff]"
                        : "text-[#425466] hover:bg-slate-50"
                    }`
                  }
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
          </div>
          <div className="mt-auto p-4 border-t border-slate-100">
            <p className="text-xs font-medium text-[#0a2540]">{user?.fullName ?? "CRM User"}</p>
            <p className="text-xs text-[#6b7c93]">{user?.role ?? "team_member"}</p>
            <button onClick={clearSession} className="mt-3 w-full flex items-center justify-center gap-2 bg-red-500 text-white h-9 rounded-md text-sm hover:bg-red-600 transition">
              <LogOut size={14} /> Logout
            </button>
          </div>
      </aside>
      <main className="flex-1">
        <div className="premium-card min-h-[calc(100vh-3rem)]">
          <header className="h-14 px-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="muted-label">Operations Control Center</p>
              <div className="flex items-center gap-2 text-[#0a2540] font-semibold mt-0.5">
                <img
                  src={resolveLogoSrc(settings?.companyLogoUrl)}
                  onError={handleLogoError}
                  alt="Config Engineering Logo"
                  className="h-7 w-auto max-w-[120px] object-contain bg-transparent border-0 shadow-none"
                />
                <LayoutDashboard size={18} />
                <span className="truncate">Config Engineering Workspace</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-slate-500 min-w-72 bg-white">
                <Search size={15} />
                <input className="outline-none border-none bg-transparent text-xs w-full placeholder:text-slate-400" placeholder="Search leads, clients, projects..." />
              </div>
              <button className="rounded-lg border border-slate-200 p-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50">
                <Bell size={16} />
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
              >
                {theme === "light" ? "Dark Mode" : "Light Mode"}
              </button>
            </div>
          </header>
          <section className="p-4 space-y-4">
            <Outlet />
          </section>
        </div>
      </main>
    </div>
  );
}
