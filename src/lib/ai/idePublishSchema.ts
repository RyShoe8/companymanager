import { z } from 'zod';

const pathSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^(?!\/)(?!.*\.\.\/)[A-Za-z0-9._/-]+$/, 'Invalid repository path.');

export const idePublishFileSchema = z
  .object({
    path: pathSchema,
    content: z.string().max(500_000),
  })
  .strict();

export const ideCommitPushSchema = z
  .object({
    confirm: z.literal(true),
    message: z.string().trim().min(1).max(500),
    files: z.array(idePublishFileSchema).min(1).max(40),
  })
  .strict();

export type IdeCommitPushInput = z.infer<typeof ideCommitPushSchema>;

export { pathSchema as ideRepoPathSchema };
