/**
 * Server-safe parsing for project palette strings (#hex and rgb()/rgba() only).
 */

export function labelForPaletteIndex(i: number): string {
  switch (i) {
    case 0:
      return 'Primary';
    case 1:
      return 'Secondary';
    case 2:
      return 'Third';
    case 3:
      return 'Fourth';
    default:
      return `Color ${i + 1}`;
  }
}

function parseHexChannel(s: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s);
}

function clampRgbByte(v: number): boolean {
  return Number.isFinite(v) && v >= 0 && v <= 255;
}

function parsePercentageChannel(s: string): number | null {
  const m = /^(-?\d*\.?\d+)%\s*$/.exec(s.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round((n / 100) * 255);
}

function parseRgbByteChannel(s: string): number | null {
  const t = s.trim();
  const pct = parsePercentageChannel(t);
  if (pct !== null) return pct;
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  if (!clampRgbByte(n)) return null;
  return Math.round(n);
}

function parseAlphaChannel(s: string): boolean {
  const t = s.trim();
  const mPct = /^(-?\d*\.?\d+)%\s*$/.exec(t);
  if (mPct) {
    const n = parseFloat(mPct[1]);
    return Number.isFinite(n) && n >= 0 && n <= 100;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) && n >= 0 && n <= 1;
}

/** Split top-level commas inside rgb()/rgba() (no nested parens expected). */
function splitRgbArgs(inner: string): string[] {
  return inner.split(',').map((p) => p.trim()).filter(Boolean);
}

function parseRgbFunctional(trimmed: string): boolean {
  const m = /^rgba?\(\s*([\s\S]+)\s*\)$/i.exec(trimmed);
  if (!m) return false;
  const parts = splitRgbArgs(m[1]);
  const lower = trimmed.toLowerCase();
  const wantAlpha = lower.startsWith('rgba(');
  if (wantAlpha) {
    if (parts.length !== 4) return false;
    const [rs, gs, bs, as] = parts;
    if (parseRgbByteChannel(rs) === null) return false;
    if (parseRgbByteChannel(gs) === null) return false;
    if (parseRgbByteChannel(bs) === null) return false;
    return parseAlphaChannel(as);
  }
  if (parts.length !== 3) return false;
  return parts.every((p, idx) => {
    void idx;
    return parseRgbByteChannel(p) !== null;
  });
}

/**
 * Validates hex (#rgb / #rrggbb / #rrggbbaa) or rgb() / rgba() syntax with numeric bounds.
 */
export function parseCssColorInput(raw: string): { ok: true; normalized: string } | { ok: false } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false };

  if (trimmed.startsWith('#')) {
    if (!parseHexChannel(trimmed)) return { ok: false };
    return { ok: true, normalized: trimmed };
  }

  if (/^rgba?\(/i.test(trimmed)) {
    if (!parseRgbFunctional(trimmed)) return { ok: false };
    return { ok: true, normalized: trimmed };
  }

  return { ok: false };
}
