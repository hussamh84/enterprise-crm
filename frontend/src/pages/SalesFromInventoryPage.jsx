import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";
import { openPdf } from "../utils/pdf";

const BLANK_ITEM = { productId: "", description: "", quantity: 1, unitPrice: 0 };

export default function SalesFromInventoryPage() {
  const [searchParams] = useSearchParams();
  const presetClientId = searchParams.get("clientId") || "";
  const [customerType, setCustomerType] = useState(presetClientId ? "existing" : "walkin");
  const [clientId, setClientId] = useState(presetClientId);
  const [clientSearch, setClientSearch] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [name, setName] = useState("");
  const [items, setItems] = useState([{ ...BLANK_ITEM }]);
  const [itemSearch, setItemSearch] = useState({});
  const [itemSuggestions, setItemSuggestions] = useState({});
  const searchTimersRef = useRef({});
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: clients = [] } = useQuery({
    queryKey: ["/clients", "sales-from-inventory"],
    queryFn: async () => (await api.get("/clients")).data,
  });

  const updateItem = (index, key, value) => {
    setItems((previous) => previous.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  };

  const filteredClients = useMemo(() => {
    const query = String(clientSearch || "").trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) => {
      const clientName = String(client?.name || "").toLowerCase();
      const clientPhone = String(client?.phone || "").toLowerCase();
      const clientEmail = String(client?.email || "").toLowerCase();
      return clientName.includes(query) || clientPhone.includes(query) || clientEmail.includes(query);
    });
  }, [clients, clientSearch]);

  const removeItem = (index) => {
    setItems((previous) => (previous.length > 1 ? previous.filter((_, itemIndex) => itemIndex !== index) : previous));
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
    } catch {
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

  const handleProductSelect = (index, product) => {
    if (!product) return;
    setItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              productId: String(product._id),
              description: String(product.name || ""),
              unitPrice: Number(product.price || 0),
            }
          : item
      )
    );
    setItemSearch((previous) => ({ ...previous, [index]: String(product.name || "") }));
    setItemSuggestions((previous) => ({ ...previous, [index]: [] }));
  };

  const normalizedItems = useMemo(
    () =>
      items
        .map((item) => {
          const quantity = Number(item.quantity || 0);
          const unitPrice = Number(item.unitPrice || 0);
          return {
            productId: String(item.productId || "").trim(),
            name: String(item.description || "").trim(),
            description: String(item.description || "").trim(),
            quantity,
            price: unitPrice,
            unitPrice,
            total: Number((quantity * unitPrice).toFixed(2)),
          };
        })
        .filter((item) => item.productId && item.quantity > 0),
    [items]
  );

  const grandTotal = useMemo(
    () => Number(normalizedItems.reduce((sum, item) => sum + Number(item.total || 0), 0).toFixed(2)),
    [normalizedItems]
  );

  const basePayload = () => ({
    name: String(name || "").trim() || "Inventory Sale",
    clientId: customerType === "existing" ? String(clientId || "").trim() : "",
    walkInCustomer:
      customerType === "walkin"
        ? {
            name: String(walkInName || "").trim(),
            phone: String(walkInPhone || "").trim(),
            email: String(walkInEmail || "").trim(),
          }
        : undefined,
    projectId: null,
    source: "inventory",
    items: normalizedItems,
    total: grandTotal,
  });

  const createQuotation = useMutation({
    mutationFn: async () => (await api.post("/quotations", basePayload())).data,
    onSuccess: async (quotation) => {
      await queryClient.invalidateQueries({ queryKey: ["/quotations"] });
      if (quotation?._id) navigate(`/quotations/${quotation._id}`);
      else navigate("/quotations");
    },
  });

  const createInvoice = useMutation({
    mutationFn: async () => (await api.post("/invoices", basePayload())).data,
    onSuccess: async (invoice) => {
      await queryClient.invalidateQueries({ queryKey: ["/invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["/inventory"] });
      if (invoice?._id) {
        openPdf(`/invoices/${invoice._id}/pdf`);
        navigate(`/invoices/${invoice._id}`);
      } else {
        navigate("/invoices");
      }
    },
  });

  const hasValidExistingClient = customerType === "existing" ? Boolean(clientId) : false;
  const hasValidWalkIn = customerType === "walkin" ? Boolean(String(walkInName || "").trim()) : false;
  const canSubmit = (hasValidExistingClient || hasValidWalkIn) && normalizedItems.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Sell from Inventory</h1>
          <p className="page-subtitle">Create quotation or invoice directly from inventory (no project required).</p>
        </div>
        <Link to="/inventory" className="btn-secondary">
          Back to Inventory
        </Link>
      </div>

      <div className="premium-card p-5 space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <input className="w-full" value={name} onChange={(event) => setName(event.target.value)} placeholder="Sale title (optional)" />
          <select
            className="w-full"
            value={customerType}
            onChange={(event) => {
              const value = event.target.value;
              setCustomerType(value);
              if (value === "existing") {
                setWalkInName("");
                setWalkInPhone("");
                setWalkInEmail("");
              } else {
                setClientId("");
                setClientSearch("");
              }
            }}
          >
            <option value="existing">Select Existing Client</option>
            <option value="walkin">Walk-in Customer</option>
          </select>
        </div>
        {customerType === "existing" ? (
          <div className="grid md:grid-cols-2 gap-3">
            <input
              className="w-full"
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
              placeholder="Search client by name, phone, email"
            />
            <select className="w-full" value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="">Select client</option>
              {filteredClients.map((client) => (
                <option key={client._id} value={client._id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            <input
              className="w-full"
              value={walkInName}
              onChange={(event) => setWalkInName(event.target.value)}
              placeholder="Customer Name"
            />
            <input
              className="w-full"
              value={walkInPhone}
              onChange={(event) => setWalkInPhone(event.target.value)}
              placeholder="Phone Number"
            />
            <input
              className="w-full"
              value={walkInEmail}
              onChange={(event) => setWalkInEmail(event.target.value)}
              placeholder="Email (optional)"
            />
          </div>
        )}

        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={`sales-item-${index}`} className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-4 relative">
                <input
                  className="input-field"
                  value={itemSearch[index] ?? item.description}
                  onChange={(event) => handleItemNameInput(index, event.target.value)}
                  placeholder="Search inventory item"
                />
                {Array.isArray(itemSuggestions[index]) && itemSuggestions[index].length > 0 ? (
                  <div className="autocomplete-dropdown absolute left-0 right-0 top-[calc(100%+4px)] z-20">
                    {itemSuggestions[index].map((suggestion) => (
                      <button
                        key={suggestion._id}
                        type="button"
                        className="autocomplete-item"
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
                min="1"
                className="col-span-2 input-field text-center"
                value={item.quantity}
                onChange={(event) => updateItem(index, "quantity", event.target.value)}
                placeholder="Qty"
              />
              <input
                type="number"
                min="0"
                className="col-span-2 input-field numeric"
                value={item.unitPrice}
                onChange={(event) => updateItem(index, "unitPrice", event.target.value)}
                placeholder="Price"
              />
              <div className="col-span-2 total-field numeric">
                {formatCurrency(Number(item.quantity || 0) * Number(item.unitPrice || 0))}
              </div>
              <button type="button" className="col-span-2 btn-secondary btn-compact" onClick={() => removeItem(index)}>
                Remove
              </button>
            </div>
          ))}

          <button type="button" className="btn-secondary btn-compact !border-dashed" onClick={() => setItems((previous) => [...previous, { ...BLANK_ITEM }])}>
            + Add Item
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <span className="text-sm text-slate-600">Total</span>
          <span className="text-base font-semibold numeric">{formatCurrency(grandTotal)}</span>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={!canSubmit || createQuotation.isPending || createInvoice.isPending}
            onClick={() => createQuotation.mutate()}
          >
            {createQuotation.isPending ? "Creating..." : "Create Quotation"}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!canSubmit || createQuotation.isPending || createInvoice.isPending}
            onClick={() => createInvoice.mutate()}
          >
            {createInvoice.isPending ? "Creating..." : "Create Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}
