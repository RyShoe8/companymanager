import 'server-only';
import { AiPlanningJob } from '@/lib/models/AiControl';

export const CLEARED_PLANNING_CONTEXT = '[context cleared]';
const terminal = { active: false, status: { $in: ['done', 'blocked', 'cancelled'] }, inputClearedAt: null };

/** Remove only redundant terminal-job context; keep original objectives, digests and audit records. */
export async function clearTerminalPlanningContexts() {
  const jobs = await AiPlanningJob.find(terminal).select('_id').limit(100).maxTimeMS(3000).lean();
  if (!jobs.length) return 0;
  // Recheck eligibility at write time; never clear context from queued or running work.
  const result = await AiPlanningJob.updateMany({ ...terminal, _id: { $in: jobs.map(job => job._id) } }, {
    $set: { input: CLEARED_PLANNING_CONTEXT, inputClearedAt: new Date() },
  }, { maxTimeMS: 3000 });
  return result.modifiedCount;
}
