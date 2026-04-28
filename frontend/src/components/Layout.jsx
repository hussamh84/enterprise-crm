import { Bell, BarChart3, Box, LayoutDashboard, LogOut, Search, ShoppingCart, Users } from "lucide-react";
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
  { to: "/inventory", label: "Product", icon: Box },
  { to: "/invoices", label: "Order", icon: ShoppingCart },
  { to: "/clients", label: "Customer", icon: Users },
  { to: "/reports", label: "Report", icon: BarChart3 },
  { to: "/settings", label: "Analytics", icon: BarChart3 },
];

export default function Layout() {
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
    <div className="relative z-[1] flex min-h-screen bg-[#f8fafc]">
      <aside className="w-[260px] shrink-0 h-screen bg-white border-r border-slate-200 flex flex-col justify-between p-4 text-sm">
          <div className="min-h-0 flex-1 flex flex-col">
          <div className="pb-4 mb-4">
            <p className="text-xl font-semibold text-slate-900">Nexlio</p>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 h-9 text-slate-400">
              <Search size={14} />
              <input className="w-full border-0 bg-transparent text-sm outline-none" placeholder="Search" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
          <nav className="space-y-1.5">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] transition ${
                      isActive
                        ? "bg-gray-900 text-white font-medium"
                        : "text-slate-600 hover:bg-slate-100"
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
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
            <p className="text-xs font-medium text-slate-700">Upgrade to unlock advanced analytics</p>
            <button type="button" className="mt-3 w-full rounded-lg bg-gray-900 text-white py-2 text-sm hover:bg-black">
              Upgrade to Pro
            </button>
          </div>
      </aside>
      <main className="relative z-[1] flex-1 p-4">
        <div className="min-h-[calc(100vh-2rem)] rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <header className="h-16 px-5 border-b border-slate-100 flex items-center justify-end gap-3">
              <button type="button" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 h-9 w-9 inline-flex items-center justify-center">
                <Bell size={16} />
              </button>
              <button type="button" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 h-9 w-9 inline-flex items-center justify-center">
                <Search size={16} />
              </button>
              <button
                type="button"
                onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
                className="h-9 w-9 rounded-full bg-gray-900 text-white text-xs font-semibold"
                title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              >
                {theme === "light" ? "U" : "L"}
              </button>
          </header>
          <section className="p-5">
            <Outlet />
          </section>
        </div>
      </main>
    </div>
  );
}
