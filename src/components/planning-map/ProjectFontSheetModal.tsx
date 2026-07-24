'use client';

import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { labelForFontPaletteIndex, maxFontPaletteEntries, parseFontFamilyInput } from '@/lib/utils/fontPaletteInput';

interface ProjectFontSheetModalProps {
  isOpen: boolean;
  fontDraft: string[];
  fontSaving: boolean;
  setFontDraft: (updater: (prev: string[]) => string[]) => void;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}

/** Project font-palette editing sheet, extracted from InlineProjectView. */
export default function ProjectFontSheetModal({
  isOpen,
  fontDraft,
  fontSaving,
  setFontDraft,
  onClose,
  onSave,
}: ProjectFontSheetModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!fontSaving) onClose();
      }}
      title="Fonts"
      elevated
      stackAboveOverlays
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Brand typefaces for this project. Primary is required. Extra rows can be left blank and are omitted when you save.
        </p>
        <div className="space-y-3">
          {fontDraft.map((row, idx) => {
            const trimmed = row.trim();
            const parsed = trimmed ? parseFontFamilyInput(trimmed) : null;
            const ok = parsed?.ok === true;
            const previewFamily =
              ok && parsed && /^[\p{L}\p{N}\s\-]+$/u.test(parsed.normalized) && !parsed.normalized.includes(',')
                ? parsed.normalized
                : undefined;
            return (
              <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-xs font-medium text-gray-500 w-28 shrink-0 pt-2 sm:pt-0">
                  {labelForFontPaletteIndex(idx)}
                </span>
                {previewFamily ? (
                  <span
                    className="text-lg shrink-0 text-gray-700 w-9 text-center"
                    style={{ fontFamily: previewFamily }}
                    aria-hidden
                  >
                    Aa
                  </span>
                ) : (
                  <span
                    className="text-lg shrink-0 text-gray-400 w-9 text-center"
                    aria-hidden
                  >
                    Aa
                  </span>
                )}
                <input
                  type="text"
                  value={row}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFontDraft((prev) => prev.map((x, i) => (i === idx ? v : x)));
                  }}
                  disabled={fontSaving}
                  placeholder={idx === 0 ? 'Inter' : 'Georgia or "Inter", sans-serif'}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm"
                />
                {idx >= 1 && (
                  <button
                    type="button"
                    disabled={fontSaving}
                    onClick={() => setFontDraft((prev) => prev.filter((_, i) => i !== idx))}
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
          disabled={fontSaving || fontDraft.length >= maxFontPaletteEntries}
          onClick={() => setFontDraft((prev) => [...prev, ''])}
        >
          Add font
        </Button>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          <Button type="button" size="sm" disabled={fontSaving} onClick={() => void onSave()}>
            {fontSaving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={fontSaving}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
