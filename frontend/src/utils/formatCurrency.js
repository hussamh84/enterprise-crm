export const formatCurrency = (value = 0) => {
  const n = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

/** Full display string: SDG + formatted amount (keeps amount on one line via `.currency` in UI). */
export const formatMoney = (value = 0) => `SDG ${formatCurrency(value)}`;
