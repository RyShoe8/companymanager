import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret-for-ai-error-mapping';
});
vi.mock('server-only', () => ({}));

import { aiError } from '@/lib/ai/control/http';
import { AiHttpError } from '@/lib/ai/control/access';
import { MONGO_NETWORK_USER_MESSAGE } from '@/lib/utils/mongoErrors';

describe('aiError mongo mapping', () => {
  it('maps pool clears to a stable retry message', async () => {
    const error = Object.assign(new Error('hidden host'), {
      name: 'MongoPoolClearedError',
      errorLabelSet: new Set(['PoolRequstedRetry']),
    });
    const response = aiError(error);
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe(MONGO_NETWORK_USER_MESSAGE);
    expect(JSON.stringify(body)).not.toContain('hidden host');
  });

  it('preserves AiHttpError status', async () => {
    const response = aiError(new AiHttpError(400, 'Invalid IDE chat mode.'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid IDE chat mode.' });
  });
});
