import type { ChatChartSpec } from "@/lib/openaiChat";

function makeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `chart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Parse any `_widget` tool result into a ChatChartSpec (or null if not a chart). */
export function chartSpecFromExpenseToolResult(
  result: object,
): ChatChartSpec | null {
  if (!result || typeof result !== "object" || "error" in result) return null;
  const r = result as Record<string, unknown>;

  // ── breakdown / pie / bar ────────────────────────────────────────
  if (r._widget === "expense_chart") {
    const segments = r.segments as { name: string; value: number }[] | undefined;
    if (!Array.isArray(segments) || segments.length === 0) return null;
    const kind = r.chartKind === "bar" ? "bar" : "pie";
    return {
      id: makeId(),
      kind,
      title: String(r.title ?? "Expense chart"),
      subtitle: r.subtitle ? String(r.subtitle) : undefined,
      currency: String(r.currency ?? "LKR"),
      data: segments.map((s) => ({
        name: String(s.name),
        value: Number(s.value) || 0,
      })),
    };
  }

  // ── trend / line / trend_bar ─────────────────────────────────────
  if (r._widget === "trend_chart") {
    const rawData = r.data;
    const rawSeries = r.series;
    if (!Array.isArray(rawData) || !Array.isArray(rawSeries) || rawData.length === 0) return null;
    const kind = r.chartKind === "trend_bar" ? "trend_bar" : "line";
    return {
      id: makeId(),
      kind,
      title: String(r.title ?? "Spending trend"),
      subtitle: r.subtitle ? String(r.subtitle) : undefined,
      currency: String(r.currency ?? "LKR"),
      data: rawData as Record<string, string | number>[],
      series: (rawSeries as { key: string; name: string }[]).map((s) => ({
        key: String(s.key),
        name: String(s.name),
      })),
    };
  }

  // ── cashflow chart ───────────────────────────────────────────────
  if (r._widget === "cashflow_chart") {
    const rawData = r.data;
    const rawSeries = r.series;
    if (!Array.isArray(rawData) || !Array.isArray(rawSeries) || rawData.length === 0) return null;
    return {
      id: makeId(),
      kind: "cashflow",
      title: String(r.title ?? "Monthly cashflow"),
      subtitle: r.subtitle ? String(r.subtitle) : undefined,
      currency: String(r.currency ?? "LKR"),
      data: rawData as Record<string, string | number>[],
      series: (rawSeries as { key: string; name: string }[]).map((s) => ({
        key: String(s.key),
        name: String(s.name),
      })),
    };
  }

  return null;
}
