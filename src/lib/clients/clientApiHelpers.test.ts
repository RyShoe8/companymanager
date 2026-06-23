import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { applyClientUpdates } from '@/lib/clients/clientApiHelpers';

function makeClientDoc() {
  return {
    organizationId: new Types.ObjectId(),
    name: 'Acme',
    assignedToEmployeeIds: [] as Types.ObjectId[],
    assignedToEmployeeId: undefined as Types.ObjectId | undefined,
  } as Parameters<typeof applyClientUpdates>[0];
}

describe('applyClientUpdates assignedToEmployeeIds', () => {
  it('sets and clears assignment fields', () => {
    const client = makeClientDoc();
    const id1 = new Types.ObjectId().toString();
    const id2 = new Types.ObjectId().toString();

    const setResult = applyClientUpdates(client, { assignedToEmployeeIds: [id1, id2, id1] }, true);
    expect(setResult.ok).toBe(true);
    expect(client.assignedToEmployeeIds?.map((id) => id.toString())).toEqual([id1, id2]);
    expect(client.assignedToEmployeeId?.toString()).toBe(id1);

    const clearResult = applyClientUpdates(client, { assignedToEmployeeIds: [] }, true);
    expect(clearResult.ok).toBe(true);
    expect(client.assignedToEmployeeIds).toEqual([]);
    expect(client.assignedToEmployeeId).toBeUndefined();
  });

  it('rejects invalid employee ids', () => {
    const client = makeClientDoc();
    const result = applyClientUpdates(client, { assignedToEmployeeIds: ['not-an-id'] }, true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });
});
