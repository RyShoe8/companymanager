'use client';

import { useState, useCallback, useMemo } from 'react';
import type { IProject, IProjectTechStackItem, TechStackCategory } from '@/lib/models/Project';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ModalAction from '@/components/ui/ModalAction';
import TechStackIcon from '@/components/projects/TechStackIcon';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';
import { getCatalogByCategory } from '@/lib/techStack/catalog';
import { TECH_STACK_CATEGORY_LABELS, getTechStackEntry } from '@/lib/utils/techStack';

interface ProjectTechStackBarProps {
  techStack: IProjectTechStackItem[];
  isManagerOrAdmin: boolean;
  onUpdate: (updates: Partial<IProject>) => Promise<void>;
}

export default function ProjectTechStackBar({
  techStack,
  isManagerOrAdmin,
  onUpdate,
}: ProjectTechStackBarProps) {
  const light = useInspectorLight();
  const [expanded, setExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TechStackCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectedIds = useMemo(() => new Set(techStack.map((t) => t.technologyId)), [techStack]);

  const categoryOptions = useMemo(
    () =>
      (['hosting', 'database', 'api', 'framework', 'payments'] as TechStackCategory[]).map((cat) => ({
        id: cat,
        label: TECH_STACK_CATEGORY_LABELS[cat],
      })),
    []
  );

  const categoryTechnologies = useMemo(
    () => (selectedCategory ? getCatalogByCategory(selectedCategory) : []),
    [selectedCategory]
  );

  const appendTech = useCallback(
    async (category: TechStackCategory, technologyId: string) => {
      if (selectedIds.has(technologyId)) {
        alert('That technology is already on this project.');
        return false;
      }
      const entry = getTechStackEntry(technologyId);
      if (!entry || entry.category !== category) return false;

      setSaving(true);
      try {
        await onUpdate({
          techStack: [...techStack, { category, technologyId }],
        });
        return true;
      } catch {
        alert('Failed to save tech stack entry.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [onUpdate, selectedIds, techStack]
  );

  const handleDelete = async (index: number) => {
    const next = techStack.filter((_, i) => i !== index);
    setSaving(true);
    try {
      await onUpdate({ techStack: next });
      setSelectedIndex(null);
    } catch {
      alert('Failed to delete tech stack entry.');
    } finally {
      setSaving(false);
    }
  };

  if (!isManagerOrAdmin && techStack.length === 0) return null;

  const selectedItem = selectedIndex != null ? techStack[selectedIndex] : null;
  const selectedEntry = selectedItem ? getTechStackEntry(selectedItem.technologyId) : null;

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
            Tech Stack
          </Button>
        )}
        {techStack.map((item, index) => {
          const entry = getTechStackEntry(item.technologyId);
          return (
            <button
              key={`${item.technologyId}-${index}`}
              type="button"
              title={entry?.name ?? item.technologyId}
              onClick={() => setSelectedIndex(index)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${lightSurface(
                'border border-gray-200 bg-white hover:bg-gray-50',
                'dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600',
                light
              )}`}
            >
              <TechStackIcon technologyId={item.technologyId} size={18} />
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
              {categoryTechnologies.map((tech) => {
                const alreadyAdded = selectedIds.has(tech.id);
                return (
                  <button
                    key={tech.id}
                    type="button"
                    disabled={saving || alreadyAdded}
                    title={alreadyAdded ? `${tech.name} (added)` : tech.name}
                    onClick={() => void appendTech(selectedCategory, tech.id)}
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
                    <TechStackIcon technologyId={tech.id} size={22} />
                    <span className={`text-[10px] leading-tight line-clamp-2 ${lightSurface('text-gray-600', 'dark:text-gray-300', light)}`}>
                      {tech.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!selectedCategory && (
            <p className={`text-xs ${lightSurface('text-gray-500', 'dark:text-gray-400', light)}`}>
              Choose a category to browse technologies.
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

      <Modal
        isOpen={selectedIndex !== null && !!selectedItem && !!selectedEntry}
        onClose={() => setSelectedIndex(null)}
        title={selectedEntry?.name ?? 'Technology'}
        maxWidth="sm"
        elevated
        stackAboveOverlays
        bodyPadding={false}
      >
        {selectedItem && selectedEntry && selectedIndex !== null && (
          <div className="py-1">
            <p className={`px-4 py-2 text-sm ${lightSurface('text-gray-500', 'dark:text-gray-400', light)}`}>
              {TECH_STACK_CATEGORY_LABELS[selectedEntry.category]}
            </p>
            <ModalAction
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              }
              label="Open"
              onClick={() => {
                window.open(selectedEntry.homepageUrl, '_blank', 'noopener,noreferrer');
                setSelectedIndex(null);
              }}
            />
            {isManagerOrAdmin && (
              <ModalAction
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                }
                label="Delete"
                variant="danger"
                onClick={() => void handleDelete(selectedIndex)}
              />
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
