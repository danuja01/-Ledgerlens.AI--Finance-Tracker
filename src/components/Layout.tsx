import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tab = "home" | "expense" | "income";

export function Layout({
  tab,
  onTab,
  children,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  children: ReactNode;
}) {
  const links: { id: Tab; label: string }[] = [
    { id: "home", label: "Overview" },
    { id: "expense", label: "Expense analysis" },
    { id: "income", label: "Income analysis" },
  ];
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-widest text-slate-500">
              LedgerLens
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Personal finance
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Salary-cycle view (23rd–22nd), category drill-down, and income
              breakdown — from your exported ledger.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Primary">
            {links.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onTab(l.id)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  tab === l.id
                    ? "bg-slate-900 text-white shadow-card"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                )}
              >
                {l.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
