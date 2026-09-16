import 'server-only';
import { Types } from 'mongoose';
import type { IdeChatMode } from '@/lib/ide/modes';
import { taskRuleModeQueryValues } from '@/lib/ide/modes';
import { AiProjectTaskRule } from '@/lib/models/AiProjectTaskRule';

const MAX_RULES = 24;
const MAX_CHARS = 16_000;

/** Load enabled project task rules for `all` + active IDE mode, bounded for system prompt size. */
export async function loadIdeTaskRuleTexts(
  organizationId: string,
  projectId: Types.ObjectId,
  mode: IdeChatMode
): Promise<string[]> {
  const rows = await AiProjectTaskRule.find({
    organizationId,
    projectId,
    enabled: true,
    mode: { $in: taskRuleModeQueryValues(mode) },
  })
    .select('title body sortOrder')
    .sort({ sortOrder: 1, _id: 1 })
    .limit(MAX_RULES)
    .maxTimeMS(3000)
    .lean();

  const texts: string[] = [];
  let used = 0;
  for (const row of rows) {
    const full = `Rule "${row.title}": ${row.body}`;
    if (used + full.length <= MAX_CHARS) {
      texts.push(full);
      used += full.length;
    } else {
      const remaining = MAX_CHARS - used;
      if (remaining >= 200) {
        texts.push(full.slice(0, remaining));
        used += remaining;
      }
      break;
    }
  }
  return texts;
}
