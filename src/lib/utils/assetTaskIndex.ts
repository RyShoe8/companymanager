/** Stable task IDs take precedence over legacy positional references. */
export function initialAssetTaskIndex(existingIndex?: number, existingId?: string, initialIndex?: number, initialId?: string): string {
  if (existingId) return '';
  if (existingIndex !== undefined) return String(existingIndex);
  return initialId ? '' : initialIndex === undefined ? '' : String(initialIndex);
}
