import { currencyConfig } from "../config/currency";

export const formatCurrency = (value = 0) => {
  const amount = Number(value || 0);
  const formatted = new Intl.NumberFormat(currencyConfig.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currencyConfig.currencySymbol} ${formatted}`;
};
