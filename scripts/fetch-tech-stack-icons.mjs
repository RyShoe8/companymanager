/**
 * Download colored Simple Icons SVGs for the tech stack catalog.
 * Usage: node scripts/fetch-tech-stack-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchColoredIcon, isDarkBrandHex } from './lib/simpleIconColorize.mjs';
import { loadCustomIcon } from './lib/loadCustomIcon.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'icons', 'tech-stack');
const customDir = join(root, 'scripts', 'icons', 'custom', 'tech-stack');

/** id -> simple-icons slug (must match catalog.ts) */
const ICONS = {
  vercel: 'vercel',
  aws: 'amazonaws',
  googlecloud: 'googlecloud',
  azure: 'microsoftazure',
  digitalocean: 'digitalocean',
  render: 'render',
  netlify: 'netlify',
  cloudflare: 'cloudflare',
  heroku: 'heroku',
  flyio: 'flydotio',
  laravelcloud: 'laravel',
  mongodb: 'mongodb',
  postgresql: 'postgresql',
  mysql: 'mysql',
  redis: 'redis',
  firebase: 'firebase',
  planetscale: 'planetscale',
  neon: 'neon',
  dynamodb: 'amazondynamodb',
  elasticsearch: 'elasticsearch',
  sqlite: 'sqlite',
  railway: 'railway',
  awslambda: 'awslambda',
  cloudflareworkers: 'cloudflareworkers',
  supabase: 'supabase',
  fastapi: 'fastapi',
  graphql: 'graphql',
  postman: 'postman',
  nginx: 'nginx',
  denodeploy: 'deno',
  openapi: 'openapiinitiative',
  nextjs: 'nextdotjs',
  react: 'react',
  vue: 'vuedotjs',
  angular: 'angular',
  svelte: 'svelte',
  remix: 'remix',
  astro: 'astro',
  nuxt: 'nuxt',
  express: 'express',
  django: 'django',
  laravel: 'laravel',
  stripe: 'stripe',
  paypal: 'paypal',
  square: 'square',
  braintree: 'braintree',
  paddle: 'paddle',
  lemonsqueezy: 'lemonsqueezy',
  adyen: 'adyen',
  shopify: 'shopify',
  razorpay: 'razorpay',
  coinbase: 'coinbase',
};

const SLUG_OVERRIDES = {
  nuxt: ['nuxt', 'nuxtdotjs'],
  aws: ['amazonaws', 'aws'],
  azure: ['microsoftazure', 'azure'],
  dynamodb: ['amazondynamodb', 'dynamodb'],
  awslambda: ['awslambda', 'amazonlambda'],
};

await mkdir(outDir, { recursive: true });

let ok = 0;
let fail = 0;
const darkIds = [];

for (const [id, slug] of Object.entries(ICONS)) {
  try {
    let svg = null;
    let brandHex = null;
    let source = 'icon';

    const custom = await loadCustomIcon(customDir, id);
    if (custom) {
      svg = custom.svg;
      brandHex = custom.hex;
      source = 'custom';
    } else {
      const result = await fetchColoredIcon(slug, SLUG_OVERRIDES);
      if (!result) throw new Error('not found in any version');
      svg = result.svg;
      brandHex = result.hex;
    }

    await writeFile(join(outDir, `${id}.svg`), svg, 'utf8');
    if (brandHex && isDarkBrandHex(brandHex)) darkIds.push(id);
    console.log(`${source === 'custom' ? 'CUS' : 'OK '} ${id}`);
    ok++;
  } catch (err) {
    console.error(`FAIL ${id} (${slug}): ${err.message}`);
    fail++;
  }
}

await writeFile(join(outDir, '_dark.json'), JSON.stringify(darkIds.sort(), null, 2), 'utf8');
console.log(`Dark-brand icons (${darkIds.length}): ${darkIds.join(', ') || 'none'}`);

console.log(`\nDone: ${ok} ok, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
