# Voice: mobile button, mobile spam, recognition, and logo upload fix

## 1. Mobile: voice button covers Team button in bottom nav

**Cause:** In [VoiceOverlay.tsx](src/components/voice/VoiceOverlay.tsx), the voice button uses `fixed bottom-6 right-6` (24px from bottom). The [MobileBottomNav](src/components/ui/MobileBottomNav.tsx) is `fixed bottom-0`, height `h-16` (64px), with three items (Workspace, Assets, Team). The mic sits in the bottom-right and overlaps the Team (rightmost) item.

**Fix:** Use responsive positioning so the button sits above the nav on small screens only.

- In [VoiceOverlay.tsx](src/components/voice/VoiceOverlay.tsx), change the button's position classes from `bottom-6` to `bottom-20 md:bottom-6` (or `bottom-[4.5rem]` to clear 64px nav + small gap). That way:
  - Mobile (default): button is at 80px from bottom, above the 64px nav.
  - `md` and up: keep `bottom-6` so desktop layout is unchanged.

---

## 2. Mobile: voice keeps spamming same text and never processes

**Cause:** With `continuous: true` and `interimResults: true`, mobile browsers often emit the same final segment multiple times. The current logic appends and resets the end-of-utterance timer on every final result, so duplicate finals keep resetting the timer and `flushAndProcess` never runs.

**Fix:** Deduplicate final segments in [VoiceProvider.tsx](src/components/voice/VoiceProvider.tsx): keep a ref for the last final segment; if the new final segment is identical, skip appending and skip resetting the timer; clear the ref when starting listening and in `flushAndProcess`.

---

## 3. Better recognition for "mark the project [Name] as complete"

**Parser:** In [IntentParser.ts](src/lib/voice/IntentParser.ts), add a COMPLETE_TASK pattern (first in the list): `/(?:mark|set)\s+(?:the\s+)?project\s+(.+?)\s+as\s+(?:complete|done|finished)/i` with `extractSlots` returning `{ name: 'project', context: m[1].trim() }`.

**Handler:** In [WorkspaceShell.tsx](src/components/workspace/WorkspaceShell.tsx), when `searchName` is empty or `'project'` and `searchContext` is set, find project by context and complete its first incomplete task; return appropriate success/error messages.

---

## 4. Project logo upload 500: projectType validation

**Cause:** `POST /api/projects/[id]/logo` loads a project, sets `project.logo`, and calls `project.save()`. Some projects in the DB have `projectType: 'generic'` (valid for **category**, not for **projectType**). The [Project](src/lib/models/Project.ts) schema allows only `projectType: ['internal', 'client']`. Mongoose validation on save fails: `projectType: generic is not a valid enum value`.

**Fix:** Run the existing migration before save so swapped or invalid values are corrected.

- In [src/app/api/projects/[id]/logo/route.ts](src/app/api/projects/[id]/logo/route.ts): Import `migrateProjectFields` from `@/lib/utils/apiHelpers`. In both the POST and DELETE handlers, immediately before `await project.save()`, call `migrateProjectFields(project)`. That helper (in [apiHelpers.ts](src/lib/utils/apiHelpers.ts)) already corrects documents where `projectType` is one of `['website', 'store', 'app', 'generic']` by swapping with `category` and defaulting projectType to `'internal'|'client'`, so the document validates and the logo save succeeds.

No schema change; this only ensures every save path normalizes projectType/category.

---

## Order of work

1. Voice button position (quick, visual).
2. Mobile deduplication in VoiceProvider (stops spam and allows processing).
3. IntentParser "mark project X as complete" pattern.
4. WorkspaceShell handler for project-as-context completion.
5. Logo route: call `migrateProjectFields(project)` before `project.save()` in POST and DELETE.
