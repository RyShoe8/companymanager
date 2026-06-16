/** Format stored cents for dollar input fields (e.g. 3900 → "39.00"). */
export function formatCentsAsDollarInput(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0;
  return (safe / 100).toFixed(2);
}

/** Parse a dollar string into integer cents (e.g. "39" → 3900, "$39.99" → 3999). */
export function parseDollarInputToCents(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const dollars = Number.parseFloat(cleaned);
  if (!Number.isFinite(dollars) || dollars < 0) return 0;
  return Math.round(dollars * 100);
}
