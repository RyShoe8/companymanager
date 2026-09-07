# AI control-system implementation status

September 5, 2026. The original roadmap is unchanged.

## Delivered

- Versioned objective, draft, dependency, inference and run contracts.
- Planning page available to all organizations when globally enabled at `/workspace/projects/<project-id>/ai`, with manager/admin mutations and immutable drafts.
- Queued remote planning through Vercel cron: at most one inference request per invocation, global leases, idempotent submissions, transactional budget reservations and run events.
- Server-only bearer authentication, HTTPS-only gateway, bounded inputs/responses, deadlines and sanitized errors; no automatic inference retries.
- Authorization, objective digest, project snapshot and configuration rechecks. Expired attempts are blocked without replay; late responses are fenced.
- Cancellation, run summaries and token usage. Unknown charges retain reservations. In-flight cancellation suppresses drafts but cannot guarantee provider-side cancellation.
- Explicit approval transactionally appends up to 20 unassigned tasks, with digest/expiry/version checks and replay protection. Human assignments and task metadata are preserved.
- Additive index creation before queue writes. Narrow polling only while runs are pending and the page is visible/active.
- Database-backed Admin → AI Settings for connection, processing and per-request/monthly ceilings; only bearer/cron secrets remain in the environment. Manual planning defaults on for all organizations, while inference defaults off with zero budgets.
- Organization and project budget pages, parent-ceiling enforcement, exact USD input conversion, optimistic save revisions and transactional settings audit records. Queue admission fences settings edits; read-only settings loads do not update existing documents. Settings pages have no polling.
- Project AI run history (25 records/page) and an on-demand run inspector: usage, separate organization/project reservation records, plan approval evidence, input/policy digests and ordered events (50/page). History and manager-authorized cancellation remain available when planning is disabled; organization/project access checks still apply. Prompt text, credentials, worker lease tokens and organization-wide usage are not returned. Views replace pages rather than accumulating an unbounded cache and perform no periodic polling.
- Objective/plan history with 25 lightweight summaries per page, collection/project-bound cursors, on-demand full details, exact-version review and approval through the existing transaction. Older objectives can be explicitly selected for new planning without enlarging the recent-history cache beyond one selected item. Expired/stale drafts remain viewable but cannot bypass approval checks. Run evidence links directly to its original plan version.
- An on-demand **AI needs attention** workspace view for review-ready and blocked/failed runs, linked from the user menu. It reuses project contribution rules, returns at most 25 visible items, and scans at most 150 candidate runs per request. Continuation cursors are encrypted and bound to the user, organization, filter and expiry. Personal acknowledgments hide only that run revision, never change execution/approval state, and do not affect another user's list. Subsequent revisions reappear. The view has no polling; separate server-side email integration is described below.
- A narrow existing seen/activity timestamp boundary fix with a controlled-clock regression test.

Shared inference load limits are administrator-editable: 48 attempts per UTC day, 300 seconds between attempts and 2048 output tokens by default. Persisted global usage commits atomically with the dispatch marker, counts failed/ambiguous attempts, survives settings edits and preserves cooldown across midnight. Throttled jobs remain queued and cancellable. These bounds do not establish the remote host's actual capacity.

Admin AI Settings now includes a manually refreshed shared-usage snapshot: UTC day, recorded attempts, allowance remaining, last attempt and earliest eligibility under request limits. It uses an administrator-only no-store endpoint with a single indexed record lookup, no periodic polling, and no provider health/resource claims. This is a current allowance view, not historical metering or a provider invoice.

The same page includes read-only planning diagnostics: queue/running/expired-lease counts capped at 100+, oldest queued timestamp and unexpired dispatcher lease timestamp. Queries use minimal field projections, bounded results and three-second database query deadlines. No prompt text, identifiers or lease credentials are returned. Counts are observational, not a consistent transactional snapshot or confirmation of provider activity. Recovery remains owned by the existing scheduled worker.

Terminal-job context retention now covers queued cancellation as well as worker completion. The authenticated scheduled worker also clears at most 100 older inactive terminal jobs per invocation, including when inference is paused. An indexed cleanup marker makes maintenance resumable; write-time eligibility checks preserve queued/running context. Original objectives, plans, digests, jobs, events and budgets remain. Broader record/blob retention policy is still open.

No local model, persistent local worker, remote shell, sandbox or autonomous execution was enabled. Planning submits only selected objective fields, not repository files.

Organization/project manager pause controls now share the audited budget settings. Parent pauses override project controls; policy checks block new submissions and dispatch and reject returned drafts after a pause. Resuming does not reauthorize old queued policy revisions. This does not stop provider-side computation or remove previously created plans; manual planning, history and cancellation remain available.

Manager budget pages show current-month scoped settled spend, held reservations and remaining allowance under current saved ceilings. The indexed, projected ledger read is bounded to one record and does not create/reset a ledger. Missing activity is explicit. Historical usage browsing and provider invoice reconciliation remain open.

Planning completion now transactionally queues a generic review-ready or blocked update for the requesting manager when their workspace digest preference is enabled. The existing digest sender rechecks AI run revision/status, organization membership, manager role, project ownership and preference before delivery. Stale/revoked AI events are marked suppressed, not sent. No objective/project names, prompts or provider details are included in AI email rows. Delivery batches are limited to 100 events per recipient per invocation. Per-recipient six-minute leases fence overlapping scheduled senders and recheck opt-out before sending; ambiguous failures retain the lease until expiry. This reuses the existing email transport; retry after ambiguous email completion can still duplicate a digest and is not claimed exactly-once.

## Remaining gates

The full roadmap is not complete. Phases 0–3 remain partial: live authenticated inference, deployed database acceptance, independent review, service identities, cloud-provider routing and eight-hour soak testing remain open. Objective/plan and run/event pagination are implemented. Attention, basic requester digests and copied-context retention are partial operations additions, not completion of Phase 5; live email verification, broader retention and operations remain open. Execution phases have not started; remote execution access is unknown. The inspector currently covers planning runs, not simulated coding execution or artifact acceptance.

Unauthenticated model discovery succeeded earlier. It does not verify authenticated generation, billing or execution access. The user reports adding `NUCLEAS_AI_REMOTE_BEARER_TOKEN` to Vercel; it has not been read or tested by this implementation.

## Verification

- 613 tests passed across 101 files, including 54 integration tests against a temporary local MongoDB replica set with mocked inference and email. These cover actual transactions, concurrency, settings persistence/auditing, scoped ceilings and usage, organization/project pauses, budget rollback, cancellation, lease recovery, approval preserving human assignments, history pagination, attention visibility/revocation, private acknowledgments, bounded scans, private-field exclusion, shared inference throttling/rollback, administrator usage snapshots, bounded diagnostics, terminal context retention, notification delivery/revocation and overlapping digest workers. Browser interaction and eight-hour memory/CPU behavior remain unverified.
- Production build passed. Targeted ESLint has no errors; the existing workspace notification module reports three unused-code warnings.
- Baseline before implementation: 374 tests/76 files; 81 existing TypeScript test-fixture diagnostics; full ESLint 80 errors/230 warnings. Full-project checking is not clean.
- Dependency audit currently reports 46 vulnerabilities (3 low, 33 moderate, 10 high); no broad dependency remediation was attempted.
- Integration tests download/cache a MongoDB binary on first execution and remove the temporary database afterward. They do not call a model or production database.

Browser interaction, live authenticated inference, deployed database acceptance and soak tests have not run. No production environment flags or secrets were changed. The unrelated `eslint-err.log` remains untouched.

See [deployment instructions](AI_PLANNING_DEPLOYMENT.md) for the remaining configuration and release check.
