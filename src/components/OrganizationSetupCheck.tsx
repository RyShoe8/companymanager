'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import OrganizationModal from '@/components/OrganizationModal';

export default function OrganizationSetupCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    const checkSetup = async () => {
      // Skip check for auth pages, setup page, admin page, and public pages
      if (
        pathname === '/' ||
        pathname?.startsWith('/login') || 
        pathname?.startsWith('/register') || 
        pathname === '/setup-organization' ||
        pathname === '/admin' ||
        pathname === '/about' ||
        pathname === '/contact' ||
        pathname === '/terms' ||
        pathname === '/privacy' ||
        pathname?.startsWith('/features/')
      ) {
        setChecking(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (!data.organizationSetupComplete) {
            setNeedsSetup(true);
          }
        }
      } catch (error) {
        console.error('Error checking organization setup:', error);
      } finally {
        setChecking(false);
      }
    };

    checkSetup();
  }, [pathname]);

  const handleComplete = () => {
    setNeedsSetup(false);
    router.refresh();
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  if (needsSetup) {
    router.push('/setup-organization');
    return null;
  }

  return <>{children}</>;
}
