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
- A narrow existing seen/activity timestamp boundary fix with a controlled-clock regression test.

No local model, persistent local worker, remote shell, sandbox or autonomous execution was enabled. Planning submits only selected objective fields, not repository files.

## Remaining gates

The full roadmap is not complete. Phases 0–3 remain partial: live authenticated inference, deployed database acceptance, independent review, service identities, cloud-provider routing, objective/plan pagination and eight-hour soak testing remain open. Run/event pagination is implemented. Execution phases have not started; remote execution access is unknown. The inspector currently covers planning runs, not simulated coding execution or artifact acceptance.

Unauthenticated model discovery succeeded earlier. It does not verify authenticated generation, billing or execution access. The user reports adding `NUCLEAS_AI_REMOTE_BEARER_TOKEN` to Vercel; it has not been read or tested by this implementation.

## Verification

- 527 tests passed across 91 files, including 22 integration tests against a temporary local MongoDB replica set with mocked inference. These cover actual transactions, concurrency, settings persistence/auditing, scoped ceilings, budget rollback, cancellation, lease recovery, approval preserving human assignments, run/event pagination and private-field exclusion. Browser interaction and eight-hour memory/CPU behavior remain unverified.
- Production build and targeted ESLint passed.
- Baseline before implementation: 374 tests/76 files; 81 existing TypeScript test-fixture diagnostics; full ESLint 80 errors/230 warnings. Full-project checking is not clean.
- Dependency audit currently reports 46 vulnerabilities (3 low, 33 moderate, 10 high); no broad dependency remediation was attempted.
- Integration tests download/cache a MongoDB binary on first execution and remove the temporary database afterward. They do not call a model or production database.

Browser interaction, live authenticated inference, deployed database acceptance and soak tests have not run. No production environment flags or secrets were changed. The unrelated `eslint-err.log` remains untouched.

See [deployment instructions](AI_PLANNING_DEPLOYMENT.md) for the remaining configuration and release check.
