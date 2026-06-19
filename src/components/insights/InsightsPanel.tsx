'use client';

import { useCallback, useEffect, useState } from 'react';
import type { InsightItemDto } from '@/lib/insights/insightDto';
import type { InsightOwnerType } from '@/lib/insights/syncInsightAutoCompletion';
import CollapsibleInspectorSection from '@/components/ui/CollapsibleInspectorSection';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';
import InsightCard from '@/components/insights/InsightCard';
import InsightsCategoriesModal from '@/components/insights/InsightsCategoriesModal';

interface InsightsPanelProps {
  ownerType: InsightOwnerType;
  ownerId: string;
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  stageOrder: number;
  itemCount: number;
  completedCount: number;
}

export default function InsightsPanel({ ownerType, ownerId }: InsightsPanelProps) {
  const light = useInspectorLight();
  const apiBase = `/api/${ownerType === 'project' ? 'projects' : 'clients'}/${ownerId}/insights`;
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
        fetch(apiBase),
        fetch(`${apiBase}/progress`),
        fetch(`${apiBase}/categories`),
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
  }, [apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDismiss = async (itemId: string, dismissedServiceName?: string) => {
    setDismissingId(itemId);
    try {
      const res = await fetch(`${apiBase}/${itemId}/dismiss`, {
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
  const collapsedSummary =
    insights.length > 0
      ? `${insights.length} insight${insights.length === 1 ? '' : 's'}`
      : `${progress.completed} of ${progress.total} completed`;

  const ownerLabel = ownerType === 'project' ? 'project' : 'client';

  return (
    <>
      <CollapsibleInspectorSection
        title="Insights"
        expanded={panelExpanded}
        onToggle={() => setPanelExpanded((prev) => !prev)}
        collapsedSummary={collapsedSummary}
      >
        <div className={`mb-2 h-1.5 rounded-full overflow-hidden ${lightSurface('bg-gray-100', 'dark:bg-gray-700', light)}`}>
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>

        {loading ? (
          <p className={`text-sm ${lightSurface('text-gray-500', 'dark:text-gray-400', light)}`}>Loading insights…</p>
        ) : insights.length === 0 ? (
          <div className="text-center py-4">
            <p className={`text-sm font-medium ${lightSurface('text-gray-900', 'dark:text-white', light)} mb-1`}>
              You&apos;re all caught up!
            </p>
            <p className={`text-sm ${lightSurface('text-gray-500', 'dark:text-gray-400', light)} mb-3`}>
              Every insight for this {ownerLabel} is complete or dismissed.
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
          <div className="space-y-2">
            {insights.map((item) => (
              <InsightCard
                key={item.id}
                ownerType={ownerType}
                ownerId={ownerId}
                item={item}
                onDismiss={handleDismiss}
                dismissing={dismissingId === item.id}
              />
            ))}
          </div>
        )}
      </CollapsibleInspectorSection>

      {showCategories && (
        <InsightsCategoriesModal categories={categories} onClose={() => setShowCategories(false)} />
      )}
    </>
  );
}
