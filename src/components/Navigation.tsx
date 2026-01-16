'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Dropdown from '@/components/ui/Dropdown';
import Modal from '@/components/ui/Modal';
import ProfileModal from '@/components/ProfileModal';
import OrganizationModal from '@/components/OrganizationModal';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string; profilePicture: string | null; isAdmin: boolean } | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showOrganizationModal, setShowOrganizationModal] = useState(false);

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

  const handleProfileUpdate = async () => {
    const response = await fetch('/api/auth/me');
    if (response.ok) {
      const data = await response.json();
      setUser(data);
    }
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

  return (
    <>
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 mb-[10px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/planning-map" className="flex items-center gap-3">
                  <Image
                    src="/images/icon.png"
                    alt="Nucleas Logo"
                    width={32}
                    height={32}
                    className="h-8 w-auto"
                    priority
                    unoptimized
                  />
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    Nucleas
                  </span>
                </Link>
              </div>
              <div className="ml-6 flex space-x-8">
                <Link
                  href="/planning-map"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname === '/planning-map'
                      ? 'border-blue-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Planning
                </Link>
                <Link
                  href="/assets"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname === '/assets'
                      ? 'border-blue-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Assets
                </Link>
                <Link
                  href="/projects"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname === '/projects'
                      ? 'border-blue-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Projects
                </Link>
                <Link
                  href="/operations"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname === '/operations'
                      ? 'border-blue-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Operations
                </Link>
                <Link
                  href="/employees"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname === '/employees'
                      ? 'border-blue-500 text-gray-900 dark:text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
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
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                    <div className={`w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium ${user?.profilePicture ? 'hidden' : ''}`}>
                      {userInitials}
                    </div>
                    <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
