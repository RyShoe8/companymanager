import { describe, expect, it } from 'vitest';
import {
  plannerOutputSchema,
  reviewerOutputSchema,
  modelProfileCreateSchema,
} from '@/lib/ai/rolePipeline/schemas';

describe('role pipeline schemas', () => {
  it('accepts planner JSON', () => {
    const parsed = plannerOutputSchema.parse({
      summary: 'Ship onboarding copy',
      subtasks: [
        {
          id: 't1',
          title: 'Draft email',
          instructions: 'Write a short welcome email.',
          acceptanceChecks: ['Mentions product name', 'Under 120 words'],
        },
      ],
    });
    expect(parsed.subtasks).toHaveLength(1);
  });

  it('accepts reviewer decisions', () => {
    expect(reviewerOutputSchema.parse({ decision: 'pass', notes: 'Looks good.' }).decision).toBe('pass');
    expect(reviewerOutputSchema.parse({ decision: 'retry', notes: 'Too long.' }).decision).toBe('retry');
  });

  it('requires https endpoint for model profiles', () => {
    expect(() =>
      modelProfileCreateSchema.parse({
        label: 'Bad',
        tier: 'commercial',
        endpoint: 'http://api.openai.com/v1/chat/completions',
        model: 'gpt',
        apiKey: 'sk-test',
      })
    ).toThrow();
  });

  it('allows omitting key so the server can generate one', () => {
    const parsed = modelProfileCreateSchema.parse({
      label: 'OpenAI · GPT-4o mini',
      provider: 'openai',
      tier: 'commercial',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test',
    });
    expect(parsed.key).toBeUndefined();
    expect(parsed.provider).toBe('openai');
  });
});
