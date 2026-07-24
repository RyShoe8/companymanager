import OpenAI from 'openai';

export type EstimateHoursKind = 'task' | 'content';

export interface EstimateHoursInput {
  kind: EstimateHoursKind;
  title: string;
  description?: string;
  channel?: string;
  projectName?: string;
}

const MIN_HOURS = 0.25;
const MAX_HOURS = 80;

function clampHours(value: number): number {
  if (!Number.isFinite(value)) return MIN_HOURS;
  return Math.min(MAX_HOURS, Math.max(MIN_HOURS, Math.round(value * 4) / 4));
}

export async function estimateHoursWithOpenAI(
  input: EstimateHoursInput,
  apiKey: string
): Promise<number | null> {
  const title = input.title.trim();
  if (!title) return null;

  const contextParts: string[] = [`Type: ${input.kind}`, `Title: ${title}`];
  if (input.description?.trim()) contextParts.push(`Description: ${input.description.trim()}`);
  if (input.channel?.trim()) contextParts.push(`Channel: ${input.channel.trim()}`);
  if (input.projectName?.trim()) contextParts.push(`Project: ${input.projectName.trim()}`);

  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Estimate effort in hours for a single work item. Return JSON: {"estimatedHours": number}. ' +
          'Use realistic values for knowledge work (often 0.5–8h). Clamp mentally to 0.25–80 hours.',
      },
      { role: 'user', content: contextParts.join('\n') },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const hours =
    parsed && typeof parsed === 'object' && 'estimatedHours' in parsed
      ? Number((parsed as { estimatedHours?: unknown }).estimatedHours)
      : NaN;

  if (!Number.isFinite(hours)) return null;
  return clampHours(hours);
}