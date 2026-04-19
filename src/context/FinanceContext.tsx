import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  buildAnalytics,
  filterTransactions,
  processTransactions,
} from "@/lib/finance";
import type {
  Analytics,
  CategoryMapping,
  FinanceFilters,
  ProcessedTransaction,
  RawTransaction,
} from "@/types";

type FinanceContextValue = {
  processed: ProcessedTransaction[];
  mapping: CategoryMapping;
  filters: FinanceFilters;
  setFilters: (
    f: FinanceFilters | ((p: FinanceFilters) => FinanceFilters),
  ) => void;
  filtered: ProcessedTransaction[];
  analytics: Analytics;
  availableCalendarYears: number[];
  availableCalendarMonthsForYear: (year: number) => number[];
  availableCycleYears: number[];
  availableCycleMonthsForYear: (cycleYear: number) => number[];
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

const emptyFilters: FinanceFilters = {
  periodMode: "calendar",
  calendarFromYear: "all",
  calendarFromMonth: "all",
  calendarToYear: "all",
  calendarToMonth: "all",
  cycleFromYear: "all",
  cycleFromMonth: "all",
  cycleToYear: "all",
  cycleToMonth: "all",
  includeExcluded: false,
};

function defaultFiltersFromData(
  processed: ProcessedTransaction[],
): FinanceFilters {
  if (processed.length === 0) return emptyFilters;
  let latest = processed[0];
  for (const t of processed) {
    if (t.date > latest.date) latest = t;
  }
  return {
    periodMode: "calendar",
    calendarFromYear: latest.year,
    calendarFromMonth: latest.month,
    calendarToYear: latest.year,
    calendarToMonth: latest.month,
    cycleFromYear: latest.cycleYear,
    cycleFromMonth: latest.cycleMonth,
    cycleToYear: latest.cycleYear,
    cycleToMonth: latest.cycleMonth,
    includeExcluded: false,
  };
}

export function FinanceProvider({
  children,
  rawTransactions,
  mapping,
}: {
  children: ReactNode;
  rawTransactions: RawTransaction[];
  mapping: CategoryMapping;
}) {
  const processed = useMemo(
    () => processTransactions(rawTransactions, mapping),
    [rawTransactions, mapping],
  );

  const [filters, setFiltersState] = useState<FinanceFilters>(emptyFilters);

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current || processed.length === 0) return;
    initRef.current = true;
    setFiltersState(defaultFiltersFromData(processed));
  }, [processed]);

  const setFilters = useCallback(
    (f: FinanceFilters | ((p: FinanceFilters) => FinanceFilters)) => {
      setFiltersState((prev) => (typeof f === "function" ? f(prev) : f));
    },
    [],
  );

  const availableCalendarYears = useMemo(() => {
    const s = new Set<number>();
    for (const t of processed) s.add(t.year);
    return [...s].sort((a, b) => a - b);
  }, [processed]);

  const availableCalendarMonthsForYear = useCallback(
    (year: number) => {
      const s = new Set<number>();
      for (const t of processed) {
        if (t.year === year) s.add(t.month);
      }
      return [...s].sort((a, b) => a - b);
    },
    [processed],
  );

  const availableCycleYears = useMemo(() => {
    const s = new Set<number>();
    for (const t of processed) s.add(t.cycleYear);
    return [...s].sort((a, b) => a - b);
  }, [processed]);

  const availableCycleMonthsForYear = useCallback(
    (cycleYear: number) => {
      const s = new Set<number>();
      for (const t of processed) {
        if (t.cycleYear === cycleYear) s.add(t.cycleMonth);
      }
      return [...s].sort((a, b) => a - b);
    },
    [processed],
  );

  const filtered = useMemo(
    () => filterTransactions(processed, filters),
    [processed, filters],
  );

  const analytics = useMemo(
    () => buildAnalytics(filtered, processed, filters.periodMode),
    [filtered, processed, filters.periodMode],
  );

  const value: FinanceContextValue = {
    processed,
    mapping,
    filters,
    setFilters,
    filtered,
    analytics,
    availableCalendarYears,
    availableCalendarMonthsForYear,
    availableCycleYears,
    availableCycleMonthsForYear,
  };

  return (
    <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
