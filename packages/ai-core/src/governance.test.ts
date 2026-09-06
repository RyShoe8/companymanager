import { describe, expect, it } from 'vitest';
import { assertApprovalBinding, assertBudgetReservation, assertRunTransition } from './governance';

describe('run governance', () => {
  it('never allows the worker to self-complete', () => {
    expect(() => assertRunTransition('running', 'completed')).toThrow();
    expect(() => assertRunTransition('awaiting_acceptance', 'completed')).toThrow();
  });
  it('requires human acceptance of the exact reviewed artifact', () => {
    expect(() => assertRunTransition('awaiting_acceptance', 'completed', { acceptedByHuman: true, reviewPassed: true, artifactMatches: true })).not.toThrow();
    expect(() => assertRunTransition('awaiting_acceptance', 'completed', { acceptedByHuman: true, reviewPassed: true, artifactMatches: false })).toThrow();
  });
  it('does not report cancellation before fencing execution', () => {
    expect(() => assertRunTransition('cancellation_requested', 'cancelled')).toThrow();
    expect(() => assertRunTransition('cancellation_requested', 'cancelled', { executionStoppedOrFenced: true })).not.toThrow();
  });
  it('does not restart terminal states', () => {
    for (const state of ['completed', 'cancelled', 'failed'] as const) expect(() => assertRunTransition(state, 'queued')).toThrow();
  });
});
describe('approval scope and expiry', () => {
  const approval = { organizationId: 'org-a', projectId: 'p', digest: 'exact-version', consumed: false, expiresAt: new Date('2030-01-01') };
  const action = { organizationId: 'org-a', projectId: 'p', digest: 'exact-version' };
  it('permits only the matching live action', () => expect(() => assertApprovalBinding(approval, action, new Date('2026-01-01'))).not.toThrow());
  it.each([{ organizationId: 'org-b' }, { projectId: 'other' }, { digest: 'changed' }])('rejects mismatched scope', change => {
    expect(() => assertApprovalBinding(approval, { ...action, ...change })).toThrow();
  });
  it('rejects replay and expiration', () => {
    expect(() => assertApprovalBinding({ ...approval, consumed: true }, action)).toThrow();
    expect(() => assertApprovalBinding(approval, action, approval.expiresAt)).toThrow();
  });
});
describe('budget arithmetic', () => {
  it('counts parallel reservations', () => {
    expect(() => assertBudgetReservation(100, 20, 50, 30)).not.toThrow();
    expect(() => assertBudgetReservation(100, 20, 50, 31)).toThrow();
  });
  it.each([-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])('rejects unsafe amounts', n => {
    expect(() => assertBudgetReservation(100, 0, 0, n)).toThrow();
  });
});
