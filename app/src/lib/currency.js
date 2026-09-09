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
export function getCurrencySymbol(code) {
  const symbols = {
    INR: "Rs.", USD: "$", EUR: "\u20AC", GBP: "\u00A3", JPY: "\u00A5",
    AED: "AED", SAR: "SAR", AUD: "A$", CAD: "C$", SGD: "S$",
    PKR: "\u20A8", BDT: "\u09F3", NGN: "\u20A6", BRL: "R$", TRY: "\u20BA"
  };
  return symbols[code] || "Rs.";
}
