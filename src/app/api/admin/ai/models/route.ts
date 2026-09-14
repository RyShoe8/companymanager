import { NextRequest } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth/requirePlatformAdmin';
import { AiHttpError } from '@/lib/ai/control/access';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { encryptModelSecret, secretLast4 } from '@/lib/ai/modelSecrets';
import { modelProfileCreateSchema } from '@/lib/ai/rolePipeline/schemas';
import { mapModelProfilePublic } from '@/lib/ai/rolePipeline/profiles';
import { AiModelProfile } from '@/lib/models/AiRolePipeline';
import connectDB from '@/lib/db/mongodb';

export const dynamic = 'force-dynamic';
let indexes: Promise<unknown> | undefined;

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;
  try {
    await connectDB();
    const rows = await AiModelProfile.find()
      .select('key label tier protocol endpoint model secretLast4 enabled updatedAt createdAt')
      .sort({ tier: 1, label: 1 })
      .limit(100)
      .maxTimeMS(3000)
      .lean();
    return aiResponse({ profiles: rows.map(mapModelProfilePublic) });
  } catch (error) {
    return aiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) {
      throw new AiHttpError(403, 'Invalid request origin.');
    }
    await connectDB();
    indexes ??= AiModelProfile.createIndexes().catch((error) => {
      indexes = undefined;
      throw error;
    });
    await indexes;
    const input = modelProfileCreateSchema.parse(await readAiBody(request));
    const row = await AiModelProfile.create({
      key: input.key,
      label: input.label,
      tier: input.tier,
      protocol: input.protocol,
      endpoint: input.endpoint,
      model: input.model,
      secretCiphertext: encryptModelSecret(input.apiKey),
      secretLast4: secretLast4(input.apiKey),
      enabled: input.enabled,
      updatedByUserId: auth.user!._id,
    });
    return aiResponse({ profile: mapModelProfilePublic(row) }, 201);
  } catch (error) {
    return aiError(error);
  }
}
