import { describe, expect, it } from 'vitest';
import {
  isMongoDuplicateKeyError,
  isMongoNetworkError,
  MONGO_NETWORK_USER_MESSAGE,
} from '@/lib/utils/mongoErrors';

describe('isMongoNetworkError', () => {
  it('detects MongoPoolClearedError and nested causes', () => {
    const nested = Object.assign(new Error('tls'), {
      name: 'MongoNetworkError',
      errorLabelSet: new Set(['ResetPool']),
    });
    const outer = Object.assign(new Error('pool'), {
      name: 'MongoPoolClearedError',
      errorLabelSet: new Set(['PoolRequstedRetry']),
      cause: nested,
    });
    expect(isMongoNetworkError(outer)).toBe(true);
    expect(isMongoNetworkError(nested)).toBe(true);
  });

  it('does not treat duplicate keys as network errors', () => {
    expect(isMongoDuplicateKeyError({ code: 11000 })).toBe(true);
    expect(isMongoNetworkError({ code: 11000, name: 'MongoServerError' })).toBe(false);
  });
});

describe('mongo network user message', () => {
  it('is stable and does not mention hosts', () => {
    expect(MONGO_NETWORK_USER_MESSAGE).toBe(
      'Database connection interrupted. Wait a moment and retry.'
    );
    expect(MONGO_NETWORK_USER_MESSAGE).not.toMatch(/mongodb\.net|ssl|tls/i);
  });
});
