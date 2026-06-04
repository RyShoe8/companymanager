import OpenAI from 'openai';

export type RecordingSummaryInput = {
  transcript: string;
  title: string;
  projectName?: string;
  projectDescription?: string;
  taskTitle?: string;
};

export type RecordingSummaryResult = {
  summary: string;
};

function stripJsonFence(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  return fence ? fence[1].trim() : t;
}

export async function summarizeRecording(
  input: RecordingSummaryInput,
  apiKey: string
): Promise<RecordingSummaryResult> {
  const openai = new OpenAI({ apiKey });

  const contextParts: string[] = [];
  if (input.projectName) contextParts.push(`Project: ${input.projectName}`);
  if (input.projectDescription) contextParts.push(`Project description: ${input.projectDescription}`);
  if (input.taskTitle) contextParts.push(`Related task: ${input.taskTitle}`);

  const userContent = [
    contextParts.length > 0 ? `Context:\n${contextParts.join('\n')}` : '',
    `Recording title: ${input.title}`,
    `Transcript:\n${input.transcript.slice(0, 12000)}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You summarize screen recordings for a productivity workspace. Return ONLY valid JSON with key "summary" — a concise executive summary (2-4 sentences) of what was discussed or demonstrated. Focus on operational memory: decisions, requirements, and next steps when present.',
      },
      { role: 'user', content: userContent },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(stripJsonFence(raw)) as { summary?: string };
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  if (!summary) {
    throw new Error('Failed to generate summary.');
  }
  return { summary };
}
