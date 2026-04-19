import type { CategoryMapping } from "@/types";

export const TRANSFER_CATEGORIES = new Set([
  "ComBank Malabe",
  "ComBank Peradeniya",
  "NTB",
]);

const EXCLUDED_CATEGORIES = new Set(["Balance", "Correction", "Modified Bal."]);

const NOTE_SNIPPETS = [
  "balance",
  "difference",
  "ignore",
  "modified bal",
  "for general expense",
  "transferred to expenses",
  "take back savings",
] as const;

export function normalizeNote(note: string): string {
  return note.trim().toLowerCase().replace(/\s+/g, " ");
}

export function mapNoteToSubCategory(
  note: string,
  category: string,
  mapping: CategoryMapping,
): string {
  if (TRANSFER_CATEGORIES.has(category)) return "";
  const block = mapping[category];
  if (!block) return "";
  const key = normalizeNote(note);
  if (!key) return "";
  return block.subCategories[key] ?? "";
}

export function checkExclusion(
  category: string,
  note: string,
): { excluded: boolean; reason: string } {
  if (EXCLUDED_CATEGORIES.has(category)) {
    return { excluded: true, reason: `Category “${category}” is excluded` };
  }
  const lower = note.toLowerCase();
  for (const s of NOTE_SNIPPETS) {
    if (lower.includes(s)) {
      return { excluded: true, reason: `Note matches “${s}”` };
    }
  }
  return { excluded: false, reason: "" };
}

export function displayNameForCategory(
  category: string,
  mapping: CategoryMapping,
): string {
  return mapping[category]?.displayName ?? category;
}
