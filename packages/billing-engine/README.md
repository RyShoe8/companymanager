# billing-engine

Portable Stripe + Mongoose subscription management for Next.js apps.

## Setup

1. Add workspace dependency: `"billing-engine": "workspace:*"`
2. Initialize once at app startup (see `lib/billing-engine.ts` in Tailnote):

```ts
import { createBillingEngine } from 'billing-engine';

export const billing = createBillingEngine({
  connect: () => connectMongoose(),
  organization: { model: OrganizationModel },
  seats: { getSeatCount, beforeCountSeats },
  auth: { getSession, requirePlatformAdmin },
  billing: { getAppBaseUrl, notify, getOwnerEmailForOrganization },
});
```

3. Wire API routes as thin delegates:

```ts
import { billing } from '@/lib/billing-engine';
export const POST = billing.handlers.stripeWebhook;
export const dynamic = 'force-dynamic';
```

## Organization schema

Host `Organization` documents should include:

- `plan`, `subscriptionStatus`, `stripeCustomerId`, `stripeSubscriptionId`

Canonical subscription data lives in `OrganizationSubscription` (package model).

## Environment variables

- `STRIPE_SECRET_KEY` — required for live billing (omit for dev “all paid” bypass)
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_BASIC_PRICE_ID`, `STRIPE_PRO_PRICE_ID` — legacy slug checkout fallback

## Exports

- `billing-engine` — core lib, models, `createBillingEngine`
- `billing-engine/next/handlers` — Next.js route handlers
- `billing-engine/next/components` — Admin plan UI, pricing cards
- `billing-engine/models` — Mongoose models
