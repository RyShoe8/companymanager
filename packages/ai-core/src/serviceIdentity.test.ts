import { describe, expect, it } from 'vitest';
import { assertServiceAction } from './serviceIdentity';
const identity = { protocolVersion: 1, identityId: 'a'.repeat(24), organizationId: 'org', role: 'architect', status: 'active', credentialVersion: 1 };
const principal = { kind: 'service', identityId: identity.identityId, credentialVersion: 1 };
const grant = { protocolVersion: 1, grantId: 'b'.repeat(24), identityId: identity.identityId, organizationId: 'org',
  projectId: 'c'.repeat(24), runId: 'd'.repeat(24), operation: 'planning.infer', policyDigest: 'e'.repeat(64), revision: 1,
  issuedAt: '2026-09-06T10:00:00Z', expiresAt: '2026-09-06T11:00:00Z', revoked: false };
const action = { organizationId: grant.organizationId, projectId: grant.projectId, runId: grant.runId,
  operation: grant.operation, policyDigest: grant.policyDigest, grantRevision: grant.revision };
const input = { principal, identity, grant, action };
const now = new Date('2026-09-06T10:30:00Z');
describe('scoped service authorization contracts', () => {
  it('allows only a current exact grant', () => expect(assertServiceAction(input, now).grantId).toBe(grant.grantId));
  it.each([{ organizationId: 'other' }, { projectId: 'f'.repeat(24) }, { runId: 'f'.repeat(24) },
    { policyDigest: 'f'.repeat(64) }, { grantRevision: 2 }, { operation: 'artifact.review' }])('rejects mismatched action %j', change => {
    expect(() => assertServiceAction({ ...input, action: { ...action, ...change } }, now)).toThrow();
  });
  it.each(['disabled', 'revoked'])('denies a %s identity', status => {
    expect(() => assertServiceAction({ ...input, identity: { ...identity, status } }, now)).toThrow();
  });
  it('rejects revoked, expired and not-yet-issued grants', () => {
    expect(() => assertServiceAction({ ...input, grant: { ...grant, revoked: true } }, now)).toThrow();
    expect(() => assertServiceAction(input, new Date(grant.expiresAt))).toThrow();
    expect(() => assertServiceAction(input, new Date('2026-09-06T09:00:00Z'))).toThrow();
    expect(() => assertServiceAction(input, new Date('invalid'))).toThrow();
  });
  it('fences rotated credentials and another authenticated identity', () => {
    expect(() => assertServiceAction({ ...input, principal: { ...principal, credentialVersion: 0 } }, now)).toThrow();
    expect(() => assertServiceAction({ ...input, principal: { ...principal, identityId: 'f'.repeat(24) } }, now)).toThrow();
    expect(() => assertServiceAction({ ...input, principal: { ...principal, kind: 'human' } }, now)).toThrow();
  });
  it.each(['shell.execute', 'task.complete', 'deploy', '*'])('does not grant %s authority', operation => {
    expect(() => assertServiceAction({ ...input, grant: { ...grant, operation }, action: { ...action, operation } }, now)).toThrow();
  });
  it('does not let architects act as reviewers even with a matching operation grant', () => {
    const candidate = { ...input, grant: { ...grant, operation: 'artifact.review' }, action: { ...action, operation: 'artifact.review' } };
    expect(() => assertServiceAction(candidate, now)).toThrow();
    expect(assertServiceAction({ ...candidate, identity: { ...identity, role: 'reviewer' } }, now).operation).toBe('artifact.review');
  });
  it('rejects wildcard scope, unsupported versions and model-supplied authority fields', () => {
    for (const change of [{ organizationId: '*' }, { protocolVersion: 2 }, { bearerToken: 'not-a-grant' }]) {
      expect(() => assertServiceAction({ ...input, grant: { ...grant, ...change } }, now)).toThrow();
    }
  });
});
