'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';

interface CatalogEntry {
  _id: string;
  companyName: string;
  categoryName?: string;
  category: string;
  url?: string;
  projectTypes?: string[];
}

type AddStep = 'type' | 'link' | 'email' | 'document' | 'figma' | 'wireframe' | 'more';

export type AddSmartButtonPayload =
  | { kind: 'link'; label: string; url: string }
  | { kind: 'email'; email: string; password?: string; label?: string };

export type PendingAssetPayload = {
  name: string;
  type: 'text' | 'link';
  url?: string;
  textContent?: string;
  linkedProjectId: string;
  linkedContentItemId?: string;
  linkedProjectTaskId?: string;
  tags?: string[];
};

export type AssetLinkContext = {
  linkedProjectId: string;
  linkedContentItemId?: string;
  linkedProjectTaskId?: string;
};

async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  const ct = res.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      const data = await res.json();
      if (data && typeof data.error === 'string') return data.error;
      if (data && typeof data.message === 'string') return data.message;
    } else {
      const text = (await res.text()).trim().slice(0, 200);
      if (text) return text;
    }
  } catch {
    // ignore parse failures
  }
  return fallback;
}

interface CategoryModalProps {
  projectId: string;
  phase: 'Plan' | 'Build' | 'Run';
  projectType: string;
  isManagerOrAdmin: boolean;
  onClose: () => void;
  onAddButton: (payload: AddSmartButtonPayload) => Promise<void>;
  onDocumentCreated?: () => void;
  linkContext?: AssetLinkContext;
  mode?: 'live' | 'draft';
  onPendingAsset?: (asset: PendingAssetPayload) => void;
}

export default function CategoryModal({
  projectId,
  phase,
  projectType,
  isManagerOrAdmin,
  onClose,
  onAddButton,
  onDocumentCreated,
  linkContext,
  mode = 'live',
  onPendingAsset,
}: CategoryModalProps) {
  const [step, setStep] = useState<AddStep>('type');
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CatalogEntry | null>(null);
  const [addLabel, setAddLabel] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [docName, setDocName] = useState('');
  const [docContent, setDocContent] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);
  const [showCustomLinkForm, setShowCustomLinkForm] = useState(false);
  const [emailAddr, setEmailAddr] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailLabel, setEmailLabel] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const effectiveProjectId = linkContext?.linkedProjectId ?? projectId;
  const isEntityContext = !!(linkContext?.linkedContentItemId || linkContext?.linkedProjectTaskId);
  const useAssetFlow = isEntityContext || mode === 'draft';

  const buildAssetPayload = (partial: Omit<PendingAssetPayload, 'linkedProjectId'>): PendingAssetPayload => ({
    linkedProjectId: effectiveProjectId,
    linkedContentItemId: linkContext?.linkedContentItemId,
    linkedProjectTaskId: linkContext?.linkedProjectTaskId,
    tags: [],
    ...partial,
  });

  const saveAsset = async (payload: PendingAssetPayload): Promise<boolean> => {
    if (mode === 'draft') {
      onPendingAsset?.(payload);
      return true;
    }
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onDocumentCreated?.();
        return true;
      }
      const msg = await readApiErrorMessage(res, 'Failed to create asset');
      alert(msg);
      return false;
    } catch {
      alert('Could not create asset. Check your connection and try again.');
      return false;
    }
  };

  const handleEntityLink = async (label: string, url: string) => {
    return saveAsset(buildAssetPayload({ name: label.trim(), type: 'link', url: url.trim() }));
  };

  const needsCatalog = step === 'figma' || step === 'wireframe' || step === 'more';
  const catalogLinkType = step === 'figma' ? 'figma' : step === 'wireframe' ? 'wireframe' : null;

  useEffect(() => {
    if (!needsCatalog) return;
    const fetchEntries = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ phase, projectType: projectType || 'generic' });
        if (catalogLinkType) params.set('linkType', catalogLinkType);
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
    const t = setTimeout(fetchEntries, catalogLinkType ? 0 : 200);
    return () => clearTimeout(t);
  }, [step, phase, projectType, catalogLinkType, query, needsCatalog]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const handleAddSubmit = async () => {
    if (!addLabel.trim() || !addUrl.trim()) return;
    setAdding(true);
    try {
      if (useAssetFlow) {
        const ok = await handleEntityLink(addLabel, addUrl);
        if (ok) onClose();
      } else {
        await onAddButton({ kind: 'link', label: addLabel.trim(), url: addUrl.trim() });
        onClose();
      }
    } finally {
      setAdding(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!emailAddr.trim()) return;
    setAddingEmail(true);
    try {
      if (useAssetFlow) {
        const label = emailLabel.trim() || emailAddr.trim();
        const ok = await handleEntityLink(label, `mailto:${emailAddr.trim()}`);
        if (ok) onClose();
      } else {
        await onAddButton({
          kind: 'email',
          email: emailAddr.trim(),
          ...(emailPassword.trim() ? { password: emailPassword } : {}),
          ...(emailLabel.trim() ? { label: emailLabel.trim() } : {}),
        });
        onClose();
      }
    } finally {
      setAddingEmail(false);
    }
  };

  const handleDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) return;
    setSavingDoc(true);
    try {
      const ok = await saveAsset(
        buildAssetPayload({
          name: docName.trim(),
          type: 'text',
          textContent: docContent.trim() || undefined,
        })
      );
      if (ok) onClose();
    } finally {
      setSavingDoc(false);
    }
  };

  const handleAddClick = (entry: CatalogEntry) => {
    setSelectedEntry(entry);
    setAddLabel(entry.companyName);
    setAddUrl(entry.url || '');
  };

  const renderStep = () => {
    if (step === 'type') {
      return (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Choose a type of link or content to add.</p>
          {[
            { id: 'document' as const, label: 'Document', desc: 'Create and save a document' },
            { id: 'link' as const, label: 'Link', desc: 'Any URL with a button label' },
            { id: 'email' as const, label: 'Email', desc: 'Mailbox address; optional stored password' },
            { id: 'figma' as const, label: 'Figma', desc: 'Design link or suggested tools' },
            { id: 'wireframe' as const, label: 'Wireframe', desc: 'Wireframe link or suggested tools' },
            { id: 'more' as const, label: 'More', desc: 'Other link types and tools' },
          ].map(({ id, label, desc }) => (
            <button
              key={id}
              type="button"
              onClick={() => setStep(id)}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
            >
              <span className="font-medium text-gray-900 dark:text-white">{label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{desc}</span>
            </button>
          ))}
        </div>
      );
    }

    if (step === 'document') {
      return (
        <form onSubmit={handleDocumentSubmit} className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isEntityContext ? 'Create a document linked to this item.' : 'Create a document linked to this project.'}
          </p>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Document name</label>
            <input
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g. Brief, Notes"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Content (optional)</label>
            <textarea
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
              placeholder="Add content..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-y"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={savingDoc || !docName.trim()}>
              {savingDoc ? 'Creating...' : 'Create document'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep('type')}>
              Back
            </Button>
          </div>
        </form>
      );
    }

    if (step === 'email') {
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Add a mailbox shortcut. The email opens your mail app in a new tab. Password is optional; if you save one, use the key icon on the project to view or copy it.
          </p>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Email address</label>
            <input
              type="email"
              autoComplete="email"
              value={emailAddr}
              onChange={(e) => setEmailAddr(e.target.value)}
              placeholder="name@company.com"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Password (optional)</label>
            <input
              type="password"
              autoComplete="new-password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder="Mailbox password"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Display label (optional)</label>
            <input
              type="text"
              value={emailLabel}
              onChange={(e) => setEmailLabel(e.target.value)}
              placeholder="Defaults to email address"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleEmailSubmit}
              disabled={addingEmail || !emailAddr.trim()}
            >
              {addingEmail ? 'Adding...' : 'Add to project'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep('type')}>
              Back
            </Button>
          </div>
        </div>
      );
    }

    if (step === 'link') {
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">Add a link with a button label.</p>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Button name</label>
            <input
              type="text"
              value={addLabel}
              onChange={(e) => setAddLabel(e.target.value)}
              placeholder="e.g. Staging, Dashboard"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">URL</label>
            <input
              type="url"
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddSubmit} disabled={adding || !addLabel.trim() || !addUrl.trim()}>
              {adding ? 'Adding...' : isEntityContext ? 'Add asset' : 'Add to project'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setStep('type')}>
              Back
            </Button>
          </div>
        </div>
      );
    }

    if (step === 'figma' || step === 'wireframe') {
      return (
        <div className="space-y-3">
          <Button variant="secondary" size="sm" onClick={() => { setStep('type'); setShowCustomLinkForm(false); setSelectedEntry(null); setQuery(''); }}>
            Back
          </Button>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Choose a suggested tool or add a custom link.
          </p>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search link types or tools..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
          {selectedEntry ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Button name</label>
                <input
                  type="text"
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">URL</label>
                <input
                  type="url"
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddSubmit} disabled={adding || !addLabel.trim() || !addUrl.trim()}>
                  {adding ? 'Adding...' : 'Add to project'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => { setSelectedEntry(null); setAddLabel(''); setAddUrl(''); }}>
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {loading ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : entries.length === 0 ? (
                  <p className="text-sm text-gray-500">No suggestions. Add a custom link below.</p>
                ) : (
                  entries.map((entry) => (
                    <div
                      key={entry._id}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{entry.companyName}</span>
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
                  ))
                )}
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                {!showCustomLinkForm ? (
                  <button
                    type="button"
                    onClick={() => setShowCustomLinkForm(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    Or enter a custom link
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Button name"
                      value={addLabel}
                      onChange={(e) => setAddLabel(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                    <input
                      type="url"
                      placeholder="https://..."
                      value={addUrl}
                      onChange={(e) => setAddUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddSubmit} disabled={adding || !addLabel.trim() || !addUrl.trim()}>
                        Add to project
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => { setShowCustomLinkForm(false); setAddLabel(''); setAddUrl(''); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      );
    }

    if (step === 'more') {
      return (
        <div className="space-y-3">
          <Button variant="secondary" size="sm" onClick={() => { setStep('type'); setSelectedEntry(null); setQuery(''); }}>
            Back
          </Button>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search link types or tools..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
          {selectedEntry ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Add a button for <strong>{selectedEntry.companyName}</strong>.</p>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Button name</label>
                <input
                  type="text"
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">URL</label>
                <input
                  type="url"
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddSubmit} disabled={adding || !addLabel.trim() || !addUrl.trim()}>
                  {adding ? 'Adding...' : 'Add to project'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSelectedEntry(null)}>Back</Button>
              </div>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {loading ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : entries.length === 0 ? (
                <p className="text-sm text-gray-500">No results. Add entries in Admin → Stage Management.</p>
              ) : (
                entries.map((entry) => (
                  <div
                    key={entry._id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{entry.companyName}</span>
                    {isManagerOrAdmin && (
                      <button
                        type="button"
                        onClick={() => handleAddClick(entry)}
                        className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200"
                      >
                        Add
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl mx-4 max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {step === 'type' ? 'Add' : step === 'document' ? 'Document' : step === 'link' ? 'Link' : step === 'email' ? 'Email' : step === 'figma' ? 'Figma' : step === 'wireframe' ? 'Wireframe' : 'More'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{renderStep()}</div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(modal, document.body);
}
