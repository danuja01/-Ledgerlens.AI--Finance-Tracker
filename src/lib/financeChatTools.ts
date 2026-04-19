import { countsForCashflow } from "@/lib/finance";
import type { Analytics, FinanceFilters, ProcessedTransaction } from "@/types";
import {
  buildExpenseChartAggregation,
  describeTimeScope,
  queryLedger,
  subcategoryRollupForScope,
  type ExpenseChartGroupBy,
  type LedgerDimensions,
  type TimeScopeArg,
} from "@/lib/ledgerQueryEngine";

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

export function formatLedgerFiltersSummary(f: FinanceFilters): string {
  const mn = (n: number) => MONTHS[n - 1];
  if (f.periodMode === "calendar") {
    const lo =
      f.calendarFromYear !== "all" && f.calendarFromMonth !== "all"
        ? `${mn(f.calendarFromMonth)} ${f.calendarFromYear}`
        : "open (no start bound)";
    const hi =
      f.calendarToYear !== "all" && f.calendarToMonth !== "all"
        ? `${mn(f.calendarToMonth)} ${f.calendarToYear}`
        : "open (no end bound)";
    return `Calendar months (inclusive): ${lo} through ${hi}.`;
  }
  const lo =
    f.cycleFromYear !== "all" && f.cycleFromMonth !== "all"
      ? `cycle ${mn(f.cycleFromMonth)} ${f.cycleFromYear}`
      : "open (no start bound)";
  const hi =
    f.cycleToYear !== "all" && f.cycleToMonth !== "all"
      ? `cycle ${mn(f.cycleToMonth)} ${f.cycleToYear}`
      : "open (no end bound)";
  return `Salary cycle (inclusive): ${lo} through ${hi}.`;
}

export type FinanceToolContext = {
  /** Full dataset (tools can override the dashboard period). */
  processed: ProcessedTransaction[];
  filtered: ProcessedTransaction[];
  analytics: Analytics;
  filters: FinanceFilters;
};

const TIME_SCOPE_SCHEMA = {
  type: "object",
  description:
    "Which time window to query. Use dashboard only if the user did not name a different calendar/salary range. If they say e.g. Jan–Apr 2026, use calendar_months or iso_dates — do NOT rely on dashboard alone.",
  properties: {
    kind: {
      type: "string",
      enum: [
        "dashboard",
        "calendar_months",
        "iso_dates",
        "salary_cycles",
      ],
    },
    fromYear: { type: "number" },
    fromMonth: { type: "number", minimum: 1, maximum: 12 },
    toYear: { type: "number" },
    toMonth: { type: "number", minimum: 1, maximum: 12 },
    dateFrom: {
      type: "string",
      description: "YYYY-MM-DD inclusive",
    },
    dateTo: { type: "string", description: "YYYY-MM-DD inclusive" },
    fromCycleYear: { type: "number" },
    fromCycleMonth: { type: "number", minimum: 1, maximum: 12 },
    toCycleYear: { type: "number" },
    toCycleMonth: { type: "number", minimum: 1, maximum: 12 },
  },
  required: ["kind"],
} as const;

const DIMENSION_SCHEMA = {
  type: "object",
  properties: {
    direction: {
      type: "string",
      enum: ["expense", "income", "both"],
      description: "Default expense for spending questions.",
    },
    displayCategories: {
      type: "array",
      items: { type: "string" },
      description:
        "OR match: any of these display category names (e.g. Food & Groceries). Omit for all.",
    },
    subCategories: {
      type: "array",
      items: { type: "string" },
      description:
        "OR match: any of these mapped sub-categories (e.g. Barista, Coffee). Omit for all.",
    },
    amountMin: { type: "number", description: "Inclusive min transaction amount" },
    amountMax: { type: "number", description: "Inclusive max transaction amount" },
    noteContains: {
      type: "string",
      description: "Case-insensitive substring match on note",
    },
    cashflowRowsOnly: {
      type: "boolean",
      description:
        "Default true: exclude excluded rows and inter-account transfers (ComBank/NTB). Set false only for raw ledger questions.",
    },
  },
} as const;

export const FINANCE_TOOLS: unknown[] = [
  {
    type: "function",
    function: {
      name: "summarize_dashboard",
      description:
        "Totals and row counts for the **current dashboard filter only** (no chat period override). Use query_ledger when the user names a specific month/year or date range.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "query_ledger",
      description:
        "Primary query: filter transactions by time scope (dashboard OR explicit calendar months / ISO dates / salary cycles), optional multiple display categories and sub-categories (OR within each list), amount bounds, note text. Returns exact rows (capped) and aggregates. Always set timeScope when the user asks for a period — use calendar_months or iso_dates for Jan–Apr 2026 style questions.",
      parameters: {
        type: "object",
        properties: {
          timeScope: TIME_SCOPE_SCHEMA,
          dimensions: DIMENSION_SCHEMA,
          maxTransactions: { type: "number", description: "Max rows to return (default 100, max 200)" },
          sort: { type: "string", enum: ["date_asc", "date_desc"] },
        },
        required: ["timeScope", "dimensions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_subcategory_totals",
      description:
        "Ranked expense sub-category rollup (sum + count) for a time scope. Optional filter to one or more display categories.",
      parameters: {
        type: "object",
        properties: {
          timeScope: TIME_SCOPE_SCHEMA,
          displayCategories: {
            type: "array",
            items: { type: "string" },
            description: "Optional: restrict to these display categories (OR)",
          },
          limit: { type: "number", description: "Max sub-category rows (default 50)" },
        },
        required: ["timeScope"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "build_expense_chart",
      description:
        "Prepare data for an **inline expense chart** (pie or bar) in the chat UI. Call this when the user asks to visualize, chart, graph, or see a breakdown of spending (e.g. pie chart Jan–Apr 2026). Use the same timeScope rules as query_ledger. Returns segment totals for the assistant to summarize; the app renders the chart automatically.",
      parameters: {
        type: "object",
        properties: {
          timeScope: TIME_SCOPE_SCHEMA,
          groupBy: {
            type: "string",
            enum: ["display_category", "subcategory"],
            description:
              "display_category = one slice per main category; subcategory = finer slices (Category › Sub).",
          },
          chartKind: {
            type: "string",
            enum: ["pie", "bar", "auto"],
            description:
              "auto = pie if not too many segments, else horizontal bar. Prefer pie when user asks for pie chart.",
          },
          topN: {
            type: "number",
            description: "Max segments before merging rest into Other (default 12, max 25)",
          },
          title: {
            type: "string",
            description: "Short chart title, e.g. Expenses by category (Jan–Apr 2026)",
          },
        },
        required: ["timeScope"],
      },
    },
  },
];

function parseTimeScope(raw: unknown): TimeScopeArg | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "timeScope must be an object" };
  const ts = raw as Record<string, unknown>;
  if (ts.kind === undefined || ts.kind === null || ts.kind === "") {
    return { error: "timeScope.kind is required (dashboard | calendar_months | iso_dates | salary_cycles)" };
  }
  const kind = String(ts.kind);
  if (kind === "dashboard") return { kind: "dashboard" };
  if (kind === "calendar_months") {
    const fromYear = Number(ts.fromYear);
    const fromMonth = Number(ts.fromMonth);
    const toYear = Number(ts.toYear);
    const toMonth = Number(ts.toMonth);
    if ([fromYear, fromMonth, toYear, toMonth].some((n) => Number.isNaN(n))) {
      return { error: "calendar_months: invalid year/month numbers" };
    }
    return {
      kind: "calendar_months",
      fromYear,
      fromMonth,
      toYear,
      toMonth,
    };
  }
  if (kind === "iso_dates") {
    return {
      kind: "iso_dates",
      dateFrom: String(ts.dateFrom),
      dateTo: String(ts.dateTo),
    };
  }
  if (kind === "salary_cycles") {
    const fromCycleYear = Number(ts.fromCycleYear);
    const fromCycleMonth = Number(ts.fromCycleMonth);
    const toCycleYear = Number(ts.toCycleYear);
    const toCycleMonth = Number(ts.toCycleMonth);
    if (
      [fromCycleYear, fromCycleMonth, toCycleYear, toCycleMonth].some((n) =>
        Number.isNaN(n),
      )
    ) {
      return { error: "salary_cycles: invalid cycle year/month numbers" };
    }
    return {
      kind: "salary_cycles",
      fromCycleYear,
      fromCycleMonth,
      toCycleYear,
      toCycleMonth,
    };
  }
  return { error: `Unknown timeScope.kind: ${kind}` };
}

function parseDimensions(raw: unknown): LedgerDimensions | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "dimensions must be an object" };
  }
  const d = raw as Record<string, unknown>;
  const direction = (d.direction as LedgerDimensions["direction"]) ?? "expense";
  if (direction !== "expense" && direction !== "income" && direction !== "both") {
    return { error: "dimensions.direction must be expense, income, or both" };
  }
  const displayCategories = Array.isArray(d.displayCategories)
    ? d.displayCategories.map((x) => String(x))
    : undefined;
  const subCategories = Array.isArray(d.subCategories)
    ? d.subCategories.map((x) => String(x))
    : undefined;
  const amin = d.amountMin !== undefined ? Number(d.amountMin) : undefined;
  const amax = d.amountMax !== undefined ? Number(d.amountMax) : undefined;
  return {
    direction,
    displayCategories,
    subCategories,
    amountMin: amin !== undefined && !Number.isNaN(amin) ? amin : undefined,
    amountMax: amax !== undefined && !Number.isNaN(amax) ? amax : undefined,
    noteContains: d.noteContains !== undefined ? String(d.noteContains) : undefined,
    cashflowRowsOnly:
      d.cashflowRowsOnly !== undefined ? Boolean(d.cashflowRowsOnly) : true,
  };
}

function expenseCashflowRows(ctx: FinanceToolContext): ProcessedTransaction[] {
  return ctx.filtered.filter(
    (t) => t.direction === "expense" && countsForCashflow(t),
  );
}

export function executeFinanceTool(
  ctx: FinanceToolContext,
  name: string,
  argsJson: string,
): object {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || "{}") as Record<string, unknown>;
  } catch {
    return { error: "Invalid JSON arguments" };
  }

  switch (name) {
    case "summarize_dashboard": {
      const { analytics, filters, filtered } = ctx;
      const exp = expenseCashflowRows(ctx);
      const inc = ctx.filtered.filter(
        (t) => t.direction === "income" && countsForCashflow(t),
      );
      return {
        currency: "LKR",
        filtersSummary: formatLedgerFiltersSummary(filters),
        filters,
        totals: {
          totalIncome: analytics.totalIncome,
          totalExpense: analytics.totalExpense,
          netCashflow: analytics.netCashflow,
          savingsRatePct: analytics.savingsRate,
        },
        rowCounts: {
          filteredTransactions: filtered.length,
          expenseRowsCashflow: exp.length,
          incomeRowsCashflow: inc.length,
        },
        hint:
          "For questions that name a specific calendar or salary period different from the dashboard, call query_ledger with an explicit timeScope (calendar_months or iso_dates).",
      };
    }
    case "query_ledger": {
      const ts = parseTimeScope(args.timeScope);
      if ("error" in ts) return { error: ts.error };
      const dims = parseDimensions(args.dimensions);
      if ("error" in dims) return { error: dims.error };
      const maxTransactions = args.maxTransactions
        ? Number(args.maxTransactions)
        : 100;
      const sort =
        args.sort === "date_desc" ? "date_desc" : "date_asc";
      const result = queryLedger(
        ctx.processed,
        ctx.filters,
        ctx.filtered,
        ts,
        dims,
        { maxTransactions, sort },
      );
      if (!result.ok) return { error: result.error };
      return {
        ...result,
        hint:
          "If rowCount is larger than maxTransactions, totals still reflect full rowCount; only the transactions array is truncated.",
      };
    }
    case "list_subcategory_totals": {
      const ts = parseTimeScope(args.timeScope);
      if ("error" in ts) return { error: ts.error };
      const displayCategories = Array.isArray(args.displayCategories)
        ? args.displayCategories.map((x) => String(x))
        : undefined;
      const limit = args.limit !== undefined ? Number(args.limit) : 50;
      const result = subcategoryRollupForScope(
        ctx.processed,
        ctx.filters,
        ctx.filtered,
        ts,
        { displayCategories, limit },
      );
      if (!result.ok) return { error: result.error };
      return {
        currency: "LKR",
        rows: result.rows,
        rowCount: result.rows.length,
      };
    }
    case "build_expense_chart": {
      const ts = parseTimeScope(args.timeScope);
      if ("error" in ts) return { error: ts.error };
      const groupBy = (args.groupBy === "subcategory"
        ? "subcategory"
        : "display_category") as ExpenseChartGroupBy;
      const topN = Math.min(
        25,
        Math.max(3, Number(args.topN) || 12),
      );
      const { segments, totalExpense } = buildExpenseChartAggregation(
        ctx.processed,
        ctx.filters,
        ctx.filtered,
        ts,
        { groupBy, topN },
      );
      const chartKindArg = String(args.chartKind ?? "auto");
      const chartKind =
        chartKindArg === "pie"
          ? "pie"
          : chartKindArg === "bar"
            ? "bar"
            : segments.length <= 14
              ? "pie"
              : "bar";
      const periodLabel = describeTimeScope(ts, ctx.filters);
      const defaultTitle =
        groupBy === "display_category"
          ? "Expenses by category"
          : "Expenses by sub-category";
      const title =
        typeof args.title === "string" && args.title.trim()
          ? args.title.trim()
          : defaultTitle;
      return {
        _widget: "expense_chart",
        title,
        subtitle: `${periodLabel} · Total ${Math.round(totalExpense).toLocaleString()} LKR (cashflow expenses)`,
        chartKind,
        currency: "LKR",
        segments,
        totalExpense,
        segmentCount: segments.length,
        hint: "Summarize these figures in your reply; the user also sees an interactive chart in the chat.",
      };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
