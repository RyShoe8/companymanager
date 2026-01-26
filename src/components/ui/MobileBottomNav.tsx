'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/plan', label: 'Plan', icon: '📋' },
    { href: '/build', label: 'Build', icon: '🔨' },
    { href: '/run', label: 'Run', icon: '🚀' },
    { href: '/assets', label: 'Assets', icon: '📦' },
    { href: '/employees', label: 'Team', icon: '👥' },
  ];

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center flex-1 h-full ${
              isActive(item.href)
                ? 'text-blue-600'
                : 'text-gray-500'
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
