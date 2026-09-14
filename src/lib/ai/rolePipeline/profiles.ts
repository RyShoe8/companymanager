import 'server-only';
import type { GatewayConfiguration } from '@nucleas/ai-core/gateway';
import { GatewayError, validateGatewayConfiguration } from '@nucleas/ai-core/gateway';
import { decryptModelSecret } from '@/lib/ai/modelSecrets';
import { isModelAllowedForProvider } from '@/lib/ai/rolePipeline/providerCatalog';
import { AiModelProfile } from '@/lib/models/AiRolePipeline';
import { Types } from 'mongoose';

export function mapModelProfilePublic(row: {
  _id: { toString(): string };
  key: string;
  label: string;
  provider?: string;
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
    provider: row.provider ?? 'custom',
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

/** Resolve an enabled company credential into a gateway config for a chosen model. */
export async function gatewayFromModelProfile(
  profileId: string,
  modelOverride?: string
): Promise<{
  gateway: GatewayConfiguration;
  profile: { id: string; label: string; tier: string; model: string; provider: string };
}> {
  if (!Types.ObjectId.isValid(profileId)) throw new GatewayError('configuration');
  const row = await AiModelProfile.findById(profileId)
    .select('label provider tier protocol endpoint model secretCiphertext enabled')
    .maxTimeMS(3000)
    .lean();
  if (!row || !row.enabled) throw new GatewayError('configuration');
  const model = (modelOverride?.trim() || row.model || '').trim();
  if (!model) throw new GatewayError('configuration');
  const provider = row.provider ?? 'custom';
  if (!isModelAllowedForProvider(provider, model)) throw new GatewayError('configuration');

  let bearerToken: string;
  try {
    bearerToken = decryptModelSecret(row.secretCiphertext);
  } catch {
    throw new GatewayError('credentials');
  }
  if (!bearerToken.trim()) throw new GatewayError('credentials');
  const gateway: GatewayConfiguration = {
    endpoint: row.endpoint,
    model,
    protocol: 'openai-chat',
    bearerToken,
    timeoutMs: 60000,
  };
  validateGatewayConfiguration(gateway);
  return {
    gateway,
    profile: {
      id: String(row._id),
      label: row.label,
      tier: row.tier,
      model,
      provider,
    },
  };
}
