import { z } from 'zod';
import { requirePlatformAdmin } from '@/lib/auth/requirePlatformAdmin';
import { platformAiSettingsSchema } from '@/lib/ai/settingsSchema';
import { platformSettingsId, readPlatformSettings, saveSettings } from '@/lib/ai/control/settings';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { AiHttpError } from '@/lib/ai/control/access';

export const dynamic = 'force-dynamic';
const inputSchema = z.object({ revision: z.number().int().nonnegative(), value: platformAiSettingsSchema,
  confirmEndpoint: z.boolean().optional() }).strict();

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;
  try {
    return aiResponse({ settings: await readPlatformSettings(), secrets: {
      bearerTokenConfigured: !!process.env.NUCLEAS_AI_REMOTE_BEARER_TOKEN?.trim(), cronSecretConfigured: !!process.env.CRON_SECRET?.trim(),
    } });
  } catch (error) { return aiError(error); }
}
export async function PUT(request: Request) {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new AiHttpError(403, 'Invalid request origin.');
    const parsed = inputSchema.safeParse(await readAiBody(request));
    if (!parsed.success) throw new AiHttpError(400, parsed.error.issues.map(issue => `${issue.path.join('.') || 'Settings'}: ${issue.message}`).join(' '));
    const input = parsed.data;
    const previous = await readPlatformSettings();
    if (input.value.endpoint !== previous.value.endpoint && !input.confirmEndpoint) throw new AiHttpError(400, 'Confirm that the new endpoint is authorized to receive the server bearer token and objective data.');
    if (input.value.dispatchEnabled && (!process.env.NUCLEAS_AI_REMOTE_BEARER_TOKEN?.trim() || !process.env.CRON_SECRET?.trim())) {
      throw new AiHttpError(400, 'Configure the bearer token and cron secret in Vercel before enabling processing.');
    }
    const settings = await saveSettings(platformSettingsId, input.revision, input.value, String(auth.user._id));
    if (!settings) throw new AiHttpError(409, 'Settings changed. Reload before saving again.');
    return aiResponse({ settings });
  } catch (error) { return aiError(error); }
}
