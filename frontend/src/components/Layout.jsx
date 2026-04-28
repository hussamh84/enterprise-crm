import { Bell, Briefcase, LayoutDashboard, LogOut, Search, Settings, ShieldCheck, User, UserCircle2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet } from "react-router-dom";
import api from "../lib/api";
import { syncCurrencyConfig } from "../config/currency";
import { useAuthStore } from "../store/authStore";

const __filename = import.meta.url;
console.log("CHECK PAGE:", __filename);

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
  { to: "/profile", label: "Profile", icon: User },
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
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark-mode");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark-mode");
    }
    localStorage.setItem("ce_theme", theme);
  }, [theme]);

  useEffect(() => {
    document.body.classList.add("dashboard-theme");
    document.body.style.pointerEvents = "auto";
    return () => {
      document.body.classList.remove("dashboard-theme");
    };
  }, []);

  return (
    <div className="relative z-[1] flex min-h-screen">
      <aside className="sidebar shrink-0 h-screen overflow-hidden flex flex-col text-sm">
          <div className="pb-4 mb-2 border-b border-slate-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <img
                src={resolveLogoSrc(settings?.companyLogoUrl)}
                onError={handleLogoError}
                alt="Config Engineering Logo"
                className="h-[56px] w-auto max-w-[180px] object-contain bg-transparent border-0 shadow-none"
              />
              <div>
                <p className="muted-label">Enterprise Suite</p>
                <p className="text-sm font-semibold mt-1 text-[#0a2540] dark:text-white leading-snug">{settings?.companyName || "Config Engineering"}</p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
          <nav className="space-y-1">
            <p className="muted-label px-1 mb-2">Workspace</p>
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `sidebar-item flex items-center gap-2 text-[14px] transition ${
                      isActive
                        ? "active font-medium dark:bg-gray-800 dark:text-white dark:border dark:border-gray-700"
                        : "hover:bg-slate-50 dark:hover:bg-gray-800"
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
          <div className="mt-auto pt-4 border-t border-slate-100 dark:border-gray-700">
            <p className="text-xs font-medium text-[#0a2540] dark:text-white">{user?.fullName ?? "CRM User"}</p>
            <p className="text-xs text-[#6b7c93] dark:text-gray-300">{user?.role ?? "team_member"}</p>
            <button onClick={clearSession} className="mt-3 w-full flex items-center justify-center gap-2 bg-red-500 text-white h-9 rounded-lg text-sm font-medium hover:bg-red-600 transition">
              <LogOut size={14} /> Logout
            </button>
          </div>
      </aside>
      <main className="main relative z-[1] flex-1">
        <div className="relative z-[1] card min-h-[calc(100vh-3rem)] !p-0">
          <header className="min-h-14 px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
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
              <div className="smart-search-shell flex items-center gap-2 rounded-lg border px-3 h-9 min-w-[240px] max-w-md">
                <Search size={15} className="smart-search-icon shrink-0" />
                <input
                  type="search"
                  className="layout-search-input smart-search-input !min-h-0 h-full py-0 border-0 shadow-none bg-transparent text-sm w-full outline-none"
                  placeholder="Search leads, clients, projects..."
                />
              </div>
              <button type="button" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 h-9 w-9 inline-flex items-center justify-center">
                <Bell size={16} />
              </button>
              <button
                type="button"
                className="button-secondary !text-slate-600"
                onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
              >
                {theme === "light" ? "Dark Mode" : "Light Mode"}
              </button>
            </div>
          </header>
          <section className="p-5 space-y-5">
            <Outlet />
          </section>
        </div>
      </main>
    </div>
  );
}
