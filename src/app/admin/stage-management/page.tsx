'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface CatalogEntry {
  _id?: string;
  companyName: string;
  categoryName?: string;
  category: 'Plan' | 'Build' | 'Run';
  checklistSentence?: string;
  checklistNumber?: number;
  url?: string;
  imageUrl?: string;
  projectTypes?: string[];
}

export default function StageManagementPage() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await fetch('/api/admin/referral-catalog');
        if (res.status === 403) {
          setError('Access denied. Manager or Administrator required.');
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setEntries(data.entries || []);
      } catch (err) {
        setError('Failed to load catalog');
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/referral-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err) {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      {
        companyName: '',
        categoryName: '',
        category: 'Plan',
        checklistSentence: '',
        checklistNumber: undefined,
        url: '',
        imageUrl: undefined,
        projectTypes: [],
      },
    ]);
  };

  const updateEntry = (index: number, field: keyof CatalogEntry, value: string | number | string[] | undefined) => {
    setEntries((prev) => {
      const updated = [...prev];
      (updated[index] as unknown as Record<string, unknown>)[field] = value;
      return updated;
    });
  };

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIndex(index);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const res = await fetch('/api/admin/referral-catalog/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }
      const data = await res.json();
      if (data.url) updateEntry(index, 'imageUrl', data.url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingIndex(null);
      e.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-6">
            <p className="text-error mb-4">{error}</p>
            <Link href="/admin">
              <Button>Back to Admin</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-[100px] py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/admin" className="text-text-secondary hover:text-primary transition-colors">
            ← Back to Admin
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Stage Management</h1>
        <p className="text-text-secondary mb-6">
          Manage button categories for the checklist and Add flow. <strong>Category</strong> is the manual name (e.g. Hosting, Analytics). <strong>Phase</strong> (Plan / Build / Run) controls when this entry appears in the smart button for that phase.
          Set checklist sentence and order for checklist items, referral URL, and an optional icon per entry.
        </p>

        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Catalog Entries</h2>
          {entries.map((entry, index) => (
            <div key={index} className="flex flex-wrap gap-2 mb-4 p-4 border border-border rounded-lg items-end">
              <div className="w-16 shrink-0">
                <label className="block text-xs text-text-secondary mb-1">Icon</label>
                <div className="flex items-center gap-2">
                  {entry.imageUrl ? (
                    <img src={entry.imageUrl} alt="" className="w-10 h-10 object-contain rounded border border-border" />
                  ) : (
                    <div className="w-10 h-10 rounded border border-border bg-muted flex items-center justify-center text-text-tertiary text-xs">—</div>
                  )}
                  <input
                    ref={(el) => { fileInputRefs.current[index] = el; }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(index, e)}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={uploadingIndex === index}
                    onClick={() => fileInputRefs.current[index]?.click()}
                  >
                    {uploadingIndex === index ? '…' : 'Upload'}
                  </Button>
                </div>
              </div>
              <div className="w-full sm:w-32">
                <label className="block text-xs text-text-secondary mb-1">Company</label>
                <Input
                  placeholder="Vercel"
                  value={entry.companyName}
                  onChange={(e) => updateEntry(index, 'companyName', e.target.value)}
                />
              </div>
              <div className="w-full sm:w-28">
                <label className="block text-xs text-text-secondary mb-1">Phase</label>
                <select
                  value={entry.category}
                  onChange={(e) => updateEntry(index, 'category', e.target.value as CatalogEntry['category'])}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  title="Plan, Build or Run — when this appears in the smart button"
                >
                  <option value="Plan">Plan</option>
                  <option value="Build">Build</option>
                  <option value="Run">Run</option>
                </select>
              </div>
              <div className="w-full sm:w-40">
                <label className="block text-xs text-text-secondary mb-1">Category</label>
                <Input
                  placeholder="e.g. Hosting, Analytics"
                  value={entry.categoryName || ''}
                  onChange={(e) => updateEntry(index, 'categoryName', e.target.value)}
                />
              </div>
              <div className="w-full sm:min-w-[220px] sm:flex-[2]">
                <label className="block text-xs text-text-secondary mb-1">Checklist sentence</label>
                <Input
                  placeholder="Set up hosting"
                  value={entry.checklistSentence || ''}
                  onChange={(e) => updateEntry(index, 'checklistSentence', e.target.value)}
                />
              </div>
              <div className="w-full sm:w-24">
                <label className="block text-xs text-text-secondary mb-1">Order</label>
                <Input
                  type="number"
                  placeholder="1"
                  value={entry.checklistNumber ?? ''}
                  onChange={(e) => updateEntry(index, 'checklistNumber', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                />
              </div>
              <div className="w-full sm:flex-1 min-w-[180px]">
                <label className="block text-xs text-text-secondary mb-1">Referral URL (full link)</label>
                <Input
                  placeholder="https://example.com/signup?ref=yourcode"
                  value={entry.url || ''}
                  onChange={(e) => updateEntry(index, 'url', e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => removeEntry(index)}
                className="text-error hover:underline text-sm shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addEntry}>
            + Add Entry
          </Button>
        </Card>

        <div className="flex gap-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Catalog'}
          </Button>
          <Link href="/admin">
            <Button variant="secondary">Cancel</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
