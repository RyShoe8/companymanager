'use client';

import { useState, useCallback, useMemo, type ReactNode } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ModalAction from '@/components/ui/ModalAction';
import PlatformCredentialModal, { PlatformCredential, PlatformInfo } from '@/components/projects/PlatformCredentialModal';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';

export type StackItem<C extends string> = { category: C; id: string; login?: string; password?: string };

export interface ProjectStackBarConfig<C extends string> {
  /** Toolbar toggle button label, e.g. "Tech Stack". */
  buttonLabel: ReactNode;
  /** Noun used in alerts, e.g. "technology" / "tool". */
  itemNoun: string;
  /** Prompt shown before a category is selected. */
  browsePrompt: string;
  /** Modal title fallback when entry lookup fails. */
  modalFallbackTitle: string;
  categories: C[];
  categoryLabels: Record<C, string>;
  getCatalogByCategory: (category: C) => { id: string; name: string }[];
  getEntry: (id: string) => { id: string; name: string; category: C; homepageUrl: string } | undefined;
  renderIcon: (id: string, size: number) => ReactNode;
}

interface ProjectStackBarProps<C extends string> {
  items: StackItem<C>[];
  isManagerOrAdmin: boolean;
  onSave: (next: StackItem<C>[]) => Promise<void>;
  config: ProjectStackBarConfig<C>;
}

/** Shared stack toolbar (tech stack, marketing stack): icon pills + category browser + detail modal. */
export default function ProjectStackBar<C extends string>({
  items,
  isManagerOrAdmin,
  onSave,
  config,
}: ProjectStackBarProps<C>) {
  const light = useInspectorLight();
  const [expanded, setExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<C | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectedIds = useMemo(() => new Set(items.map((t) => t.id)), [items]);

  const categoryOptions = useMemo(
    () => config.categories.map((cat) => ({ id: cat, label: config.categoryLabels[cat] })),
    [config]
  );

  const categoryEntries = useMemo(
    () => (selectedCategory ? config.getCatalogByCategory(selectedCategory) : []),
    [config, selectedCategory]
  );

  const appendItem = useCallback(
    async (category: C, id: string) => {
      if (selectedIds.has(id)) {
        alert(`That ${config.itemNoun} is already on this project.`);
        return false;
      }
      const entry = config.getEntry(id);
      if (!entry || entry.category !== category) return false;

      setSaving(true);
      try {
        await onSave([...items, { category, id }]);
        return true;
      } catch {
        alert(`Failed to save ${config.itemNoun} entry.`);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [config, items, onSave, selectedIds]
  );

  const handleDelete = async (index: number) => {
    const next = items.filter((_, i) => i !== index);
    setSaving(true);
    try {
      await onSave(next);
      setSelectedIndex(null);
    } catch {
      alert(`Failed to delete ${config.itemNoun} entry.`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCredentials = async (index: number, credentials: PlatformCredential) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], ...credentials };
    setSaving(true);
    try {
      await onSave(updatedItems);
      setSelectedIndex(null);
    } catch {
      alert(`Failed to save credentials.`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCredentials = async (index: number) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], login: undefined, password: undefined };
    setSaving(true);
    try {
      await onSave(updatedItems);
      setSelectedIndex(null);
    } catch {
      alert(`Failed to delete credentials.`);
    } finally {
      setSaving(false);
    }
  };

  if (!isManagerOrAdmin && items.length === 0) return null;

  const selectedItem = selectedIndex != null ? items[selectedIndex] : null;
  const selectedEntry = selectedItem ? config.getEntry(selectedItem.id) : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm min-w-0">
        {isManagerOrAdmin && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={saving}
            onClick={() => {
              setExpanded((v) => {
                const next = !v;
                if (!next) setSelectedCategory(null);
                return next;
              });
            }}
          >
            {config.buttonLabel}
          </Button>
        )}
        {items.map((item, index) => {
          const entry = config.getEntry(item.id);
          return (
            <button
              key={`${item.id}-${index}`}
              type="button"
              title={entry?.name ?? item.id}
              onClick={() => setSelectedIndex(index)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${lightSurface(
                'border border-gray-200 bg-white hover:bg-gray-50',
                'dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600',
                light
              )}`}
            >
              {config.renderIcon(item.id, 18)}
            </button>
          );
        })}
      </div>

      {expanded && isManagerOrAdmin && (
        <div
          className={`w-full basis-full space-y-3 rounded-lg border p-3 ${lightSurface(
            'border-gray-200 bg-gray-50',
            'dark:border-gray-600 dark:bg-gray-800/50',
            light
          )}`}
        >
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((cat) => (
              <button
                key={cat.id}
                type="button"
                disabled={saving}
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${lightSurface(
                  selectedCategory === cat.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                  selectedCategory === cat.id
                    ? 'dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-200'
                    : 'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600',
                  light
                )}`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {selectedCategory && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {categoryEntries.map((entry) => {
                const alreadyAdded = selectedIds.has(entry.id);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    disabled={saving || alreadyAdded}
                    title={alreadyAdded ? `${entry.name} (added)` : entry.name}
                    onClick={() => void appendItem(selectedCategory, entry.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-colors ${lightSurface(
                      alreadyAdded
                        ? 'border-gray-100 bg-gray-100 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 bg-white hover:bg-gray-50',
                      alreadyAdded
                        ? 'dark:border-gray-700 dark:bg-gray-800 opacity-50'
                        : 'dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600',
                      light
                    )}`}
                  >
                    {config.renderIcon(entry.id, 22)}
                    <span className={`text-[10px] leading-tight line-clamp-2 ${lightSurface('text-gray-600', 'dark:text-gray-300', light)}`}>
                      {entry.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!selectedCategory && (
            <p className={`text-xs ${lightSurface('text-gray-500', 'dark:text-gray-400', light)}`}>
              {config.browsePrompt}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => {
                setExpanded(false);
                setSelectedCategory(null);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      <PlatformCredentialModal
        isOpen={selectedIndex !== null && !!selectedItem && !!selectedEntry}
        onClose={() => setSelectedIndex(null)}
        platform={{
          name: selectedEntry?.name ?? config.modalFallbackTitle,
          icon: selectedEntry && selectedItem ? config.renderIcon(selectedItem.id, 24) : null,
          url: selectedEntry?.homepageUrl || '',
        }}
        credentials={{
          login: selectedItem?.login,
          password: selectedItem?.password,
        }}
        onSave={(credentials) => {
          if (selectedIndex !== null) {
            return handleSaveCredentials(selectedIndex, credentials);
          }
          return Promise.resolve();
        }}
        onDelete={isManagerOrAdmin ? () => {
          if (selectedIndex !== null) {
            return handleDeleteCredentials(selectedIndex);
          }
          return Promise.resolve();
        } : undefined}
        canEdit={isManagerOrAdmin}
        canViewPassword={isManagerOrAdmin}
      />
    </>
  );
}
