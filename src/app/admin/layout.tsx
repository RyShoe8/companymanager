'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PAGE_GUTTER_WIDE_CLASS } from '@/lib/ui/mobileLayout';
import { AdminAiSubnav } from '@/components/admin/AdminAiSubnav';

const navItems = [
  { href: '/admin', label: 'Users', exact: true },
  { href: '/admin/plans', label: 'Plans' },
  { href: '/admin/ai', label: 'AI Settings', exact: true },
  { href: '/admin/ai/models', label: 'AI API keys' },
  { href: '/admin/ai/service-identities', label: 'AI identities' },
  { href: '/admin/onboarding', label: 'Onboarding' },
  { href: '/admin/blog', label: 'Blog' },
  { href: '/admin/feedback', label: 'Feedback' },
  { href: '/admin/insights', label: 'Insights' },
  { href: '/admin/platform-catalog', label: 'Platform catalog' },
] as const;

function isNavActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact || href === '/admin') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showAiSubnav = pathname === '/admin/ai' || pathname.startsWith('/admin/ai/');

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background-card">
        <div className={`max-w-7xl mx-auto ${PAGE_GUTTER_WIDE_CLASS}`}>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {navItems.map(({ href, label, ...rest }) => {
              const exact = 'exact' in rest ? rest.exact : false;
              const isActive = isNavActive(pathname, href, exact);
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
      {showAiSubnav ? (
        <div className={`max-w-7xl mx-auto ${PAGE_GUTTER_WIDE_CLASS} pt-4`}>
          <AdminAiSubnav />
        </div>
      ) : null}
      {children}
    </div>
  );
}
