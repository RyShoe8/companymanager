import Link from 'next/link';

interface MarketingPageHeaderProps {
  title: string;
  subtitle: string;
  badge?: string;
  ctaText?: string;
  ctaHref?: string;
  showCta?: boolean;
}

export default function MarketingPageHeader({
  title,
  subtitle,
  badge,
  ctaText = 'Get started',
  ctaHref = '/register',
  showCta = true,
}: MarketingPageHeaderProps) {
  return (
    <section className="relative py-16 md:py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]" />
      <div className="absolute top-1/4 -right-32 w-[400px] h-[400px] rounded-full bg-primary/15 blur-[100px]" />
      <div className="absolute bottom-1/4 -left-32 w-[300px] h-[300px] rounded-full bg-secondary/15 blur-[80px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0f172a_60%)]" />
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {badge && (
          <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-6">
            {badge}
          </span>
        )}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
          {title}
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
          {subtitle}
        </p>
        {showCta && (
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-all shadow-lg shadow-primary/25"
          >
            {ctaText}
          </Link>
        )}
      </div>
    </section>
  );
}
