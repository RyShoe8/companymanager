import { requirePlatformAdmin } from '@/lib/auth/requirePlatformAdmin';
import { planningDiagnostics } from '@/lib/ai/control/diagnostics';
import { aiError, aiResponse } from '@/lib/ai/control/http';

export const dynamic = 'force-dynamic';
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;
  try { return aiResponse(await planningDiagnostics()); }
  catch (error) { return aiError(error); }
}
