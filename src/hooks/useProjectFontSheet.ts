import { useCallback, useState } from 'react';
import type { IProject } from '@/lib/models/Project';
import { labelForFontPaletteIndex, maxFontPaletteEntries, parseFontFamilyInput } from '@/lib/utils/fontPaletteInput';

interface UseProjectFontSheetOptions {
  localProject: IProject;
  project: IProject;
  setLocalProject: (updater: (prev: IProject) => IProject) => void;
  onUpdate: (updates: Partial<IProject> & { allowBulkTaskExpand?: boolean }) => Promise<IProject | void>;
}

/**
 * Encapsulates the project font-palette editing sheet: draft state and open/save handlers.
 * Extracted from InlineProjectView so the font-editing concern is self-contained.
 */
export function useProjectFontSheet({ localProject, project, setLocalProject, onUpdate }: UseProjectFontSheetOptions) {
  const [fontSheetOpen, setFontSheetOpen] = useState(false);
  const [fontDraft, setFontDraft] = useState<string[]>(['']);
  const [fontSaving, setFontSaving] = useState(false);

  const openFontSheet = useCallback(() => {
    const pal = localProject.fontPalette;
    const initial = Array.isArray(pal) && pal.length > 0 ? pal.map((f) => String(f)) : [''];
    setFontDraft(initial.length > 0 ? initial : ['']);
    setFontSheetOpen(true);
  }, [localProject.fontPalette]);

  const saveFontFromDraft = async () => {
    const sanitized: string[] = [];
    for (let i = 0; i < fontDraft.length; i++) {
      const t = fontDraft[i].trim();
      if (!t) {
        if (i === 0) {
          alert('Primary font is required. Enter a font family name.');
          return;
        }
        continue;
      }
      const p = parseFontFamilyInput(t);
      if (!p.ok) {
        alert(
          `Invalid ${labelForFontPaletteIndex(i)}: ${t}. Use letters, numbers, spaces, commas, quotes, or hyphens.`
        );
        return;
      }
      sanitized.push(p.normalized);
    }
    if (sanitized.length === 0) {
      alert('Add at least one valid font.');
      return;
    }
    if (sanitized.length > maxFontPaletteEntries) {
      alert(`You can save at most ${maxFontPaletteEntries} fonts.`);
      return;
    }
    setFontSaving(true);
    setLocalProject((prev) => ({ ...prev, fontPalette: sanitized } as IProject));
    try {
      await onUpdate({ fontPalette: sanitized });
      setFontSheetOpen(false);
    } catch (error) {
      console.error('Error saving fonts:', error);
      setLocalProject(() => project);
      alert(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setFontSaving(false);
    }
  };

  return {
    fontSheetOpen,
    setFontSheetOpen,
    fontDraft,
    setFontDraft,
    fontSaving,
    openFontSheet,
    saveFontFromDraft,
  };
}
