import { authenticatedServicePrincipalSchema, serviceActionSchema, serviceGrantSchema, serviceIdentitySchema } from '../../ai-contracts/src/serviceIdentity';

/** Authorization policy only, not credential verification or grant issuance. Load current records
 * server-side and obtain principal from a trusted authenticator, never from request/model JSON. */
export function assertServiceAction(input: { principal: unknown; identity: unknown; grant: unknown; action: unknown }, now = new Date()) {
  const principal = authenticatedServicePrincipalSchema.parse(input.principal);
  const identity = serviceIdentitySchema.parse(input.identity);
  const grant = serviceGrantSchema.parse(input.grant);
  const action = serviceActionSchema.parse(input.action);
  const sameId = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
  const roleOperation = identity.role === 'architect' ? 'planning.infer' : 'artifact.review';
  if (!Number.isFinite(now.getTime()) || identity.status !== 'active' || grant.revoked ||
    !sameId(principal.identityId, identity.identityId) || !sameId(grant.identityId, identity.identityId) ||
    principal.credentialVersion !== identity.credentialVersion || identity.organizationId !== grant.organizationId ||
    grant.organizationId !== action.organizationId || !sameId(grant.projectId, action.projectId) || !sameId(grant.runId, action.runId) ||
    grant.operation !== action.operation || roleOperation !== action.operation || grant.policyDigest !== action.policyDigest ||
    grant.revision !== action.grantRevision || new Date(grant.issuedAt) > now || new Date(grant.expiresAt) <= now) {
    throw new Error('Service action is not authorized by the current identity and scoped grant.');
  }
  return { identityId: identity.identityId, grantId: grant.grantId, grantRevision: grant.revision,
    organizationId: grant.organizationId, projectId: grant.projectId, runId: grant.runId, operation: grant.operation };
}
