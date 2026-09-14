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
        key: 'bad',
        label: 'Bad',
        tier: 'commercial',
        endpoint: 'http://api.openai.com/v1/chat/completions',
        model: 'gpt',
        apiKey: 'sk-test',
      })
    ).toThrow();
  });
});
