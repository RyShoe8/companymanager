'use client';

import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';
import { getCategoryBadgeClass } from '@/lib/insights/categoryColors';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  stageOrder: number;
  itemCount: number;
  completedCount: number;
}

interface InsightsCategoriesModalProps {
  categories: CategoryRow[];
  onClose: () => void;
}

export default function InsightsCategoriesModal({ categories, onClose }: InsightsCategoriesModalProps) {
  const light = useInspectorLight();

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col rounded-xl shadow-xl ${lightSurface('bg-white', 'dark:bg-gray-800', light)}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between p-4 border-b ${lightSurface('border-gray-200', 'dark:border-gray-700', light)}`}>
          <h3 className={`text-lg font-semibold ${lightSurface('text-gray-900', 'dark:text-white', light)}`}>Insight categories</h3>
          <button type="button" onClick={onClose} className={`p-1 ${lightSurface('text-gray-500 hover:text-gray-700', 'dark:text-gray-400 dark:hover:text-gray-200', light)}`} aria-label="Close">
            ✕
          </button>
        </div>
        <ul className="overflow-y-auto p-4 space-y-2">
          {categories.map((cat) => (
            <li
              key={cat.id}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${lightSurface('bg-gray-50', 'dark:bg-gray-900/40', light)}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getCategoryBadgeClass(cat.slug, light)}`}>
                  {cat.name}
                </span>
                <span className={`text-xs ${lightSurface('text-gray-500', 'dark:text-gray-400', light)}`}>
                  {cat.completedCount} / {cat.itemCount} items
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
