import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadClients = async () => {
      try {
        const res = await api.get("/clients");
        console.log("CLIENTS DATA:", res.data);
        if (isMounted) {
          setClients(Array.isArray(res.data) ? res.data : []);
        }
      } catch (error) {
        console.error("Failed to load clients:", error);
        if (isMounted) {
          setClients([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadClients();
    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) return <div className="p-6 text-center text-sm">Loading clients...</div>;
  if (!clients.length) return <div className="p-6 text-center text-sm">No clients</div>;

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center gap-3">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Manage all your clients</p>
        </div>
        <Link to="/clients/new" className="button-primary">
          + Add
        </Link>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="saas-table-shell border-0 rounded-none">
          <div className="saas-grid-head grid grid-cols-12">
            <div className="col-span-4">Name</div>
            <div className="col-span-4">Email</div>
            <div className="col-span-2">Phone</div>
            <div className="col-span-2">Actions</div>
          </div>

          {clients.map((client) => (
            <div key={client._id} className="saas-grid-row grid grid-cols-12 items-center">
              <div className="col-span-4 font-medium">{client.name || "No Name"}</div>
              <div className="col-span-4 text-sm text-gray-600">{client.email || "-"}</div>
              <div className="col-span-2 text-sm text-gray-600">{client.phone || "-"}</div>
              <div className="col-span-2 flex gap-2">
                <Link to={`/clients/${client._id}`} className="btn-secondary btn-compact">
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
