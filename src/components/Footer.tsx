'use client';

import Link from 'next/link';
import { BLOG_NAME } from '@/lib/blog/blogConstants';

const featureLinks = [
  { href: '/features/projects', label: 'Projects' },
  { href: '/features/tasks', label: 'Tasks' },
  { href: '/features/content', label: 'Content' },
  { href: '/features/meetings', label: 'Meetings' },
  { href: '/features/scheduling', label: 'Scheduling' },
  { href: '/features/tools', label: 'Tools' },
  { href: '/features/team', label: 'Team' },
  { href: '/features/efficiency', label: 'Efficiency' },
];

const freeToolLinks = [
  { href: '/tools', label: 'All Free Tools' },
  { href: '/tools/screenshot', label: 'Screenshot Tool' },
];

const companyLinks = [
  { href: '/about', label: 'About' },
  { href: '/blog', label: BLOG_NAME },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
  { href: '/contact?type=Feature Request', label: 'Request a Feature' },
];

const socialLinks = [
  {
    href: 'https://bsky.app/profile/themediashop.bsky.social',
    label: 'Bluesky',
    color: '#1185fe',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 320 286" fill="currentColor" aria-hidden>
        <path d="M69.3642 19.1462C108.497 -7.66514 146.852 46.1818 160 83.1558C173.148 46.1818 211.503 -7.66514 250.636 19.1462C279.792 39.1171 289.866 75.3129 283.821 110.155C278.36 141.624 256.096 166.452 225.854 174.652C216.32 177.236 201.272 178.691 196.536 179.351C194.276 179.666 195.968 180.377 197.809 181.166C227.426 193.864 246.602 223.111 239.544 255.437C231.258 293.385 194.398 294.027 163.666 266.38C161.424 264.364 160 260.67 160 260.67C160 260.67 158.576 264.364 156.334 266.38C125.602 294.027 88.7423 293.385 80.4557 255.437C73.3983 223.111 92.5738 193.864 122.191 181.166C124.032 180.377 125.724 179.666 123.464 179.351C118.728 178.691 103.68 177.236 94.1457 174.652C63.9042 166.452 41.6401 141.624 36.1793 110.155C30.1343 75.3129 40.2078 39.1171 69.3642 19.1462Z" />
      </svg>
    ),
  },
  {
    href: 'https://www.reddit.com/r/TheMediaShop/',
    label: 'Reddit',
    color: '#ff4500',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.03 4.875-6.77 4.875-3.74 0-6.771-2.181-6.771-4.875 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
      </svg>
    ),
  },
];

const legalLinks = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
];

export default function Footer() {
  return (
    <footer className="bg-background border-t border-white/10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-10 lg:gap-8">
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
            <p className="text-slate-500 text-xs mb-4">
              Not another project manager — the business management layer that brings it all together.
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all hover:scale-110"
                  style={{
                    color: link.color,
                    borderColor: `${link.color}40`, // 25% opacity for border
                    backgroundColor: `${link.color}10`, // 6% opacity for bg
                  }}
                >
                  {link.icon}
                </a>
              ))}
            </div>
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

          {/* Free Tools */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Free Tools</h3>
            <ul className="space-y-3">
              {freeToolLinks.map((link) => (
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
          <p className="text-xs text-slate-500 leading-relaxed max-w-3xl mb-6">
            Some links on this site are affiliate links. If you sign up or purchase through them, we may earn a
            commission at no additional cost to you. This helps support Nucleas.
          </p>
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
