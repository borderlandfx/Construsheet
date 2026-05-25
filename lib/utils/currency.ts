export type Currency = "USD" | "MXN";

// ─── Rates (vs. 1 USD) ───────────────────────────────────────────────────────

/** MXN per 1 USD */
export const MXN_RATE = 17.15;

// ─── Conversion helpers ───────────────────────────────────────────────────────

/** Convert a USD-denominated amount to the display currency */
export function toDisplay(usd: number, currency: Currency): number {
  if (currency === "MXN") return usd * MXN_RATE;
  return usd;
}

/** Convert a display-currency amount back to USD */
export function toUSD(displayValue: number, currency: Currency): number {
  if (currency === "MXN") return displayValue / MXN_RATE;
  return displayValue;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

/**
 * Format a USD value in the chosen display currency.
 *   fmt(1234.56, "USD")  → "$1,234.56"
 *   fmt(1234.56, "MXN")  → "MX$21,172.57"
 */
export function fmt(usd: number, currency: Currency): string {
  const amount = toDisplay(usd, currency);
  const decimals = 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Format a value that is *already* in the target currency (no conversion).
 * Used for values stored in the project's native currency.
 */
export function formatCurrency(amount: number, currency: Currency): string {
  const decimals = 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/** Compact variant — e.g. "$1.2K", "MX$21.2K" */
export function formatCurrencyCompact(amount: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

/**
 * @deprecated Use `toDisplay` + `fmt` instead.
 * Convert between two currencies using the fixed rates.
 */
export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency
): number {
  if (from === to) return amount;
  const usd = toUSD(amount, from);
  return toDisplay(usd, to);
}
