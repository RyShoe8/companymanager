import Link from 'next/link';
import { trialCtaButtonLabel } from 'billing-engine';
import { getMarketingTrialCopy } from '@/lib/billing/marketingTrialCopy';
import Button from '@/components/ui/Button';

type Props = {
  title: string;
  className?: string;
};

/** Shared feature-page CTA block with dynamic trial copy from active plans. */
export async function MarketingTrialCta({ title, className }: Props) {
  const trial = await getMarketingTrialCopy();

  return (
    <section className={className ?? 'px-4 sm:px-6 lg:px-8 pb-20'}>
      <div className="max-w-4xl mx-auto relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-accent/10 to-nucleas-fourth/10 border border-primary/20 p-10 md:p-16 text-center">
        <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
        <div className="relative">
          <h2 className="text-3xl font-bold text-text-primary mb-4">{title}</h2>
          <p className="text-text-secondary mb-8">{trial.featureCtaSubtext}</p>
          <Link href="/register">
            <Button className="px-8 py-4 text-lg">{trial.ctaButtonLabel}</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
