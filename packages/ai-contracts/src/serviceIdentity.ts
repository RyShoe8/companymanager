import { z } from 'zod';
import { objectIdSchema, PROTOCOL_VERSION } from './index';

const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const organizationId = z.string().trim().min(1).max(100).refine(value => !value.includes('*'), 'Wildcard scope is not supported.');
export const serviceOperationSchema = z.enum(['planning.infer', 'artifact.review']);
export const serviceIdentitySchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION), identityId: objectIdSchema, organizationId,
  role: z.enum(['architect', 'reviewer']), status: z.enum(['active', 'disabled', 'revoked']),
  credentialVersion: revision,
}).strict();
export const serviceGrantSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION), grantId: objectIdSchema, identityId: objectIdSchema,
  organizationId, projectId: objectIdSchema, runId: objectIdSchema,
  operation: serviceOperationSchema, policyDigest: z.string().regex(/^[a-f0-9]{64}$/),
  revision, issuedAt: z.string().datetime(), expiresAt: z.string().datetime(), revoked: z.boolean(),
}).strict().refine(value => new Date(value.expiresAt) > new Date(value.issuedAt), 'Grant expiry must follow issuance.');
export const serviceActionSchema = z.object({
  organizationId, projectId: objectIdSchema, runId: objectIdSchema,
  operation: serviceOperationSchema, policyDigest: z.string().regex(/^[a-f0-9]{64}$/),
  grantRevision: revision,
}).strict();
export const authenticatedServicePrincipalSchema = z.object({
  kind: z.literal('service'), identityId: objectIdSchema, credentialVersion: revision,
}).strict();
