import type { EstimateHoursKind } from '@/lib/ai/estimateHours';

export interface ClientEstimateHoursInput {
  kind: EstimateHoursKind;
  title: string;
  description?: string;
  channel?: string;
  projectName?: string;
}

export async function fetchEstimatedHours(input: ClientEstimateHoursInput): Promise<number | null> {
  const title = input.title.trim();
  if (!title) return null;

  try {
    const res = await fetch('/api/ai/estimate-hours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: input.kind,
        title,
        description: input.description?.trim() || undefined,
        channel: input.channel?.trim() || undefined,
        projectName: input.projectName?.trim() || undefined,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { estimatedHours?: number | null };
    const hours = data.estimatedHours;
    return typeof hours === 'number' && Number.isFinite(hours) ? hours : null;
  } catch {
    return null;
  }
}

export async function fetchEstimatedHoursBatch(
  items: ClientEstimateHoursInput[]
): Promise<(number | null)[]> {
  return Promise.all(items.map((item) => fetchEstimatedHours(item)));
}
