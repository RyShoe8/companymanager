'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface OrganizationModalProps {
  onUpdate: () => void;
  onClose: () => void;
}

export default function OrganizationModal({ onUpdate, onClose }: OrganizationModalProps) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        const response = await fetch('/api/organization');
        if (response.ok) {
          const data = await response.json();
          setName(data.name || '');
          setDomain(data.domain || '');
        }
      } catch (error) {
        console.error('Error fetching organization:', error);
      }
    };
    fetchOrganization();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!name.trim()) {
      setError('Organization name is required');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/organization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), domain: domain.trim() || undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update organization');
      }

      onUpdate();
      // Only close if not on setup page
      if (!window.location.pathname.includes('setup-organization')) {
        onClose();
        // Refresh the page to ensure all components have updated data
        window.location.reload();
      }
    } catch (error: any) {
      setError(error.message || 'Failed to update organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-error-light border border-error/30 text-error px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <Input
        label="Organization Name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="Enter your organization name"
      />

      <Input
        label="Domain (Optional)"
        type="text"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        placeholder="example.com"
      />
      <p className="text-sm text-text-secondary">
        Your organization domain (e.g., example.com). This is optional and can be used for email invitations.
      </p>

      <div className="flex gap-2 justify-end pt-4 border-t border-border">
        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
