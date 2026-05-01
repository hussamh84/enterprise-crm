import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";

const emptyContact = () => ({ name: "", email: "", phone: "" });

export default function ClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [editClient, setEditClient] = useState(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [editContacts, setEditContacts] = useState([emptyContact()]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [deleteClient, setDeleteClient] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const refreshClients = async () => {
    try {
      const res = await api.get("/clients");
      setClients(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Failed to load clients:", error);
      setClients([]);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
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
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const openEdit = (client) => {
    setEditError("");
    setEditClient(client);
    setEditName(typeof client.name === "string" ? client.name : "");
    setEditEmail(typeof client.email === "string" ? client.email : "");
    setEditPhone(typeof client.phone === "string" ? client.phone : "");
    setEditStatus(typeof client.status === "string" && client.status ? client.status : "active");
    const raw = Array.isArray(client.contacts) ? client.contacts : [];
    setEditContacts(raw.length ? raw.map((c) => ({
      name: typeof c?.name === "string" ? c.name : "",
      email: typeof c?.email === "string" ? c.email : "",
      phone: typeof c?.phone === "string" ? c.phone : "",
    })) : [emptyContact()]);
  };

  const closeEdit = () => {
    setEditClient(null);
    setEditError("");
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editClient?._id || !editName.trim()) return;
    setEditSaving(true);
    setEditError("");
    try {
      const body = {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        phone: editPhone.trim(),
        status: editStatus.trim() || "active",
        contacts: editContacts.map((c) => ({
          name: (c.name || "").trim(),
          email: (c.email || "").trim().toLowerCase(),
          phone: (c.phone || "").trim(),
        })),
      };
      await api.patch(`/clients/${editClient._id}`, body);
      closeEdit();
      await refreshClients();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Update failed";
      setEditError(typeof msg === "string" ? msg : "Update failed");
    } finally {
      setEditSaving(false);
    }
  };

  const openDelete = (client) => {
    setDeleteError("");
    setDeleteClient(client);
  };

  const closeDelete = () => {
    setDeleteClient(null);
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!deleteClient?._id) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await api.delete(`/clients/${deleteClient._id}`);
      closeDelete();
      await refreshClients();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Delete failed";
      setDeleteError(typeof msg === "string" ? msg : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  };

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

      <div className="card !p-0">
        <div className="saas-table-shell border-0 rounded-none">
          <div
            className="saas-grid-head grid items-center gap-x-2"
            style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(0, 2fr) minmax(0, 1fr) 260px" }}
          >
            <div className="px-4 py-2">Name</div>
            <div className="px-4 py-2">Email</div>
            <div className="px-4 py-2">Phone</div>
            <div className="px-4 py-2 text-center w-[260px]">Actions</div>
          </div>

          {clients.map((client) => (
            <div
              key={client._id}
              className="saas-grid-row grid items-center gap-x-2"
              style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(0, 2fr) minmax(0, 1fr) 260px" }}
            >
              <div className="px-4 py-2 font-medium">{client.name || "No Name"}</div>
              <div className="px-4 py-2 text-sm text-gray-600">{client.email || "-"}</div>
              <div className="px-4 py-2 text-sm text-gray-600">{client.phone || "-"}</div>
              <div className="px-4 py-2">
                <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => navigate(`/clients/${client._id}`)}
                    className="bg-[#0B132B] text-white px-3 py-2 rounded-lg text-sm"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(client)}
                    className="bg-white border border-gray-300 px-3 py-2 rounded-lg text-sm"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => openDelete(client)}
                    className="bg-red-500 text-white px-3 py-2 rounded-lg text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editClient ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="presentation">
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-client-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="edit-client-title" className="text-lg font-semibold text-[#0a2540]">
                Edit client
              </h2>
              <button type="button" onClick={closeEdit} className="text-sm text-gray-500 hover:text-gray-800">
                Close
              </button>
            </div>
            <form onSubmit={submitEdit} className="space-y-4">
              <div>
                <label htmlFor="clients-edit-name" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Name
                </label>
                <input
                  id="clients-edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="clients-edit-email" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Email
                </label>
                <input
                  id="clients-edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="name@company.com"
                />
              </div>
              <div>
                <label htmlFor="clients-edit-phone" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Phone
                </label>
                <input
                  id="clients-edit-phone"
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="clients-edit-status" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Status
                </label>
                <select
                  id="clients-edit-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="archived">archived</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contacts</span>
                  <button
                    type="button"
                    onClick={() => setEditContacts((prev) => [...prev, emptyContact()])}
                    className="text-xs text-[#0B132B] font-medium hover:underline"
                  >
                    + Add contact
                  </button>
                </div>
                {editContacts.map((c, idx) => (
                  <div key={`ec-${idx}`} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-lg border border-slate-100 bg-slate-50/80">
                    <input
                      type="text"
                      placeholder="Name"
                      value={c.name}
                      onChange={(e) =>
                        setEditContacts((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], name: e.target.value };
                          return next;
                        })
                      }
                      className="rounded border border-slate-200 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={c.email}
                      onChange={(e) =>
                        setEditContacts((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], email: e.target.value };
                          return next;
                        })
                      }
                      className="rounded border border-slate-200 px-2 py-1.5 text-sm"
                    />
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        placeholder="Phone"
                        value={c.phone}
                        onChange={(e) =>
                          setEditContacts((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], phone: e.target.value };
                            return next;
                          })
                        }
                        className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm"
                      />
                      {editContacts.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setEditContacts((prev) => prev.filter((_, i) => i !== idx))}
                          className="shrink-0 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              {editError ? <p className="text-sm text-rose-600">{editError}</p> : null}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={editSaving || !editName.trim()}
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

      {deleteClient ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="presentation">
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-client-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-client-title" className="text-lg font-semibold text-[#0a2540]">
              Delete client?
            </h2>
            <p className="text-sm text-gray-600">
              This will archive <span className="font-medium text-gray-900">{deleteClient.name || "this client"}</span>. Invoices,
              quotations, and projects linked to this client are not removed.
            </p>
            {deleteError ? <p className="text-sm text-rose-600">{deleteError}</p> : null}
            <div className="flex flex-nowrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleteBusy}
                className="inline-flex items-center justify-center h-9 px-3 rounded-lg bg-white border border-gray-300 text-black text-sm whitespace-nowrap disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteBusy}
                className="inline-flex items-center justify-center h-9 px-3 rounded-lg bg-red-500 text-white text-sm whitespace-nowrap disabled:opacity-50"
              >
                {deleteBusy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
