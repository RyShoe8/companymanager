import { NextRequest } from 'next/server';
import { requireAttentionAccess } from '@/lib/ai/control/attention';
import { aiError, aiResponse } from '@/lib/ai/control/http';
import { freeChatLedgerProjectId } from '@/lib/ide/freeChat';
import { loadIdeSpendBundle } from '@/lib/ide/ideSpend';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const access = await requireAttentionAccess(request);
    const freeChatProjectId = freeChatLedgerProjectId(access.organizationId).toString();
    const spend = await loadIdeSpendBundle({
      organizationId: access.organizationId,
      projectId: freeChatProjectId,
    });
    return aiResponse({
      freeChat: true,
      dailyEstimatedMicros: spend.project?.dailyEstimatedMicros ?? 0,
      monthlyEstimatedMicros: spend.project?.monthlyEstimatedMicros ?? 0,
      orgDailyEstimatedMicros: spend.organization.dailyEstimatedMicros,
      orgMonthlyEstimatedMicros: spend.organization.monthlyEstimatedMicros,
      searchApiEstimatedMicros: spend.searchApi.estimatedMicros,
      searchApiBraveQueries: spend.searchApi.braveQueries,
      searchApiGoogleCseQueries: spend.searchApi.googleCseQueries,
      periodMonth: spend.periodMonth,
      asOf: spend.asOf,
    });
  } catch (error) {
    return aiError(error);
  }
}
