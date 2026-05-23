/** MongoDB duplicate key (E11000). */
export function isMongoDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: number }).code;
  return code === 11000;
}
