import type { CategoryBreakdown } from "@/types";
import { cn, formatLkr } from "@/lib/utils";

export function CategoryDrill({
  row,
  onClose,
}: {
  row: CategoryBreakdown;
  onClose: () => void;
}) {
  const avg = row.count > 0 ? row.total / row.count : 0;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drill-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white shadow-2xl",
        )}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Category
            </p>
            <h2 id="drill-title" className="text-lg font-semibold text-slate-900">
              {row.displayName}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Total {formatLkr(row.total)} · {row.count} transactions · Avg{" "}
              {formatLkr(avg)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-200"
          >
            Close
          </button>
        </div>
        <div className="overflow-x-auto px-2 py-3 sm:px-5">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Sub-category</th>
                <th className="py-2 pr-3 font-medium">Note</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {row.transactions.map((t) => (
                <tr key={t.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-mono text-xs text-slate-700">
                    {t.date}
                  </td>
                  <td className="py-2 pr-3 text-slate-800">
                    {t.subCategory || "—"}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">{t.note || "—"}</td>
                  <td className="py-2 text-right font-medium tabular-nums text-slate-900">
                    {formatLkr(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
