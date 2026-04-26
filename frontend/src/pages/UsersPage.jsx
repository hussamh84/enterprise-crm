import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";

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
    <div className="space-y-5">
      <div>
        <h1 className="section-title">User Management</h1>
        <p className="page-subtitle text-[#6b7c93]">Manage Admin and Employee users for Config Engineering.</p>
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
          <p className="col-span-3">Name</p>
          <p className="col-span-3">Email</p>
          <p className="col-span-2">Role</p>
          <p className="col-span-2">Created</p>
          <p className="col-span-2">Actions</p>
        </div>
        {isLoading && <div className="p-8 text-center text-[#6b7c93]">Loading users...</div>}
        {!isLoading && users.map((user) => (
          <div key={user._id || user.id} className="saas-grid-row grid grid-cols-12 items-center text-sm">
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
