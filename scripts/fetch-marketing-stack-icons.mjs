/**
 * One-off script: download Simple Icons SVGs for the marketing stack catalog.
 * Falls back to lettermark SVGs when a brand is not in Simple Icons.
 * Usage: node scripts/fetch-marketing-stack-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'icons', 'marketing-stack');

const ICONS = {
  brevo: 'brevo',
  mailchimp: 'mailchimp',
  klaviyo: 'klaviyo',
  convertkit: 'convertkit',
  activecampaign: 'activecampaign',
  constantcontact: 'constantcontact',
  sendgrid: 'sendgrid',
  mailerlite: 'mailerlite',
  mailjet: 'mailjet',
  beehiiv: 'beehiiv',
  googleanalytics: 'googleanalytics',
  posthog: 'posthog',
  clarity: 'microsoft',
  mixpanel: 'mixpanel',
  amplitude: 'amplitude',
  heap: 'heap',
  hotjar: 'hotjar',
  plausible: 'plausibleanalytics',
  matomo: 'matomo',
  segment: 'segment',
  hootsuite: 'hootsuite',
  buffer: 'buffer',
  sproutsocial: 'sproutsocial',
  later: 'later',
  oneup: 'oneup',
  loomly: 'loomly',
  socialbee: 'socialbee',
  agorapulse: 'agorapulse',
  planable: 'planable',
  coschedule: 'coschedule',
  salesforce: 'salesforce',
  hubspot: 'hubspot',
  pipedrive: 'pipedrive',
  zoho: 'zoho',
  monday: 'monday',
  copper: 'copper',
  freshsales: 'freshworks',
  intercom: 'intercom',
  zendesk: 'zendesk',
  close: 'close',
};

/** Lettermark fallbacks when Simple Icons has no asset */
const FALLBACKS = {
  klaviyo: { letter: 'K', color: '#212322' },
  convertkit: { letter: 'C', color: '#FB6970' },
  activecampaign: { letter: 'A', color: '#356AE6' },
  constantcontact: { letter: 'C', color: '#1856A5' },
  sendgrid: { letter: 'S', color: '#51A9E3' },
  mailerlite: { letter: 'M', color: '#09C269' },
  mailjet: { letter: 'M', color: '#FFCC00', text: '#1A1A1A' },
  beehiiv: { letter: 'B', color: '#111111' },
  amplitude: { letter: 'A', color: '#1F1FBA' },
  heap: { letter: 'H', color: '#31EDB3', text: '#1A1A1A' },
  segment: { letter: 'S', color: '#52BD95' },
  sproutsocial: { letter: 'S', color: '#59CB59', text: '#1A1A1A' },
  later: { letter: 'L', color: '#2B2B2B' },
  oneup: { letter: '1', color: '#6366F1' },
  loomly: { letter: 'L', color: '#F95959' },
  socialbee: { letter: 'S', color: '#FAD505', text: '#1A1A1A' },
  agorapulse: { letter: 'A', color: '#E7685A' },
  planable: { letter: 'P', color: '#5B4FFF' },
  coschedule: { letter: 'C', color: '#EF2D5B' },
  pipedrive: { letter: 'P', color: '#017737' },
  monday: { letter: 'M', color: '#FF3D57' },
  copper: { letter: 'C', color: '#814743' },
  freshsales: { letter: 'F', color: '#1D8BFF' },
  close: { letter: 'C', color: '#1B1B1B' },
};

const VERSIONS = ['16.23.0', '11.6.0'];
const SLUG_OVERRIDES = {
  plausible: ['plausibleanalytics', 'plausible'],
};

function lettermarkSvg(id) {
  const fb = FALLBACKS[id];
  if (!fb) return null;
  const fill = fb.color;
  const text = fb.text ?? '#FFFFFF';
  const letter = fb.letter;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img"><rect width="24" height="24" rx="5" fill="${fill}"/><text x="12" y="16.5" text-anchor="middle" fill="${text}" font-size="11" font-family="system-ui,-apple-system,sans-serif" font-weight="700">${letter}</text></svg>`;
}

async function fetchIcon(slug) {
  const slugs = SLUG_OVERRIDES[slug] ?? [slug];
  for (const version of VERSIONS) {
    for (const s of slugs) {
      const url = `https://cdn.jsdelivr.net/npm/simple-icons@${version}/icons/${s}.svg`;
      const res = await fetch(url);
      if (res.ok) return res.text();
    }
  }
  return null;
}

await mkdir(outDir, { recursive: true });

let ok = 0;
let fallback = 0;
let fail = 0;

for (const [id, slug] of Object.entries(ICONS)) {
  try {
    let svg = await fetchIcon(slug);
    let source = 'icon';
    if (!svg) {
      svg = lettermarkSvg(id);
      source = 'fallback';
    }
    if (!svg) throw new Error('not found');
    await writeFile(join(outDir, `${id}.svg`), svg, 'utf8');
    console.log(`${source === 'icon' ? 'OK ' : 'FB '} ${id}`);
    if (source === 'icon') ok++;
    else fallback++;
  } catch (err) {
    console.error(`FAIL ${id} (${slug}): ${err.message}`);
    fail++;
  }
}

console.log(`\nDone: ${ok} icons, ${fallback} fallbacks, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
