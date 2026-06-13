'use client';

import Link from 'next/link';

const featureLinks = [
  { href: '/features/projects', label: 'Projects' },
  { href: '/features/tasks', label: 'Tasks' },
  { href: '/features/content', label: 'Content' },
  { href: '/features/meetings', label: 'Meetings' },
  { href: '/features/tools', label: 'Tools' },
  { href: '/features/team', label: 'Team' },
  { href: '/features/efficiency', label: 'Efficiency' },
];

const companyLinks = [
  { href: '/about', label: 'About' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
  { href: '/contact?type=Feature Request', label: 'Request a Feature' },
];

const legalLinks = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
];

export default function Footer() {
  return (
    <footer className="bg-background border-t border-white/10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {/* CTA Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border border-primary/20 p-8 md:p-10 mb-12 text-center">
          <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
          <div className="relative">
            <h3 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">
              Ready to run your business from one place?
            </h3>
            <p className="text-text-secondary mb-6 max-w-xl mx-auto">
              Start your 14-day free trial. No credit card required.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center px-8 py-3.5 rounded-xl bg-primary text-nucleas-ink font-semibold hover:bg-primary-hover transition-all duration-200 shadow-lg shadow-primary/20 hover:shadow-primary/30"
            >
              Start Your Free Trial
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-4 lg:col-span-2">
            <Link href="/" className="inline-block mb-4">
              <img
                src="/images/nucleas-logo.png?v=6"
                alt="Nucleas"
                width={140}
                height={48}
                className="h-10 w-auto object-contain"
              />
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs mb-4">
              The smart operating system for building and running a business. Build. Organize. Operate.
            </p>
            <p className="text-slate-500 text-xs">
              Not another project manager — the business management layer that brings it all together.
            </p>
          </div>

          {/* Features */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Features</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/features" className="text-sm text-primary hover:text-primary-hover transition-colors font-medium">
                  All Features
                </Link>
              </li>
              {featureLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Company</h3>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Legal</h3>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Nucleas. All rights reserved. Built by{' '}
              <a
                href="https://themediashop.co"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-white transition-colors"
              >
                TheMediaShop.co
              </a>
            </p>
            <a
              href="mailto:theteam@nucleas.app"
              className="text-sm text-slate-500 hover:text-slate-400 transition-colors"
            >
              theteam@nucleas.app
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
