/**
 * Estimated Brave / Google CSE costs after free allotments.
 * Defaults approximate public list prices (~$5 / 1k queries); override via env.
 */

export type SearchApiProviderKind = 'brave' | 'google_cse_web' | 'google_cse_image';

/** Micros charged per billable query after free tier (default $5 / 1000). */
export function searchApiMicrosPerQuery(): number {
  const dollarsPerThousand = Number(process.env.SEARCH_API_DOLLARS_PER_1K ?? '5');
  const safe = Number.isFinite(dollarsPerThousand) && dollarsPerThousand >= 0 ? dollarsPerThousand : 5;
  return Math.round((safe / 1000) * 1_000_000);
}

export function braveFreeQueriesPerMonth(): number {
  const n = Number(process.env.BRAVE_SEARCH_FREE_QUERIES_PER_MONTH ?? '2000');
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 2000;
}

/** Google Programmable Search free quota is typically ~100 queries/day. */
export function googleCseFreeQueriesPerDay(): number {
  const n = Number(process.env.GOOGLE_CSE_FREE_QUERIES_PER_DAY ?? '100');
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 100;
}

export function estimateSearchApiMicros(input: {
  braveQueries: number;
  googleCseQueries: number;
  /** Day of month 1–31; used to approximate Google's daily free pool for the month so far. */
  dayOfMonth: number;
}): number {
  const rate = searchApiMicrosPerQuery();
  const braveBillable = Math.max(0, input.braveQueries - braveFreeQueriesPerMonth());
  const googleFreePool = googleCseFreeQueriesPerDay() * Math.max(1, Math.min(31, input.dayOfMonth));
  const googleBillable = Math.max(0, input.googleCseQueries - googleFreePool);
  return Math.floor(braveBillable * rate + googleBillable * rate);
}
