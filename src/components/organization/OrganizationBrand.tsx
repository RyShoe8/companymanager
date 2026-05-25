'use client';

import { useState, useEffect, useCallback } from 'react';
import EditableText from '@/components/ui/EditableText';
import OrganizationLogo from '@/components/organization/OrganizationLogo';

export default function OrganizationBrand() {
  const [name, setName] = useState('');
  const [logo, setLogo] = useState<string | undefined>();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchOrganization = useCallback(async () => {
    try {
      const response = await fetch('/api/organization');
      if (response.ok) {
        const data = await response.json();
        setName(data.name || '');
        setLogo(data.logo);
        setIsAdmin(data.isAdmin || false);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  const handleNameSave = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const response = await fetch('/api/organization', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update organization name');
    }

    setName(trimmed);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-gray-700 animate-pulse flex-shrink-0" />
        <div className="h-8 w-40 bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 min-w-0">
      <OrganizationLogo logo={logo} isAdmin={isAdmin} onLogoUpdate={setLogo} />
      <EditableText
        value={name}
        onSave={handleNameSave}
        className="text-2xl sm:text-3xl font-bold text-white block min-w-0"
        placeholder="Organization name"
        disabled={!isAdmin}
      />
    </div>
  );
}
