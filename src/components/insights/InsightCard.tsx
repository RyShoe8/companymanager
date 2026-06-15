'use client';

import { useState } from 'react';
import type { InsightItemDto } from '@/lib/insights/getInsightsForProject';
import { getCategoryBadgeClass } from '@/lib/insights/categoryColors';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';
import Button from '@/components/ui/Button';

interface InsightCardProps {
  projectId: string;
  item: InsightItemDto;
  onDismiss: (itemId: string, serviceName?: string) => Promise<void>;
  dismissing?: boolean;
}

export default function InsightCard({ projectId, item, onDismiss, dismissing }: InsightCardProps) {
  const light = useInspectorLight();
  const [showDismissInput, setShowDismissInput] = useState(false);
  const [serviceName, setServiceName] = useState('');

  return (
    <article
      className={`rounded-lg border ${lightSurface('border-gray-200 bg-gray-50', 'dark:border-gray-700 dark:bg-gray-900/40', light)} p-4 transition-opacity ${dismissing ? 'opacity-40 pointer-events-none' : ''}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className={`font-semibold ${lightSurface('text-gray-900', 'dark:text-white', light)}`}>{item.title}</h4>
        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${getCategoryBadgeClass(item.category.slug)}`}>
          {item.category.name}
        </span>
      </div>
      <p className={`text-sm ${lightSurface('text-gray-600', 'dark:text-gray-400', light)} mb-4`}>{item.description}</p>

      {item.vendors.length > 0 && (
        <div className={`border-t ${lightSurface('border-gray-200', 'dark:border-gray-700', light)} pt-3 space-y-3`}>
          {item.vendors.map((vendor) => (
            <div key={vendor.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${lightSurface('text-gray-900', 'dark:text-white', light)}`}>{vendor.name}</p>
                <p className={`text-xs ${lightSurface('text-gray-600', 'dark:text-gray-400', light)}`}>{vendor.description}</p>
                {vendor.pricing && (
                  <p className={`text-xs ${lightSurface('text-gray-500', 'dark:text-gray-500', light)} mt-0.5`}>{vendor.pricing}</p>
                )}
              </div>
              <a
                href={`/go/${vendor.vendorSlug}?projectId=${encodeURIComponent(projectId)}&itemId=${encodeURIComponent(item.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90"
              >
                Sign up ↗
              </a>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        {!showDismissInput ? (
          <button
            type="button"
            onClick={() => setShowDismissInput(true)}
            className={`text-xs ${lightSurface('text-gray-500 hover:text-gray-700', 'dark:text-gray-400 dark:hover:text-gray-200', light)} underline-offset-2 hover:underline`}
          >
            I&apos;ve already done this
          </button>
        ) : (
          <div className="w-full space-y-2">
            <input
              type="text"
              placeholder="What tool do you use for this? (optional)"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              className={`w-full text-xs px-2 py-1.5 rounded border ${lightSurface('border-gray-200 bg-white text-gray-900', 'dark:border-gray-600 dark:bg-gray-800 dark:text-white', light)}`}
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="secondary" onClick={() => setShowDismissInput(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void onDismiss(item.id, serviceName.trim() || undefined)}>
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
