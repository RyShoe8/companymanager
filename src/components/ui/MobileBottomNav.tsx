'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/workspace', label: 'Workspace', icon: '🗂️' },
    { href: '/assets', label: 'Assets', icon: '📦' },
    { href: '/employees', label: 'Team', icon: '👥' },
  ];

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const isMarketingPage = pathname === '/' || pathname === '/about' || pathname === '/pricing' || pathname === '/features' || pathname === '/contact';
  if (isMarketingPage) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background-card border-t border-border md:hidden z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            data-tour={
              item.href === '/workspace'
                ? 'nav-workspace'
                : item.href === '/assets'
                  ? 'nav-assets'
                  : item.href === '/employees'
                    ? 'nav-team'
                    : undefined
            }
            className={`flex flex-col items-center justify-center flex-1 h-full ${isActive(item.href)
                ? 'text-primary'
                : 'text-text-secondary hover:text-text-primary'
              }`}
          >
            <span className="text-xl mb-1">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
