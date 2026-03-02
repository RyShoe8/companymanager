'use client';

import { useState, useEffect } from 'react';
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

interface ChecklistSectionProps {
  projectId: string;
  phase: 'Plan' | 'Build' | 'Run';
  projectType: string;
  actionButtons: { label: string; url: string }[];
  dismissedChecklistIds: string[];
  isManagerOrAdmin: boolean;
  onUpdate: (updates: { actionButtons?: { label: string; url: string }[]; dismissedChecklistIds?: string[] }) => Promise<void>;
  onRefreshButtons: () => void;
}

/** Use URL as the full referral link (no appending). */
function getReferralUrl(url: string | undefined): string {
  return url ? url.trim() : '';
}

export default function ChecklistSection({
  projectId,
  phase,
  projectType,
  actionButtons,
  dismissedChecklistIds,
  isManagerOrAdmin,
  onUpdate,
  onRefreshButtons,
}: ChecklistSectionProps) {
  const [checklistItems, setChecklistItems] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryForItem, setCategoryForItem] = useState<{ sentence: string; entries: CatalogEntry[] } | null>(null);
  const [addUrlForEntry, setAddUrlForEntry] = useState<{ entry: CatalogEntry; label: string; url: string } | null>(null);

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ phase, projectType: projectType || 'generic' });
        const res = await fetch(`/api/referral-catalog?${params}`);
        if (res.ok) {
          const data = await res.json();
          const entries = (data.entries || []) as CatalogEntry[];
          const withChecklist = entries.filter(
            (e) => e.checklistSentence && e.checklistNumber !== undefined && e.checklistNumber !== null
          );
          const sorted = withChecklist.sort((a, b) => (a.checklistNumber ?? 0) - (b.checklistNumber ?? 0));
          const notDismissed = sorted.filter((e) => !dismissedChecklistIds.includes(e._id));
          setChecklistItems(notDismissed);
        }
      } catch (e) {
        setChecklistItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, [phase, projectType, dismissedChecklistIds]);

  const handleCreate = (entry: CatalogEntry) => {
    const url = getReferralUrl(entry.url);
    if (url) window.open(url, '_blank');
    setCategoryForItem(null);
  };

  const handleAddFromChecklist = async (label: string, url: string) => {
    const res = await fetch(`/api/projects/${projectId}/buttons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, url }),
    });
    if (res.ok) {
      onRefreshButtons();
      setAddUrlForEntry(null);
      setCategoryForItem(null);
    }
  };

  const handleDismiss = async (entryId: string) => {
    const next = [...dismissedChecklistIds, entryId];
    await onUpdate({ dismissedChecklistIds: next });
  };

  const openCategoryForItem = async (sentence: string) => {
    const params = new URLSearchParams({ phase, projectType: projectType || 'generic', q: sentence });
    const res = await fetch(`/api/referral-catalog?${params}`);
    if (res.ok) {
      const data = await res.json();
      const entries = (data.entries || []).filter(
        (e: CatalogEntry) => e.checklistSentence === sentence || e.companyName.toLowerCase().includes(sentence.toLowerCase())
      );
      setCategoryForItem({ sentence, entries });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Checklist</h3>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Things to do at this stage. Create (open referral link), Add (save your URL to project), or Dismiss.
      </p>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : checklistItems.length === 0 ? (
        <p className="text-sm text-gray-500 mb-4">
          No checklist items. Add entries in Admin → Stage Management with checklist sentence and number.
        </p>
      ) : (
        <ol className="list-decimal list-inside space-y-2 mb-4">
          {checklistItems.map((item, idx) => (
            <li key={item._id} className="flex items-center justify-between gap-2 py-1">
              <span className="text-gray-900 dark:text-white">{item.checklistSentence}</span>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openCategoryForItem(item.checklistSentence!)}
                  className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                >
                  Create
                </button>
                {isManagerOrAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryForItem({ sentence: item.checklistSentence!, entries: [item] });
                      }}
                      className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismiss(item._id)}
                      className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {categoryForItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { setCategoryForItem(null); setAddUrlForEntry(null); }}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{categoryForItem.sentence}</h3>
              <button onClick={() => { setCategoryForItem(null); setAddUrlForEntry(null); }} className="text-gray-500 hover:text-gray-700 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
              {addUrlForEntry ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Add a button (custom name and URL)
                  </p>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Button name</label>
                    <input
                      type="text"
                      placeholder="e.g. Vercel"
                      value={addUrlForEntry.label}
                      onChange={(e) => setAddUrlForEntry({ ...addUrlForEntry, label: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">URL</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={addUrlForEntry.url}
                      onChange={(e) => setAddUrlForEntry({ ...addUrlForEntry, url: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAddFromChecklist(addUrlForEntry.label, addUrlForEntry.url)} disabled={!addUrlForEntry.label.trim() || !addUrlForEntry.url.trim()}>
                      Add to project
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setAddUrlForEntry(null)}>
                      Back
                    </Button>
                  </div>
                </div>
              ) : (
                categoryForItem.entries.map((entry) => (
                  <div
                    key={entry._id}
                    className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{entry.companyName}</span>
                    <div className="flex gap-1">
                      {entry.url && (
                        <button
                          type="button"
                          onClick={() => handleCreate(entry)}
                          className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        >
                          Create
                        </button>
                      )}
                      {isManagerOrAdmin && (
                        <button
                          type="button"
                          onClick={() => setAddUrlForEntry({ entry, label: entry.companyName, url: entry.url || '' })}
                          className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
