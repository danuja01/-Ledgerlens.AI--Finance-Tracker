import { FinancialChat } from "@/components/FinancialChat";
import { Layout } from "@/components/Layout";
import { FinanceProvider } from "@/context/FinanceContext";
import categoryMapping from "@/data/categoryMapping.json";
import rawTransactions from "@/data/transactions.json";
import { Home } from "@/pages/Home";
import { ExpenseAnalysis } from "@/pages/ExpenseAnalysis";
import { IncomeAnalysis } from "@/pages/IncomeAnalysis";
import type { CategoryMapping, RawTransaction } from "@/types";
import { useState } from "react";

type Tab = "home" | "expense" | "income";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const mapping = categoryMapping as CategoryMapping;
  const txs = rawTransactions as RawTransaction[];

  return (
    <FinanceProvider rawTransactions={txs} mapping={mapping}>
      <Layout tab={tab} onTab={setTab}>
        {tab === "home" && <Home />}
        {tab === "expense" && <ExpenseAnalysis />}
        {tab === "income" && <IncomeAnalysis />}
      </Layout>
      <FinancialChat />
    </FinanceProvider>
  );
}
