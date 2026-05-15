import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { useCompanyBrandingSnapshot } from "../lib/companySettings";

export default function UsersPage() {
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [password, setPassword] = useState("Password123!");

  const [editUser, setEditUser] = useState(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("employee");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/users"],
    queryFn: async () => (await api.get("/users")).data,
  });
  const { data: workspaceSettings } = useQuery({
    queryKey: ["workspace-settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });
  const branding = useCompanyBrandingSnapshot(workspaceSettings);

  const createUser = useMutation({
    mutationFn: async () => api.post("/users", { fullName, email, role, password }),
    onSuccess: () => {
      setFullName("");
      setEmail("");
      setRole("employee");
      setPassword("Password123!");
      queryClient.invalidateQueries({ queryKey: ["/users"] });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (id) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/users"] }),
  });

  const resetPassword = useMutation({
    mutationFn: async (id) => api.post(`/users/${id}/reset-password`, { newPassword: "Password123!" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/users"] }),
  });

  const updateUser = useMutation({
    mutationFn: async ({ id, payload }) => api.put(`/users/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/users"] }),
  });

  const changePassword = useMutation({
    mutationFn: async ({ email: em, oldPassword, newPassword }) =>
      api.put("/auth/change-password", { email: em, oldPassword, newPassword }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/users"] }),
  });

  const openEdit = (u) => {
    setEditUser(u);
    setEditName(u.fullName || "");
    setEditEmail(u.email || "");
    setEditRole(u.role === "admin" ? "admin" : "employee");
    setEditError("");
  };

  const closeEdit = () => {
    setEditUser(null);
    setEditError("");
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editUser) return;
    setEditSaving(true);
    setEditError("");
    try {
      await updateUser.mutateAsync({
        id: editUser._id || editUser.id,
        payload: { fullName: editName.trim(), email: editEmail.trim(), role: editRole },
      });
      closeEdit();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Update failed";
      setEditError(typeof msg === "string" ? msg : "Update failed");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="section-title">User Management</h1>
        <p className="page-subtitle text-[#6b7c93]">Manage Admin and Employee users for {branding.companyName}.</p>
      </div>

      <div className="premium-card p-5 grid md:grid-cols-2 lg:grid-cols-5 gap-3">
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="admin">Admin</option>
          <option value="employee">Employee</option>
        </select>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button
          type="button"
          className="btn-primary w-full md:w-auto"
          disabled={!fullName || !email || createUser.isPending}
          onClick={() => createUser.mutate()}
        >
          Add User
        </button>
      </div>

      <div className="saas-table-shell">
        <div className="saas-grid-head grid grid-cols-12">
          <p className="col-span-3 min-w-0">Name</p>
          <p className="col-span-2 min-w-0">Email</p>
          <p className="col-span-2">Role</p>
          <p className="col-span-1 min-w-0">Created</p>
          <p className="col-span-4 min-w-0 text-center">Actions</p>
        </div>
        {isLoading && <div className="p-8 text-center text-[#6b7c93]">Loading users...</div>}
        {!isLoading && users.map((u) => (
          <div key={u._id || u.id} className="saas-grid-row grid grid-cols-12 items-center text-sm">
            <p className="col-span-3 min-w-0 truncate font-medium text-[#0a2540]" title={u.fullName || ""}>
              {u.fullName}
            </p>
            <p className="col-span-2 min-w-0 truncate text-[#425466]" title={u.email || ""}>
              {u.email}
            </p>
            <p className="col-span-2 min-w-0 capitalize">{u.role}</p>
            <p className="col-span-1 min-w-0 text-[#6b7c93]">
              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
            </p>
            <div className="col-span-4 flex min-w-0 flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-2 text-xs font-medium text-[#635bff] hover:bg-violet-50 hover:underline"
                onClick={() => openEdit(u)}
              >
                Edit
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-2 text-xs font-medium text-[#635bff] hover:bg-violet-50 hover:underline"
                onClick={() => resetPassword.mutate(u._id || u.id)}
              >
                Reset Password
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-2 text-xs font-medium text-[#635bff] hover:bg-violet-50 hover:underline"
                onClick={() => {
                  const oldPassword = window.prompt("Old password");
                  if (oldPassword == null || !oldPassword) return;
                  const newPassword = window.prompt("New password");
                  if (newPassword == null || !newPassword) return;
                  changePassword.mutate({ email: u.email, oldPassword, newPassword });
                }}
              >
                Change Password
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-2 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:underline"
                onClick={() => deleteUser.mutate(u._id || u.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#0a2540]">Edit user</h2>
              <button type="button" onClick={closeEdit} className="text-sm text-gray-500 hover:text-gray-800">
                Close
              </button>
            </div>
            <form onSubmit={submitEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="admin">Admin</option>
                  <option value="employee">Employee</option>
                </select>
                <p className="mt-1 text-xs text-[#6b7c93]">
                  {editRole === "admin"
                    ? "Full access: reports, settings, backup, user management, delete clients."
                    : "Restricted: no profit reports, settings, backup, or user management."}
                </p>
              </div>
              {editError ? <p className="text-sm text-rose-600">{editError}</p> : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={editSaving || !editName.trim() || !editEmail.trim()}
                  className="inline-flex items-center justify-center h-10 px-4 rounded-lg bg-[#0B132B] text-white text-sm disabled:opacity-50"
                >
                  {editSaving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="inline-flex items-center justify-center h-10 px-4 rounded-lg bg-white border border-gray-300 text-black text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
