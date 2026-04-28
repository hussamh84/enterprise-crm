import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuthStore } from "../store/authStore";

export default function CreateClientPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const createClient = useMutation({
    mutationFn: async () => {
      const form = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
      };
      return (
        await api.post("/clients", form, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
      ).data;
    },
    onSuccess: async (client) => {
      await queryClient.invalidateQueries({ queryKey: ["/clients"] });
      if (client?._id) navigate(`/clients/${client._id}`, { replace: true });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    createClient.mutate();
  };

  return (
    <div className="client-page space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">New client</h1>
          <p className="page-subtitle">Create a client record for your workspace.</p>
        </div>
        <Link to="/clients" className="btn-secondary">
          Back to Clients
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="premium-card p-5 max-w-lg space-y-4">
        <div>
          <label htmlFor="client-name" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Name
          </label>
          <input
            id="client-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full"
            placeholder="Company or contact name"
            required
          />
        </div>
        <div>
          <label htmlFor="client-email" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Email
          </label>
          <input
            id="client-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full"
            placeholder="name@company.com"
          />
        </div>
        <div>
          <label htmlFor="client-phone" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Phone
          </label>
          <input
            id="client-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full"
            placeholder="+1 …"
          />
        </div>

        {createClient.isError ? (
          <p className="text-xs text-rose-600">Could not create client. Check the form and try again.</p>
        ) : null}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={createClient.isPending || !name.trim()} className="btn-primary disabled:opacity-50">
            {createClient.isPending ? "Saving…" : "Create client"}
          </button>
        </div>
      </form>
    </div>
  );
}
