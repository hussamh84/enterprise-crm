import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [password, setPassword] = useState("Password123!");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/users"],
    queryFn: async () => (await api.get("/users")).data,
  });

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
    mutationFn: async ({ email, oldPassword, newPassword }) =>
      api.put("/auth/change-password", { email, oldPassword, newPassword }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/users"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">User Management</h1>
        <p className="text-[#6b7c93] mt-1">Manage Admin and Employee users for Config Engineering.</p>
      </div>

      <div className="premium-card p-5 grid md:grid-cols-2 lg:grid-cols-5 gap-3">
        <input className="rounded-lg border border-slate-200 px-3 py-2" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
        <input className="rounded-lg border border-slate-200 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <select className="rounded-lg border border-slate-200 px-3 py-2" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="admin">Admin</option>
          <option value="employee">Employee</option>
        </select>
        <input className="rounded-lg border border-slate-200 px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button
          type="button"
          className="rounded-lg bg-[#635bff] text-white px-3 py-2 font-medium hover:bg-[#5849ff] disabled:opacity-60"
          disabled={!fullName || !email || createUser.isPending}
          onClick={() => createUser.mutate()}
        >
          Add User
        </button>
      </div>

      <div className="premium-card overflow-hidden">
        <div className="grid grid-cols-12 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7c93]">
          <p className="col-span-3">Name</p>
          <p className="col-span-3">Email</p>
          <p className="col-span-2">Role</p>
          <p className="col-span-2">Created</p>
          <p className="col-span-2">Actions</p>
        </div>
        {isLoading && <div className="p-8 text-center text-[#6b7c93]">Loading users...</div>}
        {!isLoading && users.map((user) => (
          <div key={user._id || user.id} className="grid grid-cols-12 px-5 py-3 border-t border-slate-100 text-sm items-center">
            <p className="col-span-3 font-medium text-[#0a2540]">{user.fullName}</p>
            <p className="col-span-3 text-[#425466]">{user.email}</p>
            <p className="col-span-2 capitalize">{user.role}</p>
            <p className="col-span-2 text-[#6b7c93]">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}</p>
            <div className="col-span-2 flex items-center gap-3">
              <button
                type="button"
                className="text-[#635bff] hover:underline"
                onClick={() => {
                  const nextName = window.prompt("Update name", user.fullName || "");
                  if (nextName == null) return;
                  const nextEmail = window.prompt("Update email", user.email || "");
                  if (nextEmail == null) return;
                  const nextRole = window.prompt("Update role (admin/employee)", user.role || "employee");
                  if (nextRole == null) return;
                  updateUser.mutate({
                    id: user._id || user.id,
                    payload: { fullName: nextName, email: nextEmail, role: nextRole },
                  });
                }}
              >
                Edit
              </button>
              <button type="button" className="text-[#635bff] hover:underline" onClick={() => resetPassword.mutate(user._id || user.id)}>Reset Password</button>
              <button
                type="button"
                className="text-[#635bff] hover:underline"
                onClick={() => {
                  const oldPassword = window.prompt("Old password");
                  if (oldPassword == null || !oldPassword) return;
                  const newPassword = window.prompt("New password");
                  if (newPassword == null || !newPassword) return;
                  changePassword.mutate({ email: user.email, oldPassword, newPassword });
                }}
              >
                Change Password
              </button>
              <button type="button" className="text-rose-600 hover:underline" onClick={() => deleteUser.mutate(user._id || user.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
