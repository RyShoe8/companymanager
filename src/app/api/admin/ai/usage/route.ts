import { requirePlatformAdmin } from '@/lib/auth/requirePlatformAdmin';
import { readPlatformSettings } from '@/lib/ai/control/settings';
import { aiError, aiResponse } from '@/lib/ai/control/http';
import { AiDispatchUsage } from '@/lib/models/AiControl';
import { DISPATCH_USAGE_ID, dispatchUsageView } from '@/lib/ai/control/dispatchLimits';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;
  try {
    const { value } = await readPlatformSettings();
    const usage = await AiDispatchUsage.findById(DISPATCH_USAGE_ID).select('day attempts lastStartedAt').lean();
    return aiResponse(dispatchUsageView(usage, value,
      value.planningEnabled && value.remoteEnabled && value.dispatchEnabled, new Date()));
  } catch (error) { return aiError(error); }
}
