import { NextRequest } from 'next/server';
import { requireAiProject } from '@/lib/ai/control/access';
import { aiError, aiResponse } from '@/lib/ai/control/http';
import { loadCredentialBalances } from '@/lib/ai/rolePipeline/creditBalances';
import connectDB from '@/lib/db/mongodb';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    await requireAiProject(request, (await context.params).id, false, true);
    await connectDB();
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';
    const payload = await loadCredentialBalances({ enabledOnly: true, forceRefresh });
    return aiResponse(payload);
  } catch (error) {
    return aiError(error);
  }
}
