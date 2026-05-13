"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtUsd, fmtApy, apyRiskClass } from "@/lib/format";
import { isAuditedProtocol } from "@/lib/protocols";

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
}

type SortKey = "project" | "symbol" | "tvlUsd" | "apy";
type SortDir = "asc" | "desc";

interface Filters {
  minTvl: number;
  stableOnly: boolean;
  auditedOnly: boolean;
}

const PRESET_TVL = [
  { label: "Any", value: 0 },
  { label: "≥ $100k", value: 100_000 },
  { label: "≥ $1M", value: 1_000_000 },
  { label: "≥ $10M", value: 10_000_000 },
];

export default function YieldTable({ rows }: { rows: YieldRow[] }) {
  const [filters, setFilters] = useState<Filters>({
    minTvl: 100_000,
    stableOnly: false,
    auditedOnly: false,
  });
  const [sortKey, setSortKey] = useState<SortKey>("apy");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const view = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (r.tvlUsd < filters.minTvl) return false;
      if (filters.stableOnly && !r.stablecoin) return false;
      if (filters.auditedOnly && !isAuditedProtocol(r.project)) return false;
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
          <div className="flex overflow-hidden rounded-md border border-white/10">
            {PRESET_TVL.map((p) => (
              <button
                key={p.value}
                onClick={() =>
                  setFilters((f) => ({ ...f, minTvl: p.value }))
                }
                className={`px-2.5 py-1 text-xs transition ${
                  filters.minTvl === p.value
                    ? "bg-blue-500/20 text-blue-200"
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
          label="Audited only"
          on={filters.auditedOnly}
          onClick={() =>
            setFilters((f) => ({ ...f, auditedOnly: !f.auditedOnly }))
          }
        />
        <span className="ml-auto text-xs text-white/40">
          {view.length} of {rows.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-white/50">
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
              <th className="px-4 py-3">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {view.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-white/40"
                >
                  No pools match these filters.
                </td>
              </tr>
            ) : (
              view.map((p, i) => (
                <tr
                  key={p.pool}
                  className="transition hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 text-white/40">{i + 1}</td>
                  <td className="px-4 py-3 font-medium capitalize">
                    <Link
                      href={`/protocols/${encodeURIComponent(p.project)}`}
                      className="hover:text-blue-300"
                    >
                      {p.project.replace(/-/g, " ")}
                    </Link>
                    {isAuditedProtocol(p.project) && (
                      <span
                        title="Well-known audited protocol"
                        className="ml-2 text-xs text-emerald-400/80"
                      >
                        ✓
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white/80">
                    {p.symbol}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-white/80">
                    {fmtUsd(p.tvlUsd)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold tabular-nums ${apyRiskClass(p.apy)}`}
                  >
                    {fmtApy(p.apy)}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/60">
                    <Badge>
                      {p.stablecoin
                        ? "stable"
                        : p.exposure === "single"
                          ? "single"
                          : "LP"}
                    </Badge>
                    {p.ilRisk === "yes" && (
                      <span className="ml-1 text-amber-300/80">· IL</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
      } ${active ? "text-blue-300" : ""}`}
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
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs transition ${
        on
          ? "border-blue-500/40 bg-blue-500/15 text-blue-200"
          : "border-white/10 text-white/60 hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
      {children}
    </span>
  );
}
