import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CirclePlus, FileText, Trash2 } from "lucide-react";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";
import { deriveTypeFromProject } from "../utils/projectTypeDisplay";

const PROJECT_TYPE_OPTIONS = [
  { value: "CCTV", label: "CCTV" },
  { value: "Solar System", label: "Solar System" },
  { value: "Network", label: "Network" },
];

const BLANK_ITEM = { productId: "", description: "", quantity: 1, unitPrice: 0, lockPrice: false };

const toNumber = (value) => Number(value || 0);

const QUOTE_HEADER_GRID = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 320px",
  gap: 24,
  alignItems: "start",
};

const __filename = import.meta.url;
console.log("CHECK PAGE:", __filename);

export default function QuotationBuilderPage() {
  const { quotationId } = useParams();
  const isEdit = Boolean(quotationId);
  const [searchParams] = useSearchParams();
  const presetClientId = searchParams.get("clientId") || "";
  const presetProjectId = searchParams.get("projectId") || "";
  const [name, setName] = useState("");
  const [customerMode, setCustomerMode] = useState("existing");
  const [clientId, setClientId] = useState(isEdit ? "" : presetClientId);
  const [projectId, setProjectId] = useState(isEdit ? "" : presetProjectId);
  const [clientSearch, setClientSearch] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [discountType, setDiscountType] = useState("fixed");
  const [discountValue, setDiscountValue] = useState(0);
  const [tax, setTax] = useState(0);
  const [quoteStatus, setQuoteStatus] = useState("draft");
  const [items, setItems] = useState([{ ...BLANK_ITEM }]);
  const [projectType, setProjectType] = useState("");
  const [cctvType, setCctvType] = useState("");
  const [itemSearch, setItemSearch] = useState({});
  const [itemSuggestions, setItemSuggestions] = useState({});
  const searchTimersRef = useRef({});
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: editBundle, isPending: editLoading, isError: editError } = useQuery({
    queryKey: ["quotation-edit", quotationId],
    queryFn: async () => (await api.get(`/quotations/${quotationId}`)).data,
    enabled: isEdit && Boolean(quotationId),
  });

  useEffect(() => {
    if (!isEdit || !editBundle?.quotation) return;
    const q = editBundle.quotation;
    setName(q.name || "");
    const walkin =
      String(q.customerKind || "").toLowerCase() === "walkin" || Boolean(String(q.walkInCustomerName || "").trim());
    setCustomerMode(walkin ? "walkin" : "existing");
    setClientId(String(q.clientId || ""));
    setProjectId(String(q.projectId || ""));
    setWalkInName(String(q.walkInCustomerName || q.customerName || "").trim());
    setWalkInPhone(String(q.walkInCustomerPhone || q.customerPhone || "").trim());
    setWalkInEmail(String(q.walkInCustomerEmail || q.customerEmail || "").trim());
    const d = q.discount || {};
    setDiscountType(d.type === "percentage" ? "percentage" : "fixed");
    setDiscountValue(d.value ?? 0);
    setTax(Number(q.tax ?? 0));
    setQuoteStatus(q.status || "draft");
    if (Array.isArray(q.items) && q.items.length > 0) {
      setItems(
        q.items.map((row) => ({
          productId: row.productId || "",
          description: row.description || row.name || "",
          quantity: row.quantity ?? 1,
          unitPrice: row.unitPrice ?? row.price ?? 0,
          lockPrice: false,
        }))
      );
    } else {
      setItems([{ ...BLANK_ITEM }]);
    }
    if (q.projectType) {
      setProjectType(q.projectType);
      setCctvType(String(q.projectType).toLowerCase() === "cctv" ? String(q.cctvType || "") : "");
    } else if (editBundle.project) {
      const derived = deriveTypeFromProject(editBundle.project);
      setProjectType(derived.primary || "Network");
      setCctvType(derived.primary === "CCTV" ? derived.cctv : "");
    } else {
      setProjectType("Network");
      setCctvType("");
    }
  }, [isEdit, editBundle]);

  useEffect(() => () => {
    Object.values(searchTimersRef.current).forEach((timerId) => clearTimeout(timerId));
  }, []);

  const { data: clients = [] } = useQuery({
    queryKey: ["/clients", "quotation-builder"],
    queryFn: async () => (await api.get("/clients")).data,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["/projects", "quotation-builder"],
    queryFn: async () => (await api.get("/projects")).data,
  });

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => String(c.name || "").toLowerCase().includes(q) || String(c.email || "").toLowerCase().includes(q));
  }, [clients, clientSearch]);

  const clientProjects = useMemo(
    () => projects.filter((project) => String(project.clientId?._id || project.clientId) === String(clientId)),
    [projects, clientId]
  );

  useEffect(() => {
    if (isEdit || customerMode !== "existing") return;
    if (!projectId || !clientId) return;
    const p = projects.find(
      (x) => String(x._id) === String(projectId) && String(x.clientId?._id || x.clientId) === String(clientId)
    );
    if (!p) return;
    const d = deriveTypeFromProject(p);
    setProjectType(d.primary || "Network");
    setCctvType(d.primary === "CCTV" ? d.cctv : "");
  }, [projectId, clientId, isEdit, projects, customerMode]);

  const calculatedItems = useMemo(
    () =>
      items.map((item) => {
        const quantity = toNumber(item.quantity);
        const unitPrice = toNumber(item.unitPrice);
        const total = quantity * unitPrice;
        return {
          productId: item.productId || "",
          name: item.description?.trim() || "",
          description: item.description?.trim() || "",
          quantity,
          price: unitPrice,
          unitPrice,
          total,
        };
      }),
    [items]
  );

  const subtotal = useMemo(
    () => calculatedItems.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [calculatedItems]
  );
  const discountAmount = useMemo(() => {
    const rawValue = toNumber(discountValue);
    if (discountType === "percentage") return (subtotal * rawValue) / 100;
    return rawValue;
  }, [discountType, discountValue, subtotal]);
  const grandTotal = subtotal - discountAmount + toNumber(tax);

  const saveQuotation = useMutation({
    mutationFn: async () => {
      const isWalkin = customerMode === "walkin";
      const body = {
        name,
        customerKind: isWalkin ? "walkin" : "existing",
        clientId: isWalkin ? clientId || "" : clientId,
        projectId: isWalkin ? "" : projectId,
        walkInCustomerName: isWalkin ? walkInName.trim() : "",
        walkInCustomerPhone: isWalkin ? walkInPhone.trim() : "",
        walkInCustomerEmail: isWalkin ? walkInEmail.trim().toLowerCase() : "",
        projectType,
        cctvType: projectType === "CCTV" ? cctvType : "",
        items: calculatedItems,
        discount: { type: discountType, value: toNumber(discountValue) },
        tax: toNumber(tax),
        ...(isEdit ? { status: quoteStatus } : {}),
      };
      if (isEdit) return api.put(`/quotations/${quotationId}`, body);
      return api.post("/quotations", body);
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["/quotations"] });
      const id = response?.data?._id || quotationId;
      if (id) {
        await queryClient.invalidateQueries({ queryKey: ["quotation-view", id] });
        await queryClient.invalidateQueries({ queryKey: ["quotation-edit", id] });
      }
      if (id) navigate(`/quotations/${id}`);
      else navigate("/quotations");
    },
  });

  const canSave = useMemo(() => {
    if (!name.trim() || !projectType || (projectType === "CCTV" && !cctvType)) return false;
    if (calculatedItems.length === 0 || calculatedItems.some((item) => !item.description)) return false;
    if (customerMode === "walkin") return Boolean(walkInName.trim());
    return Boolean(clientId && projectId);
  }, [name, projectType, cctvType, calculatedItems, customerMode, walkInName, clientId, projectId]);

  const updateItem = (index, key, value) => {
    setItems((previous) => previous.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  };

  const removeItem = (index) => {
    setItems((previous) => (previous.length > 1 ? previous.filter((_, itemIndex) => itemIndex !== index) : previous));
  };

  const handleProductSelect = (index, selectedProduct) => {
    if (!selectedProduct) return;
    setItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              productId: String(selectedProduct._id),
              description: String(selectedProduct.name || ""),
              unitPrice: Number(selectedProduct.price || 0),
            }
          : item
      )
    );
    setItemSearch((previous) => ({ ...previous, [index]: String(selectedProduct.name || "") }));
    setItemSuggestions((previous) => ({ ...previous, [index]: [] }));
  };

  const searchInventorySuggestions = async (index, query) => {
    const trimmed = String(query || "").trim();
    if (!trimmed) {
      setItemSuggestions((previous) => ({ ...previous, [index]: [] }));
      return;
    }
    try {
      const response = await api.get(`/inventory/search?q=${encodeURIComponent(trimmed)}`);
      setItemSuggestions((previous) => ({ ...previous, [index]: Array.isArray(response.data) ? response.data : [] }));
    } catch (error) {
      console.error("Failed to search inventory", error);
      setItemSuggestions((previous) => ({ ...previous, [index]: [] }));
    }
  };

  const handleItemNameInput = (index, value) => {
    setItemSearch((previous) => ({ ...previous, [index]: value }));
    updateItem(index, "description", value);
    updateItem(index, "productId", "");
    const currentTimer = searchTimersRef.current[index];
    if (currentTimer) clearTimeout(currentTimer);
    searchTimersRef.current[index] = setTimeout(() => {
      void searchInventorySuggestions(index, value);
    }, 220);
  };

  if (isEdit && editLoading) {
    return <div className="premium-card p-4 m-4 text-center text-xs text-slate-500">Loading quotation…</div>;
  }

  if (isEdit && editError) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-rose-600">Unable to load quotation.</p>
        <Link to="/quotations" className="text-[#635bff] hover:underline text-xs">
          Back to Quotations
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 quotation-invoice-theme">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 className="section-title">{isEdit ? "Edit quotation" : "New quotation"}</h1>
          <p className="page-subtitle text-[#6b7c93]">Dynamic quotation builder with real-time totals.</p>
        </div>
        <Link
          to={isEdit && quotationId ? `/quotations/${quotationId}` : "/quotations"}
          className="btn-secondary"
          style={{
            whiteSpace: "nowrap",
            height: "36px",
            padding: "0 12px",
            borderRadius: "8px",
          }}
        >
          {isEdit ? "Cancel" : "Back to Quotations"}
        </Link>
      </div>

      <div className="premium-card p-5 space-y-5">
        <div style={QUOTE_HEADER_GRID} className="mb-6">
          <div className="min-w-0">
            <label htmlFor="quote-title" className="block mb-2 text-sm font-medium">
              Quotation Title
            </label>
            <input
              id="quote-title"
              type="text"
              placeholder="Enter quotation title"
              className="w-full rounded-xl border px-4"
              style={{ height: 52, boxSizing: "border-box" }}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="min-w-0">
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                className={
                  customerMode === "existing"
                    ? "bg-[#0B132B] text-white px-4 h-[40px] rounded-lg"
                    : "border px-4 h-[40px] rounded-lg"
                }
                onClick={() => {
                  setCustomerMode("existing");
                  setWalkInName("");
                  setWalkInPhone("");
                  setWalkInEmail("");
                }}
              >
                Existing Client
              </button>
              <button
                type="button"
                className={
                  customerMode === "walkin"
                    ? "bg-[#0B132B] text-white px-4 h-[40px] rounded-lg"
                    : "border px-4 h-[40px] rounded-lg"
                }
                onClick={() => {
                  setCustomerMode("walkin");
                  setClientId("");
                  setProjectId("");
                  setClientSearch("");
                }}
              >
                Walk-in Customer
              </button>
            </div>

            {customerMode === "existing" ? (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search clients..."
                  className="w-full rounded-xl border px-4"
                  style={{ height: 52, boxSizing: "border-box" }}
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
                <select
                  className="w-full rounded-xl border px-4"
                  style={{ height: 52, boxSizing: "border-box" }}
                  value={clientId}
                  onChange={(event) => {
                    setClientId(event.target.value);
                    setProjectId("");
                  }}
                >
                  <option value="">Select client</option>
                  {filteredClients.map((client) => (
                    <option key={client._id} value={client._id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Customer name"
                  className="w-full rounded-xl border px-4"
                  style={{ height: 52, boxSizing: "border-box" }}
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Phone"
                  className="w-full rounded-xl border px-4"
                  style={{ height: 52, boxSizing: "border-box" }}
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  className="w-full rounded-xl border px-4"
                  style={{ height: 52, boxSizing: "border-box" }}
                  value={walkInEmail}
                  onChange={(e) => setWalkInEmail(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <label htmlFor="quote-project-type" className="block mb-2 text-xs font-semibold uppercase tracking-wide text-gray-700">
              PROJECT TYPE
            </label>
            <select
              id="quote-project-type"
              className="w-full rounded-xl border px-4"
              style={{ height: 52, boxSizing: "border-box" }}
              value={projectType}
              onChange={(e) => {
                const v = e.target.value;
                setProjectType(v);
                if (v !== "CCTV") setCctvType("");
              }}
            >
              <option value="">Select project type</option>
              {PROJECT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-[#635bff] mt-2 mb-0 leading-snug">
              • If you select CCTV, you will be asked to choose IP or Analog.
            </p>
            {projectType === "CCTV" ? (
              <>
                <label htmlFor="quote-cctv-type" className="block mb-2 mt-3 text-sm font-medium">
                  CCTV Type
                </label>
                <select
                  id="quote-cctv-type"
                  className="w-full rounded-xl border px-4"
                  style={{ height: 52, boxSizing: "border-box" }}
                  value={cctvType}
                  onChange={(e) => setCctvType(e.target.value)}
                >
                  <option value="">Select CCTV type</option>
                  <option value="IP">IP</option>
                  <option value="Analog">Analog</option>
                </select>
              </>
            ) : null}
          </div>
        </div>

        {customerMode === "existing" ? (
          <div style={QUOTE_HEADER_GRID} className="mb-6">
            <div className="min-w-0" />
            <div className="min-w-0">
              <select
                id="quote-project-id"
                className="w-full rounded-xl border px-4"
                style={{ height: 52, boxSizing: "border-box" }}
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                disabled={!clientId}
              >
                <option value="">Select project</option>
                {clientProjects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0" />
          </div>
        ) : null}

        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={`quotation-item-${index}`} className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-3 relative">
                <input
                  className="input-field"
                  value={itemSearch[index] ?? item.description}
                  onChange={(event) => handleItemNameInput(index, event.target.value)}
                  placeholder="Type item name (e.g. cam)"
                />
                {Array.isArray(itemSuggestions[index]) && itemSuggestions[index].length > 0 ? (
                  <div
                    className="autocomplete-dropdown absolute left-0 right-0 top-[calc(100%+4px)] z-20 bg-white text-black"
                    style={{ background: "#fff", color: "#000" }}
                  >
                    {itemSuggestions[index].map((suggestion) => (
                      <button
                        key={suggestion._id}
                        type="button"
                        className={`autocomplete-item hover:bg-gray-100 text-black ${item.productId === suggestion._id ? "active" : ""}`}
                        style={{ background: "#fff", color: "#000" }}
                        onClick={() => handleProductSelect(index, suggestion)}
                      >
                        <span className="font-medium text-slate-800">{suggestion.name}</span>
                        <span className="ml-2 text-xs text-slate-500">{suggestion.sku || "N/A"} - {formatCurrency(suggestion.price || 0)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <input
                type="number"
                min="0"
                className="col-span-2 input-field text-center"
                value={item.quantity}
                onChange={(event) => updateItem(index, "quantity", event.target.value)}
                placeholder="Qty"
              />
              <input
                type="number"
                min="0"
                className="col-span-2 input-field price numeric"
                value={item.unitPrice}
                onChange={(event) => updateItem(index, "unitPrice", event.target.value)}
                placeholder="Unit price"
                readOnly={Boolean(item.lockPrice)}
              />
              <div className="col-span-2 total-field numeric">
                {formatCurrency(calculatedItems[index]?.total)}
              </div>

              <button type="button" className="col-span-3 delete-btn text-slate-500 hover:text-rose-600 justify-self-start" onClick={() => removeItem(index)} aria-label="Remove line">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button type="button" className="btn-secondary btn-compact !border-dashed flex items-center gap-2" onClick={() => setItems((previous) => [...previous, { ...BLANK_ITEM }])}>
            <CirclePlus size={14} /> Add Item
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select className="w-full" value={discountType} onChange={(event) => setDiscountType(event.target.value)}>
            <option value="fixed">Fixed Discount</option>
            <option value="percentage">Percentage Discount</option>
          </select>
          <input type="number" min="0" className="w-full" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} placeholder={discountType === "percentage" ? "Discount %" : "Discount amount"} />
          <input type="number" min="0" className="w-full" value={tax} onChange={(event) => setTax(event.target.value)} placeholder="Tax amount" />
        </div>

        <div className="totals-box ml-auto w-full max-w-full space-y-2 text-sm">
          <div className="summary">
            <div className="row">
              <span>Subtotal</span>
              <span className="numeric">{formatCurrency(subtotal)}</span>
            </div>
            <div className="row">
              <span>Discount</span>
              <span className="numeric">{formatCurrency(discountAmount)}</span>
            </div>
            <div className="row">
              <span>Tax</span>
              <span className="numeric">{formatCurrency(tax)}</span>
            </div>
          </div>
          <div className="grand-total">
            <div className="label">Grand Total</div>
            <div className="amount">
              <span className="value">{formatCurrency(grandTotal)}</span>
              <span className="currency">SDG</span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            justifyContent: "flex-end",
            flexWrap: "nowrap",
            minWidth: "260px",
          }}
        >
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            style={{
              whiteSpace: "nowrap",
              height: "36px",
              padding: "0 12px",
              borderRadius: "8px",
            }}
            disabled={saveQuotation.isPending || !canSave}
            onClick={() => saveQuotation.mutate()}
          >
            <FileText size={16} />
            {saveQuotation.isPending ? "Saving…" : isEdit ? "Save changes" : "Save quotation"}
          </button>
        </div>
      </div>
    </div>
  );
}
