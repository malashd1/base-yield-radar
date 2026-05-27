"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtUsd, fmtApy, apyRiskClass } from "@/lib/format";
import { isAuditedProtocol } from "@/lib/protocols";
import {
  isKnownToken,
  splitPoolSymbol,
  dexScreenerSearchUrl,
  dexScreenerTokenUrl,
  hasEthExposure,
} from "@/lib/tokens";
import { resolvePoolLink } from "@/lib/poolLinks";

export interface YieldRow {
  pool: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  predictedClass?: string | null;
  apyMean30d?: number | null;
  apyPct30D?: number | null;
  underlyingTokens?: string[] | null;
}

type SortKey = "project" | "symbol" | "tvlUsd" | "apy" | "apyMean30d";
type SortDir = "asc" | "desc";

interface Filters {
  minTvl: number;
  stableOnly: boolean;
  ethOnly: boolean;
  auditedOnly: boolean;
  hideIncentiveFarms: boolean;
  /** Hide LP (multi-asset DEX) pools — show only single-asset lending/vaults. */
  hideLpPools: boolean;
  /** Pool matches if it contains ANY of these tokens (uppercased tickers). */
  tokens: string[];
}

const PRESET_TVL = [
  { label: "Any", value: 0 },
  { label: "≥ $100k", value: 100_000 },
  { label: "≥ $1M", value: 1_000_000 },
  { label: "≥ $10M", value: 10_000_000 },
];

// APY above this threshold is almost certainly emission-driven and will decay.
const INCENTIVE_APY_THRESHOLD = 500;
// Reward APY must dominate base by this multiple to count as an incentive farm.
const REWARD_TO_BASE_RATIO = 3;

/** True if the pool's APY is dominated by token emissions (incentive farm). */
function isIncentivePool(row: { apy: number | null; apyBase: number | null; apyReward: number | null }): boolean {
  if (row.apy == null) return false;
  if (row.apy >= INCENTIVE_APY_THRESHOLD) return true;
  const base = row.apyBase ?? 0;
  const reward = row.apyReward ?? 0;
  // If we have a real reward number much larger than base, it's emission-driven.
  if (reward > 0 && reward > base * REWARD_TO_BASE_RATIO) return true;
  return false;
}

/**
 * Protocol name link. Resolves to:
 *   - our /stake page when we support this vault (earns the 0x swap fee)
 *   - the protocol's own deposit/markets page when we have a deep link
 *   - DeFiLlama as a safe fallback
 *
 * The arrow icon hints at the destination: ↗ for external, → for our own page.
 * Declared before YieldTable for Turbopack hoisting reasons (see TokenSearch).
 */
function ProtocolLink({ row: p }: { row: YieldRow }) {
  const link = resolvePoolLink({
    project: p.project,
    pool: p.pool,
    symbol: p.symbol,
    underlyingTokens: p.underlyingTokens,
  });
  const arrow = link.external ? "↗" : "→";
  const tooltip =
    link.kind === "stake"
      ? "Stake on this site (1-click swap & deposit)"
      : link.kind === "protocol"
        ? `Open on ${p.project.replace(/-/g, " ")}`
        : "Open this pool on DeFiLlama";
  return (
    <>
      <a
        href={link.href}
        target={link.external ? "_blank" : undefined}
        rel={link.external ? "noreferrer noopener" : undefined}
        title={tooltip}
        className={`hover:text-[#5bd8ff] ${link.kind === "stake" ? "text-[#5bd8ff]" : ""}`}
      >
        {p.project.replace(/-/g, " ")}
        <span className="ml-1 text-[10px] opacity-50">{arrow}</span>
      </a>
      {isAuditedProtocol(p.project) && (
        <span
          title="Well-known audited protocol"
          className="ml-2 text-xs text-emerald-400/80"
        >
          ✓
        </span>
      )}
    </>
  );
}

/**
 * Multi-select token filter with type-ahead search. Pool matches if it contains
 * ANY of the selected tokens — picking USDC + cbETH shows pools with either
 * (not both), which is what users actually want when curating watchlists.
 *
 * Declared before YieldTable because Turbopack's SSR pipeline doesn't reliably
 * hoist sibling function declarations in client components.
 */
function TokenSearch({
  allTokens,
  selected,
  onChange,
}: {
  allTokens: string[];
  selected: string[];
  onChange: (tokens: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toUpperCase();
    const selectedSet = new Set(selected);
    const pool = allTokens.filter((t) => !selectedSet.has(t));
    if (!q) return pool.slice(0, 30);
    const prefix: string[] = [];
    const contains: string[] = [];
    for (const t of pool) {
      if (t.startsWith(q)) prefix.push(t);
      else if (t.includes(q)) contains.push(t);
    }
    return [...prefix, ...contains].slice(0, 30);
  }, [allTokens, query, selected]);

  function add(t: string) {
    onChange([...selected, t]);
    setQuery("");
    inputRef.current?.focus();
  }
  function remove(t: string) {
    onChange(selected.filter((x) => x !== t));
  }

  return (
    <div className="relative" ref={wrapRef}>
      <div
        className={`flex flex-wrap items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
          open || selected.length > 0
            ? "border-[#5bd8ff]/40 bg-[#5bd8ff]/[0.06]"
            : "border-white/10 hover:bg-white/5"
        }`}
      >
        {selected.map((t) => (
          <button
            key={t}
            onClick={() => remove(t)}
            className="inline-flex items-center gap-1 rounded-full bg-[#5bd8ff]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#5bd8ff] hover:bg-[#5bd8ff]/30"
            title={`Remove ${t}`}
          >
            {t}
            <span className="text-[9px] opacity-70">×</span>
          </button>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches.length > 0) {
              add(matches[0]);
            } else if (
              e.key === "Backspace" &&
              query === "" &&
              selected.length > 0
            ) {
              remove(selected[selected.length - 1]);
            }
          }}
          placeholder={selected.length === 0 ? "Filter by token…" : ""}
          className="min-w-[80px] flex-1 bg-transparent px-1 py-0.5 text-xs text-white/90 placeholder:text-white/40 focus:outline-none"
        />
      </div>
      {open && matches.length > 0 && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-40 max-h-72 w-64 overflow-y-auto rounded-xl border border-white/10 bg-[#0c0f17]/97 p-1 shadow-2xl backdrop-blur-xl">
          {matches.map((t) => (
            <button
              key={t}
              onMouseDown={(e) => {
                e.preventDefault();
                add(t);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs text-white/85 transition hover:bg-white/[0.06]"
            >
              <span className="font-mono">{t}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function YieldTable({ rows }: { rows: YieldRow[] }) {
  const [filters, setFilters] = useState<Filters>({
    minTvl: 100_000,
    stableOnly: false,
    ethOnly: false,
    auditedOnly: false,
    hideIncentiveFarms: true,
    hideLpPools: false,
    tokens: [],
  });
  const [sortKey, setSortKey] = useState<SortKey>("apy");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  /** Sorted list of every ticker appearing in the dataset — used by the token
   *  search dropdown. Memoized so we don't re-scan on every keystroke. */
  const allTokens = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      for (const t of splitPoolSymbol(r.symbol)) {
        set.add(t.toUpperCase());
      }
    }
    return Array.from(set).sort();
  }, [rows]);

  const view = useMemo(() => {
    const tokenSet = new Set(filters.tokens.map((t) => t.toUpperCase()));
    const filtered = rows.filter((r) => {
      if (r.tvlUsd < filters.minTvl) return false;
      if (filters.stableOnly && !r.stablecoin) return false;
      if (filters.ethOnly && !hasEthExposure(r.symbol)) return false;
      if (filters.auditedOnly && !isAuditedProtocol(r.project)) return false;
      if (filters.hideIncentiveFarms && isIncentivePool(r)) return false;
      if (filters.hideLpPools && r.exposure === "multi") return false;
      if (tokenSet.size > 0) {
        const poolTokens = splitPoolSymbol(r.symbol).map((t) =>
          t.toUpperCase(),
        );
        if (!poolTokens.some((t) => tokenSet.has(t))) return false;
      }
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      const av = pick(a, sortKey);
      const bv = pick(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return sorted;
  }, [rows, filters, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "project" || key === "symbol" ? "asc" : "desc");
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-white/50">TVL</span>
          <div className="flex overflow-hidden rounded-full border border-white/10">
            {PRESET_TVL.map((p) => (
              <button
                key={p.value}
                onClick={() =>
                  setFilters((f) => ({ ...f, minTvl: p.value }))
                }
                className={`px-3 py-1 text-xs transition ${
                  filters.minTvl === p.value
                    ? "bg-[#5bd8ff]/15 text-[#5bd8ff]"
                    : "text-white/60 hover:bg-white/5"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <ToggleChip
          label="Stable only"
          on={filters.stableOnly}
          onClick={() =>
            setFilters((f) => ({ ...f, stableOnly: !f.stableOnly }))
          }
        />
        <ToggleChip
          label="ETH only"
          title="Pools containing ETH, WETH or any LST/LRT (wstETH, rETH, cbETH, weETH…)"
          on={filters.ethOnly}
          onClick={() => setFilters((f) => ({ ...f, ethOnly: !f.ethOnly }))}
        />
        <ToggleChip
          label="Audited only"
          on={filters.auditedOnly}
          onClick={() =>
            setFilters((f) => ({ ...f, auditedOnly: !f.auditedOnly }))
          }
        />
        <ToggleChip
          label="Hide incentive farms"
          title="Hides pools where APY is emission-driven (≥ 500% total or rewards > 3× base)"
          on={filters.hideIncentiveFarms}
          onClick={() =>
            setFilters((f) => ({
              ...f,
              hideIncentiveFarms: !f.hideIncentiveFarms,
            }))
          }
        />
        <ToggleChip
          label="No LPs"
          title="Hide LP / AMM pools — show only single-asset lending markets and vaults"
          on={filters.hideLpPools}
          onClick={() =>
            setFilters((f) => ({ ...f, hideLpPools: !f.hideLpPools }))
          }
        />
        <TokenSearch
          allTokens={allTokens}
          selected={filters.tokens}
          onChange={(tokens) => setFilters((f) => ({ ...f, tokens }))}
        />
        <span className="ml-auto text-xs text-white/40">
          {view.length} of {rows.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.015]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-white/45">
            <tr>
              <th className="px-4 py-3 w-10">#</th>
              <SortHeader
                label="Protocol"
                active={sortKey === "project"}
                dir={sortDir}
                onClick={() => toggleSort("project")}
              />
              <SortHeader
                label="Pool"
                active={sortKey === "symbol"}
                dir={sortDir}
                onClick={() => toggleSort("symbol")}
              />
              <SortHeader
                label="TVL"
                align="right"
                active={sortKey === "tvlUsd"}
                dir={sortDir}
                onClick={() => toggleSort("tvlUsd")}
              />
              <SortHeader
                label="APY"
                align="right"
                active={sortKey === "apy"}
                dir={sortDir}
                onClick={() => toggleSort("apy")}
              />
              <SortHeader
                label="30d avg"
                align="right"
                active={sortKey === "apyMean30d"}
                dir={sortDir}
                onClick={() => toggleSort("apyMean30d")}
              />
              <th className="px-4 py-3">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {view.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-white/40"
                >
                  No pools match these filters.
                </td>
              </tr>
            ) : (
              view.map((p, i) => <Row key={p.pool} row={p} idx={i} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ row: p, idx: i }: { row: YieldRow; idx: number }) {
  return (
    <tr className="transition hover:bg-white/[0.025]">
      <td className="px-4 py-3 text-white/35 tabular-nums">{i + 1}</td>
      <td className="px-4 py-3 font-medium capitalize">
        <ProtocolLink row={p} />
      </td>
      <td className="px-4 py-3 font-mono text-xs text-white/80">
        <PoolSymbol symbol={p.symbol} addresses={p.underlyingTokens ?? null} />
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-white/80">
        {fmtUsd(p.tvlUsd)}
      </td>
      <td
        className={`px-4 py-3 text-right font-semibold tabular-nums ${apyRiskClass(p.apy)}`}
      >
        <ApyCell row={p} />
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        <Mean30dCell row={p} />
      </td>
      <td className="px-4 py-3 text-xs text-white/55">
        <div className="flex flex-wrap items-center gap-1">
          <Badge>
            {p.stablecoin
              ? "stable"
              : p.exposure === "single"
                ? "single"
                : "LP"}
          </Badge>
          {p.ilRisk === "yes" && (
            <Badge tone="warn" title="Impermanent loss risk">IL</Badge>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * Pool symbol rendered with each ticker as a chip. Unknown tokens get a ↗ link
 * to DexScreener. When the pool's underlyingTokens array is available (it almost
 * always is from DeFiLlama, in the same order as the symbol), we link directly
 * to the token's contract page on Base — so the user lands on the exact token
 * and can't pick a wrong-ticker scam from search results.
 */
function PoolSymbol({
  symbol,
  addresses,
}: {
  symbol: string;
  addresses: string[] | null;
}) {
  const tokens = splitPoolSymbol(symbol);
  if (tokens.length === 0) return <span>{symbol}</span>;

  // Address mapping is positional. We only trust it when the array length matches
  // the ticker count — otherwise fall back to symbol search to avoid pointing at
  // the wrong contract.
  const useAddresses =
    addresses != null && addresses.length === tokens.length;

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {tokens.map((t, i) => {
        const known = isKnownToken(t);
        const addr = useAddresses ? addresses![i] : null;
        const href = addr
          ? dexScreenerTokenUrl(addr)
          : dexScreenerSearchUrl(t);
        const titleSuffix = addr ? "by contract address" : "by ticker search";
        return (
          <span key={`${t}-${i}`} className="inline-flex items-center">
            {known ? (
              <span className="text-white/80">{t}</span>
            ) : (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                title={`Research ${t} on DexScreener (${titleSuffix})`}
                className="inline-flex items-center gap-0.5 rounded border border-amber-400/20 bg-amber-400/[0.06] px-1 text-amber-200/90 transition hover:border-amber-400/40 hover:bg-amber-400/[0.12] hover:text-amber-100"
                onClick={(e) => e.stopPropagation()}
              >
                {t}
                <span className="text-[9px] opacity-60">↗</span>
              </a>
            )}
            {i < tokens.length - 1 && (
              <span className="mx-0.5 text-white/30">/</span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/**
 * 30-day average APY. Just the value — the spike/decay delta lives next to the
 * current APY in the APY column, so direction-of-comparison is unambiguous.
 */
function Mean30dCell({ row: p }: { row: YieldRow }) {
  if (p.apyMean30d == null) {
    return <span className="text-white/30">—</span>;
  }
  return <span className="text-white/70">{fmtApy(p.apyMean30d)}</span>;
}

/**
 * Delta of current APY vs 30-day average: positive = current is HIGHER than 30d
 * (spike, often emission-driven), negative = current is LOWER (decay).
 */
function apyVs30dDelta(row: YieldRow): number | null {
  if (row.apy == null || row.apyMean30d == null || row.apyMean30d <= 0)
    return null;
  return ((row.apy - row.apyMean30d) / row.apyMean30d) * 100;
}

/**
 * APY cell with click-to-reveal breakdown. For incentive-heavy pools (apyReward ≫
 * apyBase or extreme totals) we show a warning chip below the number — high APYs
 * here are almost always emission-driven and decay quickly as TVL grows.
 */
function ApyCell({ row: p }: { row: YieldRow }) {
  const base = p.apyBase ?? 0;
  const reward = p.apyReward ?? 0;
  const isIncentive = isIncentivePool(p);
  const isDecaying = p.predictedClass === "Down";
  const isRising = p.predictedClass === "Stable/Up";

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const totalKnown = base + reward;
  const basePct = totalKnown > 0 ? (base / totalKnown) * 100 : 0;
  const rewardPct = totalKnown > 0 ? (reward / totalKnown) * 100 : 0;

  const delta = apyVs30dDelta(p);
  // Color convention: + green (current rising vs 30d), − red (current falling).
  const deltaClass =
    delta == null
      ? "text-white/40"
      : delta > 20
        ? "text-emerald-300"
        : delta < -20
          ? "text-rose-300"
          : "text-white/40";

  return (
    <div className="relative flex flex-col items-end gap-0.5" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="group flex items-center gap-1 rounded px-1 -mx-1 hover:bg-white/[0.04] focus:bg-white/[0.04] focus:outline-none"
        aria-expanded={open}
        aria-label="Show APY breakdown"
      >
        <span>{fmtApy(p.apy)}</span>
        <span
          className={`text-[10px] leading-none text-white/30 transition group-hover:text-white/60 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {delta != null && Math.abs(delta) >= 5 && (
        <span
          className={`text-[10px] tabular-nums ${deltaClass}`}
          title="Current APY vs 30-day average"
        >
          {delta > 0 ? "+" : ""}
          {delta.toFixed(0)}% vs 30d
        </span>
      )}
      {isIncentive && !open && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-300 hover:bg-amber-400/20"
        >
          ⚠ incentive
        </button>
      )}
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-72 rounded-xl border border-white/10 bg-[#0c0f17]/97 p-3 text-left text-xs shadow-2xl backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-white/40">
              APY breakdown
            </span>
            <span className={`tabular-nums font-semibold ${apyRiskClass(p.apy)}`}>
              {fmtApy(p.apy)}
            </span>
          </div>

          {/* Stacked base/rewards bar */}
          {totalKnown > 0 && (
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div className="flex h-full w-full">
                <div
                  className="h-full bg-emerald-400/80"
                  style={{ width: `${basePct}%` }}
                />
                <div
                  className="h-full bg-amber-400/80"
                  style={{ width: `${rewardPct}%` }}
                />
              </div>
            </div>
          )}

          <dl className="space-y-1.5 text-white/80">
            <Line
              dot="bg-emerald-400/80"
              label="Trading fees (base)"
              value={p.apyBase != null ? `${p.apyBase.toFixed(2)}%` : "n/a"}
            />
            <Line
              dot="bg-amber-400/80"
              label="Token rewards"
              value={p.apyReward != null ? `${p.apyReward.toFixed(2)}%` : "n/a"}
            />
            {p.apyMean30d != null && (
              <Line
                dot="bg-white/30"
                label="30-day average"
                value={`${p.apyMean30d.toFixed(2)}%`}
              />
            )}
          </dl>

          {(isIncentive || isDecaying || isRising || p.ilRisk === "yes") && (
            <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3 text-white/70">
              {isIncentive && (
                <p className="leading-relaxed">
                  <span className="text-amber-300">⚠</span> Yield is almost
                  entirely emissions. Expect APY to decay sharply as more TVL
                  enters the pool.
                </p>
              )}
              {isDecaying && (
                <p className="leading-relaxed">
                  <span className="text-rose-300">↓</span> DeFiLlama predicts
                  this APY is declining.
                </p>
              )}
              {isRising && (
                <p className="leading-relaxed">
                  <span className="text-emerald-300">↑</span> DeFiLlama predicts
                  this yield is stable/rising.
                </p>
              )}
              {p.ilRisk === "yes" && (
                <p className="leading-relaxed">
                  <span className="text-amber-300">⚠</span> Impermanent loss
                  risk — LP value can lag holding the underlying tokens.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Line({
  dot,
  label,
  value,
}: {
  dot: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-white/60">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="font-mono tabular-nums text-white/90">{value}</span>
    </div>
  );
}

function pick(r: YieldRow, k: SortKey): number | string | null {
  switch (k) {
    case "project":
      return r.project;
    case "symbol":
      return r.symbol;
    case "tvlUsd":
      return r.tvlUsd;
    case "apy":
      return r.apy;
    case "apyMean30d":
      return r.apyMean30d ?? null;
  }
}

function SortHeader({
  label,
  active,
  dir,
  align,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  align?: "right";
  onClick: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none px-4 py-3 transition hover:text-white ${
        align === "right" ? "text-right" : ""
      } ${active ? "text-[#5bd8ff]" : ""}`}
    >
      {label}
      {active && (
        <span className="ml-1 text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>
      )}
    </th>
  );
}

function ToggleChip({
  label,
  on,
  onClick,
  title,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        on
          ? "border-[#5bd8ff]/40 bg-[#5bd8ff]/10 text-[#5bd8ff]"
          : "border-white/10 text-white/60 hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warn";
  title?: string;
}) {
  const cls =
    tone === "warn"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
      : "border-white/10 bg-white/5 text-white/70";
  return (
    <span
      title={title}
      className={`rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${cls}`}
    >
      {children}
    </span>
  );
}
