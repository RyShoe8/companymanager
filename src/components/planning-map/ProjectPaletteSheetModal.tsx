'use client';

import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { labelForPaletteIndex, parseCssColorInput } from '@/lib/utils/cssColorInput';

interface ProjectPaletteSheetModalProps {
  isOpen: boolean;
  paletteDraft: string[];
  paletteSaving: boolean;
  paletteCopyFeedback: boolean;
  setPaletteDraft: (updater: (prev: string[]) => string[]) => void;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  onClear: () => void | Promise<void>;
  onCopy: () => void | Promise<void>;
}

/** Project color-palette editing sheet, extracted from InlineProjectView. */
export default function ProjectPaletteSheetModal({
  isOpen,
  paletteDraft,
  paletteSaving,
  paletteCopyFeedback,
  setPaletteDraft,
  onClose,
  onSave,
  onClear,
  onCopy,
}: ProjectPaletteSheetModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!paletteSaving) onClose();
      }}
      title="Color palette"
      elevated
      stackAboveOverlays
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Primary is optional and is used on the map when set. Enter hex (#RGB or #RRGGBB) or rgb() / rgba(). Blank rows are omitted when you save. Clear palette removes all swatches but keeps your project color on the map.
        </p>
        <div className="space-y-3">
          {paletteDraft.map((row, idx) => {
            const trimmed = row.trim();
            const parsed = trimmed ? parseCssColorInput(trimmed) : null;
            const ok = parsed?.ok === true;
            return (
              <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-xs font-medium text-gray-500 w-28 shrink-0 pt-2 sm:pt-0">
                  {labelForPaletteIndex(idx)}
                </span>
                <div
                  className={`h-9 w-9 shrink-0 rounded-lg border-2 ${
                    ok ? 'border-gray-200' : 'border-dashed border-amber-500/80 bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)_50%/8px_8px]'
                  }`}
                  style={ok && parsed ? { backgroundColor: parsed.normalized } : undefined}
                  aria-hidden
                />
                <input
                  type="text"
                  value={row}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPaletteDraft((prev) => prev.map((x, i) => (i === idx ? v : x)));
                  }}
                  disabled={paletteSaving}
                  placeholder={idx === 0 ? '#3b82f6 or rgb(59, 130, 246)' : '#RRGGBB or rgb()'}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm font-mono"
                />
                {idx >= 1 && (
                  <button
                    type="button"
                    disabled={paletteSaving}
                    onClick={() => setPaletteDraft((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-sm text-red-600 hover:underline shrink-0 text-left sm:text-right sm:w-16"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={paletteSaving}
          onClick={() => setPaletteDraft((prev) => [...prev, ''])}
        >
          Add color
        </Button>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          <Button type="button" size="sm" disabled={paletteSaving} onClick={() => void onSave()}>
            {paletteSaving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={paletteSaving}
            onClick={() => void onClear()}
          >
            Clear palette
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={paletteSaving}
            onClick={() => void onCopy()}
          >
            {paletteCopyFeedback ? 'Copied' : 'Copy palette'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={paletteSaving}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
