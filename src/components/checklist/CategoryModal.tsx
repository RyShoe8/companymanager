'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';

interface CatalogEntry {
  _id: string;
  companyName: string;
  categoryName?: string;
  category: string;
  checklistSentence?: string;
  checklistNumber?: number;
  url?: string;
  projectTypes?: string[];
}

interface CategoryModalProps {
  phase: 'Plan' | 'Build' | 'Run';
  projectType: string;
  isManagerOrAdmin: boolean;
  onClose: () => void;
  onAddButton: (label: string, url: string) => Promise<void>;
}

/** Use URL as the full referral link (no appending). */
function getReferralUrl(url: string | undefined): string {
  return url ? url.trim() : '';
}

export default function CategoryModal({ phase, projectType, isManagerOrAdmin, onClose, onAddButton }: CategoryModalProps) {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<CatalogEntry | null>(null);
  const [addLabel, setAddLabel] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchEntries = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ phase, projectType: projectType || 'generic' });
        if (query) params.set('q', query);
        const res = await fetch(`/api/referral-catalog?${params}`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries || []);
        }
      } catch (e) {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };
    const debounce = setTimeout(fetchEntries, 200);
    return () => clearTimeout(debounce);
  }, [phase, projectType, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCreate = (entry: CatalogEntry) => {
    const url = getReferralUrl(entry.url);
    if (url) window.open(url, '_blank');
    onClose();
  };

  const handleAddClick = (entry: CatalogEntry) => {
    setSelectedEntry(entry);
    setAddLabel(entry.companyName);
    setAddUrl(entry.url || '');
  };

  const handleAddSubmit = async () => {
    if (!selectedEntry || !addLabel.trim() || !addUrl.trim()) return;
    setAdding(true);
    try {
      await onAddButton(addLabel.trim(), addUrl.trim());
      onClose();
    } finally {
      setAdding(false);
    }
  };

  const filteredEntries = entries;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search companies..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-4"
          />
          {selectedEntry ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Add a button for <strong>{selectedEntry.companyName}</strong> (you can change the name and URL below).
              </p>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Button name</label>
                <input
                  type="text"
                  placeholder="e.g. Vercel"
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddSubmit} disabled={adding || !addLabel.trim() || !addUrl.trim()}>
                  {adding ? 'Adding...' : 'Add to project'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSelectedEntry(null)}>
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {loading ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : filteredEntries.length === 0 ? (
                <p className="text-sm text-gray-500">No results. Add entries in Admin → Stage Management.</p>
              ) : (
                filteredEntries.map((entry) => (
                  <div
                    key={entry._id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {entry.companyName}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      {entry.url && (
                        <button
                          type="button"
                          onClick={() => handleCreate(entry)}
                          className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                        >
                          Create
                        </button>
                      )}
                      {isManagerOrAdmin && (
                        <button
                          type="button"
                          onClick={() => handleAddClick(entry)}
                          className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(modal, document.body);
}
