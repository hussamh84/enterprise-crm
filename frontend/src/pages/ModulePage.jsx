import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatClientNumber } from "../utils/formatClientNumber";

export default function ModulePage({ title, endpoint }) {
  const queryClient = useQueryClient();

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
  const clientNumberOnly = (item) => String(formatClientNumber(item) || "").replace(/^Client\s*/i, "");

  const handleApprove = async (item) => {
    try {
      await api.patch(`/quotations/${item._id}/approve`);
      queryClient.invalidateQueries([endpoint]);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePdf = async (id) => {
    try {
      const res = await api.get(`${endpoint}/${id}/pdf`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "file.pdf";
      a.click();
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center text-sm">Loading...</div>;
  }

  if (isClients) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-[#0a2540]">{title}</h1>
            <p className="text-xs text-gray-500">Manage all your {title.toLowerCase()}</p>
          </div>
          <Link
            to={`${endpoint}/new`}
            className="bg-[#635bff] text-white px-3 py-1.5 text-sm rounded-md hover:opacity-90 transition"
          >
            + Add
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="grid grid-cols-12 py-3 text-xs font-semibold text-gray-500 uppercase border-b border-slate-100">
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
                className="grid grid-cols-12 py-3 border-b border-slate-100 last:border-b-0 items-center"
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
                  <div className="flex items-center gap-2">
                    <Link
                      to={`${endpoint}/${item._id}`}
                      className="h-7 px-2 text-xs rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-slate-50 transition inline-flex items-center justify-center"
                    >
                      View
                    </Link>
                    <Link
                      to={`/clients/${item._id}/edit`}
                      className="h-7 px-2 text-xs rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-slate-50 transition inline-flex items-center justify-center"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (isProjects) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-[#0a2540]">{title}</h1>
            <p className="text-xs text-gray-500">Manage all your {title.toLowerCase()}</p>
          </div>
          <Link
            to={`${endpoint}/new`}
            className="bg-[#635bff] text-white px-3 py-1.5 text-sm rounded-md hover:opacity-90 transition"
          >
            + Add
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 overflow-x-auto">
          <div className="grid grid-cols-12 py-3 text-xs font-semibold text-gray-500 uppercase border-b border-slate-100">
            <div className="col-span-3">Client</div>
            <div className="col-span-3">Project Name</div>
            <div className="col-span-2">Start Date</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Actions</div>
          </div>

          {data.map((item) => {
            const clientName = item?.clientId?.name || "Client";
            const clientEmail = item?.clientId?.email || item?.email || "no-email@client.com";
            const subtitle = item?.type || item?.projectType || item?.description || "Project";

            return (
              <div
                key={item._id}
                className="grid grid-cols-12 py-3 border-b border-slate-100 last:border-b-0 items-center align-middle"
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
                  <div className="flex items-center gap-2">
                    <Link
                      to={`${endpoint}/${item._id}`}
                      className="h-8 px-3 text-sm rounded-md border border-slate-200 text-[#425466] hover:bg-slate-50 transition inline-flex items-center"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handlePdf(item._id)}
                      className="h-8 px-3 text-sm rounded-md bg-[#635bff] text-white hover:opacity-90 transition inline-flex items-center"
                    >
                      PDF
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (isQuotations) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-[#0a2540]">{title}</h1>
            <p className="text-xs text-gray-500">Manage all your {title.toLowerCase()}</p>
          </div>
          <Link
            to={`${endpoint}/new`}
            className="bg-[#635bff] text-white px-3 py-1.5 text-sm rounded-md hover:opacity-90 transition"
          >
            + Add
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="grid grid-cols-12 py-3 text-xs font-semibold text-gray-500 uppercase border-b border-slate-100">
            <div className="col-span-3">Client</div>
            <div className="col-span-3">Quotation</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Actions</div>
          </div>

          {data.map((item) => {
            const clientName = item?.clientId?.name || "No Client";
            const clientEmail = item?.clientId?.email || "no-email@client.com";
            const subtitle = item?.description || `${Array.isArray(item?.items) ? item.items.length : 0} items`;

            return (
              <div
                key={item._id}
                className="grid grid-cols-12 py-3 border-b border-slate-100 last:border-b-0 items-center"
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
                  <p className="text-sm font-semibold text-[#0a2540] truncate">{item?.name || "Quotation"}</p>
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

                <div className="col-span-2 align-middle min-w-[200px] overflow-hidden">
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <Link
                      to={`${endpoint}/${item._id}`}
                      className="h-7 px-2 text-xs rounded-md whitespace-nowrap border border-gray-300 text-gray-700 bg-white hover:bg-slate-50 transition inline-flex items-center justify-center"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handlePdf(item._id)}
                      className="h-7 px-2 text-xs rounded-md whitespace-nowrap bg-purple-600 text-white hover:opacity-90 transition inline-flex items-center justify-center"
                    >
                      PDF
                    </button>
                    {item?.status !== "approved" ? (
                      <button
                        onClick={() => handleApprove(item)}
                        className="h-7 px-2 text-xs rounded-md whitespace-nowrap bg-indigo-600 text-white hover:opacity-90 transition inline-flex items-center justify-center"
                      >
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
    );
  }

  if (isInvoices) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-[#0a2540]">{title}</h1>
            <p className="text-xs text-gray-500">Manage all your {title.toLowerCase()}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="grid grid-cols-12 py-3 text-xs font-semibold text-gray-500 uppercase border-b border-slate-100">
            <div className="col-span-3">Client</div>
            <div className="col-span-3">Invoice</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Actions</div>
          </div>

          {data.map((item) => {
            const clientName = item?.clientId?.name || item?.clientName || "No Client";
            const clientEmail = item?.clientId?.email || "no-email@client.com";
            const invoiceName = item?.name || `Invoice ${String(item?._id || "").slice(-6)}`;
            const subtitle = `Total: ${Number(item?.total || 0).toLocaleString()}`;
            const statusLabel = getInvoiceStatusLabel(item);
            const remainingAmount = Number(item?.remainingAmount ?? Math.max(Number(item?.total || 0) - Number(item?.paidAmount || 0), 0));

            return (
              <div
                key={item._id}
                className="grid grid-cols-12 py-3 border-b border-slate-100 last:border-b-0 items-center"
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
                  <p className="text-xs text-gray-500 truncate">{subtitle}</p>
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

                <div className="col-span-2 align-middle min-w-[200px] overflow-hidden">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Link
                      to={`${endpoint}/${item._id}`}
                      className="h-7 px-2 text-xs rounded-md whitespace-nowrap border border-gray-300 text-gray-700 bg-white hover:bg-slate-50 transition inline-flex items-center justify-center"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handlePdf(item._id)}
                      className="h-7 px-2 text-xs rounded-md whitespace-nowrap bg-purple-600 text-white hover:opacity-90 transition inline-flex items-center justify-center"
                    >
                      PDF
                    </button>
                    <Link
                      to={`${endpoint}/${item._id}`}
                      className="h-7 px-2 text-xs rounded-md whitespace-nowrap bg-indigo-600 text-white hover:opacity-90 transition inline-flex items-center justify-center"
                    >
                      Pay
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-[#0a2540]">{title}</h1>
          <p className="text-gray-500 text-xs">
            Manage all your {title.toLowerCase()}
          </p>
        </div>

        {!isInvoices ? (
          <Link
            to={`${endpoint}/new`}
            className="bg-[#635bff] text-white px-3 py-1.5 text-sm rounded-md hover:opacity-90 transition"
          >
            + Add
          </Link>
        ) : null}
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
          {isClients ? <div className="col-span-2">Client ID</div> : null}
          <div className="col-span-4">Name</div>
          <div className={isClients ? "col-span-2" : "col-span-3"}>Date</div>
          <div className="col-span-2">Status</div>
          <div className={isClients ? "col-span-2" : "col-span-3"}>Actions</div>
        </div>

        {data.map((item) => (
          <div
            key={item._id}
            className="grid grid-cols-12 px-5 py-2 border-t items-center hover:bg-gray-50 transition"
          >
            {isClients ? (
              <div className="col-span-2 text-xs font-medium text-[#425466]">{formatClientNumber(item)}</div>
            ) : null}
            <div className={`${isClients ? "col-span-4" : "col-span-4"} font-medium`}>
              {isInvoices ? invoiceDisplayName(item) : projectDisplayName(item)}
            </div>

            <div
              className={`${isClients ? "col-span-2" : "col-span-3"} text-gray-500 text-xs`}
            >
              {new Date(item.createdAt).toLocaleDateString()}
            </div>

            <div className="col-span-2">
              <span
                className={`px-2 py-1 rounded text-xs ${
                  item.status === "approved"
                    ? "bg-green-100 text-green-600"
                    : "bg-yellow-100 text-yellow-600"
                }`}
              >
                {item.status || "pending"}
              </span>
            </div>

            <div className={`${isClients ? "col-span-2" : "col-span-3"} flex flex-wrap gap-2 text-xs`}>
              {/* VIEW */}
              <Link
                to={`${endpoint}/${item._id}`}
                className="text-[#635bff] hover:underline"
              >
                View
              </Link>

              {/* EDIT (clients only) */}
              {isClients && (
                <Link to={`/clients/${item._id}/edit`} className="text-blue-600 hover:underline">
                  Edit
                </Link>
              )}

              {/* APPROVE (quotations only) */}
              {isQuotations && item.status !== "approved" && (
                <button
                  onClick={() => handleApprove(item)}
                  className="bg-[#635bff] text-white px-3 py-1.5 text-sm rounded-md hover:opacity-90 transition"
                >
                  Approve
                </button>
              )}

              {/* PDF (not shown for clients) */}
              {endpoint !== "/clients" && (
                <button
                  onClick={() => handlePdf(item._id)}
                  className="bg-[#635bff] text-white px-3 py-1.5 text-sm rounded-md hover:opacity-90 transition"
                >
                  PDF
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}