import { Filters } from "@/components/Filters";
import { useFinance } from "@/context/FinanceContext";
import { formatLkr } from "@/lib/utils";
import { useMemo, useState } from "react";

const SUB_NONE = "__none__";

export function IncomeAnalysis() {
  const { filtered } = useFinance();
  const [cat, setCat] = useState<string>("all");
  const [subCategory, setSubCategory] = useState<string>("all");

  const incomeRows = useMemo(
    () =>
      filtered.filter(
        (t) => t.direction === "income" && !t.isInternalTransfer,
      ),
    [filtered],
  );

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const t of incomeRows) s.add(t.displayCategory);
    return [...s].sort();
  }, [incomeRows]);

  const subCategoryOptions = useMemo(() => {
    const s = new Set<string>();
    for (const t of incomeRows) s.add(t.subCategory || "");
    const list = [...s].filter((x) => x !== "");
    list.sort((a, b) => a.localeCompare(b));
    if (s.has("")) list.push("");
    return list;
  }, [incomeRows]);

  const visible = useMemo(() => {
    return incomeRows.filter((t) => {
      if (cat !== "all" && t.displayCategory !== cat) return false;
      if (subCategory === "all") return true;
      const target = subCategory === SUB_NONE ? "" : subCategory;
      return (t.subCategory || "") === target;
    });
  }, [incomeRows, cat, subCategory]);

  const total = visible.reduce((s, t) => s + t.amount, 0);
  const count = visible.length;
  const avg = count > 0 ? total / count : 0;

  return (
    <div className="space-y-8">
      <Filters />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Income</h2>
          <p className="text-sm text-slate-600">
            Real income only — ComBank Malabe, ComBank Peradeniya, and NTB
            transfers between your accounts are not listed here. Respects
            “Include balance adjustments”.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-[180px] flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Income category</span>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
            >
              <option value="all">All</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[180px] flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Sub-category</span>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
            >
              <option value="all">All</option>
              {subCategoryOptions.map((sc) => {
                const value = sc === "" ? SUB_NONE : sc;
                const label = sc === "" ? "(Unmapped)" : sc;
                return (
                  <option key={value} value={value}>
                    {label}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total income
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700 tabular-nums">
            {formatLkr(total)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Transactions
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{count}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Average
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
            {formatLkr(avg)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">Date</th>
                <th className="px-4 py-3 font-medium text-slate-600">Category</th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  Sub-category
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">Note</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id} className="border-b border-slate-100">
                  <td className="px-4 py-2 font-mono text-xs text-slate-700">
                    {t.date}
                  </td>
                  <td className="px-4 py-2 text-slate-800">{t.displayCategory}</td>
                  <td className="px-4 py-2 text-slate-700">
                    {t.subCategory || "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{t.note || "—"}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums text-slate-900">
                    {formatLkr(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No income rows for the current filters.
          </p>
        )}
      </div>
    </div>
  );
}
