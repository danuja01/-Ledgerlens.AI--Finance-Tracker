import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export function formatLkr(n: number): string {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPct(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  return `${n.toFixed(1)}%`;
}
