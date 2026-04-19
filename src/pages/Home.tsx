import { Charts } from "@/components/Charts";
import { Filters } from "@/components/Filters";
import { useFinance } from "@/context/FinanceContext";
import { formatLkr, formatPct } from "@/lib/utils";

export function Home() {
  const { analytics, filters } = useFinance();

  const kpis = [
    {
      label: "Total income",
      value: formatLkr(analytics.totalIncome),
      hint: "Excludes balance rows & bank-to-bank transfers",
      tone: "text-emerald-700",
    },
    {
      label: "Total expenses",
      value: formatLkr(analytics.totalExpense),
      hint: "Excludes balance rows & bank-to-bank transfers",
      tone: "text-rose-700",
    },
    {
      label: "Net cashflow",
      value: formatLkr(analytics.netCashflow),
      hint: "Income − expenses",
      tone: "text-blue-800",
    },
    {
      label: "Savings rate",
      value: formatPct(analytics.savingsRate),
      hint: "Net ÷ income",
      tone: "text-slate-800",
    },
    {
      label: "Data coverage",
      value: `${analytics.trackedCalendarMonths} mo · ${analytics.trackedSalaryCycles} cycles`,
      hint: "Calendar months & salary cycles with data",
      tone: "text-slate-800",
    },
  ];

  return (
    <div className="space-y-8">
      <Filters />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {k.label}
            </p>
            <p className={`mt-2 text-2xl font-semibold tabular-nums ${k.tone}`}>
              {k.value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{k.hint}</p>
          </div>
        ))}
      </div>
      {!filters.includeExcluded && analytics.excludedCount > 0 && (
        <p className="text-sm text-slate-600">
          {analytics.excludedCount} transaction
          {analytics.excludedCount === 1 ? "" : "s"} hidden (balance
          adjustments). Enable “Include balance adjustments” to show them.
        </p>
      )}
      {analytics.internalTransferCount > 0 && (
        <p className="text-sm text-slate-600">
          {analytics.internalTransferCount} inter-account transfer
          {analytics.internalTransferCount === 1 ? "" : "s"} (ComBank Malabe,
          ComBank Peradeniya, NTB) omitted from income and expense totals.
        </p>
      )}
      <Charts analytics={analytics} />
    </div>
  );
}
