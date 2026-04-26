import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CirclePlus, FileText, Trash2 } from "lucide-react";
import api from "../lib/api";
import { formatCurrency, formatMoney } from "../utils/formatCurrency";
import { formatClientNumber } from "../utils/formatClientNumber";

const BLANK_ITEM = { description: "", quantity: 1, unitPrice: 0 };

const toNumber = (value) => Number(value || 0);

export default function QuotationBuilderPage() {
  const { quotationId } = useParams();
  const isEdit = Boolean(quotationId);
  const [searchParams] = useSearchParams();
  const presetClientId = searchParams.get("clientId") || "";
  const presetProjectId = searchParams.get("projectId") || "";
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState(isEdit ? "" : presetClientId);
  const [projectId, setProjectId] = useState(isEdit ? "" : presetProjectId);
  const [discountType, setDiscountType] = useState("fixed");
  const [discountValue, setDiscountValue] = useState(0);
  const [tax, setTax] = useState(0);
  const [quoteStatus, setQuoteStatus] = useState("draft");
  const [items, setItems] = useState([{ ...BLANK_ITEM }]);
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
    setClientId(String(q.clientId || ""));
    setProjectId(String(q.projectId || ""));
    const d = q.discount || {};
    setDiscountType(d.type === "percentage" ? "percentage" : "fixed");
    setDiscountValue(d.value ?? 0);
    setTax(Number(q.tax ?? 0));
    setQuoteStatus(q.status || "draft");
    if (Array.isArray(q.items) && q.items.length > 0) {
      setItems(
        q.items.map((row) => ({
          description: row.description || "",
          quantity: row.quantity ?? 1,
          unitPrice: row.unitPrice ?? 0,
        }))
      );
    } else {
      setItems([{ ...BLANK_ITEM }]);
    }
  }, [isEdit, editBundle]);

  const { data: clients = [] } = useQuery({
    queryKey: ["/clients", "quotation-builder"],
    queryFn: async () => (await api.get("/clients")).data,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["/projects", "quotation-builder"],
    queryFn: async () => (await api.get("/projects")).data,
  });

  const clientProjects = useMemo(
    () => projects.filter((project) => String(project.clientId) === String(clientId)),
    [projects, clientId]
  );

  const calculatedItems = useMemo(
    () =>
      items.map((item) => {
        const quantity = toNumber(item.quantity);
        const unitPrice = toNumber(item.unitPrice);
        const total = quantity * unitPrice;
        return {
          description: item.description?.trim() || "",
          quantity,
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
      const body = {
        name,
        clientId,
        projectId,
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

  const updateItem = (index, key, value) => {
    setItems((previous) => previous.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  };

  const removeItem = (index) => {
    setItems((previous) => (previous.length > 1 ? previous.filter((_, itemIndex) => itemIndex !== index) : previous));
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
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">{isEdit ? "Edit quotation" : "New quotation"}</h1>
          <p className="text-[#6b7c93] text-xs mt-1">Dynamic quotation builder with real-time totals.</p>
        </div>
        <Link
          to={isEdit && quotationId ? `/quotations/${quotationId}` : "/quotations"}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-[#425466] hover:bg-slate-50 transition"
        >
          {isEdit ? "Cancel" : "Back to Quotations"}
        </Link>
      </div>

      <div className="premium-card p-4 space-y-3">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          <input className="rounded-lg border border-slate-200 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} placeholder="Quotation title" />
          <select className="rounded-lg border border-slate-200 px-3 py-2" value={clientId} onChange={(event) => { setClientId(event.target.value); setProjectId(""); }}>
            <option value="">Select client</option>
            {clients.map((client) => (
              <option key={client._id} value={client._id}>
                {formatClientNumber(client)} — {client.name}
              </option>
            ))}
          </select>
          <select className="rounded-lg border border-slate-200 px-3 py-2" value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={!clientId}>
            <option value="">Select project</option>
            {clientProjects.map((project) => (
              <option key={project._id} value={project._id}>{project.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={`quotation-item-${index}`} className="grid grid-cols-12 gap-2 items-center">
              <input className="col-span-5 rounded-lg border border-slate-200 px-3 py-2" value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} placeholder="Item description" />
              <input type="number" min="0" className="col-span-2 rounded-lg border border-slate-200 px-3 py-2" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} placeholder="Qty" />
              <input type="number" min="0" className="col-span-2 rounded-lg border border-slate-200 px-3 py-2" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} placeholder="Unit price" />
              <p className="col-span-2 text-xs font-medium text-[#0a2540]">
                <span className="currency">{formatMoney(calculatedItems[index]?.total)}</span>
              </p>
              <button type="button" className="col-span-1 text-slate-500 hover:text-rose-600 flex justify-center" onClick={() => removeItem(index)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button type="button" className="rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-sm text-[#425466] hover:bg-slate-50 transition flex items-center gap-2" onClick={() => setItems((previous) => [...previous, { ...BLANK_ITEM }])}>
            <CirclePlus size={14} /> Add Item
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          <select className="rounded-lg border border-slate-200 px-3 py-2" value={discountType} onChange={(event) => setDiscountType(event.target.value)}>
            <option value="fixed">Fixed Discount</option>
            <option value="percentage">Percentage Discount</option>
          </select>
          <input type="number" min="0" className="rounded-lg border border-slate-200 px-3 py-2" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} placeholder={discountType === "percentage" ? "Discount %" : "Discount amount"} />
          <input type="number" min="0" className="rounded-lg border border-slate-200 px-3 py-2" value={tax} onChange={(event) => setTax(event.target.value)} placeholder="Tax amount" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 ml-auto w-full max-w-sm text-xs space-y-2">
          <Row label="Subtotal" value={<span className="currency">{formatMoney(subtotal)}</span>} />
          <Row label="Discount" value={<span className="currency">- SDG {formatCurrency(discountAmount)}</span>} />
          <Row label="Tax" value={<span className="currency">{formatMoney(tax)}</span>} />
          <div className="pt-2 border-t border-slate-200">
            <Row label="Grand Total" value={<span className="currency">{formatMoney(grandTotal)}</span>} strong />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-md bg-[#635bff] text-white px-3 py-1.5 text-sm font-medium hover:opacity-90 transition flex items-center gap-2 disabled:opacity-60"
            disabled={
              saveQuotation.isPending ||
              !name ||
              !clientId ||
              !projectId ||
              calculatedItems.length === 0 ||
              calculatedItems.some((item) => !item.description)
            }
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

function Row({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#6b7c93]">{label}</span>
      <span className={strong ? "font-semibold text-[#0a2540]" : "font-medium text-[#0a2540]"}>{value}</span>
    </div>
  );
}
