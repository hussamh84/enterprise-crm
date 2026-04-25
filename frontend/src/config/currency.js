export const currencyConfig = {
  currencyCode: "SDG",
  currencySymbol: "SDG",
  locale: "en-US",
};

export const syncCurrencyConfig = (settings = {}) => {
  const rawCurrency = typeof settings.currency === "string" ? settings.currency.trim().toUpperCase() : "";
  const rawLocale = typeof settings.locale === "string" ? settings.locale.trim() : "";

  if (rawCurrency) {
    currencyConfig.currencyCode = rawCurrency;
    currencyConfig.currencySymbol = rawCurrency;
  }
  if (rawLocale) {
    currencyConfig.locale = rawLocale;
  }
};
