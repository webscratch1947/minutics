/**
 * currency.js — Currency helpers
 * 
 * Replaces mangled exports: ok (setCurrency), sk (getCurrency)
 * localStorage key: "lt_currency_v1"
 */

/** Read currency from localStorage (was: sk) */
export function getCurrency() {
  try {
    return JSON.parse(localStorage.getItem("lt_currency_v1") || '{"code":"INR"}');
  } catch {
    return { code: "INR" };
  }
}

/** Save currency to localStorage (was: ok) */
export function setCurrency(code) {
  try {
    localStorage.setItem("lt_currency_v1", JSON.stringify({ code }));
  } catch {}
}

/** Get currency symbol by code */
/** Single source of truth: symbol table must match the full Settings picker
    (enhancements.js CURRENCIES). Missing codes used to fall back to "Rs.",
    which made Home's money banner show Rs. after picking e.g. CNY/KRW. */
const SYMBOLS = {
  INR: "Rs.", USD: "$", EUR: "\u20AC", GBP: "\u00A3", JPY: "\u00A5",
  CNY: "\u00A5", AED: "AED", SAR: "SAR", AUD: "A$", CAD: "C$", SGD: "S$",
  CHF: "Fr", HKD: "HK$", NZD: "NZ$", MYR: "RM", IDR: "Rp", PHP: "\u20B1",
  THB: "\u0E3F", KRW: "\u20A9", TRY: "\u20BA", BRL: "R$", MXN: "MX$",
  ZAR: "R", NGN: "\u20A6", EGP: "\u00A3", PKR: "\u20A8", BDT: "\u09F3",
  LKR: "\u20A8", NPR: "\u20A8", SEK: "kr", NOK: "kr", DKK: "kr",
  RUB: "\u20BD", ILS: "\u20AA", KWD: "\u062F.\u0643", QAR: "\u0631.\u0642",
  OMR: "\u0631.\u0639", BHD: ".د.ب", MMK: "K", VND: "\u20AB"
};
export function getCurrencySymbol(code) {
  return SYMBOLS[code] || (code ? code : "Rs.");
}
