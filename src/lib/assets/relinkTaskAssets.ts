import { Types } from 'mongoose';
import Asset from '@/lib/models/Asset';

type TaskWithId = {
  _id?: Types.ObjectId | string;
};

/**
 * When tasks gain stable _id values, relink assets that were stored with
 * linkedProjectTaskIndex only (legacy) to linkedProjectTaskId.
 */
export async function relinkTaskAssets(
  projectId: string,
  tasks: TaskWithId[]
): Promise<number> {
  if (!Types.ObjectId.isValid(projectId) || !Array.isArray(tasks)) return 0;

  const projectObjectId = new Types.ObjectId(projectId);
  let modified = 0;

  for (let index = 0; index < tasks.length; index++) {
    const task = tasks[index];
    const rawId = task._id;
    const taskIdStr =
      typeof rawId === 'string'
        ? rawId
        : rawId && typeof (rawId as { toString?: () => string }).toString === 'function'
          ? (rawId as { toString: () => string }).toString()
          : null;
    if (!taskIdStr || !Types.ObjectId.isValid(taskIdStr)) continue;

    const result = await Asset.updateMany(
      {
        linkedProjectId: projectObjectId,
        linkedProjectTaskIndex: index,
        $or: [{ linkedProjectTaskId: { $exists: false } }, { linkedProjectTaskId: null }],
      },
      {
        $set: { linkedProjectTaskId: new Types.ObjectId(taskIdStr) },
        $unset: { linkedProjectTaskIndex: '' },
      }
    );
    modified += result.modifiedCount ?? 0;
  }

  return modified;
}
