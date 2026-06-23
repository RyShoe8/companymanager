const VERSIONS = ['16.23.0', '11.6.0'];
const JSON_PATHS = ['data/simple-icons.json', '_data/simple-icons.json'];

const SLUG_TITLE_HINTS: Record<string, string> = {
  amazonaws: 'Amazon AWS',
  microsoftazure: 'Microsoft Azure',
  amazondynamodb: 'Amazon DynamoDB',
  awslambda: 'AWS Lambda',
  heroku: 'Heroku',
  microsoft: 'Microsoft',
  salesforce: 'Salesforce',
};

const SLUG_OVERRIDES: Record<string, string[]> = {
  nuxt: ['nuxt', 'nuxtdotjs'],
  aws: ['amazonaws', 'aws'],
  azure: ['microsoftazure', 'azure'],
  dynamodb: ['amazondynamodb', 'dynamodb'],
  awslambda: ['awslambda', 'amazonlambda'],
};

let hexBySlug: Map<string, string> | null = null;

function normalizeHex(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const h = String(hex).replace(/^#/, '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(h) ? h : null;
}

function colorizeSvg(svg: string, hex: string): string {
  const color = normalizeHex(hex);
  if (!color) return svg;
  const fill = `#${color}`;
  return svg.replace(/<path(\s[^>]*?)?>/gi, (match) => {
    if (/\bfill\s*=/i.test(match)) return match;
    return match.replace('<path', `<path fill="${fill}"`);
  });
}

async function loadHexMap(): Promise<Map<string, string>> {
  if (hexBySlug) return hexBySlug;
  hexBySlug = new Map();
  const titleToHex = new Map<string, string>();

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
      hexBySlug.set(slug, titleToHex.get(title)!);
    }
  }

  return hexBySlug;
}

async function fetchMonochromeIcon(slug: string): Promise<{ svg: string; resolvedSlug: string } | null> {
  const slugs = SLUG_OVERRIDES[slug] ?? [slug];
  for (const version of VERSIONS) {
    for (const s of slugs) {
      const url = `https://cdn.jsdelivr.net/npm/simple-icons@${version}/icons/${s}.svg`;
      const res = await fetch(url);
      if (res.ok) return { svg: await res.text(), resolvedSlug: s };
    }
  }
  return null;
}

export async function fetchColoredSimpleIcon(slug: string): Promise<{ svg: string; hex: string } | null> {
  const map = await loadHexMap();
  const fetched = await fetchMonochromeIcon(slug);
  if (!fetched) return null;

  const slugsToTry = [...new Set([fetched.resolvedSlug, slug, ...(SLUG_OVERRIDES[slug] ?? [])])];
  let hex: string | null = null;
  for (const s of slugsToTry) {
    if (map.has(s)) {
      hex = map.get(s)!;
      break;
    }
  }
  if (!hex) return null;

  return { svg: colorizeSvg(fetched.svg, hex), hex };
}
