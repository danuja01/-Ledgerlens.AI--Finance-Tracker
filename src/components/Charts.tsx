import type { Analytics } from "@/types";
import { formatLkr } from "@/lib/utils";
import {
  Area,
  AreaChart,
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

const PIE_COLORS = [
  "#0f172a",
  "#1d4ed8",
  "#047857",
  "#b45309",
  "#be123c",
  "#6d28d9",
  "#0e7490",
  "#a16207",
];

export function Charts({ analytics }: { analytics: Analytics }) {
  const cashflowTitle =
    analytics.analyticsPeriodMode === "calendar"
      ? "Cashflow by calendar month"
      : "Cashflow by salary cycle";
  const cashflowSub =
    analytics.analyticsPeriodMode === "calendar"
      ? "Income vs expenses by calendar month (transaction date)"
      : "Income vs expenses per 23rd–22nd cycle";

  const dayTitle =
    analytics.dayChartKind === "calendar"
      ? "Spending by calendar day"
      : "Spending by salary-cycle day";
  const daySub =
    analytics.dayChartKind === "calendar"
      ? "Day of month (1–31)"
      : "Day 1 = cycle start (23rd)";

  const pieData = (() => {
    const rows = analytics.byCategory.slice(0, 8);
    const rest = analytics.byCategory.slice(8);
    const other = rest.reduce((s, r) => s + r.total, 0);
    const out = rows.map((r) => ({ name: r.displayName, value: r.total }));
    if (other > 0) out.push({ name: "Other", value: other });
    return out.filter((d) => d.value > 0);
  })();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
        <h3 className="text-sm font-semibold text-slate-900">{cashflowTitle}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{cashflowSub}</p>
        <div className="mt-4 h-64">
          {analytics.monthlySeries.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-slate-500">
              No data for cashflow in this period.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="#64748b"
                  tickFormatter={(v) =>
                    v >= 1e6
                      ? `${(v / 1e6).toFixed(1)}M`
                      : `${Math.round(v / 1000)}k`
                  }
                />
                <Tooltip
                  formatter={(v: number) => formatLkr(v)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="Income"
                  stroke="#047857"
                  fill="#6ee7b7"
                  fillOpacity={0.35}
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="Expenses"
                  stroke="#be123c"
                  fill="#fda4af"
                  fillOpacity={0.35}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
        <h3 className="text-sm font-semibold text-slate-900">
          Spending by category
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">Expense totals in period</p>
        <div className="mt-4 h-64">
          {pieData.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-slate-500">
              No expense categories in this period.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatLkr(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
        <h3 className="text-sm font-semibold text-slate-900">
          Spending by weekday
        </h3>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.byWeekday}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" hide />
              <Tooltip formatter={(v: number) => formatLkr(v)} />
              <Bar dataKey="total" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
        <h3 className="text-sm font-semibold text-slate-900">{dayTitle}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{daySub}</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.byCycleDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 9 }}
                stroke="#64748b"
                interval={2}
              />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" hide />
              <Tooltip formatter={(v: number) => formatLkr(v)} />
              <Bar dataKey="total" fill="#0f766e" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
