import { countsForCashflow } from "@/lib/finance";
import type { Analytics, FinanceFilters, ProcessedTransaction } from "@/types";
import {
  buildExpenseChartAggregation,
  buildTrendChartData,
  describeTimeScope,
  queryLedger,
  resolveDisplayList,
  resolveSubCategoryList,
  subcategoryRollupForScope,
  type ExpenseChartGroupBy,
  type LedgerDimensions,
  type TimeScopeArg,
  type TrendDirection,
  type TrendSeriesBy,
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
        "Legacy: use build_chart instead. Kept for backward compatibility — generates a breakdown pie/bar chart.",
      parameters: {
        type: "object",
        properties: {
          timeScope: TIME_SCOPE_SCHEMA,
          groupBy: { type: "string", enum: ["display_category", "subcategory"] },
          displayCategories: { type: "array", items: { type: "string" } },
          subCategories: { type: "array", items: { type: "string" } },
          chartKind: { type: "string", enum: ["pie", "bar", "auto"] },
          topN: { type: "number" },
          title: { type: "string" },
        },
        required: ["timeScope"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "build_chart",
      description:
        "Generate any inline chart widget in the chat. Choose chartType based on what the user wants:\n" +
        "• 'breakdown' — pie or horizontal bar showing distribution of spending across categories/sub-categories in a period.\n" +
        "• 'trend' — line or vertical bar chart showing how spending (or income) changes month by month.\n" +
        "• 'cashflow' — grouped bar showing income vs expenses each month, with a net line.\n\n" +
        "ALWAYS carry over the exact context filters (timeScope, displayCategories, subCategories) from prior turns. " +
        "Never widen the scope beyond what the user asked.",
      parameters: {
        type: "object",
        properties: {
          chartType: {
            type: "string",
            enum: ["breakdown", "trend", "cashflow"],
            description:
              "breakdown = pie/bar distribution; trend = month-by-month line/bar; cashflow = income vs expense over time.",
          },
          timeScope: TIME_SCOPE_SCHEMA,
          displayCategories: {
            type: "array",
            items: { type: "string" },
            description:
              "Scope the chart to these display category names (OR logic). Copy from context if previous query used a category filter.",
          },
          subCategories: {
            type: "array",
            items: { type: "string" },
            description: "Further restrict to these sub-categories (OR logic).",
          },
          // ── breakdown params ──
          groupBy: {
            type: "string",
            enum: ["display_category", "subcategory"],
            description:
              "breakdown only. display_category = one slice per main category; subcategory = one slice per sub-category. Use subcategory when already scoped to one category.",
          },
          topN: {
            type: "number",
            description:
              "breakdown only. Max segments before collapsing rest into 'Other' (default 12, max 25).",
          },
          chartKind: {
            type: "string",
            enum: ["pie", "bar", "line", "trend_bar", "auto"],
            description:
              "Chart render style. auto = sensible default for chartType. pie/bar for breakdown; line/trend_bar for trend.",
          },
          // ── trend params ──
          direction: {
            type: "string",
            enum: ["expense", "income", "both"],
            description:
              "trend only. expense = spending trend; income = income trend; both = show both series on same chart. Default expense.",
          },
          seriesBy: {
            type: "string",
            enum: ["total", "display_category"],
            description:
              "trend only. total = one line for overall amount; display_category = one line per top category (multi-series). Use display_category for 'compare categories over time'.",
          },
          maxSeries: {
            type: "number",
            description:
              "trend seriesBy=display_category only. Max category lines (default 6, max 10).",
          },
          // ── shared ──
          title: {
            type: "string",
            description: "Chart title shown to the user.",
          },
        },
        required: ["chartType", "timeScope"],
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
      const topN = Math.min(25, Math.max(3, Number(args.topN) || 12));

      // Category filters — resolve with fuzzy matching
      const rawDisplayCats = Array.isArray(args.displayCategories)
        ? args.displayCategories.map((x) => String(x))
        : undefined;
      const rawSubCats = Array.isArray(args.subCategories)
        ? args.subCategories.map((x) => String(x))
        : undefined;

      // Validate up front so we can surface clear errors
      if (rawDisplayCats?.length) {
        const check = resolveDisplayList(ctx.processed, rawDisplayCats);
        if ("error" in check) return { error: check.error };
      }
      if (rawSubCats?.length) {
        const check = resolveSubCategoryList(ctx.processed, rawSubCats);
        if ("error" in check) return { error: check.error };
      }

      const { segments, totalExpense, appliedCategoryFilter } =
        buildExpenseChartAggregation(ctx.processed, ctx.filters, ctx.filtered, ts, {
          groupBy,
          topN,
          displayCategories: rawDisplayCats,
          subCategories: rawSubCats,
        });

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
      const catLabel =
        appliedCategoryFilter?.length
          ? appliedCategoryFilter.join(" + ")
          : rawDisplayCats?.length
            ? rawDisplayCats.join(" + ")
            : null;
      const defaultTitle = catLabel
        ? groupBy === "subcategory"
          ? `${catLabel} — by sub-category`
          : `${catLabel} — by category`
        : groupBy === "display_category"
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
        appliedCategoryFilter: appliedCategoryFilter ?? null,
        hint: "Summarize these figures in your reply; the user also sees an interactive chart in the chat.",
      };
    }
    case "build_chart": {
      const ts = parseTimeScope(args.timeScope);
      if ("error" in ts) return { error: ts.error };

      const chartType = String(args.chartType ?? "breakdown") as
        | "breakdown"
        | "trend"
        | "cashflow";

      const rawDisplayCats = Array.isArray(args.displayCategories)
        ? (args.displayCategories as unknown[]).map((x) => String(x))
        : undefined;
      const rawSubCats = Array.isArray(args.subCategories)
        ? (args.subCategories as unknown[]).map((x) => String(x))
        : undefined;

      // ── breakdown ──────────────────────────────────────────────
      if (chartType === "breakdown") {
        const groupBy = (
          args.groupBy === "subcategory" ? "subcategory" : "display_category"
        ) as ExpenseChartGroupBy;
        const topN = Math.min(25, Math.max(3, Number(args.topN) || 12));

        if (rawDisplayCats?.length) {
          const check = resolveDisplayList(ctx.processed, rawDisplayCats);
          if ("error" in check) return { error: check.error };
        }
        if (rawSubCats?.length) {
          const check = resolveSubCategoryList(ctx.processed, rawSubCats);
          if ("error" in check) return { error: check.error };
        }

        const { segments, totalExpense, appliedCategoryFilter } =
          buildExpenseChartAggregation(
            ctx.processed,
            ctx.filters,
            ctx.filtered,
            ts,
            { groupBy, topN, displayCategories: rawDisplayCats, subCategories: rawSubCats },
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
        const catLabel = appliedCategoryFilter?.length
          ? appliedCategoryFilter.join(" + ")
          : rawDisplayCats?.length
            ? rawDisplayCats.join(" + ")
            : null;
        const defaultTitle = catLabel
          ? groupBy === "subcategory"
            ? `${catLabel} — by sub-category`
            : `${catLabel} — by category`
          : groupBy === "display_category"
            ? "Expenses by category"
            : "Expenses by sub-category";
        const title =
          typeof args.title === "string" && args.title.trim()
            ? args.title.trim()
            : defaultTitle;
        return {
          _widget: "expense_chart",
          title,
          subtitle: `${periodLabel} · Total ${Math.round(totalExpense).toLocaleString()} LKR`,
          chartKind,
          currency: "LKR",
          segments,
          totalExpense,
          segmentCount: segments.length,
          appliedCategoryFilter: appliedCategoryFilter ?? null,
          hint: "An interactive chart is shown in the chat. Summarize the key numbers.",
        };
      }

      // ── trend or cashflow ──────────────────────────────────────
      const direction: TrendDirection =
        chartType === "cashflow"
          ? "both"
          : (["expense", "income", "both"].includes(String(args.direction))
              ? (args.direction as TrendDirection)
              : "expense");

      const seriesBy: TrendSeriesBy =
        chartType === "cashflow"
          ? "total"
          : args.seriesBy === "display_category"
            ? "display_category"
            : "total";

      const maxSeries = Math.min(10, Math.max(2, Number(args.maxSeries) || 6));

      const result = buildTrendChartData(
        ctx.processed,
        ctx.filters,
        ctx.filtered,
        ts,
        {
          direction,
          seriesBy,
          displayCategories: rawDisplayCats,
          subCategories: rawSubCats,
          maxSeries,
        },
      );
      if ("error" in result) return { error: result.error };

      if (result.data.length === 0) {
        return { error: "No data found for the specified period and filters." };
      }

      const periodLabel = describeTimeScope(ts, ctx.filters);
      const catLabel =
        result.appliedCategoryFilter?.length
          ? result.appliedCategoryFilter.join(" + ")
          : rawDisplayCats?.length
            ? rawDisplayCats.join(" + ")
            : null;

      let defaultTitle: string;
      if (chartType === "cashflow") {
        defaultTitle = catLabel
          ? `Cashflow — ${catLabel}`
          : "Monthly cashflow (income vs expenses)";
      } else if (direction === "income") {
        defaultTitle = catLabel ? `Income trend — ${catLabel}` : "Income over time";
      } else {
        defaultTitle = catLabel
          ? `Spending trend — ${catLabel}`
          : seriesBy === "display_category"
            ? "Spending by category over time"
            : "Spending over time";
      }
      const title =
        typeof args.title === "string" && args.title.trim()
          ? args.title.trim()
          : defaultTitle;

      // Determine chart kind
      let chartKind: string;
      if (chartType === "cashflow") {
        chartKind = "cashflow";
      } else if (args.chartKind === "trend_bar") {
        chartKind = "trend_bar";
      } else if (args.chartKind === "line") {
        chartKind = "line";
      } else {
        // auto: line for multi-series, trend_bar for single series ≤12 months
        chartKind =
          result.series.length > 1
            ? "line"
            : result.data.length <= 12
              ? "trend_bar"
              : "line";
      }

      const widget = chartType === "cashflow" ? "cashflow_chart" : "trend_chart";

      return {
        _widget: widget,
        title,
        subtitle: `${periodLabel}${catLabel ? ` · ${catLabel}` : ""} · Total ${Math.round(result.totalAmount).toLocaleString()} LKR`,
        chartKind,
        currency: "LKR",
        data: result.data,
        series: result.series,
        totalAmount: result.totalAmount,
        appliedCategoryFilter: result.appliedCategoryFilter ?? null,
        hint: "An interactive chart is shown in the chat. Summarize the highlights.",
      };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
