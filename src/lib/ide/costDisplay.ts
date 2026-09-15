import { microsToDollars } from '@/lib/ai/settingsSchema';

export type IdeCostPayload = {
  costMicros: number | null;
  reservedMicros: number | null;
  noProviderFee: boolean;
};

/** Format a chat turn cost for IDE chrome — dollars only, never raw tokens. */
export function formatIdeCostUsd(input: IdeCostPayload): { label: string; amount: string } {
  if (input.noProviderFee) {
    return { label: 'no provider fee', amount: '$0.00' };
  }
  if (input.costMicros != null) {
    return { label: 'estimated', amount: `~$${microsToDollars(input.costMicros)}` };
  }
  if (input.reservedMicros != null && input.reservedMicros > 0) {
    return { label: 'budget hold', amount: `$${microsToDollars(input.reservedMicros)}` };
  }
  return { label: 'cost', amount: '—' };
}
