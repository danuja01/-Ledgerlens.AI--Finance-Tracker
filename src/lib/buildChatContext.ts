import { buildSubCategoryExpenseRollup } from "@/lib/finance";
import type { Analytics, FinanceFilters, ProcessedTransaction } from "@/types";

const MAX_TRANSACTIONS = 6000;

function sortTxRowsForSnapshot<
  T extends { date: string; id: string },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const c = a.date.localeCompare(b.date);
    return c !== 0 ? c : a.id.localeCompare(b.id);
  });
}

export type FinancialSnapshot = {
  ledgerMeta: {
    periodMode: FinanceFilters["periodMode"];
    filters: FinanceFilters;
    note: string;
  };
  totals: {
    totalIncome: number;
    totalExpense: number;
    netCashflow: number;
    savingsRate: number | null;
  };
  coverage: {
    trackedCalendarMonths: number;
    trackedSalaryCycles: number;
  };
  excludedRowsInView: number;
  internalTransferRowsInView: number;
  categoryBreakdown: {
    displayName: string;
    total: number;
    count: number;
  }[];
  monthlySeries: Analytics["monthlySeries"];
  weekdaySpending: Analytics["byWeekday"];
  dayDistribution: {
    kind: Analytics["dayChartKind"];
    values: Analytics["byCycleDay"];
  };
  /** Complete expense totals by display category + sub-category for the active filters (not truncated). Use this for sub-category questions. */
  subCategoryExpenseBreakdown: {
    displayCategory: string;
    subCategory: string;
    total: number;
    count: number;
  }[];
  transactionsInFilteredView: {
    id: string;
    date: string;
    direction: string;
    displayCategory: string;
    rawCategory: string;
    subCategory: string;
    note: string;
    amount: number;
    cycleLabel: string;
    monthLabel: string;
    excluded: boolean;
    isInternalTransfer: boolean;
  }[];
  transactionsTruncated: boolean;
  transactionsTotalCount: number;
};

export function buildFinancialSnapshot(
  filtered: ProcessedTransaction[],
  analytics: Analytics,
  filters: FinanceFilters,
): FinancialSnapshot {
  const subCategoryExpenseBreakdown =
    buildSubCategoryExpenseRollup(filtered);

  const txs = sortTxRowsForSnapshot(
    filtered.map((t) => ({
      id: t.id,
      date: t.date,
      direction: t.direction,
      displayCategory: t.displayCategory,
      rawCategory: t.category,
      subCategory: t.subCategory,
      note: t.note,
      amount: t.amount,
      cycleLabel: t.cycleLabel,
      monthLabel: t.monthLabel,
      excluded: t.excluded,
      isInternalTransfer: t.isInternalTransfer,
    })),
  );

  const truncated = txs.length > MAX_TRANSACTIONS;
  const slice = truncated ? txs.slice(0, MAX_TRANSACTIONS) : txs;

  return {
    ledgerMeta: {
      periodMode: filters.periodMode,
      filters,
      note: "Amounts are LKR. KPI totals exclude balance-adjustment rows when not included, and exclude inter-account transfers (ComBank/NTB) from cashflow. subCategoryExpenseBreakdown lists every expense sub-category in this filter window with full totals and counts. transactionsInFilteredView is a chronological sample and may be truncated when there are many rows — use subCategoryExpenseBreakdown for sub-category totals and counts, not the sample list alone.",
    },
    totals: {
      totalIncome: analytics.totalIncome,
      totalExpense: analytics.totalExpense,
      netCashflow: analytics.netCashflow,
      savingsRate: analytics.savingsRate,
    },
    coverage: {
      trackedCalendarMonths: analytics.trackedCalendarMonths,
      trackedSalaryCycles: analytics.trackedSalaryCycles,
    },
    excludedRowsInView: analytics.excludedCount,
    internalTransferRowsInView: analytics.internalTransferCount,
    categoryBreakdown: analytics.byCategory.map((c) => ({
      displayName: c.displayName,
      total: c.total,
      count: c.count,
    })),
    monthlySeries: analytics.monthlySeries,
    weekdaySpending: analytics.byWeekday,
    dayDistribution: {
      kind: analytics.dayChartKind,
      values: analytics.byCycleDay,
    },
    subCategoryExpenseBreakdown,
    transactionsInFilteredView: slice,
    transactionsTruncated: truncated,
    transactionsTotalCount: txs.length,
  };
}

export function snapshotToJson(snapshot: FinancialSnapshot): string {
  return JSON.stringify(snapshot, null, 0);
}
