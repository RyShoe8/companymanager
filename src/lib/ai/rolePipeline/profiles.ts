import 'server-only';
import type { GatewayConfiguration } from '@nucleas/ai-core/gateway';
import { GatewayError, validateGatewayConfiguration } from '@nucleas/ai-core/gateway';
import { decryptModelSecret } from '@/lib/ai/modelSecrets';
import { AiModelProfile } from '@/lib/models/AiRolePipeline';
import { Types } from 'mongoose';

export function mapModelProfilePublic(row: {
  _id: { toString(): string };
  key: string;
  label: string;
  tier: string;
  protocol: string;
  endpoint: string;
  model: string;
  secretLast4: string;
  enabled: boolean;
  updatedAt?: Date;
  createdAt?: Date;
}) {
  return {
    id: String(row._id),
    key: row.key,
    label: row.label,
    tier: row.tier,
    protocol: row.protocol,
    endpoint: row.endpoint,
    model: row.model,
    secretConfigured: true,
    secretLast4: row.secretLast4,
    enabled: row.enabled,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? null,
  };
}

/** Resolve an enabled profile into a gateway config. Fail-closed if missing or undecryptable. */
export async function gatewayFromModelProfile(profileId: string): Promise<{
  gateway: GatewayConfiguration;
  profile: { id: string; label: string; tier: string; model: string };
}> {
  if (!Types.ObjectId.isValid(profileId)) throw new GatewayError('configuration');
  const row = await AiModelProfile.findById(profileId)
    .select('label tier protocol endpoint model secretCiphertext enabled')
    .maxTimeMS(3000)
    .lean();
  if (!row || !row.enabled) throw new GatewayError('configuration');
  let bearerToken: string;
  try {
    bearerToken = decryptModelSecret(row.secretCiphertext);
  } catch {
    throw new GatewayError('credentials');
  }
  if (!bearerToken.trim()) throw new GatewayError('credentials');
  const gateway: GatewayConfiguration = {
    endpoint: row.endpoint,
    model: row.model,
    protocol: 'openai-chat',
    bearerToken,
    timeoutMs: 60000,
  };
  validateGatewayConfiguration(gateway);
  return {
    gateway,
    profile: { id: String(row._id), label: row.label, tier: row.tier, model: row.model },
  };
}
