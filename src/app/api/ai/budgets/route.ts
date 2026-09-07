import { NextRequest } from 'next/server';
import { z } from 'zod';
import { aiBudgetSettingsSchema } from '@/lib/ai/settingsSchema';
import { requireBudgetAccess, budgetSettingsView, saveBudgetSettings } from '@/lib/ai/control/budgetSettings';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { AiHttpError } from '@/lib/ai/control/access';

export const dynamic = 'force-dynamic';
const inputSchema = z.object({ revision: z.number().int().nonnegative(), value: aiBudgetSettingsSchema.extend({ paused: z.boolean() }) }).strict();
export async function GET(request: NextRequest) {
  try {
    const access = await requireBudgetAccess(request);
    return aiResponse(await budgetSettingsView(access.organizationId, access.projectId));
  } catch (error) { return aiError(error); }
}
export async function PUT(request: NextRequest) {
  try {
    const access = await requireBudgetAccess(request);
    const parsed = inputSchema.safeParse(await readAiBody(request));
    if (!parsed.success) throw new AiHttpError(400, 'Provide a valid budget and explicit pause state. Reload this page if it was open before an update.');
    const input = parsed.data;
    await saveBudgetSettings(access, input.revision, input.value);
    return aiResponse(await budgetSettingsView(access.organizationId, access.projectId));
  } catch (error) { return aiError(error); }
}
