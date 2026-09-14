import { z } from 'zod';
import { isIdeChatMode, isIdeDirectMode } from '@/lib/ide/modes';
import { teamMessageRoleSchema } from '@/lib/ai/teamWorkspace';

/** Request body for IDE chat (worker modes + Direct). */
export const ideChatSchema = z
  .object({
    mode: z.string().refine(isIdeChatMode, 'Invalid IDE chat mode.'),
    text: z.string().trim().min(1).max(6000),
    history: z
      .array(
        z
          .object({
            role: teamMessageRoleSchema,
            text: z.string().max(6000),
          })
          .strict()
      )
      .max(20)
      .default([]),
    modelProfileId: z
      .string()
      .regex(/^[a-fA-F0-9]{24}$/)
      .optional(),
    model: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (isIdeDirectMode(value.mode)) {
      if (!value.modelProfileId) {
        ctx.addIssue({
          code: 'custom',
          message: 'Direct mode requires a company credential.',
          path: ['modelProfileId'],
        });
      }
      if (!value.model?.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Direct mode requires a model id.',
          path: ['model'],
        });
      }
    }
  });

export type IdeChatInput = z.infer<typeof ideChatSchema>;
