import { useFinance } from "@/context/FinanceContext";
import { periodMonthIndex } from "@/lib/finance";
import { cn } from "@/lib/utils";
import type { FinanceFilters, PeriodMode } from "@/types";

const MONTH_LONG = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleString("en", { month: "long" }),
);

function clampCalendar(f: FinanceFilters): FinanceFilters {
  const a = { ...f };
  if (
    a.calendarFromYear !== "all" &&
    a.calendarFromMonth !== "all" &&
    a.calendarToYear !== "all" &&
    a.calendarToMonth !== "all"
  ) {
    const lo = periodMonthIndex(
      a.calendarFromYear as number,
      a.calendarFromMonth as number,
    );
    const hi = periodMonthIndex(
      a.calendarToYear as number,
      a.calendarToMonth as number,
    );
    if (lo > hi) {
      a.calendarToYear = a.calendarFromYear;
      a.calendarToMonth = a.calendarFromMonth;
    }
  }
  return a;
}

function clampCycle(f: FinanceFilters): FinanceFilters {
  const a = { ...f };
  if (
    a.cycleFromYear !== "all" &&
    a.cycleFromMonth !== "all" &&
    a.cycleToYear !== "all" &&
    a.cycleToMonth !== "all"
  ) {
    const lo = periodMonthIndex(
      a.cycleFromYear as number,
      a.cycleFromMonth as number,
    );
    const hi = periodMonthIndex(
      a.cycleToYear as number,
      a.cycleToMonth as number,
    );
    if (lo > hi) {
      a.cycleToYear = a.cycleFromYear;
      a.cycleToMonth = a.cycleFromMonth;
    }
  }
  return a;
}

export function Filters({ className }: { className?: string }) {
  const {
    filters,
    setFilters,
    availableCalendarYears,
    availableCycleYears,
  } = useFinance();

  const setMode = (periodMode: PeriodMode) => {
    setFilters((f) => ({ ...f, periodMode }));
  };

  const patchCalendar = (patch: Partial<FinanceFilters>) => {
    setFilters((f) => clampCalendar({ ...f, ...patch }));
  };

  const patchCycle = (patch: Partial<FinanceFilters>) => {
    setFilters((f) => clampCycle({ ...f, ...patch }));
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-card",
        className,
      )}
    >
      <div className="border-b border-slate-100 bg-slate-50/90 px-4 py-3 sm:px-5">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Time range
        </p>
        <p className="mt-0.5 text-sm text-slate-600">
          Use <strong className="font-medium text-slate-800">inclusive month ranges</strong>{" "}
          (from–to). Leave either side as <em>Any</em> to keep that end open. Switch between{" "}
          <strong className="font-medium text-slate-800">calendar</strong> months and{" "}
          <strong className="font-medium text-slate-800">salary cycles</strong> (23rd → 22nd).
        </p>
      </div>

      <div className="p-4 sm:p-5">
        <div
          className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-1 sm:flex-row"
          role="tablist"
          aria-label="Period type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filters.periodMode === "calendar"}
            onClick={() => setMode("calendar")}
            className={cn(
              "flex-1 rounded-lg px-4 py-3 text-left transition",
              filters.periodMode === "calendar"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
            )}
          >
            <span className="block text-sm font-semibold">Calendar months</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Jan–Dec by transaction date
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filters.periodMode === "salary-cycle"}
            onClick={() => setMode("salary-cycle")}
            className={cn(
              "flex-1 rounded-lg px-4 py-3 text-left transition",
              filters.periodMode === "salary-cycle"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
            )}
          >
            <span className="block text-sm font-semibold">Salary cycles</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              23rd → 22nd · payday on the 23rd
            </span>
          </button>
        </div>

        {filters.periodMode === "calendar" && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Calendar range
              </p>
              <button
                type="button"
                className="text-xs font-medium text-blue-700 hover:underline"
                onClick={() =>
                  patchCalendar({
                    calendarFromYear: "all",
                    calendarFromMonth: "all",
                    calendarToYear: "all",
                    calendarToMonth: "all",
                  })
                }
              >
                Clear range (all dates)
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/40 p-4">
                <p className="text-sm font-semibold text-slate-800">From</p>
                <p className="mt-0.5 text-xs text-slate-500">Start month (inclusive)</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Year
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900"
                      value={
                        filters.calendarFromYear === "all"
                          ? "all"
                          : String(filters.calendarFromYear)
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "all") {
                          patchCalendar({
                            calendarFromYear: "all",
                            calendarFromMonth: "all",
                          });
                          return;
                        }
                        const y = Number(v);
                        patchCalendar({
                          calendarFromYear: y,
                          calendarFromMonth:
                            filters.calendarFromMonth === "all"
                              ? 1
                              : filters.calendarFromMonth,
                        });
                      }}
                    >
                      <option value="all">Any</option>
                      {availableCalendarYears.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Month
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 disabled:opacity-45"
                      disabled={filters.calendarFromYear === "all"}
                      value={
                        filters.calendarFromYear === "all"
                          ? ""
                          : String(
                              filters.calendarFromMonth === "all"
                                ? 1
                                : filters.calendarFromMonth,
                            )
                      }
                      onChange={(e) =>
                        patchCalendar({
                          calendarFromMonth: Number(e.target.value),
                        })
                      }
                    >
                      {filters.calendarFromYear === "all" ? (
                        <option value="">—</option>
                      ) : (
                        MONTH_LONG.map((name, i) => (
                          <option key={i + 1} value={i + 1}>
                            {name}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-slate-50/40 p-4">
                <p className="text-sm font-semibold text-slate-800">To</p>
                <p className="mt-0.5 text-xs text-slate-500">End month (inclusive)</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Year
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900"
                      value={
                        filters.calendarToYear === "all"
                          ? "all"
                          : String(filters.calendarToYear)
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "all") {
                          patchCalendar({
                            calendarToYear: "all",
                            calendarToMonth: "all",
                          });
                          return;
                        }
                        const y = Number(v);
                        patchCalendar({
                          calendarToYear: y,
                          calendarToMonth:
                            filters.calendarToMonth === "all"
                              ? 12
                              : filters.calendarToMonth,
                        });
                      }}
                    >
                      <option value="all">Any</option>
                      {availableCalendarYears.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Month
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 disabled:opacity-45"
                      disabled={filters.calendarToYear === "all"}
                      value={
                        filters.calendarToYear === "all"
                          ? ""
                          : String(
                              filters.calendarToMonth === "all"
                                ? 12
                                : filters.calendarToMonth,
                            )
                      }
                      onChange={(e) =>
                        patchCalendar({
                          calendarToMonth: Number(e.target.value),
                        })
                      }
                    >
                      {filters.calendarToYear === "all" ? (
                        <option value="">—</option>
                      ) : (
                        MONTH_LONG.map((name, i) => (
                          <option key={i + 1} value={i + 1}>
                            {name}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {filters.periodMode === "salary-cycle" && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Salary cycle range
              </p>
              <button
                type="button"
                className="text-xs font-medium text-blue-700 hover:underline"
                onClick={() =>
                  patchCycle({
                    cycleFromYear: "all",
                    cycleFromMonth: "all",
                    cycleToYear: "all",
                    cycleToMonth: "all",
                  })
                }
              >
                Clear range (all cycles)
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/40 p-4">
                <p className="text-sm font-semibold text-slate-800">From</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Cycle named by the month of the 23rd (inclusive)
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Year
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900"
                      value={
                        filters.cycleFromYear === "all"
                          ? "all"
                          : String(filters.cycleFromYear)
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "all") {
                          patchCycle({
                            cycleFromYear: "all",
                            cycleFromMonth: "all",
                          });
                          return;
                        }
                        const y = Number(v);
                        patchCycle({
                          cycleFromYear: y,
                          cycleFromMonth:
                            filters.cycleFromMonth === "all"
                              ? 1
                              : filters.cycleFromMonth,
                        });
                      }}
                    >
                      <option value="all">Any</option>
                      {availableCycleYears.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Month
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 disabled:opacity-45"
                      disabled={filters.cycleFromYear === "all"}
                      value={
                        filters.cycleFromYear === "all"
                          ? ""
                          : String(
                              filters.cycleFromMonth === "all"
                                ? 1
                                : filters.cycleFromMonth,
                            )
                      }
                      onChange={(e) =>
                        patchCycle({
                          cycleFromMonth: Number(e.target.value),
                        })
                      }
                    >
                      {filters.cycleFromYear === "all" ? (
                        <option value="">—</option>
                      ) : (
                        MONTH_LONG.map((name, i) => (
                          <option key={i + 1} value={i + 1}>
                            {name}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-slate-50/40 p-4">
                <p className="text-sm font-semibold text-slate-800">To</p>
                <p className="mt-0.5 text-xs text-slate-500">Last cycle included in range</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Year
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900"
                      value={
                        filters.cycleToYear === "all"
                          ? "all"
                          : String(filters.cycleToYear)
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "all") {
                          patchCycle({
                            cycleToYear: "all",
                            cycleToMonth: "all",
                          });
                          return;
                        }
                        const y = Number(v);
                        patchCycle({
                          cycleToYear: y,
                          cycleToMonth:
                            filters.cycleToMonth === "all"
                              ? 12
                              : filters.cycleToMonth,
                        });
                      }}
                    >
                      <option value="all">Any</option>
                      {availableCycleYears.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    Month
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 disabled:opacity-45"
                      disabled={filters.cycleToYear === "all"}
                      value={
                        filters.cycleToYear === "all"
                          ? ""
                          : String(
                              filters.cycleToMonth === "all"
                                ? 12
                                : filters.cycleToMonth,
                            )
                      }
                      onChange={(e) =>
                        patchCycle({
                          cycleToMonth: Number(e.target.value),
                        })
                      }
                    >
                      {filters.cycleToYear === "all" ? (
                        <option value="">—</option>
                      ) : (
                        MONTH_LONG.map((name, i) => (
                          <option key={i + 1} value={i + 1}>
                            {name}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
              checked={filters.includeExcluded}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  includeExcluded: e.target.checked,
                }))
              }
            />
            <span className="text-slate-700">Include balance adjustments</span>
          </label>
          <p className="text-xs text-slate-500">
            Ranges are inclusive. Charts follow the active tab above.
          </p>
        </div>
      </div>
    </div>
  );
}
