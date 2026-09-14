import { describe, expect, it } from 'vitest';
import {
  plannerOutputSchema,
  reviewerOutputSchema,
  modelProfileCreateSchema,
  rolePipelineUpsertSchema,
} from '@/lib/ai/rolePipeline/schemas';
import { isModelAllowedForProvider } from '@/lib/ai/rolePipeline/providerCatalog';

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

  it('requires endpoint for custom company credentials', () => {
    expect(() =>
      modelProfileCreateSchema.parse({
        label: 'Custom host',
        provider: 'custom',
        tier: 'local_remote',
        apiKey: 'secret',
      })
    ).toThrow();
  });

  it('allows company credentials without a fixed model', () => {
    const parsed = modelProfileCreateSchema.parse({
      label: 'OpenAI',
      provider: 'openai',
      tier: 'commercial',
      apiKey: 'sk-test',
    });
    expect(parsed.provider).toBe('openai');
    expect(parsed.model).toBeUndefined();
  });

  it('requires a model id on each pipeline stage', () => {
    const parsed = rolePipelineUpsertSchema.parse({
      employee: 'product',
      planner: { modelProfileId: '507f1f77bcf86cd799439011', model: 'gpt-5.6-sol' },
      worker: { modelProfileId: '507f1f77bcf86cd799439012', model: 'gpt-5.6-luna' },
      reviewer: { modelProfileId: '507f1f77bcf86cd799439011', model: 'gpt-5.6-terra' },
    });
    expect(parsed.planner.model).toBe('gpt-5.6-sol');
    expect(parsed.reviewer.model).toBe('gpt-5.6-terra');
  });
});

describe('isModelAllowedForProvider', () => {
  it('allows catalog models for a company and freeform for custom', () => {
    expect(isModelAllowedForProvider('openai', 'gpt-5.6-sol')).toBe(true);
    expect(isModelAllowedForProvider('openai', 'not-a-real-model')).toBe(false);
    expect(isModelAllowedForProvider('custom', 'Qwen/local-model')).toBe(true);
  });
});
