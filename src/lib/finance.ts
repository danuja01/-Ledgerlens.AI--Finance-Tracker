import {
  checkExclusion,
  displayNameForCategory,
  mapNoteToSubCategory,
  TRANSFER_CATEGORIES,
} from "@/lib/mapper";
import type {
  Analytics,
  CategoryBreakdown,
  CategoryMapping,
  FinanceFilters,
  PeriodMode,
  ProcessedTransaction,
  RawTransaction,
} from "@/types";
import { monthLabel } from "@/lib/utils";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const CAL_MONTHS = [
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

export function getSalaryCycleParts(d: Date): {
  cycleYear: number;
  cycleMonth: number;
  cycleLabel: string;
  cycleDay: number;
} {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  let cycleMonth: number;
  let cycleYear: number;
  if (day >= 23) {
    cycleMonth = m;
    cycleYear = y;
  } else if (m === 1) {
    cycleMonth = 12;
    cycleYear = y - 1;
  } else {
    cycleMonth = m - 1;
    cycleYear = y;
  }
  const start = new Date(cycleYear, cycleMonth - 1, 23);
  const msPerDay = 24 * 60 * 60 * 1000;
  const cycleDay = Math.min(
    31,
    Math.max(1, Math.floor((d.getTime() - start.getTime()) / msPerDay) + 1),
  );
  const nextM = cycleMonth === 12 ? 1 : cycleMonth + 1;
  const label = `${CAL_MONTHS[cycleMonth - 1]} ${cycleYear} cycle (23 ${CAL_MONTHS[cycleMonth - 1]} - 22 ${CAL_MONTHS[nextM - 1]})`;
  return { cycleYear, cycleMonth, cycleLabel: label, cycleDay };
}

export function processTransactions(
  raw: RawTransaction[],
  mapping: CategoryMapping,
): ProcessedTransaction[] {
  return raw.map((t) => {
    const d = new Date(t.date + "T12:00:00");
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const { cycleYear, cycleMonth, cycleLabel, cycleDay } =
      getSalaryCycleParts(d);
    const ex = checkExclusion(t.category, t.note);
    const sub = mapNoteToSubCategory(t.note, t.category, mapping);
    const displayCategory = displayNameForCategory(t.category, mapping);
    const isInternalTransfer = TRANSFER_CATEGORIES.has(t.category);
    return {
      ...t,
      year,
      month,
      monthLabel: monthLabel(year, month),
      cycleYear,
      cycleMonth,
      cycleLabel,
      cycleDay,
      dayOfWeek: WEEKDAYS[d.getDay()],
      dayOfMonth: d.getDate(),
      subCategory: sub,
      displayCategory,
      excluded: ex.excluded,
      exclusionReason: ex.reason,
      isInternalTransfer,
    };
  });
}

/** True if this row should affect income/expense KPIs and charts (not balance-only, not inter-account). */
export function countsForCashflow(t: ProcessedTransaction): boolean {
  return !t.excluded && !t.isInternalTransfer;
}

/** Sortable index for calendar or salary (year, month) pairs. */
export function periodMonthIndex(year: number, month: number): number {
  return year * 12 + month - 1;
}

function inCalendarRange(t: ProcessedTransaction, f: FinanceFilters): boolean {
  const tk = periodMonthIndex(t.year, t.month);
  if (f.calendarFromYear !== "all" && f.calendarFromMonth !== "all") {
    const lo = periodMonthIndex(
      f.calendarFromYear as number,
      f.calendarFromMonth as number,
    );
    if (tk < lo) return false;
  }
  if (f.calendarToYear !== "all" && f.calendarToMonth !== "all") {
    const hi = periodMonthIndex(
      f.calendarToYear as number,
      f.calendarToMonth as number,
    );
    if (tk > hi) return false;
  }
  return true;
}

function inSalaryCycleRange(t: ProcessedTransaction, f: FinanceFilters): boolean {
  const tk = periodMonthIndex(t.cycleYear, t.cycleMonth);
  if (f.cycleFromYear !== "all" && f.cycleFromMonth !== "all") {
    const lo = periodMonthIndex(
      f.cycleFromYear as number,
      f.cycleFromMonth as number,
    );
    if (tk < lo) return false;
  }
  if (f.cycleToYear !== "all" && f.cycleToMonth !== "all") {
    const hi = periodMonthIndex(
      f.cycleToYear as number,
      f.cycleToMonth as number,
    );
    if (tk > hi) return false;
  }
  return true;
}

export function filterTransactions(
  txs: ProcessedTransaction[],
  f: FinanceFilters,
): ProcessedTransaction[] {
  return txs.filter((t) => {
    if (!f.includeExcluded && t.excluded) return false;
    if (f.periodMode === "calendar") return inCalendarRange(t, f);
    return inSalaryCycleRange(t, f);
  });
}

function cycleSeriesKey(cycleYear: number, cycleMonth: number): string {
  return `${cycleYear}-${String(cycleMonth).padStart(2, "0")}`;
}

/** Group expense rows into per-category breakdown (sorted by total desc). */
export function buildExpenseCategoryBreakdown(
  expenseRows: ProcessedTransaction[],
): CategoryBreakdown[] {
  const catMap = new Map<string, CategoryBreakdown>();
  for (const t of expenseRows) {
    const key = t.category;
    if (!catMap.has(key)) {
      catMap.set(key, {
        categoryKey: key,
        displayName: t.displayCategory,
        total: 0,
        count: 0,
        transactions: [],
      });
    }
    const c = catMap.get(key)!;
    c.total += t.amount;
    c.count += 1;
    c.transactions.push(t);
  }
  return [...catMap.values()].sort((a, b) => b.total - a.total);
}

/** Per (display category × sub-category) expense totals for cashflow rows — complete for the filtered set (not limited by chat transaction cap). */
export function buildSubCategoryExpenseRollup(
  filtered: ProcessedTransaction[],
): {
  displayCategory: string;
  subCategory: string;
  total: number;
  count: number;
}[] {
  const map = new Map<
    string,
    {
      displayCategory: string;
      subCategory: string;
      total: number;
      count: number;
    }
  >();
  for (const t of filtered) {
    if (t.direction !== "expense" || !countsForCashflow(t)) continue;
    const key = `${t.displayCategory}\u0000${t.subCategory}`;
    const cur = map.get(key);
    if (cur) {
      cur.total += t.amount;
      cur.count += 1;
    } else {
      map.set(key, {
        displayCategory: t.displayCategory,
        subCategory: t.subCategory,
        total: t.amount,
        count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function buildAnalytics(
  filtered: ProcessedTransaction[],
  allProcessed: ProcessedTransaction[],
  periodMode: PeriodMode,
): Analytics {
  const incomeRows = filtered.filter(
    (t) => t.direction === "income" && countsForCashflow(t),
  );
  const expenseRows = filtered.filter(
    (t) => t.direction === "expense" && countsForCashflow(t),
  );
  const totalIncome = incomeRows.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expenseRows.reduce((s, t) => s + t.amount, 0);
  const netCashflow = totalIncome - totalExpense;
  const savingsRate =
    totalIncome > 0 ? (netCashflow / totalIncome) * 100 : null;

  const trackedSalary = new Set<string>();
  const trackedCal = new Set<string>();
  for (const t of allProcessed) {
    if (!countsForCashflow(t)) continue;
    trackedSalary.add(cycleSeriesKey(t.cycleYear, t.cycleMonth));
    trackedCal.add(`${t.year}-${t.month}`);
  }

  const byCategory = buildExpenseCategoryBreakdown(expenseRows);

  const weekdayOrder = WEEKDAYS.slice(1).concat(WEEKDAYS[0]);
  const wdTotals: Record<string, number> = Object.fromEntries(
    weekdayOrder.map((d) => [d, 0]),
  );
  for (const t of expenseRows) {
    wdTotals[t.dayOfWeek] = (wdTotals[t.dayOfWeek] ?? 0) + t.amount;
  }
  const byWeekday = weekdayOrder.map((day) => ({
    day: day.slice(0, 3),
    total: wdTotals[day] ?? 0,
  }));

  const dayChartKind: "salary-cycle" | "calendar" =
    periodMode === "calendar" ? "calendar" : "salary-cycle";
  const cdTotals: Record<number, number> = {};
  for (let i = 1; i <= 31; i++) cdTotals[i] = 0;
  for (const t of expenseRows) {
    const d =
      periodMode === "calendar" ? t.dayOfMonth : t.cycleDay;
    if (d >= 1 && d <= 31) cdTotals[d] = (cdTotals[d] ?? 0) + t.amount;
  }
  const byCycleDay = Object.entries(cdTotals).map(([k, total]) => ({
    day: Number(k),
    total,
  }));

  const seriesMap = new Map<
    string,
    { y: number; m: number; income: number; expense: number }
  >();
  for (const t of filtered) {
    if (!countsForCashflow(t)) continue;
    if (periodMode === "calendar") {
      const k = `${t.year}-${String(t.month).padStart(2, "0")}`;
      if (!seriesMap.has(k)) {
        seriesMap.set(k, {
          y: t.year,
          m: t.month,
          income: 0,
          expense: 0,
        });
      }
      const row = seriesMap.get(k)!;
      if (t.direction === "income") row.income += t.amount;
      if (t.direction === "expense") row.expense += t.amount;
    } else {
      const k = cycleSeriesKey(t.cycleYear, t.cycleMonth);
      if (!seriesMap.has(k)) {
        seriesMap.set(k, {
          y: t.cycleYear,
          m: t.cycleMonth,
          income: 0,
          expense: 0,
        });
      }
      const row = seriesMap.get(k)!;
      if (t.direction === "income") row.income += t.amount;
      if (t.direction === "expense") row.expense += t.amount;
    }
  }
  const monthlySeries = [...seriesMap.values()]
    .sort((a, b) => (a.y !== b.y ? a.y - b.y : a.m - b.m))
    .map((r) => ({
      label: `${CAL_MONTHS[r.m - 1]} ${r.y}`,
      income: r.income,
      expense: r.expense,
    }));

  const excludedCount = filtered.filter((t) => t.excluded).length;
  const internalTransferCount = filtered.filter((t) => t.isInternalTransfer)
    .length;

  return {
    totalIncome,
    totalExpense,
    netCashflow,
    savingsRate,
    byCategory,
    byWeekday,
    byCycleDay,
    dayChartKind,
    monthlySeries,
    analyticsPeriodMode: periodMode,
    trackedSalaryCycles: trackedSalary.size,
    trackedCalendarMonths: trackedCal.size,
    excludedCount,
    internalTransferCount,
  };
}
