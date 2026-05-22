/**
 * Server-safe parsing for project font palette strings (font family names / stacks).
 */

const MAX_FONT_FAMILY_LENGTH = 120;
const MAX_FONT_PALETTE_ENTRIES = 12;

export function labelForFontPaletteIndex(i: number): string {
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
      return `Font ${i + 1}`;
  }
}

/** Allowed chars for font family names and simple CSS stacks. */
const FONT_FAMILY_PATTERN = /^[\p{L}\p{N}\s,"'\-._]+$/u;

function stripControlChars(s: string): string {
  return s.replace(/[\x00-\x1f\x7f]/g, '');
}

/**
 * Validates a font family name or short CSS font-family stack.
 */
export function parseFontFamilyInput(raw: string): { ok: true; normalized: string } | { ok: false } {
  const trimmed = stripControlChars(raw.trim());
  if (!trimmed) return { ok: false };
  if (trimmed.length > MAX_FONT_FAMILY_LENGTH) return { ok: false };
  if (!FONT_FAMILY_PATTERN.test(trimmed)) return { ok: false };
  return { ok: true, normalized: trimmed };
}

export const maxFontPaletteEntries = MAX_FONT_PALETTE_ENTRIES;
