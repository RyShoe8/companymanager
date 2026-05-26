import '@/lib/billing-engine';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublicPricingPlans, isRecommendedPlan } from 'billing-engine';
import { PricingPlanCard } from 'billing-engine/next/components';
import Button from '@/components/ui/Button';
import { NUCLEAS_PLATFORM_FEATURES } from '@/lib/marketing/nucleasPlatformFeatures';
import { pricingPlanCtaHref } from '@/lib/billing/pricingPlanCta';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Seat-based Nucleas pricing. Every plan includes the full platform — workspace, projects, assets, scheduling, and team management.',
};

export default async function PricingPage() {
  const plans = await getPublicPricingPlans();
  const planCtas = await Promise.all(
    plans.map(async (plan) => ({
      id: plan.id,
      href: await pricingPlanCtaHref(plan.id),
    }))
  );
  const ctaByPlanId = Object.fromEntries(planCtas.map((entry) => [entry.id, entry.href]));

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Pricing</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold text-text-primary tracking-tight">
            Simple seat-based plans
          </h1>
          <p className="mt-4 text-lg text-text-secondary max-w-2xl mx-auto">
            Every plan includes the full Nucleas platform. You pay for your organization&apos;s seats —
            not feature tiers. Add team members as you grow.
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        {plans.length === 0 ? (
          <p className="text-center text-text-secondary max-w-md mx-auto">
            No public plans are available right now. Please check back later or{' '}
            <Link href="/contact" className="text-primary hover:text-primary-hover">
              contact us
            </Link>
            .
          </p>
        ) : (
          <div className="max-w-7xl mx-auto grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <PricingPlanCard
                key={plan.id}
                plan={plan}
                variant="marketing"
                className={isRecommendedPlan(plan) ? 'ring-2 ring-primary/40' : undefined}
                footer={
                  <Link
                    href={ctaByPlanId[plan.id] ?? `/register?plan=${encodeURIComponent(plan.id)}`}
                    className="block w-full"
                  >
                    <Button className="w-full">Get started — {plan.name}</Button>
                  </Link>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-text-primary text-center mb-2">
            Everything included in every plan
          </h2>
          <p className="text-center text-text-secondary mb-8">
            All subscribers get the same platform capabilities. Plans differ by included seats and add-on pricing.
          </p>
          <ul className="grid sm:grid-cols-2 gap-3">
            {NUCLEAS_PLATFORM_FEATURES.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 rounded-lg border border-border bg-background-card px-4 py-3 text-sm text-text-primary"
              >
                <span className="text-primary mt-0.5" aria-hidden>
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
