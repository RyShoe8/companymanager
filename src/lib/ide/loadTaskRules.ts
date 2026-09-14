import 'server-only';
import { Types } from 'mongoose';
import type { IdeChatMode } from '@/lib/ide/modes';
import { taskRuleModeQueryValues } from '@/lib/ide/modes';
import { AiProjectTaskRule } from '@/lib/models/AiProjectTaskRule';

const MAX_RULES = 24;
const MAX_CHARS = 12_000;

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
    const chunk = `Rule "${row.title}": ${row.body}`.slice(0, 2000);
    if (used + chunk.length > MAX_CHARS) break;
    texts.push(chunk);
    used += chunk.length;
  }
  return texts;
}
