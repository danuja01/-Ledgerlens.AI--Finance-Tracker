import type { ChatChartBreakdownSpec, ChatChartSpec, ChatChartTrendSpec } from "@/lib/openaiChat";
import { formatLkr } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const SLICE_COLORS = [
  "#0f766e",
  "#0369a1",
  "#5b21b6",
  "#9d174d",
  "#b45309",
  "#15803d",
  "#1d4ed8",
  "#7c3aed",
  "#c026d3",
  "#ea580c",
  "#0d9488",
  "#0284c7",
  "#a855f7",
  "#be123c",
  "#4f46e5",
];

/** Fixed palette for cashflow chart (income=green, expense=red, net=blue) */
const CASHFLOW_COLORS: Record<string, string> = {
  income: "#15803d",
  expense: "#dc2626",
  net: "#0369a1",
};

function tickFmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(Math.round(v));
}

function seriesColor(key: string, idx: number): string {
  return CASHFLOW_COLORS[key] ?? SLICE_COLORS[idx % SLICE_COLORS.length];
}

/* ─────────────────────────────────────────────────────────────────────
   Breakdown chart (pie / horizontal bar)
───────────────────────────────────────────────────────────────────── */
function BreakdownView({ spec }: { spec: ChatChartBreakdownSpec }) {
  const { data } = spec;
  return spec.kind === "pie" ? (
    <div className="h-[min(320px,50dvh)] w-full min-h-[220px] sm:min-h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={110}
            paddingAngle={1}
            label={({ percent }) =>
              percent != null ? `${(percent * 100).toFixed(0)}%` : ""
            }
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={SLICE_COLORS[i % SLICE_COLORS.length]}
                stroke="#fff"
                strokeWidth={1}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => formatLkr(value)}
            contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px" }}
            formatter={(value) =>
              value.length > 28 ? `${value.slice(0, 26)}…` : value
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  ) : (
    <div className="h-[min(360px,55dvh)] w-full min-h-[240px] sm:min-h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
          <XAxis
            type="number"
            tickFormatter={tickFmt}
            className="text-[10px]"
          />
          <YAxis
            type="category"
            dataKey="name"
            width={132}
            tick={{ fontSize: 10 }}
            tickFormatter={(v: string) =>
              v.length > 22 ? `${v.slice(0, 20)}…` : v
            }
          />
          <Tooltip
            formatter={(value: number) => formatLkr(value)}
            contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Trend chart — line or grouped vertical bars
───────────────────────────────────────────────────────────────────── */
function TrendView({ spec }: { spec: ChatChartTrendSpec & { kind: "line" | "trend_bar" } }) {
  const { data, series } = spec;
  const isLine = spec.kind === "line";
  const multiSeries = series.length > 1;

  return (
    <div className="h-[min(340px,52dvh)] w-full min-h-[220px] sm:min-h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        {isLine ? (
          <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={tickFmt}
              width={52}
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              formatter={(value: number) => formatLkr(value)}
              contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
            />
            {multiSeries && <Legend wrapperStyle={{ fontSize: "11px" }} />}
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={seriesColor(s.key, i)}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={tickFmt}
              width={52}
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              formatter={(value: number) => formatLkr(value)}
              contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
            />
            {multiSeries && <Legend wrapperStyle={{ fontSize: "11px" }} />}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={seriesColor(s.key, i)}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Cashflow chart — grouped income/expense bars + net line
───────────────────────────────────────────────────────────────────── */
function CashflowView({ spec }: { spec: ChatChartTrendSpec & { kind: "cashflow" } }) {
  const { data } = spec;
  return (
    <div className="h-[min(340px,52dvh)] w-full min-h-[220px] sm:min-h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={tickFmt}
            width={52}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            formatter={(value: number) => formatLkr(value)}
            contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
          />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
          <Bar
            dataKey="income"
            name="Income"
            fill={CASHFLOW_COLORS.income}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="expense"
            name="Expenses"
            fill={CASHFLOW_COLORS.expense}
            radius={[4, 4, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="net"
            name="Net"
            stroke={CASHFLOW_COLORS.net}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Main widget wrapper
───────────────────────────────────────────────────────────────────── */
type Props = {
  spec: ChatChartSpec;
};

export function ChatChartWidget({ spec }: Props) {
  return (
    <div className="mt-3 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2 sm:px-4">
        <p className="text-sm font-semibold leading-snug text-slate-900">
          {spec.title}
        </p>
        {spec.subtitle && (
          <p className="text-xs text-slate-500">{spec.subtitle}</p>
        )}
      </div>
      <div className="p-2 sm:p-4">
        {spec.kind === "pie" || spec.kind === "bar" ? (
          <BreakdownView spec={spec} />
        ) : spec.kind === "cashflow" ? (
          <CashflowView spec={spec as ChatChartTrendSpec & { kind: "cashflow" }} />
        ) : (
          <TrendView spec={spec as ChatChartTrendSpec & { kind: "line" | "trend_bar" }} />
        )}
      </div>
    </div>
  );
}
