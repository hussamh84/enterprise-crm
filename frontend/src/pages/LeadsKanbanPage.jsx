import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Converted" },
];

const mapLeadStatus = (lead) => {
  const value = String(lead?.stage || lead?.status || "").toLowerCase();
  if (value === "converted" || value === "won") return "converted";
  if (value === "contacted") return "contacted";
  return "new";
};

const getInitials = (value) =>
  String(value || "LD")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const getStatusBadge = (status) => {
  if (status === "converted") return "bg-green-100 text-green-700";
  if (status === "contacted") return "bg-yellow-100 text-yellow-700";
  return "bg-slate-100 text-slate-700";
};

export default function LeadsKanbanPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", status: "new" });

  const { data: leads = [] } = useQuery({
    queryKey: ["/leads"],
    queryFn: async () => (await api.get("/leads")).data,
  });

  const sortedLeads = useMemo(
    () =>
      [...leads].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    [leads]
  );

  const createLeadMutation = useMutation({
    mutationFn: async (payload) =>
      (
        await api.post("/leads", {
          name: payload.name.trim(),
          phone: payload.phone.trim(),
          email: payload.email.trim().toLowerCase(),
          stage: "new",
          status: "new",
          score: 50,
        })
      ).data,
    onSuccess: () => {
      setForm({ name: "", phone: "", email: "" });
      queryClient.invalidateQueries({ queryKey: ["/leads"] });
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, payload }) => (await api.put(`/leads/${id}`, payload)).data,
    onSuccess: () => {
      setEditingLeadId(null);
      queryClient.invalidateQueries({ queryKey: ["/leads"] });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id) => (await api.delete(`/leads/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/leads"] }),
  });

  const convertLeadMutation = useMutation({
    mutationFn: async (id) => (await api.post(`/leads/${id}/convert`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/leads"] }),
  });

  const startEdit = (lead) => {
    setEditingLeadId(lead._id);
    setEditForm({
      name: lead?.name || "",
      phone: lead?.phone || "",
      email: lead?.email || "",
      status: mapLeadStatus(lead),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">Track, convert, and manage your sales pipeline.</p>
        </div>
      </div>

      <div className="premium-card p-5">
        <div className="grid md:grid-cols-4 gap-3">
          <input
            value={form.name}
            onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
            placeholder="Lead name"
          />
          <input
            value={form.phone}
            onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))}
            placeholder="Phone"
          />
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
            placeholder="Email"
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!form.name.trim() || createLeadMutation.isPending}
            onClick={() => createLeadMutation.mutate(form)}
          >
            {createLeadMutation.isPending ? "Adding..." : "Add Lead"}
          </button>
        </div>
      </div>

      {editingLeadId ? (
        <div className="premium-card p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-semibold text-[#0a2540]">Edit Lead</p>
            <button type="button" className="btn-secondary btn-compact" onClick={() => setEditingLeadId(null)}>
              Cancel
            </button>
          </div>
          <div className="grid md:grid-cols-5 gap-3">
            <input
              value={editForm.name}
              onChange={(event) => setEditForm((previous) => ({ ...previous, name: event.target.value }))}
              placeholder="Lead name"
            />
            <input
              value={editForm.phone}
              onChange={(event) => setEditForm((previous) => ({ ...previous, phone: event.target.value }))}
              placeholder="Phone"
            />
            <input
              type="email"
              value={editForm.email}
              onChange={(event) => setEditForm((previous) => ({ ...previous, email: event.target.value }))}
              placeholder="Email"
            />
            <select
              value={editForm.status}
              onChange={(event) => setEditForm((previous) => ({ ...previous, status: event.target.value }))}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-primary"
              disabled={!editForm.name.trim() || updateLeadMutation.isPending}
              onClick={() =>
                updateLeadMutation.mutate({
                  id: editingLeadId,
                  payload: {
                    name: editForm.name.trim(),
                    phone: editForm.phone.trim(),
                    email: editForm.email.trim().toLowerCase(),
                    stage: editForm.status,
                    status: editForm.status,
                  },
                })
              }
            >
              {updateLeadMutation.isPending ? "Saving..." : "Update Lead"}
            </button>
          </div>
          <div className="mt-3">
            <button
              type="button"
              disabled={editForm.status === "converted" || convertLeadMutation.isPending}
              onClick={() => editingLeadId && convertLeadMutation.mutate(editingLeadId)}
              className="btn-primary btn-compact disabled:opacity-60"
            >
              {convertLeadMutation.isPending ? "Converting..." : "Convert to Client"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <div className="saas-table-shell min-w-[640px]">
        <div className="saas-grid-head grid grid-cols-12">
          <div className="col-span-3">Lead</div>
          <div className="col-span-2">Phone</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3">Actions</div>
        </div>

        {sortedLeads.map((lead) => {
          const status = mapLeadStatus(lead);
          return (
            <div key={lead._id} className="saas-grid-row grid grid-cols-12 items-center">
              <div className="col-span-3 flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gray-200 text-[#334155] flex items-center justify-center text-sm font-semibold shrink-0">
                  {getInitials(lead?.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0a2540] truncate">{lead?.name || "Unnamed Lead"}</p>
                  <p className="text-xs text-gray-500 truncate">{lead?.email || "No email"}</p>
                </div>
              </div>
              <div className="col-span-2 text-sm text-[#425466]">{lead?.phone || "-"}</div>
              <div className="col-span-2 text-sm text-[#425466]">
                {lead?.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "-"}
              </div>
              <div className="col-span-2">
                <span className={`rounded-full px-2 py-1 text-xs ${getStatusBadge(status)}`}>
                  {status === "new" ? "New" : status === "contacted" ? "Contacted" : "Converted"}
                </span>
              </div>
              <div className="col-span-3 min-w-[220px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <button type="button" onClick={() => startEdit(lead)} className="btn-secondary btn-compact whitespace-nowrap">
                    View
                  </button>
                  <button type="button" onClick={() => startEdit(lead)} className="btn-secondary btn-compact whitespace-nowrap">
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={deleteLeadMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete lead "${lead.name}"? This action cannot be undone.`)) {
                        deleteLeadMutation.mutate(lead._id);
                      }
                    }}
                    className="btn-danger whitespace-nowrap disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
