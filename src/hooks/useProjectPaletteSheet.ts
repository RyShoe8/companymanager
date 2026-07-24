import { useCallback, useState } from 'react';
import type { IProject } from '@/lib/models/Project';
import { labelForPaletteIndex, parseCssColorInput, formatColorPaletteForCopy } from '@/lib/utils/cssColorInput';

interface UseProjectPaletteSheetOptions {
  localProject: IProject;
  project: IProject;
  setLocalProject: (updater: (prev: IProject) => IProject) => void;
  onUpdate: (updates: Partial<IProject> & { allowBulkTaskExpand?: boolean }) => Promise<IProject | void>;
}

/**
 * Encapsulates the project color-palette editing sheet: draft state, open/save/clear/copy
 * handlers. Extracted from InlineProjectView so the palette-editing concern is self-contained
 * and independently testable.
 */
export function useProjectPaletteSheet({
  localProject,
  project,
  setLocalProject,
  onUpdate,
}: UseProjectPaletteSheetOptions) {
  const [paletteSheetOpen, setPaletteSheetOpen] = useState(false);
  const [paletteDraft, setPaletteDraft] = useState<string[]>(['#3b82f6']);
  const [paletteSaving, setPaletteSaving] = useState(false);
  const [paletteCopyFeedback, setPaletteCopyFeedback] = useState(false);

  const openPaletteSheet = useCallback(() => {
    const pal = localProject.colorPalette;
    const initial =
      Array.isArray(pal) && pal.length > 0 ? pal.map((c) => String(c)) : [localProject.color || '#3b82f6'];
    setPaletteDraft(initial.length > 0 ? initial : ['#3b82f6']);
    setPaletteSheetOpen(true);
  }, [localProject.colorPalette, localProject.color]);

  const savePaletteFromDraft = async () => {
    const sanitized: string[] = [];
    for (let i = 0; i < paletteDraft.length; i++) {
      const t = paletteDraft[i].trim();
      if (!t) continue;
      const p = parseCssColorInput(t);
      if (!p.ok) {
        alert(`Invalid ${labelForPaletteIndex(i)}: ${t}. Use #hex or rgb() / rgba().`);
        return;
      }
      sanitized.push(p.normalized);
    }
    setPaletteSaving(true);
    const nextColor = sanitized.length > 0 ? sanitized[0] : localProject.color;
    setLocalProject((prev) => ({ ...prev, colorPalette: sanitized as string[], color: nextColor } as IProject));
    try {
      await onUpdate({
        colorPalette: sanitized,
        ...(sanitized.length > 0 ? { color: sanitized[0] } : {}),
      });
      setPaletteSheetOpen(false);
    } catch (error) {
      console.error('Error saving palette:', error);
      setLocalProject(() => project);
      alert(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setPaletteSaving(false);
    }
  };

  const clearPalette = async () => {
    setPaletteSaving(true);
    setPaletteDraft(['']);
    setLocalProject((prev) => ({ ...prev, colorPalette: [] as string[], color: prev.color } as IProject));
    try {
      await onUpdate({ colorPalette: [] });
      setPaletteSheetOpen(false);
    } catch (error) {
      console.error('Error clearing palette:', error);
      setLocalProject(() => project);
      alert(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setPaletteSaving(false);
    }
  };

  const handleCopyPalette = async () => {
    const text = formatColorPaletteForCopy(paletteDraft);
    if (!text) {
      alert('Add at least one valid color to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setPaletteCopyFeedback(true);
      window.setTimeout(() => setPaletteCopyFeedback(false), 2000);
    } catch {
      alert('Could not copy to clipboard.');
    }
  };

  return {
    paletteSheetOpen,
    setPaletteSheetOpen,
    paletteDraft,
    setPaletteDraft,
    paletteSaving,
    paletteCopyFeedback,
    openPaletteSheet,
    savePaletteFromDraft,
    clearPalette,
    handleCopyPalette,
  };
}
