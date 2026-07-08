import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CirclePlus, FileText, GripVertical, Layers, Trash2 } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";
import { deriveTypeFromProject } from "../utils/projectTypeDisplay";
import { normalizeQuotationStatus } from "../utils/quotationStatus";

const PROJECT_TYPE_OPTIONS = [
  { value: "CCTV", label: "CCTV" },
  { value: "Solar System", label: "Solar System" },
  { value: "Network", label: "Network" },
];

const VALIDITY_OPTIONS = ["1 day", "7 days", "15 days", "30 days", "45 days"];
const ADVANCE_PERCENT_OPTIONS = [0, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const DEFAULT_VALIDITY = "1 day";
const DEFAULT_ADVANCE_PERCENT = 70;
const DEFAULT_WARRANTY = "1 Year";

const BLANK_ITEM = {
  productId: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
  lockPrice: false,
  sourceType: "inventory",
  purchasePrice: "",
  serviceCost: "",
  supplier: "",
  purchaseReference: "",
  addToInventory: false,
  sectionIndex: 0,
};

const newBlankItem = (sectionIndex = 0) => ({
  ...BLANK_ITEM,
  uid: crypto.randomUUID(),
  sectionIndex,
});

const toNumber = (value) => Number(value || 0);

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
  const [items, setItems] = useState([newBlankItem(0)]);
  const [sections, setSections] = useState([]);
  const [projectType, setProjectType] = useState("");
  const [cctvType, setCctvType] = useState("");
  const [quotationValidity, setQuotationValidity] = useState(DEFAULT_VALIDITY);
  const [advancePaymentPercent, setAdvancePaymentPercent] = useState(DEFAULT_ADVANCE_PERCENT);
  const [warranty, setWarranty] = useState(DEFAULT_WARRANTY);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [itemSearch, setItemSearch] = useState({});
  const [itemSuggestions, setItemSuggestions] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [postSaveNotice, setPostSaveNotice] = useState(null);
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
    setQuoteStatus(normalizeQuotationStatus(q.status));
    if (Array.isArray(q.items) && q.items.length > 0) {
      setItems(
        q.items.map((row) => ({
          uid: crypto.randomUUID(),
          productId: row.productId || "",
          description: row.description || row.name || "",
          quantity: row.quantity ?? 1,
          unitPrice: row.unitPrice ?? row.price ?? 0,
          lockPrice: false,
          sourceType: (() => {
            const st = String(row.sourceType || "inventory").toLowerCase();
            if (st === "market_purchase") return "market_purchase";
            if (st === "service") return "service";
            return "inventory";
          })(),
          purchasePrice: row.purchasePrice ?? "",
          serviceCost: row.serviceCost ?? "",
          supplier: row.supplier ?? "",
          purchaseReference: row.purchaseReference ?? "",
          addToInventory: Boolean(row.addToInventory),
          sectionIndex: Math.max(0, Number(row.sectionIndex) || 0),
        }))
      );
    } else {
      setItems([newBlankItem(0)]);
    }
    if (Array.isArray(q.sections) && q.sections.length > 0) {
      setSections(
        q.sections.map((s) => ({
          uid: crypto.randomUUID(),
          title: String(s?.title || ""),
          notes: String(s?.notes || ""),
        }))
      );
    } else {
      setSections([]);
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
    setQuotationValidity(String(q.quotationValidity || "").trim() || DEFAULT_VALIDITY);
    setAdvancePaymentPercent(
      q.advancePaymentPercent === null || q.advancePaymentPercent === undefined || q.advancePaymentPercent === ""
        ? DEFAULT_ADVANCE_PERCENT
        : Number(q.advancePaymentPercent)
    );
    setWarranty(String(q.warranty || "").trim() || DEFAULT_WARRANTY);
    setAdditionalNotes(String(q.additionalNotes || ""));
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
        const raw = String(item.sourceType || "inventory").toLowerCase();
        const st = raw === "market_purchase" ? "market_purchase" : raw === "service" ? "service" : "inventory";
        const si = Math.max(0, Number(item.sectionIndex) || 0);
        const base = {
          productId: item.productId || "",
          name: item.description?.trim() || "",
          description: item.description?.trim() || "",
          quantity,
          price: unitPrice,
          unitPrice,
          total,
          sourceType: st,
          purchasePrice: 0,
          serviceCost: 0,
          supplier: "",
          purchaseReference: "",
          addToInventory: false,
          sectionIndex: si,
        };
        if (st === "market_purchase") {
          return {
            ...base,
            productId: "",
            purchasePrice: toNumber(item.purchasePrice),
            supplier: String(item.supplier || "").trim(),
            purchaseReference: String(item.purchaseReference || "").trim(),
            addToInventory: Boolean(item.addToInventory),
          };
        }
        if (st === "service") {
          return {
            ...base,
            productId: "",
            serviceCost: toNumber(item.serviceCost),
          };
        }
        return base;
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

  const sectionSubtotal = (si) =>
    calculatedItems
      .filter((item) => (item.sectionIndex ?? 0) === si)
      .reduce((sum, item) => sum + Number(item.total || 0), 0);

  const saveBlockedReasons = useMemo(() => {
    const reasons = [];
    if (!name.trim()) reasons.push("Quotation title is required.");
    if (projectType === "CCTV" && !cctvType) reasons.push("Select IP or Analog for CCTV.");
    if (calculatedItems.length === 0 || calculatedItems.some((item) => !item.description)) {
      reasons.push("Each line item needs a description.");
    }
    for (const item of items) {
      if (String(item.sourceType || "inventory").toLowerCase() !== "market_purchase") continue;
      const pp = toNumber(item.purchasePrice);
      if (!Number.isFinite(pp) || pp < 0) {
        reasons.push("Market purchase lines need a valid purchase price (0 or greater).");
        break;
      }
    }
    if (customerMode === "walkin") {
      if (!walkInName.trim()) reasons.push("Walk-in customer name is required.");
    } else if (!clientId) {
      reasons.push("Select a client.");
    }
    return reasons;
  }, [name, projectType, cctvType, calculatedItems, items, customerMode, walkInName, clientId]);

  const canSave = saveBlockedReasons.length === 0;

  useEffect(() => {
    setSaveError(null);
  }, [name, clientId, projectId, customerMode, walkInName, walkInPhone, walkInEmail, projectType, cctvType, items, quoteStatus]);

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
        projectType: projectType || "Network",
        cctvType: projectType === "CCTV" ? cctvType : "",
        items: calculatedItems,
        sections: sections.map((s) => ({ title: s.title.trim(), notes: (s.notes || "").trim() })),
        discount: { type: discountType, value: toNumber(discountValue) },
        tax: toNumber(tax),
        quotationValidity,
        advancePaymentPercent: toNumber(advancePaymentPercent),
        warranty: warranty.trim(),
        additionalNotes: additionalNotes.trim(),
        ...(isEdit ? { status: quoteStatus } : {}),
      };
      try {
        const response = isEdit ? await api.put(`/quotations/${quotationId}`, body) : await api.post("/quotations", body);
        return response;
      } catch (err) {
        console.error("[quotation save] response error", err?.response?.status, err?.response?.data || err);
        throw err;
      }
    },
    onMutate: () => {
      setSaveError(null);
      setPostSaveNotice(null);
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["/quotations"] });
      const id = response?.data?._id || quotationId;
      if (id) {
        await queryClient.invalidateQueries({ queryKey: ["quotation-view", id] });
        await queryClient.invalidateQueries({ queryKey: ["quotation-edit", id] });
      }
      setPostSaveNotice(isEdit ? "Changes saved." : "Quotation saved successfully.");
      await new Promise((resolve) => setTimeout(resolve, 650));
      setPostSaveNotice(null);
      if (id) navigate(`/quotations/${id}`);
      else navigate("/quotations");
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || err?.message || "Could not save quotation.";
      setSaveError(msg);
    },
  });

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
              sourceType: "inventory",
              productId: String(selectedProduct._id),
              description: String(selectedProduct.name || ""),
              unitPrice: Number(selectedProduct.price || 0),
              purchasePrice: "",
              supplier: "",
              purchaseReference: "",
              addToInventory: false,
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
    const line = items[index];
    const lineSt = String(line?.sourceType || "inventory").toLowerCase();
    if (lineSt === "market_purchase" || lineSt === "service") {
      setItemSuggestions((previous) => ({ ...previous, [index]: [] }));
      return;
    }
    const currentTimer = searchTimersRef.current[index];
    if (currentTimer) clearTimeout(currentTimer);
    searchTimersRef.current[index] = setTimeout(() => {
      void searchInventorySuggestions(index, value);
    }, 220);
  };

  const setItemSourceType = (index, nextSource) => {
    const isMarket = nextSource === "market_purchase";
    const isService = nextSource === "service";
    setItems((previous) =>
      previous.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (isMarket) {
          return { ...item, sourceType: "market_purchase", productId: "", lockPrice: false, serviceCost: "", addToInventory: false };
        }
        if (isService) {
          return { ...item, sourceType: "service", productId: "", lockPrice: false, purchasePrice: "", supplier: "", purchaseReference: "", addToInventory: false };
        }
        return { ...item, sourceType: "inventory", purchasePrice: "", serviceCost: "", supplier: "", purchaseReference: "", addToInventory: false };
      })
    );
    if (isMarket || isService) {
      setItemSuggestions((previous) => ({ ...previous, [index]: [] }));
    }
  };

  // --- Section management ---
  const addSection = () => {
    setSections((prev) => [
      ...prev,
      { uid: crypto.randomUUID(), title: "", notes: "" },
    ]);
  };

  const removeSection = (si) => {
    if (sections.length === 1) {
      setSections([]);
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        const itemSi = item.sectionIndex ?? 0;
        if (itemSi === si) return { ...item, sectionIndex: Math.max(0, si - 1) };
        if (itemSi > si) return { ...item, sectionIndex: itemSi - 1 };
        return item;
      })
    );
    setSections((prev) => prev.filter((_, i) => i !== si));
  };

  const updateSectionTitle = (si, value) => {
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, title: value } : s)));
  };

  const addItemToSection = (si) => {
    setItems((prev) => [...prev, newBlankItem(si)]);
  };

  // --- Drag & drop ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((item) => item.uid === active.id);
        const newIndex = prev.findIndex((item) => item.uid === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
      setItemSuggestions({});
    }
  };

  const makeSectionDragEnd = (si) => ({ active, over }) => {
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((item) => item.uid === active.id);
        const newIndex = prev.findIndex((item) => item.uid === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
      setItemSuggestions({});
    }
  };

  // --- Item row renderer (shared between sections and flat mode) ---
  const renderItemContent = (item, index, dragListeners) => {
    const srcType = String(item.sourceType || "inventory").toLowerCase();
    const isMarket = srcType === "market_purchase";
    const isService = srcType === "service";
    return (
      <div className="flex gap-1.5">
        <div
          className="flex-shrink-0 flex items-start pt-2.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
          {...dragListeners}
        >
          <GripVertical size={14} />
        </div>
        <div className="flex-1 space-y-2">
          <div className="grid grid-cols-12 gap-2 sm:gap-3 items-center">
            <select
              className="col-span-12 sm:col-span-2 input-field text-xs sm:text-sm"
              aria-label="Line source type"
              value={srcType}
              onChange={(e) => setItemSourceType(index, e.target.value)}
            >
              <option value="inventory">Inventory</option>
              <option value="market_purchase">Market Purchase</option>
              <option value="service">Service</option>
            </select>
            <div className="col-span-12 sm:col-span-3 relative">
              <input
                className="input-field"
                value={itemSearch[index] ?? item.description}
                onChange={(event) => handleItemNameInput(index, event.target.value)}
                placeholder={isMarket ? "Item description" : isService ? "Service description" : "Type item name (e.g. cam)"}
              />
              {!isMarket && !isService &&
              Array.isArray(itemSuggestions[index]) &&
              itemSuggestions[index].length > 0 ? (
                <div
                  className="autocomplete-dropdown absolute left-0 right-0 top-[calc(100%+4px)] z-20 bg-white text-black border border-gray-200 rounded-xl shadow-lg"
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
                      <span className="ml-2 text-xs text-slate-500">
                        {suggestion.sku || "N/A"} - {formatCurrency(suggestion.price || 0)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <input
              type="number"
              min="0"
              className="col-span-4 sm:col-span-2 input-field text-center"
              value={item.quantity}
              onChange={(event) => updateItem(index, "quantity", event.target.value)}
              placeholder="Qty"
            />
            <input
              type="number"
              min="0"
              className="col-span-4 sm:col-span-2 input-field price numeric"
              value={item.unitPrice}
              onChange={(event) => updateItem(index, "unitPrice", event.target.value)}
              placeholder={isMarket ? "Sell price" : isService ? "Service price" : "Unit price"}
              readOnly={Boolean(item.lockPrice)}
            />
            <div className="col-span-4 sm:col-span-2 total-field numeric text-sm">
              {formatCurrency(calculatedItems[index]?.total)}
            </div>
            <button
              type="button"
              className="col-span-12 sm:col-span-1 delete-btn text-slate-500 hover:text-rose-600 justify-self-end sm:justify-self-start"
              onClick={() => removeItem(index)}
              aria-label="Remove line"
            >
              <Trash2 size={16} />
            </button>
          </div>
          {isMarket ? (
            <div className="grid grid-cols-12 gap-2 sm:gap-3 items-center border-l-2 border-slate-200 pl-2">
              <input
                type="number" min="0" step="0.01"
                className="col-span-6 sm:col-span-2 input-field text-sm"
                placeholder="Purchase price"
                value={item.purchasePrice}
                onChange={(e) => updateItem(index, "purchasePrice", e.target.value)}
              />
              <input
                type="text"
                className="col-span-6 sm:col-span-3 input-field text-sm"
                placeholder="Supplier"
                value={item.supplier}
                onChange={(e) => updateItem(index, "supplier", e.target.value)}
              />
              <input
                type="text"
                className="col-span-12 sm:col-span-3 input-field text-sm"
                placeholder="Purchase reference"
                value={item.purchaseReference}
                onChange={(e) => updateItem(index, "purchaseReference", e.target.value)}
              />
              <label className="col-span-12 sm:col-span-4 flex items-center gap-2 text-xs text-slate-600 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={Boolean(item.addToInventory)}
                  onChange={(e) => updateItem(index, "addToInventory", e.target.checked)}
                />
                Add purchased item to inventory
              </label>
            </div>
          ) : null}
          {isService ? (
            <div className="grid grid-cols-12 gap-2 sm:gap-3 items-center border-l-2 border-indigo-200 pl-2">
              <input
                type="number" min="0" step="0.01"
                className="col-span-6 sm:col-span-2 input-field text-sm"
                placeholder="Internal cost (optional)"
                value={item.serviceCost}
                onChange={(e) => updateItem(index, "serviceCost", e.target.value)}
              />
              <span className="col-span-6 sm:col-span-10 text-xs text-slate-400 italic">
                Internal service cost — labour, outsourcing, etc. Not shown on client PDF.
              </span>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  if (isEdit && editLoading) {
    return <div className="premium-card p-4 m-4 text-center text-xs text-slate-500">Loading quotation…</div>;
  }

  if (isEdit && editError) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-rose-600">Unable to load quotation.</p>
        <Link to="/quotations" className="text-[#635bff] hover:underline text-xs">Back to Quotations</Link>
      </div>
    );
  }

  if (isEdit && editBundle?.quotation) {
    const loadedStatus = normalizeQuotationStatus(editBundle.quotation.status);
    if (loadedStatus === "converted_to_project") {
      const pid = String(editBundle.quotation.projectId || "").trim();
      return (
        <div className="space-y-4 p-4 quotation-invoice-theme">
          <div className="premium-card p-5 space-y-3">
            <p className="text-sm text-slate-700">This quotation was converted to a project and cannot be edited.</p>
            <div className="flex flex-wrap gap-2">
              {pid ? <Link to={`/projects/${pid}`} className="btn-primary">Open project</Link> : null}
              <Link to={`/quotations/${quotationId}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#425466] hover:bg-slate-50">View quotation</Link>
              <Link to="/quotations" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#425466] hover:bg-slate-50">Back to list</Link>
            </div>
          </div>
        </div>
      );
    }
  }

  const hasSections = sections.length > 0;

  return (
    <div className="space-y-5 quotation-invoice-theme">
      <div className="premium-card p-5 space-y-5">
        {/* Header fields */}
        <div id="qz26zf" className="grid grid-cols-3 gap-6 mb-8 items-start">
          <div className="min-w-0">
            <label htmlFor="quote-title" className="block text-sm font-medium mb-2">Quotation Title</label>
            <input
              id="quote-title"
              type="text"
              placeholder="Enter quotation title"
              className="w-full h-12 border rounded-xl px-4"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="min-w-0">
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                className={customerMode === "existing" ? "bg-[#0B132B] text-white px-4 h-10 rounded-lg" : "border px-4 h-10 rounded-lg"}
                onClick={() => { setCustomerMode("existing"); setWalkInName(""); setWalkInPhone(""); setWalkInEmail(""); }}
              >
                Existing Client
              </button>
              <button
                type="button"
                className={customerMode === "walkin" ? "bg-[#0B132B] text-white px-4 h-10 rounded-lg" : "border px-4 h-10 rounded-lg"}
                onClick={() => { setCustomerMode("walkin"); setClientId(""); setProjectId(""); setClientSearch(""); }}
              >
                Walk-in Customer
              </button>
            </div>
            {customerMode === "existing" ? (
              <select id="quote-client" className="w-full h-12 border rounded-xl px-4" value={clientId} onChange={(event) => { setClientId(event.target.value); setProjectId(""); }}>
                <option value="">Select Client</option>
                {filteredClients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}
              </select>
            ) : null}
            {customerMode === "walkin" ? (
              <div className="space-y-2">
                <input type="text" placeholder="Customer name" className="w-full h-12 border rounded-xl px-4" value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
                <input type="text" placeholder="Phone" className="w-full h-12 border rounded-xl px-4" value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} />
                <input type="email" placeholder="Email (optional)" className="w-full h-12 border rounded-xl px-4" value={walkInEmail} onChange={(e) => setWalkInEmail(e.target.value)} />
              </div>
            ) : null}
          </div>

          <div className="min-w-0">
            <label htmlFor="quote-project-type" className="block text-sm font-medium mb-2">Project Type</label>
            <select id="quote-project-type" className="w-full h-12 border rounded-xl px-4" value={projectType} onChange={(e) => { const v = e.target.value; setProjectType(v); if (v !== "CCTV") setCctvType(""); }}>
              <option value="">Select project (optional)</option>
              {PROJECT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {projectType === "CCTV" ? (
              <select id="quote-cctv-type" className="w-full h-12 border rounded-xl px-4 mt-2" value={cctvType} onChange={(e) => setCctvType(e.target.value)} aria-label="CCTV subtype">
                <option value="">IP / Analog</option>
                <option value="IP">IP</option>
                <option value="Analog">Analog</option>
              </select>
            ) : null}
          </div>
        </div>

        {/* Items area */}
        <div className="space-y-3">
          {!hasSections ? (
            /* ── Flat mode (no sections) ── */
            <>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((i) => i.uid)} strategy={verticalListSortingStrategy}>
                  {items.map((item, index) => (
                    <SortableQuotationItem key={item.uid} id={item.uid}>
                      {(dragListeners) => renderItemContent(item, index, dragListeners)}
                    </SortableQuotationItem>
                  ))}
                </SortableContext>
              </DndContext>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn-secondary btn-compact !border-dashed flex items-center gap-2"
                  onClick={() => setItems((prev) => [...prev, newBlankItem(0)])}
                >
                  <CirclePlus size={14} /> Add Item
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-compact !border-dashed flex items-center gap-2"
                  onClick={addSection}
                >
                  <Layers size={14} /> Add Section
                </button>
              </div>
            </>
          ) : (
            /* ── Sections mode ── */
            <>
              {sections.map((section, si) => {
                const sectionItemsWithIdx = items
                  .map((item, gIdx) => ({ item, gIdx }))
                  .filter(({ item }) => (item.sectionIndex ?? 0) === si);
                const sectionUIDs = sectionItemsWithIdx.map(({ item }) => item.uid);
                const secTotal = sectionSubtotal(si);

                return (
                  <div key={section.uid} className="rounded-xl border border-slate-200 overflow-hidden">
                    {/* Section header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                      <Layers size={13} className="text-slate-400 flex-shrink-0" />
                      <input
                        className="flex-1 text-sm font-semibold bg-transparent outline-none placeholder:text-slate-400 placeholder:font-normal"
                        value={section.title}
                        onChange={(e) => updateSectionTitle(si, e.target.value)}
                        placeholder={`Section ${si + 1} title (e.g. CCTV System)`}
                      />
                      <span className="text-xs text-slate-500 font-mono flex-shrink-0">
                        {formatCurrency(secTotal)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSection(si)}
                        className="flex-shrink-0 text-slate-400 hover:text-rose-500 transition-colors"
                        aria-label="Remove section"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Section items */}
                    <div className="p-3 space-y-2">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={makeSectionDragEnd(si)}
                      >
                        <SortableContext items={sectionUIDs} strategy={verticalListSortingStrategy}>
                          {sectionItemsWithIdx.map(({ item, gIdx }) => (
                            <SortableQuotationItem key={item.uid} id={item.uid}>
                              {(dragListeners) => renderItemContent(item, gIdx, dragListeners)}
                            </SortableQuotationItem>
                          ))}
                        </SortableContext>
                      </DndContext>
                      {sectionItemsWithIdx.length === 0 ? (
                        <p className="text-xs text-slate-400 italic pl-5">No items yet.</p>
                      ) : null}
                      <button
                        type="button"
                        className="btn-secondary btn-compact !border-dashed flex items-center gap-2 text-xs"
                        onClick={() => addItemToSection(si)}
                      >
                        <CirclePlus size={12} /> Add item to section
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn-secondary btn-compact !border-dashed flex items-center gap-2"
                  onClick={addSection}
                >
                  <Layers size={14} /> Add Section
                </button>
              </div>
            </>
          )}
        </div>

        {/* Terms & Notes */}
        <div className="space-y-3 rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700">Terms &amp; Notes</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="quote-validity" className="block text-xs font-medium mb-1.5 text-slate-600">Quotation Validity</label>
              <select
                id="quote-validity"
                className="w-full h-12 border rounded-xl px-4"
                value={quotationValidity}
                onChange={(e) => setQuotationValidity(e.target.value)}
              >
                {VALIDITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="quote-advance" className="block text-xs font-medium mb-1.5 text-slate-600">Advance Payment</label>
              <select
                id="quote-advance"
                className="w-full h-12 border rounded-xl px-4"
                value={advancePaymentPercent}
                onChange={(e) => setAdvancePaymentPercent(Number(e.target.value))}
              >
                {ADVANCE_PERCENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}%</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-slate-600">Remaining Payment</label>
              <div className="w-full h-12 border rounded-xl px-4 flex items-center bg-slate-50 text-slate-600">
                {Math.max(0, 100 - toNumber(advancePaymentPercent))}% (calculated automatically)
              </div>
            </div>
            <div>
              <label htmlFor="quote-warranty" className="block text-xs font-medium mb-1.5 text-slate-600">Warranty</label>
              <input
                id="quote-warranty"
                type="text"
                className="w-full h-12 border rounded-xl px-4"
                value={warranty}
                onChange={(e) => setWarranty(e.target.value)}
                placeholder="e.g. No Warranty, 6 Months, 1 Year, 2 Years"
              />
            </div>
          </div>
          <div>
            <label htmlFor="quote-additional-notes" className="block text-xs font-medium mb-1.5 text-slate-600">Additional Notes</label>
            <textarea
              id="quote-additional-notes"
              className="w-full border rounded-xl px-4 py-3"
              rows={3}
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="e.g. Delivery within 7 days. Installation included. Transportation excluded."
            />
          </div>
        </div>

        {/* Status (edit only) */}
        {isEdit ? (
          <div className="max-w-md">
            <label htmlFor="quote-status" className="block text-sm font-medium mb-2">Quotation status</label>
            <select id="quote-status" className="w-full h-12 border rounded-xl px-4" value={quoteStatus} onChange={(e) => setQuoteStatus(normalizeQuotationStatus(e.target.value))}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <p className="text-xs text-slate-500 mt-1.5">
              Use <strong>Approve</strong> on the view page to generate the invoice when the client accepts.
            </p>
          </div>
        ) : null}

        {/* Totals */}
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
            <div className="row"><span>Subtotal</span><span className="numeric">{formatCurrency(subtotal)}</span></div>
            <div className="row"><span>Discount</span><span className="numeric">{formatCurrency(discountAmount)}</span></div>
            <div className="row"><span>Tax</span><span className="numeric">{formatCurrency(tax)}</span></div>
          </div>
          <div className="grand-total">
            <div className="label">Grand Total</div>
            <div className="amount">
              <span className="value">{formatCurrency(grandTotal)}</span>
              <span className="currency">SDG</span>
            </div>
          </div>
        </div>

        {saveBlockedReasons.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
            <p className="font-medium">Complete the following to save:</p>
            <ul className="mt-1 list-disc pl-5 space-y-0.5">
              {saveBlockedReasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>
        ) : null}
        {saveError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{saveError}</div>
        ) : null}
        {postSaveNotice ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">{postSaveNotice}</div>
        ) : null}

        <div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "flex-end", flexWrap: "nowrap", minWidth: "260px" }}>
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            style={{ whiteSpace: "nowrap", height: "36px", padding: "0 12px", borderRadius: "8px" }}
            disabled={saveQuotation.isPending || !canSave}
            title={saveBlockedReasons[0] || undefined}
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

function SortableQuotationItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, position: "relative", zIndex: isDragging ? 1 : "auto" }}
      {...attributes}
    >
      {children(listeners)}
    </div>
  );
}
