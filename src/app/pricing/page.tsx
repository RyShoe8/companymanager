import '@/lib/billing-engine';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublicPricingPlans, isRecommendedPlan, sortPlansForPricingDisplay } from 'billing-engine';
import { PricingPlanCard } from 'billing-engine/next/components';
import Button from '@/components/ui/Button';
import { NUCLEAS_PLATFORM_FEATURES } from '@/lib/marketing/nucleasPlatformFeatures';
import { pricingPlanCtaHref } from '@/lib/billing/pricingPlanCta';
import { StructuredData } from '@/components/StructuredData';
import AnimateIn from '@/components/home/AnimateIn';

export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';

export const metadata: Metadata = {
  title: 'Pricing — Simple, Seat-Based Plans',
  description: 'Nucleas pricing is simple: every plan includes the full platform. Pay for seats, not features. Start your 14-day free trial — no credit card required.',
  keywords: ['Nucleas pricing', 'business management pricing', 'seat-based pricing', 'SaaS pricing', 'free trial'],
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing — Simple, Seat-Based Plans | Nucleas',
    description: 'Every plan includes the full platform. Pay for seats, not features. 14-day free trial.',
    url: `${baseUrl}/pricing`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing | Nucleas',
    description: 'Simple, seat-based pricing. Full platform access. 14-day free trial.',
  },
};

const PRICING_FAQ = [
  { q: 'Is there a free trial?', a: 'Yes! Every plan includes a 14-day free trial with full platform access. No credit card required to start.' },
  { q: 'What\'s included in every plan?', a: 'Every plan includes the full Nucleas platform — projects, tasks, content, meetings, tools, team management, and all features. Plans differ only by the number of seats included.' },
  { q: 'Can I change plans later?', a: 'Absolutely. You can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle.' },
  { q: 'What happens after my trial ends?', a: 'After your 14-day trial, you can choose a plan that fits your team size. All your data and settings are preserved.' },
];

export default async function PricingPage() {
  const plans = sortPlansForPricingDisplay(await getPublicPricingPlans());
  const planCtas = await Promise.all(
    plans.map(async (plan) => ({
      id: plan.id,
      href: await pricingPlanCtaHref(plan.id),
    }))
  );
  const ctaByPlanId = Object.fromEntries(planCtas.map((entry) => [entry.id, entry.href]));

  return (
    <>
      <StructuredData type="WebPage" data={{ name: 'Pricing | Nucleas', description: metadata.description as string, url: `${baseUrl}/pricing`, publisher: { '@type': 'Organization', name: 'Nucleas', url: baseUrl } }} />
      <StructuredData type="BreadcrumbList" data={{ itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl }, { '@type': 'ListItem', position: 2, name: 'Pricing', item: `${baseUrl}/pricing` }] }} />

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
          <div className="absolute top-1/3 -left-32 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative max-w-4xl mx-auto text-center">
            <AnimateIn>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-sm font-semibold text-green-400 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                14-Day Free Trial on All Plans
              </span>
            </AnimateIn>
            <AnimateIn>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary tracking-tight mb-6">
                Simple,{' '}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">seat-based</span>{' '}
                pricing
              </h1>
            </AnimateIn>
            <AnimateIn>
              <p className="text-lg text-text-secondary max-w-2xl mx-auto">
                Every plan includes the full Nucleas platform. You pay for your organization&apos;s seats — not feature tiers. Add team members as you grow.
              </p>
            </AnimateIn>
          </div>
        </section>

        {/* Plan Cards */}
        <section className="px-4 sm:px-6 lg:px-8 pb-16">
          <AnimateIn>
            {plans.length === 0 ? (
              <p className="text-center text-text-secondary max-w-md mx-auto">
                No public plans are available right now. Please check back later or{' '}
                <Link href="/contact" className="text-primary hover:text-primary-hover">contact us</Link>.
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
                        <Button className="w-full">Start Free Trial — {plan.name}</Button>
                      </Link>
                    }
                  />
                ))}
              </div>
            )}
          </AnimateIn>
        </section>

        {/* Everything Included */}
        <section className="px-4 sm:px-6 lg:px-8 pb-20 md:pb-28">
          <div className="max-w-5xl mx-auto">
            <AnimateIn>
              <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-3">
                  Everything included in{' '}
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">every plan</span>
                </h2>
                <p className="text-text-secondary text-lg">
                  All subscribers get the same platform capabilities. Plans differ by included seats and add-on pricing.
                </p>
              </div>
            </AnimateIn>
            <AnimateIn>
              <ul className="grid sm:grid-cols-2 gap-3">
                {NUCLEAS_PLATFORM_FEATURES.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 rounded-xl border border-border bg-background-card px-5 py-4 text-sm text-text-primary"
                  >
                    <span className="text-primary mt-0.5 flex-shrink-0" aria-hidden>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </AnimateIn>
          </div>
        </section>

        {/* Pricing FAQ */}
        <section className="px-4 sm:px-6 lg:px-8 pb-20 md:pb-28">
          <div className="max-w-3xl mx-auto">
            <AnimateIn>
              <h2 className="text-2xl font-bold text-text-primary text-center mb-10">Frequently asked questions</h2>
            </AnimateIn>
            <div className="space-y-4">
              {PRICING_FAQ.map((faq) => (
                <AnimateIn key={faq.q}>
                  <div className="bg-background-card border border-border rounded-xl p-6">
                    <h3 className="text-base font-semibold text-text-primary mb-2">{faq.q}</h3>
                    <p className="text-sm text-text-secondary leading-relaxed">{faq.a}</p>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 sm:px-6 lg:px-8 pb-20 md:pb-28">
          <div className="max-w-4xl mx-auto relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-accent/10 to-nucleas-fourth/10 border border-primary/20 p-10 md:p-16 text-center">
            <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
            <div className="relative">
              <AnimateIn>
                <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">Ready to get started?</h2>
                <p className="text-lg text-text-secondary mb-8 max-w-xl mx-auto">
                  Start your 14-day free trial today. Full platform access, no credit card required.
                </p>
                <Link href="/register" className="inline-flex items-center px-8 py-4 rounded-xl bg-primary text-nucleas-ink font-semibold text-lg hover:bg-primary-hover transition-all shadow-lg shadow-primary/25">
                  Start Your 14-Day Free Trial
                </Link>
              </AnimateIn>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
