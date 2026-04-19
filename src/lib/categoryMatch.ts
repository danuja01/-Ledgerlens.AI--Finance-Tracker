/**
 * Fuzzy matching for LedgerLens display categories when user phrasing
 * doesn't exactly match (e.g. "Vehicle repairs" vs "🚗  Vehicle Maintain").
 */

/** Words treated as related for budgeting categories (expand when scoring). */
const TOKEN_EQUIVALENCE: string[][] = [
  [
    "repair",
    "repairs",
    "repairing",
    "maintain",
    "maintains",
    "maintaining",
    "maintenance",
    "servicing",
    "service",
    "services",
  ],
  ["food", "groceries", "grocery"],
  ["bill", "bills", "billing"],
  ["fee", "fees"],
  ["subscription", "subscriptions", "subs"],
  ["travel", "travelling", "traveling", "trip", "trips"],
  ["health", "medical", "medicine", "pharmacy"],
  ["entertainment", "leisure", "fun"],
  ["transfer", "transfers"],
  ["vehicle", "vehicles", "car", "cars", "auto", "automotive", "motor"],
];

function buildEquivalenceMap(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const group of TOKEN_EQUIVALENCE) {
    const set = new Set(group);
    for (const w of group) {
      map.set(w, set);
    }
  }
  return map;
}

const EQUIV_MAP = buildEquivalenceMap();

function expandToken(t: string): Set<string> {
  const s = new Set<string>([t]);
  const eq = EQUIV_MAP.get(t);
  if (eq) for (const x of eq) s.add(x);
  return s;
}

/** Remove emoji / pictographic chars so "🚗  Vehicle" compares to "Vehicle". */
export function stripForMatch(s: string): string {
  return s
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/[\uFE0F\u200d]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function norm(s: string): string {
  return stripForMatch(s).trim().toLowerCase();
}

export function tokenize(s: string): string[] {
  return norm(s)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function expandTokenSet(tokens: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const t of tokens) {
    for (const x of expandToken(t)) out.add(x);
  }
  return out;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + cost,
      );
      prev = tmp;
    }
  }
  return dp[n];
}

function levenshteinSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const d = levenshtein(a, b);
  return 1 - d / Math.max(a.length, b.length);
}

/**
 * Score 0–1: higher = query refers to this category name.
 */
export function scoreDisplayCategoryMatch(query: string, categoryName: string): number {
  const q = norm(query);
  const n = norm(categoryName);
  if (!q || !n) return 0;
  if (q === n) return 1;

  if (n.includes(q) || q.includes(n)) return 0.9;

  const qt = tokenize(query);
  const nt = tokenize(categoryName);
  if (qt.length === 0 || nt.length === 0) {
    return levenshteinSimilarity(q, n);
  }

  const qExp = expandTokenSet(qt);
  const nExp = expandTokenSet(nt);
  let inter = 0;
  for (const x of qExp) {
    if (nExp.has(x)) inter++;
  }
  // Weighted: require overlap on "content" words, not only stopwords
  const union = new Set([...qExp, ...nExp]).size;
  const jacc = union ? inter / union : 0;

  const lev = levenshteinSimilarity(q, n);

  // Bonus if every query token has *some* expanded hit in candidate
  let queryCover = 0;
  for (const t of qt) {
    const ex = expandToken(t);
    const hit = [...ex].some((e) => nExp.has(e));
    if (hit) queryCover++;
  }
  const cover = qt.length ? queryCover / qt.length : 0;

  return Math.max(jacc * 0.45 + lev * 0.25 + cover * 0.35, jacc, lev * 0.95);
}

const MIN_SCORE = 0.38;
const MIN_GAP = 0.04;

export type ResolveDisplayResult =
  | { match: string }
  | { error: string };

/**
 * Pick best display category from known names using fuzzy + synonym-aware scoring.
 */
export function resolveDisplayCategorySmart(
  uniqueDisplayNames: string[],
  query: string,
): ResolveDisplayResult {
  const q = norm(query);
  if (!q) return { error: "Empty category query" };

  const names = [...new Set(uniqueDisplayNames)].sort();
  const exact = names.find((n) => norm(n) === q);
  if (exact) return { match: exact };

  const scored = names.map((name) => ({
    name,
    score: scoreDisplayCategoryMatch(query, name),
  }));
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];
  if (!best || best.score < MIN_SCORE) {
    const examples = names.slice(0, 15).join(", ");
    return {
      error: `No category close enough to "${query}". Try one of: ${examples}`,
    };
  }
  if (second && best.score - second.score < MIN_GAP && best.score < 0.72) {
    return {
      error: `Ambiguous category "${query}". Closest: ${best.name} (${best.score.toFixed(2)}), ${second.name} (${second.score.toFixed(2)}). Pick an exact name from your ledger.`,
    };
  }
  return { match: best.name };
}
