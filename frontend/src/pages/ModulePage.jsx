import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { formatClientNumber } from "../utils/formatClientNumber";
import { formatCurrency } from "../utils/format";
import { openPdf } from "../utils/pdf";
import { useAuthStore } from "../store/authStore";
import { isAdminRole } from "../utils/roleUtils";

const __filename = import.meta.url;
console.log("CHECK PAGE:", __filename);

export default function ModulePage({ title, endpoint }) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = isAdminRole(currentUser?.role);
  const isInventory = endpoint === "/inventory";
  const [deleteProjectId, setDeleteProjectId] = useState(null);
  const [deleteProjectName, setDeleteProjectName] = useState("");
  const [deletingProject, setDeletingProject] = useState(false);
  const [deleteProjectError, setDeleteProjectError] = useState("");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [editingId, setEditingId] = useState(null);

  const { data = [], isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: async () => {
      let responseData = [];
      try {
        const res = await api.get(endpoint);
        console.log("API RESPONSE:", res.data);
        responseData = res.data;
      } catch (e) {
        console.error(e);
        responseData = [];
      }
      return Array.isArray(responseData) ? responseData : [];
    },
  });

  const isClients = endpoint === "/clients";
  const isInvoices = endpoint === "/invoices";
  const isQuotations = endpoint === "/quotations";
  const isProjects = endpoint === "/projects";
  const getInitials = (value) =>
    String(value || "CL")
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  const getProjectStatusBadge = (status) => {
    const value = String(status || "").toLowerCase();
    if (value === "active") return "bg-green-100 text-green-700";
    if (value === "partial") return "bg-amber-100 text-amber-800 border border-amber-200";
    if (value === "in progress" || value === "in_progress" || value === "pending") {
      return "bg-yellow-100 text-yellow-700";
    }
    if (value === "completed" || value === "approved" || value === "paid") {
      return "bg-teal-100 text-teal-700";
    }
    return "bg-slate-100 text-slate-700";
  };
  const getProjectStatusLabel = (status) => {
    const value = String(status || "").toLowerCase();
    if (value === "in_progress") return "In Progress";
    if (value === "partial") return "Partial";
    if (value === "completed") return "Completed";
    if (value === "active") return "Active";
    if (!value) return "Active";
    return value
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };
  const getQuotationStatusBadge = (status) => {
    const value = String(status || "").toLowerCase();
    if (value === "approved") return "bg-green-100 text-green-700";
    if (value === "rejected") return "bg-red-100 text-red-700";
    if (value === "draft") return "bg-slate-100 text-slate-700";
    return "bg-slate-100 text-slate-700";
  };
  const getQuotationStatusLabel = (status) => {
    const value = String(status || "").toLowerCase();
    if (!value) return "Draft";
    return value.charAt(0).toUpperCase() + value.slice(1);
  };
  const getInvoiceStatusBadge = (status) => {
    const value = String(status || "").toLowerCase();
    if (value === "paid") return "bg-green-100 text-green-700";
    if (value === "partial") return "bg-yellow-100 text-yellow-700";
    return "bg-slate-100 text-slate-700";
  };
  const getInvoiceStatusLabel = (item) => {
    const value = String(item?.status || "").toLowerCase();
    const total = Number(item?.total || 0);
    const paid = Number(item?.paidAmount || 0);
    const remaining = Number(item?.remainingAmount ?? Math.max(total - paid, 0));
    if (value === "paid" || remaining <= 0) return "Paid";
    if (paid > 0) return "Partial";
    return "Unpaid";
  };
  const invoiceDisplayName = (item) => {
    if (!isInvoices) return item.name || "No Name";
    const clientName = item?.clientId?.name || item?.clientName || "";
    const projectName = item?.projectId?.name || item?.projectName || "";
    if (clientName && projectName) return `${clientName} - ${projectName}`;
    return clientName || projectName || item.name || "No Client";
  };
  const projectDisplayName = (item) => {
    if (!isProjects) return item.name || "No Name";
    const clientName = item?.clientId?.name || "No Client";
    return `${clientName} - ${item.name || "Project"}`;
  };
  const inventoryStatusLabel = (item) => {
    if (!isInventory) return item.status || "pending";
    if (item?.lowStock) return "Low Stock";
    return "In Stock";
  };
  const clientNumberOnly = (item) => String(formatClientNumber(item) || "").replace(/^Client\s*/i, "");

  const handleApprove = async (item) => {
    try {
      await api.patch(`/quotations/${item._id}/approve`);
      queryClient.invalidateQueries([endpoint]);
    } catch (e) {
      console.error(e);
    }
  };

  const openDocumentPdf = (id) => {
    if (endpoint === "/invoices") {
      openPdf(`/invoices/${id}/pdf`);
      return;
    }
    if (endpoint === "/quotations") {
      openPdf(`/quotations/${id}/pdf`);
      return;
    }
    void (async () => {
      try {
        const res = await api.get(`${endpoint}/${id}/pdf`, { responseType: "blob" });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement("a");
        a.href = url;
        a.download = "file.pdf";
        a.click();
      } catch (e) {
        console.error(e);
      }
    })();
  };

  const handleDownloadPDF = async (id) => {
    try {
      console.log("Downloading PDF for:", id);
      const res = await api.get(`/projects/${id}/pdf`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "project.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF ERROR:", err);
    }
  };

  const downloadInventorySample = async () => {
    try {
      const response = await api.get("/inventory/sample", { responseType: "blob" });
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "inventory-import-sample.xlsx";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Failed to download sample Excel format.");
    }
  };

  const downloadInventoryExport = async () => {
    try {
      const response = await api.get("/inventory/export", { responseType: "blob" });
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "inventory-export.xlsx";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Failed to export inventory Excel.");
    }
  };

  const handleInventoryImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post("/inventory/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await queryClient.invalidateQueries([endpoint]);
      const summary = response?.data?.summary || {};
      const errors = Array.isArray(response?.data?.errors) ? response.data.errors : [];
      if (errors.length > 0) {
        const preview = errors
          .slice(0, 5)
          .map((item) => `Row ${item.row}: ${item.reason}`)
          .join("\n");
        alert(
          `Import finished with row issues.\nCreated: ${summary.created || 0}, Updated: ${summary.updated || 0}, Failed: ${summary.failed || errors.length}\n\n${preview}${errors.length > 5 ? "\n..." : ""}`
        );
      } else {
        alert("Inventory import completed successfully.");
      }
    } catch (error) {
      console.error(error);
      const message = error?.response?.data?.message || "Import failed.";
      alert(message);
    } finally {
      event.target.value = "";
    }
  };

  const resetInventoryForm = () => {
    setName("");
    setSku("");
    setCostPrice("");
    setSellingPrice("");
    setQuantity("");
    setEditingId(null);
  };

  const updateItem = async (id, data) => {
    await api.put(`/inventory/${id}`, data);
  };

  const addItem = async (payload) => {
    await api.post("/inventory", payload);
  };

  const handleEdit = (item) => {
    setName(String(item?.name || ""));
    setSku(String(item?.sku || ""));
    setCostPrice(String(item?.costPrice ?? item?.cost ?? 0));
    setSellingPrice(String(item?.sellingPrice ?? item?.price ?? 0));
    setQuantity(String(item?.quantity ?? ""));
    setEditingId(item?._id || null);
  };

  const handleAddItem = async (event) => {
    event.preventDefault();
    console.log("ADD CLICKED");
    if (!name.trim() || !sku.trim()) {
      alert("Name and SKU are required.");
      return;
    }
    const normalizedCostPrice = Number(costPrice || 0);
    const normalizedSellingPrice = Number(sellingPrice || 0);
    const normalizedQuantity = Number(quantity || 0);
    if (
      !Number.isFinite(normalizedCostPrice) ||
      normalizedCostPrice < 0 ||
      !Number.isFinite(normalizedSellingPrice) ||
      normalizedSellingPrice < 0 ||
      !Number.isFinite(normalizedQuantity) ||
      normalizedQuantity < 0
    ) {
      alert("Cost Price, Selling Price and Quantity must be valid numbers >= 0.");
      return;
    }
    const payload = {
      name: name.trim(),
      sku: sku.trim(),
      // Keep backward compatibility with existing backend usage.
      price: normalizedSellingPrice,
      sellingPrice: normalizedSellingPrice,
      cost: normalizedCostPrice,
      costPrice: normalizedCostPrice,
      quantity: normalizedQuantity,
      category: "General",
      minQuantity: 0,
      unit: "pcs",
      status: "active",
    };
    try {
      if (editingId) {
        await updateItem(editingId, payload);
      } else {
        await addItem(payload);
      }
      await queryClient.invalidateQueries([endpoint]);
      resetInventoryForm();
      alert(editingId ? "Inventory item updated." : "Inventory item added.");
    } catch (error) {
      console.error(error);
      const message = error?.response?.data?.message || "Failed to save item.";
      alert(message);
    }
  };

  const openDeleteProject = (item) => {
    setDeleteProjectId(item._id);
    setDeleteProjectName(item.name || "this project");
    setDeleteProjectError("");
  };

  const closeDeleteProject = () => {
    setDeleteProjectId(null);
    setDeleteProjectName("");
    setDeleteProjectError("");
  };

  const confirmDeleteProject = async () => {
    if (!deleteProjectId) return;
    setDeletingProject(true);
    setDeleteProjectError("");
    try {
      await api.delete(`/projects/${deleteProjectId}`);
      closeDeleteProject();
      await queryClient.invalidateQueries({ queryKey: [endpoint] });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Delete failed";
      setDeleteProjectError(typeof msg === "string" ? msg : "Delete failed");
    } finally {
      setDeletingProject(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center text-sm">Loading...</div>;
  }

  if (isClients) {
    return (
      <div className="client-page space-y-5">
        <div className="flex justify-between items-center gap-3">
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="page-subtitle">Manage all your {title.toLowerCase()}</p>
          </div>
          <Link to={`${endpoint}/new`} className="button-primary">
            + Add
          </Link>
        </div>

        <div className="card !p-0 overflow-hidden">
          <div className="saas-table-shell border-0 rounded-none">
          <div className="saas-grid-head grid grid-cols-12">
            <div className="col-span-2">ID</div>
            <div className="col-span-4">Client</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Actions</div>
          </div>

          {data.map((item) => {
            const clientName = item?.name || "No Client";
            const clientEmail = item?.email || "no-email@client.com";
            const clientPhone = item?.phone || "";

            return (
              <div
                key={item._id}
                className="saas-grid-row grid grid-cols-12 items-center"
              >
                <div className="col-span-2 text-sm font-semibold text-[#425466]">
                  {clientNumberOnly(item)}
                </div>

                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gray-200 text-[#334155] flex items-center justify-center text-sm font-semibold shrink-0">
                    {getInitials(clientName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0a2540] truncate">{clientName}</p>
                    <p className="text-xs text-gray-500 truncate">{clientEmail}</p>
                    {clientPhone ? <p className="text-xs text-gray-500 truncate">{clientPhone}</p> : null}
                  </div>
                </div>

                <div className="col-span-2 text-sm text-[#425466]">
                  {new Date(item.createdAt).toLocaleDateString()}
                </div>

                <div className="col-span-2">
                  <span className="bg-yellow-100 text-yellow-700 rounded-full px-2 py-1 text-xs">
                    {item.status || "active"}
                  </span>
                </div>

                <div className="col-span-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`${endpoint}/${item._id}`} className="btn-secondary btn-compact">
                      View
                    </Link>
                    <Link to={`/clients/${item._id}/edit`} className="btn-secondary btn-compact">
                      Edit
                    </Link>
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

  if (isProjects) {
    return (
      <div className="space-y-5">
        <div className="flex justify-between items-center gap-3">
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="page-subtitle">Manage all your {title.toLowerCase()}</p>
          </div>
          <Link to={`${endpoint}/new`} className="button-primary">
            + Add
          </Link>
        </div>

        <div className="overflow-x-auto">
          <div className="card !p-0 min-w-[720px]" style={{ overflow: "visible" }}>
            <div className="saas-table-shell border-0 rounded-none" style={{ overflow: "visible" }}>
            <div className="saas-grid-head grid grid-cols-12">
              <div className="col-span-3">Client</div>
              <div className="col-span-3">Project Name</div>
              <div className="col-span-2">Start Date</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2" style={{ minWidth: "240px" }}>Actions</div>
            </div>

            {data.map((item) => {
            const clientName = item?.clientId?.name || "Client";
            const clientEmail = item?.clientId?.email || item?.email || "no-email@client.com";
            const subtitle = item?.type || item?.projectType || item?.description || "Project";

            return (
              <div
                key={item._id}
                className="saas-grid-row grid grid-cols-12 items-center"
              >
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-[#eef2ff] text-[#4f46e5] text-xs font-semibold flex items-center justify-center shrink-0">
                    {getInitials(clientName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0a2540] truncate">{clientName}</p>
                    <p className="text-xs text-gray-500 truncate">{clientEmail}</p>
                  </div>
                </div>

                <div className="col-span-3 min-w-0">
                  <p className="text-sm font-semibold text-[#0a2540] truncate">{projectDisplayName(item)}</p>
                  <p className="text-xs text-gray-500 truncate">{item?.clientId?.email || subtitle}</p>
                </div>

                <div className="col-span-2 text-sm text-[#425466]">
                  {new Date(item.createdAt).toLocaleDateString()}
                </div>

                <div className="col-span-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${getProjectStatusBadge(
                      item?.status
                    )}`}
                  >
                    {getProjectStatusLabel(item?.status)}
                  </span>
                </div>

                <div className="col-span-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`${endpoint}/${item._id}`} className="btn-secondary btn-compact">
                      View
                    </Link>
                    <button type="button" onClick={() => handleDownloadPDF(item._id)} className="btn-primary btn-compact">
                      PDF
                    </button>
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => openDeleteProject(item)}
                        className="inline-flex h-7 items-center justify-center rounded-md bg-red-500 px-2 text-xs font-medium text-white hover:bg-red-600"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
            </div>
          </div>
        </div>

        {isAdmin && deleteProjectId ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-[#0a2540]">Delete project?</h2>
              <p className="text-sm text-gray-600">
                Permanently delete <span className="font-medium text-gray-900">{deleteProjectName}</span>. This cannot be undone.
              </p>
              {deleteProjectError ? <p className="text-sm text-rose-600">{deleteProjectError}</p> : null}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeDeleteProject}
                  disabled={deletingProject}
                  className="inline-flex h-9 items-center px-3 rounded-lg border border-gray-300 bg-white text-sm text-black disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteProject}
                  disabled={deletingProject}
                  className="inline-flex h-9 items-center px-3 rounded-lg bg-red-500 text-sm text-white disabled:opacity-50 hover:bg-red-600"
                >
                  {deletingProject ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (isQuotations) {
    return (
      <div className="space-y-5 quotation-invoice-theme">
        <div className="flex justify-between items-center gap-3">
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="page-subtitle">Manage all your {title.toLowerCase()}</p>
          </div>
          <Link to={`${endpoint}/new`} className="button-primary">
            + Add
          </Link>
        </div>

        <div className="overflow-x-auto">
          <div className="card !p-0 min-w-[720px]" style={{ overflow: "visible" }}>
            <div className="saas-table-shell border-0 rounded-none" style={{ overflow: "visible" }}>
            <div className="saas-grid-head grid grid-cols-12">
              <div className="col-span-3">Client</div>
              <div className="col-span-3">Quotation</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2" style={{ width: "260px", textAlign: "right" }}>
                Actions
              </div>
            </div>

            {data.map((item) => {
            const clientName = item?.clientId?.name || "No Client";
            const clientEmail = item?.clientId?.email || "no-email@client.com";
            const subtitle = item?.description || `${Array.isArray(item?.items) ? item.items.length : 0} items`;

            return (
              <div
                key={item._id}
                className="saas-grid-row grid grid-cols-12 items-center"
              >
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-[#eef2ff] text-[#4f46e5] text-xs font-semibold flex items-center justify-center shrink-0">
                    {getInitials(clientName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0a2540] truncate">{clientName}</p>
                    <p className="text-xs text-gray-500 truncate">{clientEmail}</p>
                  </div>
                </div>

                <div className="col-span-3 min-w-0">
                  <p className="text-sm font-semibold text-[#0a2540] truncate">{item?.quotationNo || item?.name || "Quotation"}</p>
                  <p className="text-xs text-gray-500 truncate">{subtitle}</p>
                </div>

                <div className="col-span-2 text-sm text-[#425466]">
                  {new Date(item.createdAt).toLocaleDateString()}
                </div>

                <div className="col-span-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${getQuotationStatusBadge(
                      item?.status
                    )}`}
                  >
                    {String(item?.source || "").toLowerCase() === "inventory"
                      ? "Inventory Sale"
                      : getQuotationStatusLabel(item?.status)}
                  </span>
                </div>

                <div className="col-span-2" style={{ textAlign: "right", paddingRight: "12px" }}>
                  <div className="actions-cell">
                    <Link to={`${endpoint}/${item._id}`} className="btn-view">
                      View
                    </Link>
                    <button type="button" onClick={() => openDocumentPdf(item._id)} className="btn-pdf">
                      PDF
                    </button>
                    {item?.status !== "approved" ? (
                      <button type="button" onClick={() => handleApprove(item)} className="btn-approve">
                        Approve
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isInvoices) {
    return (
      <div className="space-y-5 quotation-invoice-theme">
        <div className="flex justify-between items-center gap-3">
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="page-subtitle">Manage all your {title.toLowerCase()}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="card !p-0 min-w-[720px]">
            <div className="saas-table-shell border-0 rounded-none">
            <div className="saas-grid-head grid grid-cols-12">
              <div className="col-span-3">Client</div>
              <div className="col-span-3">Invoice</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2" style={{ width: "260px", textAlign: "right" }}>
                Actions
              </div>
            </div>

            {data.map((item) => {
            const clientName = item?.clientId?.name || item?.clientName || "No Client";
            const clientEmail = item?.clientId?.email || "no-email@client.com";
            const invoiceName = item?.invoiceNo || item?.name || "Invoice";
            const statusLabel = getInvoiceStatusLabel(item);
            const totalAmount = Number(item?.total || 0);
            const paidAmount = Number(item?.paidAmount || 0);
            const remainingAmount = Number(item?.remainingAmount ?? Math.max(totalAmount - paidAmount, 0));

            return (
              <div
                key={item._id}
                className="saas-grid-row grid grid-cols-12 items-center"
              >
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-[#eef2ff] text-[#4f46e5] text-xs font-semibold flex items-center justify-center shrink-0">
                    {getInitials(clientName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0a2540] truncate">{clientName}</p>
                    <p className="text-xs text-gray-500 truncate">{clientEmail}</p>
                  </div>
                </div>

                <div className="col-span-3 min-w-0">
                  <p className="text-sm font-semibold text-[#0a2540] truncate">{invoiceName}</p>
                  <p className="text-xs text-gray-500">
                    Remaining:{" "}
                    <span className="font-medium whitespace-nowrap text-[#374151] numeric">{formatCurrency(remainingAmount)}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Paid:{" "}
                    <span className="font-medium whitespace-nowrap text-[#374151] numeric">{formatCurrency(paidAmount)}</span>
                  </p>
                </div>

                <div className="col-span-2 text-sm text-[#425466]">
                  {new Date(item.createdAt).toLocaleDateString()}
                </div>

                <div className="col-span-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${getInvoiceStatusBadge(statusLabel)}`}
                  >
                    {String(item?.source || "").toLowerCase() === "inventory" ? "Inventory Sale" : statusLabel}
                  </span>
                </div>

                <div className="col-span-2" style={{ textAlign: "right", paddingRight: "12px" }}>
                  <div className="actions-cell">
                    <Link to={`${endpoint}/${item._id}`} className="btn-view">
                      View
                    </Link>
                    <button type="button" onClick={() => openDocumentPdf(item._id)} className="btn-pdf">
                      PDF
                    </button>
                    <Link to={`${endpoint}/${item._id}`} className="btn-approve">
                      Pay
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isInventory) {
    return (
      <div className="space-y-5">
        <div className="flex justify-between items-center gap-3">
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="page-subtitle">Manage all your {title.toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/sales/new" className="bg-[#0B132B] text-white rounded-xl px-4 py-2">
              Sell
            </Link>
            <button type="button" className="bg-[#0B132B] text-white rounded-xl px-4 py-2" onClick={downloadInventoryExport}>
              Export Excel
            </button>
            <button type="button" className="bg-[#0B132B] text-white rounded-xl px-4 py-2" onClick={downloadInventorySample}>
              Download sample Excel format
            </button>
            <label className="bg-[#0B132B] text-white rounded-xl px-4 py-2 cursor-pointer">
              Import Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleInventoryImport}
              />
            </label>
          </div>
        </div>

        <form onSubmit={handleAddItem} className="card grid md:grid-cols-6 gap-3 items-end">
          <input
            className="input-field"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input-field"
            placeholder="SKU"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          />
          <input
            type="number"
            className="input-field"
            placeholder="Cost Price"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
          />
          <input
            type="number"
            className="input-field"
            placeholder="Selling Price"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
          />
          <input
            type="number"
            className="input-field"
            placeholder="Quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button type="submit" className="button-primary">
              {editingId ? "Update" : "Add"}
            </button>
            {editingId ? (
              <button type="button" className="btn-secondary btn-compact" onClick={resetInventoryForm}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="card !p-0 overflow-hidden">
          <div className="saas-table-shell border-0 rounded-none overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Cost Price</th>
                  <th>Selling Price</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item._id} className={item?.lowStock ? "bg-rose-50" : ""}>
                    <td>{item.name}</td>
                    <td>{item.sku}</td>
                    <td className="numeric">{formatCurrency(item.costPrice ?? item.cost ?? 0)}</td>
                    <td className="numeric">{formatCurrency(item.sellingPrice ?? item.price ?? 0)}</td>
                    <td>{item.quantity}</td>
                    <td>
                      {item?.lowStock ? (
                        <span className="px-2 py-1 rounded text-xs bg-rose-100 text-rose-700">Low Stock</span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700">In Stock</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Link to={`/inventory/${item._id}`} className="inventory-btn btn-black">
                          View
                        </Link>
                        <button type="button" className="inventory-btn btn-secondary" onClick={() => handleEdit(item)}>
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center gap-3">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">Manage all your {title.toLowerCase()}</p>
        </div>

        {!isInvoices && !isInventory ? (
          <Link to={`${endpoint}/new`} className="button-primary">
            + Add
          </Link>
        ) : null}
        {isInventory ? (
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary btn-compact" onClick={downloadInventorySample}>
              Download sample Excel format
            </button>
            <label className="button-primary cursor-pointer">
              Import Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleInventoryImport}
              />
            </label>
            <button type="button" onClick={handleAddInventoryItem} className="button-primary">
              + Add
            </button>
          </div>
        ) : null}
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="saas-table-shell border-0 rounded-none">
        <div className={`saas-grid-head grid ${isInventory ? "grid-cols-16" : "grid-cols-12"}`}>
          {isClients ? <div className="col-span-2">Client ID</div> : null}
          <div className={isInventory ? "col-span-4" : "col-span-4"}>Name</div>
          {isInventory ? <div className="col-span-2">SKU</div> : null}
          {isInventory ? <div className="col-span-2">Category</div> : null}
          {isInventory ? <div className="col-span-2">Price</div> : null}
          {isInventory ? <div className="col-span-2">Stock</div> : null}
          <div className={isInventory ? "col-span-2" : isClients ? "col-span-2" : "col-span-3"}>{isInventory ? "Updated" : "Date"}</div>
          <div className="col-span-2">Status</div>
          <div className={isInventory ? "col-span-2" : isClients ? "col-span-2" : "col-span-3"}>Actions</div>
        </div>

        {data.map((item) => (
          <div
            key={item._id}
            className={`saas-grid-row grid ${isInventory ? "grid-cols-16" : "grid-cols-12"} items-center transition ${
              isInventory && item?.lowStock ? "bg-rose-50/60 hover:bg-rose-50/80" : "hover:bg-slate-50/80"
            }`}
          >
            {isClients ? (
              <div className="col-span-2 text-xs font-medium text-[#425466]">{formatClientNumber(item)}</div>
            ) : null}
            <div className="col-span-4 font-medium">
              {isInvoices ? invoiceDisplayName(item) : projectDisplayName(item)}
            </div>
            {isInventory ? (
              <div className="col-span-2 text-xs text-gray-600">{item?.sku || "-"}</div>
            ) : null}
            {isInventory ? (
              <div className="col-span-2 text-xs text-gray-600">{item?.category || "-"}</div>
            ) : null}
            {isInventory ? (
              <div className="col-span-2 text-xs text-gray-600 numeric">{formatCurrency(item?.price || 0)}</div>
            ) : null}
            {isInventory ? (
              <div className="col-span-2 text-xs text-gray-600">
                {Number(item?.quantity || 0)} / min {Number(item?.minQuantity || 0)}
              </div>
            ) : null}

            <div
              className={`${isInventory ? "col-span-2" : isClients ? "col-span-2" : "col-span-3"} text-gray-500 text-xs`}
            >
              {new Date(item.createdAt).toLocaleDateString()}
            </div>

            <div className="col-span-2">
              <span
                className={`px-2 py-1 rounded text-xs ${
                  isInventory
                    ? item?.lowStock
                      ? "bg-rose-100 text-rose-700"
                      : "bg-emerald-100 text-emerald-700"
                    : item.status === "approved"
                    ? "bg-green-100 text-green-600"
                    : "bg-yellow-100 text-yellow-600"
                }`}
              >
                {inventoryStatusLabel(item)}
              </span>
            </div>

            <div className={`${isInventory ? "col-span-2" : isClients ? "col-span-2" : "col-span-3"} flex flex-wrap gap-2`}>
              <Link to={`${endpoint}/${item._id}`} className="btn-secondary btn-compact">
                View
              </Link>
              {isClients && (
                <Link to={`/clients/${item._id}/edit`} className="btn-secondary btn-compact">
                  Edit
                </Link>
              )}
              {isQuotations && item.status !== "approved" && (
                <button type="button" onClick={() => handleApprove(item)} className="btn-primary btn-compact">
                  Approve
                </button>
              )}
              {endpoint !== "/clients" && (
                <button type="button" onClick={() => openDocumentPdf(item._id)} className="btn-primary btn-compact">
                  PDF
                </button>
              )}
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}