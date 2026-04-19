import type { ChatChartSpec } from "@/lib/openaiChat";

/** Tool result shape from `build_expense_chart`. */
export function chartSpecFromExpenseToolResult(
  result: object,
): ChatChartSpec | null {
  if (!result || typeof result !== "object" || "error" in result) return null;
  const r = result as Record<string, unknown>;
  if (r._widget !== "expense_chart") return null;
  const segments = r.segments as { name: string; value: number }[] | undefined;
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const kind = r.chartKind === "bar" ? "bar" : "pie";
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `chart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
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
