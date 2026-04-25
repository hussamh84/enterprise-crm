const currencyConfig = {
  currencyCode: "SDG",
  currencySymbol: "SDG",
  locale: "en-US",
};

const formatMoney = (value = 0) => {
  const amount = Number(value || 0);
  const formatted = new Intl.NumberFormat(currencyConfig.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currencyConfig.currencySymbol} ${formatted}`;
};

module.exports = { currencyConfig, formatMoney };
