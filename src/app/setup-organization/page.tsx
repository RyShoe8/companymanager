'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OrganizationModal from '@/components/OrganizationModal';
import Modal from '@/components/ui/Modal';

export default function SetupOrganizationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSetup, setIsSetup] = useState(false);

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.organizationSetupComplete) {
            setIsSetup(true);
            router.push('/planning-map');
          } else {
            setLoading(false);
          }
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('Error checking setup:', error);
        router.push('/login');
      }
    };
    checkSetup();
  }, [router]);

  const handleComplete = () => {
    setIsSetup(true);
    router.push('/planning-map');
  };

  if (loading || isSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Welcome to Nucleas!</h1>
          <p className="text-text-secondary">
            Before you can start using Nucleas, please set up your organization.
          </p>
        </div>
        <div className="bg-background-card rounded-lg shadow-lg border border-border p-6">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Setup Your Organization</h2>
          <OrganizationModal onUpdate={handleComplete} onClose={handleComplete} />
        </div>
      </div>
    </div>
  );
}
