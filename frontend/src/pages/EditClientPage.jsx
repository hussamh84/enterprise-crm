import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import { formatClientNumber } from "../utils/formatClientNumber";

export default function EditClientPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["client-details", clientId, "edit"],
    queryFn: async () => (await api.get(`/clients/${clientId}/details`)).data,
    enabled: Boolean(clientId),
  });

  const client = data?.client;

  useEffect(() => {
    if (!client) return;
    setName(typeof client.name === "string" ? client.name : "");
    setEmail(typeof client.email === "string" ? client.email : "");
    setPhone(typeof client.phone === "string" ? client.phone : "");
  }, [client]);

  const updateClient = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
      };
      return (await api.patch(`/clients/${clientId}`, body)).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/clients"] });
      await queryClient.invalidateQueries({ queryKey: ["client-details", clientId] });
      navigate(`/clients/${clientId}`, { replace: true });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateClient.mutate();
  };

  if (!clientId) return null;

  if (isLoading) {
    return <div className="premium-card p-8 m-6 text-center text-slate-500">Loading client…</div>;
  }

  if (isError || !client) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-rose-600">Unable to load client.</p>
        <Link to="/clients" className="text-[#635bff] hover:underline text-sm">
          Back to Clients
        </Link>
      </div>
    );
  }

  return (
    <div className="client-page space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0a2540]">Edit client</h1>
          <p className="text-gray-500 text-sm mt-1">
            <span className="font-medium text-[#425466]">{formatClientNumber(client)}</span>
            <span className="mx-2">·</span>
            Update name, email, and phone.
          </p>
        </div>
        <Link to={`/clients/${clientId}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#425466] hover:bg-slate-50">
          Cancel
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="premium-card p-6 max-w-lg space-y-4">
        <div>
          <label htmlFor="edit-client-name" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Name
          </label>
          <input
            id="edit-client-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0a2540] focus:outline-none focus:ring-2 focus:ring-[#635bff]/30"
            required
          />
        </div>
        <div>
          <label htmlFor="edit-client-email" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Email
          </label>
          <input
            id="edit-client-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0a2540] focus:outline-none focus:ring-2 focus:ring-[#635bff]/30"
            placeholder="name@company.com"
          />
        </div>
        <div>
          <label htmlFor="edit-client-phone" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Phone
          </label>
          <input
            id="edit-client-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0a2540] focus:outline-none focus:ring-2 focus:ring-[#635bff]/30"
            placeholder="+1 …"
          />
        </div>

        {updateClient.isError ? (
          <p className="text-sm text-rose-600">Could not save changes. Check the form and try again.</p>
        ) : null}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={updateClient.isPending || !name.trim()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-black disabled:opacity-50"
          >
            {updateClient.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
