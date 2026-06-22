import { describe, expect, it } from 'vitest';
import {
  allowBulkTaskExpandForRequest,
  parseIncomingTaskStatus,
  shouldForceActiveTaskStatus,
} from '@/lib/projects/taskCreateAuth';

describe('shouldForceActiveTaskStatus', () => {
  it('forces active status for contributors', () => {
    expect(shouldForceActiveTaskStatus(false)).toBe(true);
    expect(shouldForceActiveTaskStatus(true)).toBe(false);
  });
});

describe('allowBulkTaskExpandForRequest', () => {
  it('allows bulk expand only for managers with explicit flag', () => {
    expect(allowBulkTaskExpandForRequest(true, true)).toBe(true);
    expect(allowBulkTaskExpandForRequest(true, false)).toBe(false);
    expect(allowBulkTaskExpandForRequest(false, true)).toBe(false);
    expect(allowBulkTaskExpandForRequest(false, false)).toBe(false);
  });
});

describe('parseIncomingTaskStatus', () => {
  it('parses manager-provided statuses', () => {
    expect(parseIncomingTaskStatus('completed')).toBe('completed');
    expect(parseIncomingTaskStatus('complete')).toBe('completed');
    expect(parseIncomingTaskStatus('in-review')).toBe('in-review');
    expect(parseIncomingTaskStatus('in_review')).toBe('in-review');
    expect(parseIncomingTaskStatus('active')).toBe('active');
    expect(parseIncomingTaskStatus(undefined)).toBe('active');
  });
});
