'use client';

import EditableText from '@/components/ui/EditableText';
import Button from '@/components/ui/Button';
import { normalizeProjectUrlHref, truncateProjectUrlDisplay } from '@/lib/utils/projectUrls';

interface PlatformUrlsSectionProps {
  urlList: string[];
  isManagerOrAdmin: boolean;
  onUrlSave: (index: number, value: string) => void | Promise<void>;
  onUrlRemove: (index: number) => void | Promise<void>;
  onAddUrl: () => void;
  title?: string;
  titleClassName?: string;
  editableClassName?: string;
  emptyClassName?: string;
}

export default function PlatformUrlsSection({
  urlList,
  isManagerOrAdmin,
  onUrlSave,
  onUrlRemove,
  onAddUrl,
  title = 'URLs',
  titleClassName = 'text-xs font-semibold uppercase tracking-wide text-text-tertiary',
  editableClassName = 'min-w-0 max-w-[14rem] text-text-primary',
  emptyClassName = 'text-text-tertiary text-xs',
}: PlatformUrlsSectionProps) {
  return (
    <div className="space-y-1">
      <p className={titleClassName}>{title}</p>
      <div className="flex flex-nowrap items-center gap-2 min-w-0 overflow-x-auto text-sm">
        {urlList.length === 0 && !isManagerOrAdmin ? (
          <span className={emptyClassName}>No URLs</span>
        ) : (
          urlList.map((url, idx) => {
            const href = normalizeProjectUrlHref(url);
            return (
              <div key={idx} className="flex items-center gap-1 shrink-0">
                {isManagerOrAdmin ? (
                  <>
                    <EditableText
                      value={url}
                      onSave={(v) => onUrlSave(idx, v)}
                      className={editableClassName}
                      placeholder="Add URL"
                    />
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2 py-0.5 rounded border border-border hover:bg-background-accent shrink-0"
                      >
                        Open
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void onUrlRemove(idx)}
                      className="p-0.5 text-text-tertiary hover:text-error shrink-0"
                      aria-label="Remove URL"
                    >
                      ×
                    </button>
                  </>
                ) : href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {truncateProjectUrlDisplay(url, 40)}
                  </a>
                ) : null}
              </div>
            );
          })
        )}
        {isManagerOrAdmin ? (
          <Button type="button" size="sm" onClick={onAddUrl} className="shrink-0">
            + Add URL
          </Button>
        ) : null}
      </div>
    </div>
  );
}
