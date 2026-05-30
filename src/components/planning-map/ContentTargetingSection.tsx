'use client';

import { IProject } from '@/lib/models/Project';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import Button from '@/components/ui/Button';
import { parseDelimitedList } from '@/lib/constants/contentDistribution';

interface ContentTargetingSectionProps {
  project: IProject;
  isManagerOrAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
  keywords: string;
  onKeywordsChange: (value: string) => void;
  internalLinks: string[];
  onInternalLinksChange: (links: string[]) => void;
  externalUrl: string;
  onExternalUrlChange: (value: string) => void;
  contentItemId?: string;
  mode?: 'live' | 'draft';
}

export function parseKeywordsInput(text: string): string[] {
  return parseDelimitedList(text);
}

export default function ContentTargetingSection({
  expanded,
  onToggle,
  keywords,
  onKeywordsChange,
  internalLinks,
  onInternalLinksChange,
  externalUrl,
  onExternalUrlChange,
}: ContentTargetingSectionProps) {
  const addInternalLink = () => onInternalLinksChange([...internalLinks, '']);
  const updateInternalLink = (index: number, value: string) => {
    const next = [...internalLinks];
    next[index] = value;
    onInternalLinksChange(next);
  };
  const removeInternalLink = (index: number) => {
    onInternalLinksChange(internalLinks.filter((_, i) => i !== index));
  };

  return (
    <>
      <TargetingToggle expanded={expanded} onToggle={onToggle} />

      {expanded && (
        <div className="space-y-4 animate-in slide-in-from-top-2">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Target keywords</label>
            <AutoGrowTextarea
              value={keywords}
              onChange={(e) => onKeywordsChange(e.target.value)}
              placeholder="e.g. keyword1, keyword2 (comma or newline separated)"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-text-primary">Internal links</label>
              <Button type="button" variant="secondary" size="sm" onClick={addInternalLink}>
                + Add internal link
              </Button>
            </div>
            {internalLinks.length === 0 && (
              <p className="text-xs text-text-secondary mb-2">No internal links yet.</p>
            )}
            {internalLinks.map((link, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <AutoGrowTextarea
                  value={link}
                  onChange={(e) => updateInternalLink(index, e.target.value)}
                  placeholder="/page1 or https://..."
                  minRows={1}
                  className="flex-1"
                />
                <Button type="button" variant="danger" size="sm" onClick={() => removeInternalLink(index)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">External link</label>
            <AutoGrowTextarea
              value={externalUrl}
              onChange={(e) => onExternalUrlChange(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
      )}
    </>
  );
}

function TargetingToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <div className="pt-2 border-t border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors w-full focus:outline-none"
      >
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Targeting and links
      </button>
    </div>
  );
}
