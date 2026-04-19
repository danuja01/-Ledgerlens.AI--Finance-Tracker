import { CategoryDrill } from "@/components/CategoryDrill";
import { Filters } from "@/components/Filters";
import { useFinance } from "@/context/FinanceContext";
import { buildExpenseCategoryBreakdown, countsForCashflow } from "@/lib/finance";
import { formatLkr } from "@/lib/utils";
import type { CategoryBreakdown } from "@/types";
import { useEffect, useMemo, useState } from "react";

type SortMode = "amount" | "frequency";

const SUB_NONE = "__none__";

export function ExpenseAnalysis() {
  const { filtered } = useFinance();
  const [sort, setSort] = useState<SortMode>("amount");
  const [selected, setSelected] = useState<CategoryBreakdown | null>(null);
  const [subCategory, setSubCategory] = useState<string>("all");

  const expenseBase = useMemo(
    () =>
      filtered.filter(
        (t) => t.direction === "expense" && countsForCashflow(t),
      ),
    [filtered],
  );

  const subCategoryOptions = useMemo(() => {
    const s = new Set<string>();
    for (const t of expenseBase) s.add(t.subCategory || "");
    const list = [...s].filter((x) => x !== "");
    list.sort((a, b) => a.localeCompare(b));
    if (s.has("")) list.push("");
    return list;
  }, [expenseBase]);

  const expenseFiltered = useMemo(() => {
    if (subCategory === "all") return expenseBase;
    const target = subCategory === SUB_NONE ? "" : subCategory;
    return expenseBase.filter((t) => (t.subCategory || "") === target);
  }, [expenseBase, subCategory]);

  const byCategoryFiltered = useMemo(
    () => buildExpenseCategoryBreakdown(expenseFiltered),
    [expenseFiltered],
  );

  useEffect(() => {
    setSelected(null);
  }, [subCategory, filtered]);

  const rows = useMemo(() => {
    const list = [...byCategoryFiltered];
    if (sort === "amount") {
      list.sort((a, b) => b.total - a.total);
    } else {
      list.sort((a, b) => b.count - a.count);
    }
    return list;
  }, [byCategoryFiltered, sort]);

  return (
    <div className="space-y-8">
      <Filters />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">By category</h2>
            <p className="text-sm text-slate-600">
              Click a row to see every transaction in that category. Filter by
              sub-category (e.g. Barista) to focus one merchant or label.
            </p>
          </div>
          <label className="flex min-w-[200px] flex-col gap-1 text-sm sm:max-w-xs">
            <span className="font-medium text-slate-700">Sub-category</span>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
            >
              <option value="all">All sub-categories</option>
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSort("amount")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              sort === "amount"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Sort by amount
          </button>
          <button
            type="button"
            onClick={() => setSort("frequency")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              sort === "frequency"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Sort by frequency
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Category</th>
              <th className="px-4 py-3 font-medium text-slate-600">Total</th>
              <th className="px-4 py-3 font-medium text-slate-600">Count</th>
              <th className="px-4 py-3 font-medium text-slate-600">Average</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const avg = r.count > 0 ? r.total / r.count : 0;
              return (
                <tr
                  key={r.categoryKey}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  onClick={() => setSelected(r)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {r.displayName}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-800">
                    {formatLkr(r.total)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.count}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {formatLkr(avg)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No expense data for the current filters.
          </p>
        )}
      </div>

      {selected && (
        <CategoryDrill row={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
