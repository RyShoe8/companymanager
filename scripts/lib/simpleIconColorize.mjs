/**
 * Fetch Simple Icons SVGs and apply brand colors (matching colored social icons).
 */

export const VERSIONS = ['16.23.0', '11.6.0'];

/** Relative luminance threshold — icons at or below this need dark:invert in dark UI. */
const DARK_LUMINANCE_MAX = 0.08;

let hexBySlug = null;

const JSON_PATHS = ['data/simple-icons.json', '_data/simple-icons.json'];

/** v11 metadata is title-keyed; map fetch slugs to catalog titles. */
const SLUG_TITLE_HINTS = {
  amazonaws: 'Amazon AWS',
  microsoftazure: 'Microsoft Azure',
  amazondynamodb: 'Amazon DynamoDB',
  awslambda: 'AWS Lambda',
  heroku: 'Heroku',
  microsoft: 'Microsoft',
  salesforce: 'Salesforce',
};

async function loadHexMap() {
  if (hexBySlug) return hexBySlug;
  hexBySlug = new Map();
  const titleToHex = new Map();

  // Merge metadata from all versions (older releases keep slugs dropped in newer JSON).
  for (const version of [...VERSIONS].reverse()) {
    for (const path of JSON_PATHS) {
      const url = `https://cdn.jsdelivr.net/npm/simple-icons@${version}/${path}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const raw = await res.json();
      const entries = Array.isArray(raw) ? raw : raw.icons;
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!entry?.hex) continue;
        const hex = entry.hex.replace(/^#/, '').toUpperCase();
        if (entry.slug) hexBySlug.set(entry.slug, hex);
        if (entry.title) titleToHex.set(entry.title, hex);
      }
    }
  }

  for (const [slug, title] of Object.entries(SLUG_TITLE_HINTS)) {
    if (!hexBySlug.has(slug) && titleToHex.has(title)) {
      hexBySlug.set(slug, titleToHex.get(title));
    }
  }

  return hexBySlug;
}

export function normalizeHex(hex) {
  if (!hex) return null;
  const h = String(hex).replace(/^#/, '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(h) ? h : null;
}

function hexLuminance(hex) {
  const h = normalizeHex(hex);
  if (!h) return 1;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** True when brand color is near-black and should be inverted on dark backgrounds. */
export function isDarkBrandHex(hex) {
  return hexLuminance(hex) <= DARK_LUMINANCE_MAX;
}

export function colorizeSvg(svg, hex) {
  const color = normalizeHex(hex);
  if (!color) return svg;
  const fill = `#${color}`;
  return svg.replace(/<path(\s[^>]*?)?>/gi, (match) => {
    if (/\bfill\s*=/i.test(match)) return match;
    return match.replace('<path', `<path fill="${fill}"`);
  });
}

async function fetchMonochromeIcon(slug, slugOverrides = {}) {
  const slugs = slugOverrides[slug] ?? [slug];
  for (const version of VERSIONS) {
    for (const s of slugs) {
      const url = `https://cdn.jsdelivr.net/npm/simple-icons@${version}/icons/${s}.svg`;
      const res = await fetch(url);
      if (res.ok) return { svg: await res.text(), resolvedSlug: s };
    }
  }
  return null;
}

/**
 * Fetch a colored Simple Icons SVG for the given slug.
 * @returns {{ svg: string, hex: string, resolvedSlug: string } | null}
 */
export async function fetchColoredIcon(slug, slugOverrides = {}) {
  const map = await loadHexMap();
  const fetched = await fetchMonochromeIcon(slug, slugOverrides);
  if (!fetched) return null;

  const slugsToTry = [...new Set([fetched.resolvedSlug, slug, ...(slugOverrides[slug] ?? [])])];
  let hex = null;
  let resolvedSlug = fetched.resolvedSlug;
  for (const s of slugsToTry) {
    if (map.has(s)) {
      hex = map.get(s);
      resolvedSlug = s;
      break;
    }
  }
  if (!hex) return null;

  return {
    svg: colorizeSvg(fetched.svg, hex),
    hex,
    resolvedSlug,
  };
}

/** Resolve brand hex for a slug (used for lettermark fallbacks). */
export async function getBrandHex(slug, slugOverrides = {}) {
  const map = await loadHexMap();
  const slugs = slugOverrides[slug] ?? [slug];
  for (const s of slugs) {
    if (map.has(s)) return map.get(s);
  }
  return map.get(slug) ?? null;
}

/** Extract the first hex fill from an SVG (for custom overrides). */
export function extractDominantFill(svg) {
  const match = svg.match(/\bfill\s*=\s*["']#([0-9A-Fa-f]{6})["']/i);
  return match ? match[1].toUpperCase() : null;
}
