import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";

export default function LeadsPage() {
  console.log("Leads route loaded");
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["/leads"],
    queryFn: async () => (await api.get("/leads")).data,
  });

  return (
    <div className="space-y-4">
      <h1 className="page-title">Leads</h1>
      {isLoading ? <div className="text-sm text-slate-500">Loading leads...</div> : null}
      {!isLoading && !leads.length ? <div className="text-sm text-slate-500">No leads found.</div> : null}
      {!isLoading && leads.length ? (
        <div className="card !p-0 overflow-hidden">
          <div className="saas-table-shell border-0 rounded-none">
            <div className="saas-grid-head grid grid-cols-12">
              <div className="col-span-4">Name</div>
              <div className="col-span-4">Email</div>
              <div className="col-span-2">Phone</div>
              <div className="col-span-2">Status</div>
            </div>
            {leads.map((lead) => (
              <div key={lead._id} className="saas-grid-row grid grid-cols-12 items-center">
                <div className="col-span-4">{lead?.name || "-"}</div>
                <div className="col-span-4 text-sm text-slate-600">{lead?.email || "-"}</div>
                <div className="col-span-2 text-sm text-slate-600">{lead?.phone || "-"}</div>
                <div className="col-span-2 text-sm">{lead?.status || lead?.stage || "lead"}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
