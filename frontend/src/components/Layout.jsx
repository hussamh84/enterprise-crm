import { Bell, Briefcase, LayoutDashboard, LogOut, Search, Settings, ShieldCheck, User, UserCircle2, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
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
  if (!event.currentTarget.src.endsWith("/logo.png")) {
    event.currentTarget.src = "/logo.png";
    return;
  }
  event.currentTarget.src = "/favicon.svg";
};

export default function Layout() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);
  const [theme, setTheme] = useState(() => localStorage.getItem("ce_theme") || "light");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchShellRef = useRef(null);
  const { data: settings } = useQuery({
    queryKey: ["workspace-settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["global-search-clients"],
    queryFn: async () => (await api.get("/clients")).data,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["global-search-projects"],
    queryFn: async () => (await api.get("/projects")).data,
  });
  const { data: inventory = [] } = useQuery({
    queryKey: ["global-search-inventory"],
    queryFn: async () => (await api.get("/inventory")).data,
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!searchShellRef.current?.contains(event.target)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const searchResults = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    if (!q) {
      return { clients: [], projects: [], inventory: [] };
    }
    const includesQuery = (value) => String(value || "").toLowerCase().includes(q);
    return {
      clients: (Array.isArray(clients) ? clients : [])
        .filter((c) => includesQuery(c?.name) || includesQuery(c?.email) || includesQuery(c?.phone))
        .slice(0, 5),
      projects: (Array.isArray(projects) ? projects : [])
        .filter((p) => includesQuery(p?.name) || includesQuery(p?.title) || includesQuery(p?.code))
        .slice(0, 5),
      inventory: (Array.isArray(inventory) ? inventory : [])
        .filter((i) => includesQuery(i?.name) || includesQuery(i?.sku) || includesQuery(i?.category))
        .slice(0, 5),
    };
  }, [clients, projects, inventory, debouncedQuery]);

  const hasSearchResults =
    searchResults.clients.length || searchResults.projects.length || searchResults.inventory.length;

  const handleSearchItemClick = (path) => {
    setShowSearchResults(false);
    setQuery("");
    setDebouncedQuery("");
    navigate(path);
  };

  return (
    <div className="relative z-[1] flex min-h-screen bg-[#f8fafc]">
      <aside className="sidebar shrink-0 h-screen flex flex-col justify-between overflow-hidden text-sm">
        <div className="min-h-0 flex-1 flex flex-col">
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
                <p className="text-sm font-semibold mt-1 text-[#0a2540] dark:text-white leading-snug">
                  {settings?.companyName || "Config Engineering"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <nav className="space-y-1">
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
        </div>
        <div className="p-3 border-t border-slate-100 dark:border-gray-700">
          <button onClick={clearSession} className="w-full bg-gray-900 text-white py-2 rounded hover:bg-black flex items-center justify-center gap-2">
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
              <div ref={searchShellRef} className="relative min-w-[240px] w-full max-w-md">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 h-9 text-slate-500 bg-white">
                  <Search size={15} className="shrink-0" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onFocus={() => setShowSearchResults(true)}
                    className="layout-search-input !min-h-0 h-full py-0 border-0 shadow-none bg-transparent text-sm w-full placeholder:text-slate-400 outline-none"
                    placeholder="Search clients, projects, inventory..."
                  />
                </div>
                {showSearchResults && query.trim() ? (
                  <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-40 max-h-80 overflow-auto">
                    {hasSearchResults ? (
                      <>
                        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Clients</p>
                        {searchResults.clients.length ? (
                          searchResults.clients.map((item) => (
                            <button
                              key={item._id}
                              type="button"
                              onClick={() => handleSearchItemClick(`/clients/${item._id}`)}
                              className="w-full text-left px-2 py-1.5 rounded text-sm text-slate-700 hover:bg-slate-100"
                            >
                              {item.name || "Unnamed Client"}
                            </button>
                          ))
                        ) : (
                          <p className="px-2 py-1 text-xs text-slate-400">No clients found</p>
                        )}

                        <p className="px-2 py-1 mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Projects</p>
                        {searchResults.projects.length ? (
                          searchResults.projects.map((item) => (
                            <button
                              key={item._id}
                              type="button"
                              onClick={() => handleSearchItemClick(`/projects/${item._id}`)}
                              className="w-full text-left px-2 py-1.5 rounded text-sm text-slate-700 hover:bg-slate-100"
                            >
                              {item.name || item.title || "Unnamed Project"}
                            </button>
                          ))
                        ) : (
                          <p className="px-2 py-1 text-xs text-slate-400">No projects found</p>
                        )}

                        <p className="px-2 py-1 mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Inventory</p>
                        {searchResults.inventory.length ? (
                          searchResults.inventory.map((item) => (
                            <button
                              key={item._id}
                              type="button"
                              onClick={() => handleSearchItemClick(`/inventory/${item._id}`)}
                              className="w-full text-left px-2 py-1.5 rounded text-sm text-slate-700 hover:bg-slate-100"
                            >
                              {item.name || "Unnamed Item"}
                            </button>
                          ))
                        ) : (
                          <p className="px-2 py-1 text-xs text-slate-400">No inventory found</p>
                        )}
                      </>
                    ) : (
                      <p className="px-2 py-1 text-sm text-slate-500">No matching results</p>
                    )}
                  </div>
                ) : null}
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
