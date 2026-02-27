/**
 * Migration outline: Operations → Project Tasks
 * Run with Node against your MongoDB. Complete the TODOs (connect, batch, transaction) before production use.
 *
 * Prerequisites:
 * - Operation schema audit done (field mapping in plan).
 * - DB snapshot taken.
 * - Dry run validated.
 *
 * Idempotency: Add migrationVersion + sourceOperationId on migrated tasks; skip ops already migrated.
 */

// const mongoose = require('mongoose');
// const Operation = require('../src/lib/models/Operation').default;
// const Project = require('../src/lib/models/Project').default;
// const Comment = require('../src/lib/models/Comment').default;
// const Asset = require('../lib/models/Asset').default;

const MIGRATION_VERSION = 1;
const BATCH_SIZE = 100;

async function migrateOperationsToTasks(dryRun = true) {
  // 1. Find all operations (in batches, track last _id for resumability)
  // 2. For each operation: get project by op.projectId
  // 3. Build task subdoc: name, description, startDate, endDate, estimatedHours, assignedTo, assignedToEmployeeId, status, sourceOperationId: op._id, migrationVersion: MIGRATION_VERSION
  // 4. If project.tasks already has a task with sourceOperationId === op._id, skip (idempotent)
  // 5. project.tasks.push(task); capture task._id (Mongoose sets it)
  // 6. Comment migration: entityType=operation -> entityType=projectTask
  //    await Comment.updateMany(
  //      { entityType: 'operation', entityId: op._id },
  //      { $set: { entityType: 'projectTask', entityId: op.projectId, taskId: task._id }, $unset: { taskIndex: 1 } }
  //    );
  // 7. Update assets: Asset.updateMany({ linkedOperationId: op._id }, { $set: { linkedProjectId: op.projectId, linkedProjectTaskId: task._id }, $unset: { linkedOperationId: 1 } });
  // 8. await project.save() (or use transaction)
  // 9. Post-check: report migrated count, failed count, orphan refs
}

// migrateOperationsToTasks(process.argv.includes('--dry-run'));
