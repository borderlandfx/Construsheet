export type Currency = "USD" | "MXN";

// ─── Rate ─────────────────────────────────────────────────────────────────────

/** MXN per 1 USD — update periodically or replace with a live rate */
export const MXN_RATE = 17.15;

// ─── Conversion helpers ───────────────────────────────────────────────────────

/** Convert a USD-denominated amount to the display currency */
export function toDisplay(usd: number, currency: Currency): number {
  return currency === "MXN" ? usd * MXN_RATE : usd;
}

/** Convert a display-currency amount back to USD */
export function toUSD(displayValue: number, currency: Currency): number {
  return currency === "MXN" ? displayValue / MXN_RATE : displayValue;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

/**
 * Format a USD value in the chosen display currency.
 *   fmt(1234.56, "USD")  → "$1,234.56"
 *   fmt(1234.56, "MXN")  → "MX$21,172.57"
 *
 * Always uses the en-US locale so that:
 *   - USD renders as  "$…"
 *   - MXN renders as  "MX$…"
 */
export function fmt(usd: number, currency: Currency): string {
  const amount = toDisplay(usd, currency);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a value that is *already* in the target currency (no conversion).
 * Used for values stored in the project's native currency.
 */
export function formatCurrency(amount: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
 * Convert between two currencies using the fixed MXN_RATE.
 */
export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency
): number {
  if (from === to) return amount;
  // Normalise to USD first, then to target
  const usd = from === "MXN" ? amount / MXN_RATE : amount;
  return to === "MXN" ? usd * MXN_RATE : usd;
}
