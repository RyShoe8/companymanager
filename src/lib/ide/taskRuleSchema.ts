import { z } from 'zod';
import { ideTaskRuleModes } from '@/lib/models/AiProjectTaskRule';

export const ideTaskRuleCreateSchema = z
  .object({
    mode: z.enum(ideTaskRuleModes).default('all'),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(8000),
    enabled: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(10000).default(0),
  })
  .strict();

export const ideTaskRulePatchSchema = z
  .object({
    mode: z.enum(ideTaskRuleModes).optional(),
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(8000).optional(),
    enabled: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.');
