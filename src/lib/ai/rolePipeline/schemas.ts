import { z } from 'zod';

const httpsEndpoint = z.string().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(url.hostname) &&
      !/\.(localhost|local|internal)$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}, 'Use a public HTTPS hostname without credentials, query parameters or fragments.');

export const modelTierSchema = z.enum(['commercial', 'local_remote']);
export const modelProviderSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'groq',
  'deepseek',
  'together',
  'fireworks',
  'openrouter',
  'custom',
]);
export const modelProfileCreateSchema = z
  .object({
    /** Optional; server generates a unique slug when omitted. */
    key: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9_-]*$/, 'Use a lowercase key starting with a letter.')
      .optional(),
    label: z.string().trim().min(1).max(120),
    provider: modelProviderSchema.optional(),
    tier: modelTierSchema,
    protocol: z.literal('openai-chat').default('openai-chat'),
    endpoint: httpsEndpoint,
    model: z.string().trim().min(1).max(200),
    apiKey: z.string().trim().min(1).max(4096),
    enabled: z.boolean().default(true),
  })
  .strict();

export const modelProfilePatchSchema = z
  .object({
    label: z.string().trim().min(1).max(120).optional(),
    provider: modelProviderSchema.optional(),
    tier: modelTierSchema.optional(),
    endpoint: httpsEndpoint.optional(),
    model: z.string().trim().min(1).max(200).optional(),
    apiKey: z.string().trim().min(1).max(4096).optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.');


export const rolePipelineStageSchema = z
  .object({
    modelProfileId: z.string().regex(/^[a-fA-F0-9]{24}$/),
  })
  .strict();

export const rolePipelineUpsertSchema = z
  .object({
    employee: z.enum(['marketing', 'product', 'support', 'engineering', 'researcher']),
    planner: rolePipelineStageSchema,
    worker: rolePipelineStageSchema,
    reviewer: rolePipelineStageSchema,
    maxSubtasks: z.number().int().min(1).max(8).default(5),
    maxWorkerRetries: z.number().int().min(0).max(2).default(1),
    enabled: z.boolean().default(true),
  })
  .strict();

export const pipelineRunCreateSchema = z
  .object({
    employee: z.enum(['marketing', 'product', 'support', 'engineering', 'researcher']),
    brief: z.string().trim().min(1).max(6000),
  })
  .strict();

export const plannerOutputSchema = z
  .object({
    summary: z.string().trim().min(1).max(2000),
    subtasks: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(64),
            title: z.string().trim().min(1).max(200),
            instructions: z.string().trim().min(1).max(4000),
            acceptanceChecks: z.array(z.string().trim().min(1).max(500)).min(1).max(8),
          })
          .strict()
      )
      .min(1)
      .max(8),
  })
  .strict();

export const reviewerOutputSchema = z
  .object({
    decision: z.enum(['pass', 'retry', 'fail']),
    notes: z.string().trim().min(1).max(4000),
  })
  .strict();
