import {
  norm,
  resolveDisplayCategorySmart,
} from "@/lib/categoryMatch";
import {
  buildSubCategoryExpenseRollup,
  countsForCashflow,
  filterTransactions,
  periodMonthIndex,
} from "@/lib/finance";
import type { FinanceFilters, ProcessedTransaction } from "@/types";

export { norm } from "@/lib/categoryMatch";

/** Resolve one display category against known names (fuzzy + synonyms, emoji-safe). */
export function resolveDisplayCategory(
  rows: ProcessedTransaction[],
  query: string,
): { match: string } | { error: string } {
  const names = [...new Set(rows.map((t) => t.displayCategory))];
  return resolveDisplayCategorySmart(names, query);
}

export type TimeScopeArg =
  | { kind: "dashboard" }
  | {
      kind: "calendar_months";
      fromYear: number;
      fromMonth: number;
      toYear: number;
      toMonth: number;
    }
  | { kind: "iso_dates"; dateFrom: string; dateTo: string }
  | {
      kind: "salary_cycles";
      fromCycleYear: number;
      fromCycleMonth: number;
      toCycleYear: number;
      toCycleMonth: number;
    };

export type LedgerDimensions = {
  direction: "expense" | "income" | "both";
  /** Match any of these display names (OR). Empty = no filter. */
  displayCategories?: string[];
  /** Match any of these sub-category labels (OR). Empty = no filter. */
  subCategories?: string[];
  /** Inclusive amount filter on transaction amount (same sign as stored). */
  amountMin?: number;
  amountMax?: number;
  noteContains?: string;
  /**
   * When true (default for expense/income questions), exclude excluded rows and inter-account transfers from expense/income analytics.
   */
  cashflowRowsOnly?: boolean;
};

function mergeCalendarMonths(
  base: FinanceFilters,
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): FinanceFilters {
  return {
    ...base,
    periodMode: "calendar",
    calendarFromYear: fromYear,
    calendarFromMonth: fromMonth,
    calendarToYear: toYear,
    calendarToMonth: toMonth,
  };
}

function mergeSalaryCycles(
  base: FinanceFilters,
  fromCycleYear: number,
  fromCycleMonth: number,
  toCycleYear: number,
  toCycleMonth: number,
): FinanceFilters {
  return {
    ...base,
    periodMode: "salary-cycle",
    cycleFromYear: fromCycleYear,
    cycleFromMonth: fromCycleMonth,
    cycleToYear: toCycleYear,
    cycleToMonth: toCycleMonth,
  };
}

function describeTimeScope(
  ts: TimeScopeArg,
  base: FinanceFilters,
): string {
  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ] as const;
  const m = (n: number) => MONTHS[n - 1];
  switch (ts.kind) {
    case "dashboard":
      return `Dashboard window (${base.periodMode} mode, app filters).`;
    case "calendar_months":
      return `Calendar months (inclusive): ${m(ts.fromMonth)} ${ts.fromYear} – ${m(ts.toMonth)} ${ts.toYear}.`;
    case "iso_dates":
      return `Calendar dates (inclusive): ${ts.dateFrom} – ${ts.dateTo}.`;
    case "salary_cycles":
      return `Salary cycles (inclusive): cycle ${m(ts.fromCycleMonth)} ${ts.fromCycleYear} – cycle ${m(ts.toCycleMonth)} ${ts.toCycleYear}.`;
    default:
      return "Custom period.";
  }
}

/**
 * Rows matching time scope + dashboard exclude rules (includeExcluded from base filters).
 */
export function rowsForTimeScope(
  processed: ProcessedTransaction[],
  baseFilters: FinanceFilters,
  dashboardFiltered: ProcessedTransaction[],
  ts: TimeScopeArg,
): ProcessedTransaction[] {
  switch (ts.kind) {
    case "dashboard":
      return dashboardFiltered;
    case "calendar_months":
      return filterTransactions(
        processed,
        mergeCalendarMonths(
          baseFilters,
          ts.fromYear,
          ts.fromMonth,
          ts.toYear,
          ts.toMonth,
        ),
      );
    case "salary_cycles":
      return filterTransactions(
        processed,
        mergeSalaryCycles(
          baseFilters,
          ts.fromCycleYear,
          ts.fromCycleMonth,
          ts.toCycleYear,
          ts.toCycleMonth,
        ),
      );
    case "iso_dates": {
      const [fy, fm] = ts.dateFrom.split("-").map(Number);
      const [ty, tm] = ts.dateTo.split("-").map(Number);
      const broad = filterTransactions(
        processed,
        mergeCalendarMonths(baseFilters, fy, fm, ty, tm),
      );
      return broad.filter(
        (t) => t.date >= ts.dateFrom && t.date <= ts.dateTo,
      );
    }
    default:
      return dashboardFiltered;
  }
}

function resolveDisplayList(
  rows: ProcessedTransaction[],
  queries: string[],
): { matches: string[] } | { error: string } {
  const matches: string[] = [];
  for (const q of queries) {
    const r = resolveDisplayCategory(rows, q);
    if ("error" in r) return r;
    if (!matches.includes(r.match)) matches.push(r.match);
  }
  return { matches };
}

function resolveSubCategoryList(
  allRowsForLookup: ProcessedTransaction[],
  queries: string[],
): { matches: string[] } | { error: string } {
  const uniqueSubs = [
    ...new Set(allRowsForLookup.map((t) => t.subCategory)),
  ];
  const matches: string[] = [];
  for (const q of queries) {
    const r = resolveDisplayCategorySmart(uniqueSubs, q);
    if ("error" in r) return r;
    if (!matches.includes(r.match)) matches.push(r.match);
  }
  return { matches };
}

export function applyDimensions(
  rows: ProcessedTransaction[],
  allRowsForLookup: ProcessedTransaction[],
  dims: LedgerDimensions,
): ProcessedTransaction[] | { error: string } {
  let r = rows;

  if (dims.direction === "expense") {
    r = r.filter((t) => t.direction === "expense");
  } else if (dims.direction === "income") {
    r = r.filter((t) => t.direction === "income");
  }

  if (dims.cashflowRowsOnly !== false) {
    r = r.filter((t) => countsForCashflow(t));
  }

  if (dims.displayCategories?.length) {
    const res = resolveDisplayList(allRowsForLookup, dims.displayCategories);
    if ("error" in res) return res;
    const set = new Set(res.matches.map((x) => norm(x)));
    r = r.filter((t) => set.has(norm(t.displayCategory)));
  }

  if (dims.subCategories?.length) {
    const res = resolveSubCategoryList(allRowsForLookup, dims.subCategories);
    if ("error" in res) return res;
    const set = new Set(res.matches.map((x) => norm(x)));
    r = r.filter((t) => set.has(norm(t.subCategory)));
  }

  if (dims.amountMin !== undefined) {
    r = r.filter((t) => t.amount >= dims.amountMin!);
  }
  if (dims.amountMax !== undefined) {
    r = r.filter((t) => t.amount <= dims.amountMax!);
  }

  if (dims.noteContains?.trim()) {
    const n = norm(dims.noteContains);
    r = r.filter((t) => norm(t.note).includes(n));
  }

  return r;
}

export type QueryLedgerResult =
  | {
      ok: true;
      currency: "LKR";
      appliedPeriodDescription: string;
      timeScopeKind: string;
      rowCount: number;
      totalAmount: number;
      truncated: boolean;
      transactions: {
        date: string;
        displayCategory: string;
        subCategory: string;
        amount: number;
        note: string;
        direction: string;
      }[];
    }
  | { ok: false; error: string };

export function validateTimeScope(ts: TimeScopeArg): string | null {
  if (ts.kind === "calendar_months") {
    if (
      periodMonthIndex(ts.fromYear, ts.fromMonth) >
      periodMonthIndex(ts.toYear, ts.toMonth)
    ) {
      return "calendar_months: start month is after end month";
    }
  }
  if (ts.kind === "iso_dates") {
    if (ts.dateFrom > ts.dateTo) return "iso_dates: dateFrom is after dateTo";
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(ts.dateFrom) || !re.test(ts.dateTo)) {
      return "iso_dates: use YYYY-MM-DD for dateFrom and dateTo";
    }
  }
  if (ts.kind === "salary_cycles") {
    if (
      periodMonthIndex(ts.fromCycleYear, ts.fromCycleMonth) >
      periodMonthIndex(ts.toCycleYear, ts.toCycleMonth)
    ) {
      return "salary_cycles: start is after end";
    }
  }
  return null;
}

export function queryLedger(
  processed: ProcessedTransaction[],
  baseFilters: FinanceFilters,
  dashboardFiltered: ProcessedTransaction[],
  timeScope: TimeScopeArg,
  dims: LedgerDimensions,
  options: { maxTransactions?: number; sort?: "date_asc" | "date_desc" } = {},
): QueryLedgerResult {
  const err = validateTimeScope(timeScope);
  if (err) return { ok: false, error: err };

  const maxTx = Math.min(200, Math.max(0, options.maxTransactions ?? 100));
  const appliedPeriodDescription = describeTimeScope(timeScope, baseFilters);

  let rows = rowsForTimeScope(
    processed,
    baseFilters,
    dashboardFiltered,
    timeScope,
  );

  const filtered = applyDimensions(rows, processed, dims);
  if ("error" in filtered) return { ok: false, error: filtered.error };
  rows = filtered;

  const sort = options.sort ?? "date_asc";
  const sorted = [...rows].sort((a, b) =>
    sort === "date_asc"
      ? a.date.localeCompare(b.date)
      : b.date.localeCompare(a.date),
  );

  const totalAmount = sorted.reduce((s, t) => s + t.amount, 0);
  const slice = maxTx === 0 ? [] : sorted.slice(0, maxTx);

  return {
    ok: true,
    currency: "LKR",
    appliedPeriodDescription,
    timeScopeKind: timeScope.kind,
    rowCount: sorted.length,
    totalAmount,
    truncated: maxTx > 0 && sorted.length > maxTx,
    transactions: slice.map((t) => ({
      date: t.date,
      displayCategory: t.displayCategory,
      subCategory: t.subCategory,
      amount: t.amount,
      note: t.note,
      direction: t.direction,
    })),
  };
}

export function subcategoryRollupForScope(
  processed: ProcessedTransaction[],
  baseFilters: FinanceFilters,
  dashboardFiltered: ProcessedTransaction[],
  timeScope: TimeScopeArg,
  options: {
    displayCategories?: string[];
    limit?: number;
  } = {},
): { ok: true; rows: ReturnType<typeof buildSubCategoryExpenseRollup> } | { ok: false; error: string } {
  let rows = rowsForTimeScope(
    processed,
    baseFilters,
    dashboardFiltered,
    timeScope,
  );
  rows = rows.filter(
    (t) => t.direction === "expense" && countsForCashflow(t),
  );

  if (options.displayCategories?.length) {
    const res = resolveDisplayList(processed, options.displayCategories);
    if ("error" in res) return { ok: false, error: res.error };
    const set = new Set(res.matches.map((x) => norm(x)));
    rows = rows.filter((t) => set.has(norm(t.displayCategory)));
  }

  let rollup = buildSubCategoryExpenseRollup(rows);
  const limit = Math.min(120, Math.max(1, options.limit ?? 50));
  rollup = rollup.slice(0, limit);
  return { ok: true, rows: rollup };
}
