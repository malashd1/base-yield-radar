"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

export interface SparklinePoint {
  timestamp: string | number; // ISO date string or epoch ms
  value: number | null;
}

interface SparklineProps {
  data: SparklinePoint[];
  height?: number;
  /** Tailwind-friendly color override. Default Base blue. */
  color?: string;
  /** Hide tooltip (small inline use). Default true (interactive). */
  interactive?: boolean;
  /** Format the tooltip value (e.g. "12.34%"). */
  formatValue?: (v: number) => string;
}

export default function Sparkline({
  data,
  height = 80,
  color = "#3b82f6",
  interactive = true,
  formatValue = (v) => v.toFixed(2),
}: SparklineProps) {
  // Normalize: drop nulls, sort by timestamp ascending. recharts handles gaps if we pass nulls,
  // but for a sparkline a clean monotonic line reads better.
  const clean = data
    .filter((d) => d.value != null && Number.isFinite(d.value))
    .map((d) => ({
      ts:
        typeof d.timestamp === "number"
          ? d.timestamp
          : Date.parse(d.timestamp),
      value: d.value as number,
    }))
    .sort((a, b) => a.ts - b.ts);

  if (clean.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs text-white/30"
        style={{ height }}
      >
        not enough data
      </div>
    );
  }

  const gradientId = `spark-grad-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <AreaChart
          data={clean}
          margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["auto", "auto"]} />
          {interactive && (
            <Tooltip
              cursor={{
                stroke: "rgba(255,255,255,0.2)",
                strokeWidth: 1,
              }}
              contentStyle={{
                background: "#0a0a0a",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                fontSize: 12,
                padding: "6px 8px",
              }}
              labelFormatter={(ts) =>
                new Date(ts as number).toLocaleDateString()
              }
              formatter={(v) => [formatValue(v as number), "value"]}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
