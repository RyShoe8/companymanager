# Nucleas Product Pivot Plan

This document captures the product pivot plan and review feedback incorporations.

---

## 1. Task Linking Stability

**Solution:** Use `linkedProjectTaskId` (ObjectId) instead of `linkedProjectTaskIndex` for stable references.

- Asset and Comment models support `linkedProjectTaskId` / `taskId`.
- Project tasks have `_id` by default (Mongoose subdocuments).
- All usages updated to prefer taskId; legacy taskIndex supported for backward compatibility.
- See [Asset.ts](src/lib/models/Asset.ts), [Comment.ts](src/lib/models/Comment.ts), and [MIGRATION.md](MIGRATION.md).

---

## 2. Operation Model Field Mapping

Before migration, perform an Operation schema audit. See [MIGRATION.md](MIGRATION.md) for the full field mapping table:

- `recurrenceType` → task recurrence/schedule
- `status` → TaskStatus
- `assignedToEmployeeId` → assignedToEmployeeId
- etc.

---

## 3. Admin & Session

**Session refresh:** Verify whether NextAuth's `useSession` with `refetchOnWindowFocus` or a post-login callback already refreshes session data before adding custom refresh logic (e.g., `router.refresh()` or explicit refetch).

---

## 4. Permissions

**Consistent wording:** Use one definition everywhere. Task creation: **managers/admins and assigned project members** (not "any project member" or "any org member").

---

## 5. Referral Code Validation

**UX:** Invalid or unknown referral codes: silently ignore and proceed with registration, or show a non-blocking warning. No blocking validation.

---

## 6. About Page

The about page exists at [src/app/about/page.tsx](src/app/about/page.tsx). The route `/about` is valid.

---

## 7. Implementation Order

1. Branding
2. **2b. Interactive Demo (optional / phased)** — Template-driven "Generate Demo Workspace" flow. Can be deferred if bandwidth is limited; landing page can ship without it initially.
3. Smart Buttons
4. (… rest of order)

---

## 8. Coverage Matrix

- **Smart Button dedupe:** Available vs Active button lists implemented (no duplicates in Active, removed from Available).

---

## 9. Migration

- **Rollback:** Take a DB snapshot before migration. Keep the Operation collection until verification is complete. See [MIGRATION.md](MIGRATION.md) for `mongorestore` steps.
- **Comment migration:** Operation comments (`entityType='operation'`, `entityId=op._id`) become `entityType='projectTask'`, `entityId=projectId`, `taskId=task._id`. See migration script outline in [scripts/migrate-operations-to-tasks.outline.mjs](scripts/migrate-operations-to-tasks.outline.mjs).

---

## Summary of Priority Edits

| Priority | Change                               | Effort               |
| -------- | ------------------------------------ | -------------------- |
| High     | Task linking: linkedProjectTaskId     | Code + migration     |
| High     | Rollback plan for migration           | Doc only             |
| High     | Operation schema audit before migration | Doc + script outline |
| Medium   | Interactive Demo phased/optional       | Doc only             |
| Medium   | Comment migration pseudo-code          | Doc only             |
| Low      | Permission wording, referral UX, about path, coverage matrix, session note | Doc only             |
