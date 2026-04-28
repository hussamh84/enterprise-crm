import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { formatClientNumber } from "../utils/formatClientNumber";
import { formatCurrency } from "../utils/format";
import { openPdf } from "../utils/pdf";

const __filename = import.meta.url;
console.log("CHECK PAGE:", __filename);

export default function ModulePage({ title, endpoint }) {
  const queryClient = useQueryClient();
  const isInventory = endpoint === "/inventory";
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [editingId, setEditingId] = useState(null);

  const { data = [], isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: async () => (await api.get(endpoint)).data,
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
    if (!value) return "In Progress";
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
    setPrice("");
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
    setPrice(String(item?.price ?? ""));
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
    const normalizedPrice = Number(price || 0);
    const normalizedQuantity = Number(quantity || 0);
    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0 || !Number.isFinite(normalizedQuantity) || normalizedQuantity < 0) {
      alert("Price and Quantity must be valid numbers >= 0.");
      return;
    }
    const payload = {
      name: name.trim(),
      sku: sku.trim(),
      price: normalizedPrice,
      quantity: normalizedQuantity,
      category: "General",
      cost: 0,
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

  if (isLoading) {
    return <div className="p-6 text-center text-sm">Loading...</div>;
  }

  if (isClients) {
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
                    <button type="button" onClick={() => openDocumentPdf(item._id)} className="btn-primary btn-compact">
                      PDF
                    </button>
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
                    {getQuotationStatusLabel(item?.status)}
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
                    Total:{" "}
                    <span className="font-medium whitespace-nowrap text-[#374151] numeric">
                      {formatCurrency(item?.total || 0)}
                    </span>
                  </p>
                </div>

                <div className="col-span-2 text-sm text-[#425466]">
                  {new Date(item.createdAt).toLocaleDateString()}
                </div>

                <div className="col-span-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${getInvoiceStatusBadge(statusLabel)}`}
                  >
                    {statusLabel}
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
          </div>
        </div>

        <form onSubmit={handleAddItem} className="card grid md:grid-cols-5 gap-3 items-end">
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
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
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
                  <th>Price</th>
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
                    <td className="numeric">{formatCurrency(item.price || 0)}</td>
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