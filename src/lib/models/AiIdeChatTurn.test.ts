import { describe, expect, it } from 'vitest';
import { AiIdeChatTurn } from './AiIdeChatTurn';
import { Types } from 'mongoose';

describe('AiIdeChatTurn Mongoose Schema validation (F01)', () => {
  it('validates a worker mode turn with empty directProfileId and directModel', () => {
    const doc = new AiIdeChatTurn({
      organizationId: 'org-test',
      projectId: new Types.ObjectId(),
      createdByUserId: new Types.ObjectId(),
      mode: 'product',
      directProfileId: '',
      directModel: '',
      requestId: 'req-worker-1',
      role: 'assistant',
      text: 'Worker output completed.',
    });

    const error = doc.validateSync();
    expect(error).toBeUndefined();
  });

  it('rejects direct mode when directProfileId or directModel is missing or empty', () => {
    const doc = new AiIdeChatTurn({
      organizationId: 'org-test',
      projectId: new Types.ObjectId(),
      createdByUserId: new Types.ObjectId(),
      mode: 'direct',
      directProfileId: '',
      directModel: '',
      requestId: 'req-direct-1',
      role: 'assistant',
      text: 'Direct output.',
    });

    const error = doc.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors.directProfileId).toBeDefined();
    expect(error?.errors.directModel).toBeDefined();
  });

  it('validates direct mode when directProfileId and directModel are provided', () => {
    const doc = new AiIdeChatTurn({
      organizationId: 'org-test',
      projectId: new Types.ObjectId(),
      createdByUserId: new Types.ObjectId(),
      mode: 'direct',
      directProfileId: 'prof-123',
      directModel: 'gpt-4o',
      requestId: 'req-direct-2',
      role: 'assistant',
      text: 'Direct output valid.',
    });

    const error = doc.validateSync();
    expect(error).toBeUndefined();
  });
});
