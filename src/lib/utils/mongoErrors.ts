/** Detect Mongo duplicate-key (E11000) without leaking driver details. */
export function isMongoDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ('code' in error && error.code === 11000) return true;
  // insertMany({ ordered: false }) often surfaces BulkWriteError with writeErrors[].
  if ('writeErrors' in error && Array.isArray(error.writeErrors)) {
    return error.writeErrors.some(
      (item) =>
        item &&
        typeof item === 'object' &&
        'code' in item &&
        (item as { code?: number }).code === 11000
    );
  }
  const result =
    'result' in error && error.result && typeof error.result === 'object'
      ? (error.result as { getWriteErrors?: () => { code?: number }[] })
      : null;
  if (typeof result?.getWriteErrors === 'function') {
    try {
      return result.getWriteErrors().some((item) => item?.code === 11000);
    } catch {
      return false;
    }
  }
  return false;
}

const MONGO_NETWORK_NAMES = new Set([
  'MongoNetworkError',
  'MongoPoolClearedError',
  'MongoServerSelectionError',
  'MongoNetworkTimeoutError',
  'MongoExpiredSessionError',
]);

/**
 * True for transient Mongo connectivity / TLS / pool-clear failures.
 * Never use message text that might include hostnames in API responses — callers map to a stable string.
 */
export function isMongoNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error && typeof error.name === 'string' ? error.name : '';
  if (MONGO_NETWORK_NAMES.has(name)) return true;

  const labels =
    'errorLabelSet' in error && error.errorLabelSet instanceof Set
      ? error.errorLabelSet
      : null;
  if (labels) {
    for (const label of ['ResetPool', 'PoolRequstedRetry', 'InterruptInUseConnections', 'RetryableWriteError'] as const) {
      if (labels.has(label)) return true;
    }
  }

  const cause = 'cause' in error ? error.cause : undefined;
  if (cause && cause !== error && isMongoNetworkError(cause)) return true;

  return false;
}

export const MONGO_NETWORK_USER_MESSAGE =
  'Database connection interrupted. Wait a moment and retry.';
