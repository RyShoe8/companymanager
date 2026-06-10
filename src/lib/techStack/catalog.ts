import type { TechStackCategory } from '@/lib/models/Project';

export interface TechStackCatalogEntry {
  id: string;
  name: string;
  category: TechStackCategory;
  homepageUrl: string;
  /** Simple Icons slug used by scripts/fetch-tech-stack-icons.mjs */
  simpleIconSlug: string;
}

export const TECH_STACK_CATALOG: TechStackCatalogEntry[] = [
  // Hosting
  { id: 'vercel', name: 'Vercel', category: 'hosting', homepageUrl: 'https://vercel.com', simpleIconSlug: 'vercel' },
  { id: 'aws', name: 'AWS', category: 'hosting', homepageUrl: 'https://aws.amazon.com', simpleIconSlug: 'amazonaws' },
  { id: 'googlecloud', name: 'Google Cloud', category: 'hosting', homepageUrl: 'https://cloud.google.com', simpleIconSlug: 'googlecloud' },
  { id: 'azure', name: 'Azure', category: 'hosting', homepageUrl: 'https://azure.microsoft.com', simpleIconSlug: 'microsoftazure' },
  { id: 'digitalocean', name: 'DigitalOcean', category: 'hosting', homepageUrl: 'https://www.digitalocean.com', simpleIconSlug: 'digitalocean' },
  { id: 'render', name: 'Render', category: 'hosting', homepageUrl: 'https://render.com', simpleIconSlug: 'render' },
  { id: 'netlify', name: 'Netlify', category: 'hosting', homepageUrl: 'https://www.netlify.com', simpleIconSlug: 'netlify' },
  { id: 'cloudflare', name: 'Cloudflare', category: 'hosting', homepageUrl: 'https://www.cloudflare.com', simpleIconSlug: 'cloudflare' },
  { id: 'heroku', name: 'Heroku', category: 'hosting', homepageUrl: 'https://www.heroku.com', simpleIconSlug: 'heroku' },
  { id: 'flyio', name: 'Fly.io', category: 'hosting', homepageUrl: 'https://fly.io', simpleIconSlug: 'flydotio' },

  // Database
  { id: 'mongodb', name: 'MongoDB', category: 'database', homepageUrl: 'https://www.mongodb.com', simpleIconSlug: 'mongodb' },
  { id: 'postgresql', name: 'PostgreSQL', category: 'database', homepageUrl: 'https://www.postgresql.org', simpleIconSlug: 'postgresql' },
  { id: 'mysql', name: 'MySQL', category: 'database', homepageUrl: 'https://www.mysql.com', simpleIconSlug: 'mysql' },
  { id: 'redis', name: 'Redis', category: 'database', homepageUrl: 'https://redis.io', simpleIconSlug: 'redis' },
  { id: 'firebase', name: 'Firebase', category: 'database', homepageUrl: 'https://firebase.google.com', simpleIconSlug: 'firebase' },
  { id: 'planetscale', name: 'PlanetScale', category: 'database', homepageUrl: 'https://planetscale.com', simpleIconSlug: 'planetscale' },
  { id: 'neon', name: 'Neon', category: 'database', homepageUrl: 'https://neon.tech', simpleIconSlug: 'neon' },
  { id: 'dynamodb', name: 'DynamoDB', category: 'database', homepageUrl: 'https://aws.amazon.com/dynamodb', simpleIconSlug: 'amazondynamodb' },
  { id: 'elasticsearch', name: 'Elasticsearch', category: 'database', homepageUrl: 'https://www.elastic.co/elasticsearch', simpleIconSlug: 'elasticsearch' },
  { id: 'sqlite', name: 'SQLite', category: 'database', homepageUrl: 'https://www.sqlite.org', simpleIconSlug: 'sqlite' },

  // API (backend / API hosting)
  { id: 'railway', name: 'Railway', category: 'api', homepageUrl: 'https://railway.app', simpleIconSlug: 'railway' },
  { id: 'awslambda', name: 'AWS Lambda', category: 'api', homepageUrl: 'https://aws.amazon.com/lambda', simpleIconSlug: 'awslambda' },
  { id: 'cloudflareworkers', name: 'Cloudflare Workers', category: 'api', homepageUrl: 'https://workers.cloudflare.com', simpleIconSlug: 'cloudflareworkers' },
  { id: 'supabase', name: 'Supabase', category: 'api', homepageUrl: 'https://supabase.com', simpleIconSlug: 'supabase' },
  { id: 'fastapi', name: 'FastAPI', category: 'api', homepageUrl: 'https://fastapi.tiangolo.com', simpleIconSlug: 'fastapi' },
  { id: 'graphql', name: 'GraphQL', category: 'api', homepageUrl: 'https://graphql.org', simpleIconSlug: 'graphql' },
  { id: 'postman', name: 'Postman', category: 'api', homepageUrl: 'https://www.postman.com', simpleIconSlug: 'postman' },
  { id: 'nginx', name: 'NGINX', category: 'api', homepageUrl: 'https://www.nginx.com', simpleIconSlug: 'nginx' },
  { id: 'denodeploy', name: 'Deno Deploy', category: 'api', homepageUrl: 'https://deno.com/deploy', simpleIconSlug: 'deno' },
  { id: 'openapi', name: 'OpenAPI', category: 'api', homepageUrl: 'https://www.openapis.org', simpleIconSlug: 'openapiinitiative' },

  // Framework
  { id: 'nextjs', name: 'Next.js', category: 'framework', homepageUrl: 'https://nextjs.org', simpleIconSlug: 'nextdotjs' },
  { id: 'react', name: 'React', category: 'framework', homepageUrl: 'https://react.dev', simpleIconSlug: 'react' },
  { id: 'vue', name: 'Vue', category: 'framework', homepageUrl: 'https://vuejs.org', simpleIconSlug: 'vuedotjs' },
  { id: 'angular', name: 'Angular', category: 'framework', homepageUrl: 'https://angular.dev', simpleIconSlug: 'angular' },
  { id: 'svelte', name: 'Svelte', category: 'framework', homepageUrl: 'https://svelte.dev', simpleIconSlug: 'svelte' },
  { id: 'remix', name: 'Remix', category: 'framework', homepageUrl: 'https://remix.run', simpleIconSlug: 'remix' },
  { id: 'astro', name: 'Astro', category: 'framework', homepageUrl: 'https://astro.build', simpleIconSlug: 'astro' },
  { id: 'nuxt', name: 'Nuxt', category: 'framework', homepageUrl: 'https://nuxt.com', simpleIconSlug: 'nuxt' },
  { id: 'express', name: 'Express', category: 'framework', homepageUrl: 'https://expressjs.com', simpleIconSlug: 'express' },
  { id: 'django', name: 'Django', category: 'framework', homepageUrl: 'https://www.djangoproject.com', simpleIconSlug: 'django' },

  // Payments
  { id: 'stripe', name: 'Stripe', category: 'payments', homepageUrl: 'https://stripe.com', simpleIconSlug: 'stripe' },
  { id: 'paypal', name: 'PayPal', category: 'payments', homepageUrl: 'https://www.paypal.com', simpleIconSlug: 'paypal' },
  { id: 'square', name: 'Square', category: 'payments', homepageUrl: 'https://squareup.com', simpleIconSlug: 'square' },
  { id: 'braintree', name: 'Braintree', category: 'payments', homepageUrl: 'https://www.braintreepayments.com', simpleIconSlug: 'braintree' },
  { id: 'paddle', name: 'Paddle', category: 'payments', homepageUrl: 'https://www.paddle.com', simpleIconSlug: 'paddle' },
  { id: 'lemonsqueezy', name: 'Lemon Squeezy', category: 'payments', homepageUrl: 'https://www.lemonsqueezy.com', simpleIconSlug: 'lemonsqueezy' },
  { id: 'adyen', name: 'Adyen', category: 'payments', homepageUrl: 'https://www.adyen.com', simpleIconSlug: 'adyen' },
  { id: 'shopify', name: 'Shopify', category: 'payments', homepageUrl: 'https://www.shopify.com', simpleIconSlug: 'shopify' },
  { id: 'razorpay', name: 'Razorpay', category: 'payments', homepageUrl: 'https://razorpay.com', simpleIconSlug: 'razorpay' },
  { id: 'coinbase', name: 'Coinbase', category: 'payments', homepageUrl: 'https://www.coinbase.com', simpleIconSlug: 'coinbase' },
];

const catalogById = new Map(TECH_STACK_CATALOG.map((e) => [e.id, e]));

export function getCatalogEntry(technologyId: string): TechStackCatalogEntry | undefined {
  return catalogById.get(technologyId);
}

export function getCatalogByCategory(category: TechStackCategory): TechStackCatalogEntry[] {
  return TECH_STACK_CATALOG.filter((e) => e.category === category);
}

export const TECH_STACK_CATEGORIES: TechStackCategory[] = [
  'hosting',
  'database',
  'api',
  'framework',
  'payments',
];
