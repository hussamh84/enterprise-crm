import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import api from "../lib/api";
import { formatCurrency } from "../utils/format";

export default function InventoryDetailsPage() {
  const { inventoryId } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["inventory-details", inventoryId],
    queryFn: async () => (await api.get(`/inventory/${inventoryId}/usage`)).data,
    enabled: Boolean(inventoryId),
  });

  const item = data?.inventoryItem;
  const costPrice = Number(item?.costPrice ?? item?.cost ?? 0);
  const sellingPrice = Number(item?.sellingPrice ?? item?.price ?? 0);
  const profitMargin = sellingPrice - costPrice;

  if (isLoading) {
    return <div className="p-6 text-center text-sm">Loading inventory details...</div>;
  }

  if (isError || !item) {
    return <div className="p-6 text-center text-sm text-rose-600">Unable to load inventory details.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">{item.name || "Inventory Item"}</h1>
          <p className="page-subtitle">Inventory pricing details and usage summary.</p>
        </div>
        <Link to="/inventory" className="btn-secondary btn-compact">
          Back
        </Link>
      </div>

      <div className="card grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-500">Cost Price</p>
          <p className="text-sm font-semibold">{formatCurrency(costPrice)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Selling Price</p>
          <p className="text-sm font-semibold">{formatCurrency(sellingPrice)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Profit Margin</p>
          <p className="text-sm font-semibold">{formatCurrency(profitMargin)}</p>
        </div>
      </div>
    </div>
  );
}
