export type Direction = "income" | "expense";

export type RawTransaction = {
  id: string;
  date: string;
  period: string;
  category: string;
  note: string;
  amount: number;
  direction: Direction;
};

export type ProcessedTransaction = RawTransaction & {
  year: number;
  month: number;
  monthLabel: string;
  cycleYear: number;
  cycleMonth: number;
  cycleLabel: string;
  cycleDay: number;
  dayOfWeek: string;
  dayOfMonth: number;
  subCategory: string;
  displayCategory: string;
  excluded: boolean;
  exclusionReason: string;
  /** ComBank Malabe / Peradeniya / NTB — moves between own accounts, not real income or spend */
  isInternalTransfer: boolean;
};

export type CategoryMapping = Record<
  string,
  { displayName: string; subCategories: Record<string, string> }
>;

export type PeriodMode = "calendar" | "salary-cycle";

/**
 * Calendar = Jan–Dec by transaction date. Salary cycle = 23rd → 22nd (payday on the 23rd).
 * Ranges are inclusive. Use year+month "all" on an endpoint to leave that side open (unbounded).
 */
export type FinanceFilters = {
  periodMode: PeriodMode;
  calendarFromYear: number | "all";
  calendarFromMonth: number | "all";
  calendarToYear: number | "all";
  calendarToMonth: number | "all";
  cycleFromYear: number | "all";
  cycleFromMonth: number | "all";
  cycleToYear: number | "all";
  cycleToMonth: number | "all";
  includeExcluded: boolean;
};

export type CategoryBreakdown = {
  categoryKey: string;
  displayName: string;
  total: number;
  count: number;
  transactions: ProcessedTransaction[];
};

export type Analytics = {
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  savingsRate: number | null;
  byCategory: CategoryBreakdown[];
  byWeekday: { day: string; total: number }[];
  /** Day 1–31: either salary-cycle day or calendar day of month (see dayChartKind) */
  byCycleDay: { day: number; total: number }[];
  dayChartKind: "salary-cycle" | "calendar";
  monthlySeries: {
    label: string;
    income: number;
    expense: number;
  }[];
  /** How cashflow timeline & day chart are bucketed (matches active filter mode) */
  analyticsPeriodMode: PeriodMode;
  trackedSalaryCycles: number;
  trackedCalendarMonths: number;
  excludedCount: number;
  /** Rows that are bank-to-bank moves (hidden from income/expense totals) */
  internalTransferCount: number;
};
