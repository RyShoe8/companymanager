/**
 * Generate custom colored SVG overrides for stack icons not in Simple Icons.
 * Usage: node scripts/generate-custom-stack-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const marketingDir = join(root, 'scripts', 'icons', 'custom', 'marketing-stack');
const techDir = join(root, 'scripts', 'icons', 'custom', 'tech-stack');

function wrap(svgBody) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">${svgBody}</svg>`;
}

/** Colored rounded badge with a white letter (distinct from flat lettermarks). */
function badgeIcon(letter, bg, text = '#FFFFFF') {
  return wrap(
    `<rect width="24" height="24" rx="6" fill="${bg}"/><text x="12" y="16.5" text-anchor="middle" fill="${text}" font-size="11" font-family="system-ui,-apple-system,sans-serif" font-weight="700">${letter}</text>`
  );
}

/** Two-tone brand mark: colored circle + white glyph */
function circleIcon(letter, bg, text = '#FFFFFF') {
  return wrap(
    `<circle cx="12" cy="12" r="11" fill="${bg}"/><text x="12" y="16" text-anchor="middle" fill="${text}" font-size="10" font-family="system-ui,-apple-system,sans-serif" font-weight="700">${letter}</text>`
  );
}

const marketingIcons = {
  klaviyo: circleIcon('K', '#57E38F', '#1A1A1A'),
  convertkit: circleIcon('C', '#FB6970'),
  activecampaign: circleIcon('A', '#356AE6'),
  constantcontact: circleIcon('C', '#1856A5'),
  sendgrid: circleIcon('S', '#51A9E3'),
  mailerlite: circleIcon('M', '#09C269'),
  mailjet: circleIcon('M', '#FFCC00', '#1A1A1A'),
  beehiiv: circleIcon('B', '#FFD600', '#1A1A1A'),
  amplitude: circleIcon('A', '#1F1FBA'),
  heap: circleIcon('H', '#31EDB3', '#1A1A1A'),
  segment: circleIcon('S', '#52BD95'),
  sproutsocial: circleIcon('S', '#59CB59', '#1A1A1A'),
  later: circleIcon('L', '#2B2B2B'),
  oneup: circleIcon('1', '#6366F1'),
  loomly: circleIcon('L', '#F95959'),
  socialbee: circleIcon('S', '#FAD505', '#1A1A1A'),
  agorapulse: circleIcon('A', '#E7685A'),
  planable: circleIcon('P', '#5B4FFF'),
  coschedule: circleIcon('C', '#EF2D5B'),
  pipedrive: circleIcon('P', '#017737'),
  monday: circleIcon('M', '#FF3D57'),
  copper: circleIcon('C', '#814743'),
  freshsales: circleIcon('F', '#1D8BFF'),
  close: circleIcon('C', '#1B1B1B'),
  clarity: wrap(
    `<defs><linearGradient id="clarity" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stop-color="#0078D4"/><stop offset="1" stop-color="#50E6FF"/></linearGradient></defs><rect width="24" height="24" rx="5" fill="url(#clarity)"/><path fill="#FFFFFF" d="M6 14c2.5-4 4.5-6 6-6s3.5 2 6 6c-2 3-4 5-6 5s-4-2-6-5z"/><circle cx="9" cy="10" r="1.5" fill="#FFFFFF"/>`
  ),
};

/** Tech icons: white glyph on brand-colored circle for near-black brands */
const techIcons = {
  nextjs: wrap(
    `<circle cx="12" cy="12" r="11" fill="#000000"/><path fill="#FFFFFF" d="M16.5 18.5c-1.2.9-2.7 1.4-4.5 1.4-4.1 0-7.5-3.4-7.5-7.5S8 4.9 12.1 4.9c1.5 0 2.9.4 4.1 1.1L11.5 11v4.2h2.1v-3.1l5.9 7.6-.9.7z"/>`
  ),
  vercel: wrap(
    `<circle cx="12" cy="12" r="11" fill="#000000"/><path fill="#FFFFFF" d="M12 5L19 19H5L12 5z"/>`
  ),
  remix: wrap(
    `<circle cx="12" cy="12" r="11" fill="#121212"/><path fill="#FFFFFF" d="M6 8h12v2H9v6H6V8zm3 4h9v2H9v-2z"/>`
  ),
  render: wrap(
    `<circle cx="12" cy="12" r="11" fill="#46E3B7"/><path fill="#000000" d="M8 8h8v2h-6v4h5v2H8V8z"/>`
  ),
  planetscale: wrap(
    `<circle cx="12" cy="12" r="11" fill="#000000"/><circle cx="12" cy="12" r="5" fill="none" stroke="#FFFFFF" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="#FFFFFF"/>`
  ),
  braintree: wrap(
    `<circle cx="12" cy="12" r="11" fill="#000000"/><path fill="#FFFFFF" d="M7 9h10v6H7V9zm2 2v2h6v-2H9z"/>`
  ),
  express: wrap(
    `<circle cx="12" cy="12" r="11" fill="#000000"/><path fill="#FFFFFF" d="M8 8l8 4-8 4V8z"/>`
  ),
};

await mkdir(marketingDir, { recursive: true });
await mkdir(techDir, { recursive: true });

for (const [id, svg] of Object.entries(marketingIcons)) {
  await writeFile(join(marketingDir, `${id}.svg`), svg, 'utf8');
  console.log(`marketing ${id}`);
}

for (const [id, svg] of Object.entries(techIcons)) {
  await writeFile(join(techDir, `${id}.svg`), svg, 'utf8');
  console.log(`tech ${id}`);
}

console.log('Done generating custom stack icons');
