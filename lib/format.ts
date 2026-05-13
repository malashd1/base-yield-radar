/** Pretty number formatters used across the UI. */

const COMPACT = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const PERCENT = new Intl.NumberFormat("en", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return "$" + COMPACT.format(n);
}

export function fmtApy(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return `${COMPACT.format(n)}%`;
  return `${PERCENT.format(n)}%`;
}

/** Heuristic risk class for color-coding APY cells. */
export function apyRiskClass(apy: number | null | undefined): string {
  if (apy == null) return "text-white/50";
  if (apy < 5) return "text-white/80";
  if (apy < 20) return "text-emerald-300";
  if (apy < 100) return "text-amber-300";
  return "text-rose-400";
}
