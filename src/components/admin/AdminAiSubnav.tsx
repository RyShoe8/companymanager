'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Secondary links shown on every /admin/ai* page. */
export const ADMIN_AI_NAV: { href: string; label: string; exact?: boolean }[] = [
  { href: '/admin/ai', label: 'Settings', exact: true },
  { href: '/admin/ai/models', label: 'API keys' },
  { href: '/admin/ai/service-identities', label: 'Service identities' },
];

export function AdminAiSubnav() {
  const pathname = usePathname();

  return (
    <nav aria-label="AI admin sections" className="mb-4 flex flex-wrap gap-2 border-b border-border pb-3">
      {ADMIN_AI_NAV.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              isActive
                ? 'bg-primary text-white'
                : 'border border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
