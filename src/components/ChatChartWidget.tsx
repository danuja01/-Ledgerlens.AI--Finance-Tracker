import type { ChatChartSpec } from "@/lib/openaiChat";
import { formatLkr } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SLICE_COLORS = [
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

type Props = {
  spec: ChatChartSpec;
};

export function ChatChartWidget({ spec }: Props) {
  const data = spec.data;

  return (
    <div className="mt-3 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2 sm:px-4">
        <p className="text-sm font-semibold leading-snug text-slate-900">{spec.title}</p>
        {spec.subtitle && (
          <p className="text-xs text-slate-500">{spec.subtitle}</p>
        )}
      </div>
      <div className="p-2 sm:p-4">
        {spec.kind === "pie" ? (
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
                  contentStyle={{
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
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
                  tickFormatter={(v) =>
                    v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}k`
                  }
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
                    <Cell
                      key={i}
                      fill={SLICE_COLORS[i % SLICE_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
