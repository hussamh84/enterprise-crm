import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";

export default function LeadsPage() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["/leads"],
    queryFn: async () => (await api.get("/leads")).data,
  });
  const refreshLeads = async () => {
    await refetch();
  };

  const handleAddLead = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      setIsSubmitting(true);
      await api.post("/leads", {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
      setName("");
      setPhone("");
      setEmail("");
      setOpen(false);
      await refreshLeads();
    } catch (err) {
      console.error("ADD LEAD ERROR:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/leads/${id}`);
      await refreshLeads();
    } catch (err) {
      console.error("DELETE LEAD ERROR:", err);
    }
  };

  const handleConvert = async (id) => {
    try {
      await api.post(`/leads/${id}/convert`);
      await refreshLeads();
    } catch (err) {
      console.error("CONVERT LEAD ERROR:", err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Leads</h1>
        <button type="button" className="button-primary" onClick={() => setOpen(true)}>
          Add Lead
        </button>
      </div>

      {open ? (
        <form onSubmit={handleAddLead} className="card grid md:grid-cols-4 gap-3 items-end">
          <input className="input-field" placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input-field" placeholder="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="input-field" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="flex items-center gap-2">
            <button type="submit" className="button-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </button>
            <button type="button" className="btn-secondary btn-compact" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {isLoading ? <div className="text-sm text-slate-500">Loading leads...</div> : null}
      {!isLoading && !leads.length ? <div className="text-sm text-slate-500">No leads found.</div> : null}
      {!isLoading && leads.length ? (
        <div className="card !p-0 overflow-hidden">
          <div className="saas-table-shell border-0 rounded-none">
            <div className="saas-grid-head grid grid-cols-12">
              <div className="col-span-3">Name</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-2">Phone</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Actions</div>
            </div>
            {leads.map((lead) => (
              <div key={lead._id} className="saas-grid-row grid grid-cols-12 items-center">
                <div className="col-span-3">{lead?.name || "-"}</div>
                <div className="col-span-3 text-sm text-slate-600">{lead?.email || "-"}</div>
                <div className="col-span-2 text-sm text-slate-600">{lead?.phone || "-"}</div>
                <div className="col-span-2 text-sm">{lead?.status || lead?.stage || "lead"}</div>
                <div className="col-span-2 flex gap-2 flex-wrap">
                  <button type="button" className="btn-secondary btn-compact" onClick={() => handleDelete(lead._id)}>
                    Delete
                  </button>
                  <button type="button" className="btn-primary btn-compact" onClick={() => handleConvert(lead._id)}>
                    Convert to Client
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
