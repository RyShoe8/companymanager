'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import Dropdown from '@/components/ui/Dropdown';
import Modal from '@/components/ui/Modal';
import ProfileModal from '@/components/ProfileModal';
import OrganizationModal from '@/components/OrganizationModal';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [showProfile, setShowProfile] = useState(false);
  const [showOrganization, setShowOrganization] = useState(false);
  const [user, setUser] = useState<{ name?: string; email: string; profilePicture?: string; isAdmin?: boolean } | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleProfileUpdate = () => {
    // Refresh user data
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(console.error);
  };

  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/register');

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
      onClick: () => setShowProfile(true),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      label: 'Organization',
      onClick: () => setShowOrganization(true),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    ...(user?.isAdmin
      ? [
          {
            label: 'Admin',
            onClick: () => router.push('/admin'),
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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

  return (
    <>
      <nav className="bg-background-card border-b border-border mb-[10px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/planning-map" className="flex items-center gap-3">
                  <Image
                    src="/images/Nucleas.png"
                    alt="Nucleas Logo"
                    width={32}
                    height={32}
                    className="h-8 w-auto border-0 outline-none"
                    priority
                    unoptimized
                  />
                  <span className="text-xl font-bold text-text-primary">
                    Nucleas
                  </span>
                </Link>
              </div>
              <div className="ml-6 flex space-x-8">
                <Link
                  href="/planning-map"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    pathname === '/planning-map'
                      ? 'border-primary text-text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-dark'
                  }`}
                >
                  Planning
                </Link>
                <Link
                  href="/assets"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    pathname === '/assets'
                      ? 'border-primary text-text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-dark'
                  }`}
                >
                  Assets
                </Link>
                <Link
                  href="/projects"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    pathname === '/projects'
                      ? 'border-primary text-text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-dark'
                  }`}
                >
                  Projects
                </Link>
                <Link
                  href="/operations"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    pathname === '/operations'
                      ? 'border-accent text-text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-dark'
                  }`}
                >
                  Operations
                </Link>
              <Link
                href="/employees"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                  pathname === '/employees'
                    ? 'border-primary text-text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-dark'
                }`}
              >
                Employees
              </Link>
            </div>
          </div>
            <div className="flex items-center">
              <Dropdown
                trigger={
                  <div className="flex items-center gap-2 cursor-pointer">
                    {user?.profilePicture ? (
                      <img
                        src={user.profilePicture}
                        alt={user.name || user.email}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          // Hide broken image and show initials instead
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            e.currentTarget.style.display = 'none';
                            const initialsDiv = document.createElement('div');
                            initialsDiv.className = 'w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium';
                            initialsDiv.textContent = userInitials;
                            parent.appendChild(initialsDiv);
                          }
                        }}
                      />
                    ) : null}
                    {!user?.profilePicture && (
                      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
                        {userInitials}
                      </div>
                    )}
                    <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                }
                items={dropdownItems}
                align="right"
              />
            </div>
          </div>
        </div>
      </nav>

      <Modal isOpen={showProfile} onClose={() => setShowProfile(false)} title="Profile">
        <ProfileModal onUpdate={handleProfileUpdate} onClose={() => setShowProfile(false)} />
      </Modal>

      <Modal isOpen={showOrganization} onClose={() => setShowOrganization(false)} title="Organization">
        <OrganizationModal onUpdate={() => {}} onClose={() => setShowOrganization(false)} />
      </Modal>
    </>
  );
}
