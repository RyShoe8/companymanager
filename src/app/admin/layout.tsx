'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PAGE_GUTTER_WIDE_CLASS } from '@/lib/ui/mobileLayout';

const navItems = [
  { href: '/admin', label: 'Users' },
  { href: '/admin/plans', label: 'Plans' },
  { href: '/admin/onboarding', label: 'Onboarding' },
  { href: '/admin/blog', label: 'Blog' },
  { href: '/admin/feedback', label: 'Feedback' },
  { href: '/admin/insights', label: 'Insights' },
  { href: '/admin/platform-catalog', label: 'Platform catalog' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background-card">
        <div className={`max-w-7xl mx-auto ${PAGE_GUTTER_WIDE_CLASS}`}>
          <div className="flex gap-6">
            {navItems.map(({ href, label }) => {
              const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`py-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
