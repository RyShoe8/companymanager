import { NextRequest } from 'next/server';
import { requireAiProject } from '@/lib/ai/control/access';
import { libraryKindSchema, getLibraryObjective, getLibraryPlan } from '@/lib/ai/control/libraryQueries';
import { isAiPlanningEnabled } from '@/lib/ai/control/config';
import { aiError, aiResponse } from '@/lib/ai/control/http';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ id: string; kind: string; itemId: string }> }) {
  try {
    const { id, kind: rawKind, itemId } = await context.params;
    const access = await requireAiProject(request, id, false, true);
    const kind = libraryKindSchema.parse(rawKind);
    const item = kind === 'objectives' ? { kind, objective: await getLibraryObjective(access, itemId) }
      : { kind, plan: await getLibraryPlan(access, itemId) };
    return aiResponse({ ...item, canManage: access.canManage, planningEnabled: await isAiPlanningEnabled() });
  } catch (error) { return aiError(error); }
}
