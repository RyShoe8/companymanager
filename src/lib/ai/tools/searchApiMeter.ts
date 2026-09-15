import 'server-only';
import { AiSearchApiUsage } from '@/lib/models/AiControl';
import {
  estimateSearchApiMicros,
  type SearchApiProviderKind,
} from '@/lib/ai/pricing/searchApiRates';

export type SearchApiSpendSnapshot = {
  braveQueries: number;
  googleCseQueries: number;
  estimatedMicros: number;
  periodMonth: string;
};

/** Record one billed search API call (best-effort; never throws to callers). */
export async function recordSearchApiQuery(input: {
  organizationId: string;
  provider: SearchApiProviderKind;
}): Promise<void> {
  try {
    const org = input.organizationId.trim();
    if (!org) return;
    const asOf = new Date();
    const periodMonth = asOf.toISOString().slice(0, 7);
    const field =
      input.provider === 'brave'
        ? 'braveQueries'
        : input.provider === 'google_cse_image'
          ? 'googleCseImageQueries'
          : 'googleCseWebQueries';
    await AiSearchApiUsage.updateOne(
      { organizationId: org, periodMonth },
      { $inc: { [field]: 1 } },
      { upsert: true }
    );
  } catch {
    /* metering must not break chat */
  }
}

export async function loadSearchApiSpend(organizationId: string): Promise<SearchApiSpendSnapshot> {
  const asOf = new Date();
  const periodMonth = asOf.toISOString().slice(0, 7);
  const dayOfMonth = asOf.getUTCDate();
  const row = await AiSearchApiUsage.findOne({ organizationId, periodMonth })
    .select('braveQueries googleCseWebQueries googleCseImageQueries -_id')
    .maxTimeMS(3000)
    .lean();
  const braveQueries = Math.max(0, Math.floor(row?.braveQueries ?? 0));
  const googleCseQueries = Math.max(
    0,
    Math.floor((row?.googleCseWebQueries ?? 0) + (row?.googleCseImageQueries ?? 0))
  );
  return {
    braveQueries,
    googleCseQueries,
    estimatedMicros: estimateSearchApiMicros({ braveQueries, googleCseQueries, dayOfMonth }),
    periodMonth,
  };
}
