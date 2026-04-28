import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";

const includesQuery = (value, query) => String(value || "").toLowerCase().includes(query);

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = String(searchParams.get("q") || "").trim().toLowerCase();

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["/clients", "search"],
    queryFn: async () => (await api.get("/clients")).data,
  });
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["/projects", "search"],
    queryFn: async () => (await api.get("/projects")).data,
  });
  const { data: inventory = [], isLoading: inventoryLoading } = useQuery({
    queryKey: ["/inventory", "search"],
    queryFn: async () => (await api.get("/inventory")).data,
  });

  const filteredClients = useMemo(
    () =>
      query
        ? clients.filter((item) => includesQuery(item?.name, query) || includesQuery(item?.email, query) || includesQuery(item?.phone, query))
        : [],
    [clients, query]
  );
  const filteredProjects = useMemo(
    () =>
      query
        ? projects.filter((item) => includesQuery(item?.name, query) || includesQuery(item?.projectType, query) || includesQuery(item?.status, query))
        : [],
    [projects, query]
  );
  const filteredInventory = useMemo(
    () =>
      query
        ? inventory.filter((item) => includesQuery(item?.name, query) || includesQuery(item?.sku, query) || includesQuery(item?.category, query))
        : [],
    [inventory, query]
  );

  const isLoading = clientsLoading || projectsLoading || inventoryLoading;
  const totalResults = filteredClients.length + filteredProjects.length + filteredInventory.length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="section-title">Search</h1>
        <p className="page-subtitle">
          {query ? `Results for "${searchParams.get("q") || ""}"` : "Type a query in the header search box."}
        </p>
      </div>

      {isLoading ? <div className="card text-sm text-slate-500">Searching...</div> : null}
      {!isLoading && query && totalResults === 0 ? (
        <div className="card text-sm text-slate-500">No matching clients, projects, or inventory items found.</div>
      ) : null}

      {!isLoading && filteredClients.length > 0 ? (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Clients</h2>
          <div className="space-y-2">
            {filteredClients.map((item) => (
              <Link key={item._id} to={`/clients/${item._id}`} className="block rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                <p className="font-medium text-slate-800">{item.name || "Client"}</p>
                <p className="text-xs text-slate-500">{item.email || item.phone || "-"}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {!isLoading && filteredProjects.length > 0 ? (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Projects</h2>
          <div className="space-y-2">
            {filteredProjects.map((item) => (
              <Link key={item._id} to={`/projects/${item._id}`} className="block rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                <p className="font-medium text-slate-800">{item.name || "Project"}</p>
                <p className="text-xs text-slate-500">{item.projectType || item.status || "-"}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {!isLoading && filteredInventory.length > 0 ? (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Inventory</h2>
          <div className="space-y-2">
            {filteredInventory.map((item) => (
              <Link key={item._id} to="/inventory" className="block rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                <p className="font-medium text-slate-800">{item.name || "Item"}</p>
                <p className="text-xs text-slate-500">
                  {item.sku || "-"} | {formatCurrency(item.price || 0)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
