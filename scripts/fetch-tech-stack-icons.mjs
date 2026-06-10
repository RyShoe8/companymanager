/**
 * One-off script: download Simple Icons SVGs for the tech stack catalog.
 * Usage: node scripts/fetch-tech-stack-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'icons', 'tech-stack');

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

const VERSIONS = ['16.23.0', '11.6.0'];
/** slug overrides for simple-icons renames across versions */
const SLUG_OVERRIDES = {
  nuxt: ['nuxt', 'nuxtdotjs'],
};

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
let fail = 0;

for (const [id, slug] of Object.entries(ICONS)) {
  try {
    const svg = await fetchIcon(slug);
    if (!svg) throw new Error('not found in any version');
    await writeFile(join(outDir, `${id}.svg`), svg, 'utf8');
    console.log(`OK  ${id}`);
    ok++;
  } catch (err) {
    console.error(`FAIL ${id} (${slug}): ${err.message}`);
    fail++;
  }
}

console.log(`\nDone: ${ok} ok, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
