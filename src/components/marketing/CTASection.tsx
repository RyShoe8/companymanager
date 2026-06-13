import Link from 'next/link';
import { cn } from '@/lib/utils';

type CTAButton = {
  label: string;
  href: string;
};

type CTASectionProps = {
  headline: string;
  description: string;
  primaryCta: CTAButton;
  secondaryCta?: CTAButton;
  className?: string;
};

export default function CTASection({
  headline,
  description,
  primaryCta,
  secondaryCta,
  className,
}: CTASectionProps) {
  return (
    <section
      className={cn(
        'relative py-24 md:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden',
        className
      )}
    >
      {/* Gradient background */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10"
      />

      {/* Subtle radial glow */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl"
      />

      <div className="relative max-w-3xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary tracking-tight mb-6">
          {headline}
        </h2>

        <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
          {description}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={primaryCta.href}
            className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 text-base font-semibold rounded-xl bg-primary text-nucleas-ink hover:bg-primary-hover transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            {primaryCta.label}
          </Link>

          {secondaryCta && (
            <Link
              href={secondaryCta.href}
              className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 text-base font-semibold rounded-xl border-2 border-white/20 text-white hover:border-white/40 hover:bg-white/5 transition-all duration-200"
            >
              {secondaryCta.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
