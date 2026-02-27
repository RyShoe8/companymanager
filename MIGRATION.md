# Operations → Tasks Migration

This document describes the migration from the Operation model to project-embedded tasks and the rollback procedure.

## Operation schema audit

Before migration, verify the Operation model fields and map them to the task schema:

| Operation field | Task schema field | Notes |
|----------------|-------------------|-------|
| `name` | `name` | Direct |
| `description` | `description` | Direct |
| `url` | — | Not on task; project has `urls` |
| `recurrenceType` | — | Map to task recurrence/schedule if needed |
| `status` | `status` (TaskStatus) | `active` \| `completed` \| `in-review` |
| `assignedTo` | `assignedTo` | Legacy string |
| `assignedToEmployeeId` | `assignedToEmployeeId` | Direct |
| `estimatedHours` | `estimatedHours` | Direct |
| `startDate` | `startDate` | Direct |
| `endDate` | `endDate` | Direct |
| `projectId` | — | Used to find target project |
| `userId` | — | Not on task |

Operation fields: `name`, `description`, `url`, `recurrenceType`, `status`, `assignedTo`, `assignedToEmployeeId`, `estimatedHours`, `startDate`, `endDate`, `projectId`, `userId`.

## Pre-migration checklist

1. **Dry run** — Run the migration script with a dry-run flag; inspect diff against production-like data.
2. **Backup** — Take a DB snapshot before migration (e.g. `mongodump`).
3. **Resumable batches** — Process operations in batches (e.g. 100); track last processed `_id`; script can resume from checkpoint.
4. **Idempotency** — Migrated tasks include `migrationVersion` and `sourceOperationId`; skip operations already migrated.
5. **Transaction boundary** — Use MongoDB transactions where possible; batch updates atomically.
6. **Post-check report** — Script outputs: migrated count, failed count, orphan refs, duplicate detection.

## Rollback considerations

If the migration fails or causes issues:

1. **Take a DB snapshot before migration** — Use `mongodump` to create a backup.
2. **Keep the Operation collection until verification is complete** — Do not drop or truncate it until you have verified migrated data.
3. **Restore from snapshot** — Use `mongorestore` to restore from the pre-migration dump.
4. Redeploy the previous application version.
5. Verify the Operation collection is intact and project tasks reverted.
6. Document exact commands in your runbook for your environment.

Example (adjust paths and connection string):

```bash
# Backup before migration
mongodump --uri="mongodb://..." --out=/path/to/dump

# Restore if needed
mongorestore --uri="mongodb://..." --drop /path/to/dump
```

## Compatibility window

Keep `/operations` routes and API read-only with deprecation headers for at least one release. Remove after telemetry confirms low usage (e.g. &lt; 5% of traffic).
