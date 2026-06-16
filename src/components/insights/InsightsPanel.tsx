'use client';

import { useCallback, useEffect, useState } from 'react';
import type { InsightItemDto } from '@/lib/insights/getInsightsForProject';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';
import InsightCard from '@/components/insights/InsightCard';
import InsightsCategoriesModal from '@/components/insights/InsightsCategoriesModal';

interface InsightsPanelProps {
  projectId: string;
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  stageOrder: number;
  itemCount: number;
  completedCount: number;
}

export default function InsightsPanel({ projectId }: InsightsPanelProps) {
  const light = useInspectorLight();
  const [insights, setInsights] = useState<InsightItemDto[]>([]);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [insightsRes, progressRes, categoriesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/insights`),
        fetch(`/api/projects/${projectId}/insights/progress`),
        fetch(`/api/projects/${projectId}/insights/categories`),
      ]);
      if (insightsRes.ok) {
        const data = await insightsRes.json();
        setInsights(data.insights ?? []);
      }
      if (progressRes.ok) {
        setProgress(await progressRes.json());
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data.categories ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDismiss = async (itemId: string, dismissedServiceName?: string) => {
    setDismissingId(itemId);
    try {
      const res = await fetch(`/api/projects/${projectId}/insights/${itemId}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissedServiceName }),
      });
      if (res.ok) {
        await load();
      }
    } finally {
      setDismissingId(null);
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className={`${lightSurface('bg-white', 'dark:bg-gray-800', light)} rounded-lg border ${lightSurface('border-gray-200', 'dark:border-gray-700', light)} p-4`}>
      <button
        type="button"
        onClick={() => setPanelExpanded((prev) => !prev)}
        aria-expanded={panelExpanded}
        className={`flex w-full items-center gap-2 text-left ${panelExpanded ? 'mb-3' : ''}`}
      >
        <span className={`shrink-0 text-xs ${lightSurface('text-gray-500', 'dark:text-gray-400', light)}`}>
          {panelExpanded ? '▼' : '▶'}
        </span>
        <h3 className={`text-lg font-semibold ${lightSurface('text-gray-900', 'dark:text-white', light)}`}>Insights</h3>
        {!panelExpanded && (
          <span className={`ml-auto text-sm ${lightSurface('text-gray-500', 'dark:text-gray-400', light)}`}>
            {progress.completed} of {progress.total} completed
          </span>
        )}
      </button>

      {panelExpanded && (
        <>
          <p className={`text-sm ${lightSurface('text-gray-500', 'dark:text-gray-400', light)} mb-2`}>
            {progress.completed} of {progress.total} completed
          </p>
          <div className={`mb-3 h-1.5 rounded-full overflow-hidden ${lightSurface('bg-gray-100', 'dark:bg-gray-700', light)}`}>
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>

          {loading ? (
            <p className={`text-sm ${lightSurface('text-gray-500', 'dark:text-gray-400', light)}`}>Loading insights…</p>
          ) : insights.length === 0 ? (
            <div className="text-center py-6">
              <p className={`text-sm font-medium ${lightSurface('text-gray-900', 'dark:text-white', light)} mb-1`}>
                You&apos;re all caught up!
              </p>
              <p className={`text-sm ${lightSurface('text-gray-500', 'dark:text-gray-400', light)} mb-4`}>
                Every insight for this project is complete or dismissed.
              </p>
              <button
                type="button"
                onClick={() => setShowCategories(true)}
                className="text-sm text-primary hover:underline"
              >
                Browse all insight categories
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {insights.map((item) => (
                <InsightCard
                  key={item.id}
                  projectId={projectId}
                  item={item}
                  onDismiss={handleDismiss}
                  dismissing={dismissingId === item.id}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showCategories && (
        <InsightsCategoriesModal categories={categories} onClose={() => setShowCategories(false)} />
      )}
    </div>
  );
}
