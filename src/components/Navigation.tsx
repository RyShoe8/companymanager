'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Dropdown from '@/components/ui/Dropdown';
import Modal from '@/components/ui/Modal';
import ProfileModal from '@/components/ProfileModal';
import OrganizationModal from '@/components/OrganizationModal';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{
    name: string;
    email: string;
    profilePicture: string | null;
    isAdmin: boolean;
    isOrgOwner?: boolean;
  } | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showOrganizationModal, setShowOrganizationModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/register');

  useEffect(() => {
    if (isAuthPage) return; // no need to fetch on login/register
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data && !data.error && data.id) {
            setUser(data);
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        setUser(null);
      }
    };
    fetchUser();
  }, [pathname, isAuthPage]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      // Logout error
    }
  };

  const handleProfileUpdate = async () => {
    const response = await fetch('/api/auth/me');
    if (response.ok) {
      const data = await response.json();
      setUser(data && data.id ? data : null);
    } else {
      setUser(null);
    }
  };

  if (isAuthPage) {
    return null;
  }

  const userInitials = user?.name
    ? user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U';

  const dropdownItems = [
    {
      label: 'Profile',
      onClick: () => setShowProfileModal(true),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      label: 'Organization',
      onClick: () => setShowOrganizationModal(true),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    ...(user?.isOrgOwner
      ? [
          {
            label: 'Billing',
            onClick: () => router.push('/billing'),
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            ),
          },
        ]
      : []),
    ...(user?.isAdmin
      ? [
        {
          label: 'Admin',
          onClick: () => router.push('/admin'),
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
      ]
      : []),
    {
      label: 'Logout',
      onClick: handleLogout,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      ),
    },
  ];

  const navLinks = [
    { href: '/workspace', label: 'Workspace' },
    { href: '/assets', label: 'Assets' },
    { href: '/employees', label: 'Team' },
  ];

  return (
    <>
      <nav className="bg-background-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/workspace" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md">
                  <img
                    src="/images/nucleas-logo.png?v=4"
                    alt="Nucleas Logo"
                    width={56}
                    height={56}
                    className="h-14 w-14 object-contain"
                  />
                </span>
                <span className="text-xl font-bold text-text-primary">
                  Nucleas
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex md:items-center md:space-x-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${pathname === link.href || pathname?.startsWith(link.href + '/')
                    ? 'border-primary text-text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
                    }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Desktop: User menu when logged in, Login/Register when not */}
            <div className="hidden md:flex md:items-center">
              {user ? (
                <Dropdown
                  trigger={
                    <div className="flex items-center gap-2 cursor-pointer">
                      {user?.profilePicture ? (
                        <img
                          src={user.profilePicture}
                          alt={user.name || user.email}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                      <div className={`w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium ${user?.profilePicture ? 'hidden' : ''}`}>
                        {userInitials}
                      </div>
                      <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  }
                  items={dropdownItems}
                  align="right"
                />
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    href="/login"
                    className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-nucleas-ink hover:bg-primary-hover transition-colors"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile: User menu when logged in, Login/Register when not */}
            <div className="md:hidden flex items-center gap-3">
              {user ? (
                <Dropdown
                  trigger={
                    <div className="flex items-center gap-2 cursor-pointer">
                      {user?.profilePicture ? (
                        <img
                          src={user.profilePicture}
                          alt={user.name || user.email}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                      <div className={`w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium ${user?.profilePicture ? 'hidden' : ''}`}>
                        {userInitials}
                      </div>
                    </div>
                  }
                  items={dropdownItems}
                  align="right"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="text-sm font-medium text-text-secondary hover:text-text-primary"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center px-2 py-1 rounded text-sm font-medium bg-primary text-nucleas-ink hover:bg-primary-hover"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Register
                  </Link>
                </div>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-background-elevated focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                aria-expanded="false"
              >
                <span className="sr-only">Open main menu</span>
                {mobileMenuOpen ? (
                  <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${pathname === link.href || pathname?.startsWith(link.href + '/')
                    ? 'bg-background-elevated text-text-primary'
                    : 'text-text-secondary hover:bg-background-elevated hover:text-text-primary'
                    }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      <Modal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} title="Profile">
        <ProfileModal
          onUpdate={handleProfileUpdate}
          onClose={() => setShowProfileModal(false)}
        />
      </Modal>

      <Modal isOpen={showOrganizationModal} onClose={() => setShowOrganizationModal(false)} title="Organization">
        <OrganizationModal
          onUpdate={handleProfileUpdate}
          onClose={() => setShowOrganizationModal(false)}
        />
      </Modal>
    </>
  );
}
