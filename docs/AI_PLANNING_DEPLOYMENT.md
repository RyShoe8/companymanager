# Remote planning deployment

## Secrets stay in Vercel

Keep only `NUCLEAS_AI_REMOTE_BEARER_TOKEN` and the existing `CRON_SECRET` as AI-related server environment secrets for inference and cron. For future GitHub publish (not required to run planning), also set `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` on the server—never `NEXT_PUBLIC_` or browser-held tokens. See [`AI_GITHUB_PUBLISH_CONTRACT.md`](./AI_GITHUB_PUBLISH_CONTRACT.md). The cron secret is shared with other scheduled routes: do not replace it with the model token. Never expose either through `NEXT_PUBLIC_` or source control.

The old AI enablement, endpoint, protocol, model, fee and budget environment variables are no longer read. They may be removed after this code is deployed. There is no organization allowlist.

## Configure in Nucleas after deploying the source

1. Open **Admin → AI Settings** (`/admin/ai`) as a platform administrator.
2. Confirm the endpoint and model. Defaults are `https://llm.rogly.net/v1/chat/completions` and `Qwen/Qwen2.5-Coder-14B-Instruct-AWQ`, using OpenAI-compatible chat. Authenticated generation is still unverified.
3. Confirm that the page reports both secrets configured. It displays presence only, never values.
4. Enter a per-request reservation and monthly per-organization/project ceilings in USD. Zero blocks new requests. The project ceiling cannot exceed the organization ceiling, and the reservation must fit both.
5. Enable the remote connection and queued processing. Manual planning is enabled for all organizations by default; inference/processing default off and budgets default zero. No arbitrary spend policy is enabled on deployment.
6. Only select “no provider inference fee” after confirmation from the endpoint owner. Otherwise unknown charges retain their reservations. These internal limits are not provider invoice guarantees; priced settlement/reconciliation is not implemented.

Changing the endpoint requires explicit confirmation that it may receive the existing bearer token and selected objective data. Only trusted platform admins can make this change. HTTPS hostname validation is not a DNS-rebinding defense; platform admins control the shared destination.

Settings are persisted in MongoDB with revision checks and an audit record. Changes apply on subsequent server checks without redeploying. Previously queued work with an older policy is blocked rather than silently rerouted. Token rotation still requires the usual Vercel environment deployment.

## Organization and project budgets

Organization managers/administrators can open **Organization → AI budget settings** (`/workspace/ai-settings`) and choose a lower organization budget or inherit the platform ceiling.

The project AI planning page links to its budget settings (`/workspace/ai-settings?projectId=<id>`). Project limits inherit or lower the effective organization/platform ceilings. Server authorization derives organization scope from membership, never caller-supplied organization IDs.

Lowering a parent ceiling clamps existing child limits. Zero blocks admission. Limits use UTC calendar months. Existing spent/reserved amounts remain counted; editing a setting does not reset them. Admission transactions contend with settings edits to avoid restoring stale ceilings.

## Runtime and verification

The project planning page links to **All objectives and plans** (`/workspace/projects/<id>/ai/library`). Browse 25 summaries at a time and open an item for full details. An older objective can be selected for a new plan; an older draft is still subject to its original digest, expiry and project snapshot. Expired/stale plans require a fresh draft, not a bypass. The run inspector links directly to its source plan version. These history views load only on navigation or explicit refresh and remain read-only when planning is disabled.

The existing Vercel cron invokes `/api/cron/ai-planning` every five minutes; confirm your deployment supports that interval and the configured 300-second function. Each invocation processes at most one model call, with a six-minute lease and two-minute gateway deadline. This is bounded pilot throughput, not a scalable execution service.

Use a synthetic objective first, without client/repository/secret data. Confirm it queues, becomes a reviewable draft, and creates no tasks until a manager explicitly approves. Verify replay, cancellation and stale-project rejection before sending real context.

Models run on the remote endpoint; the dispatcher runs on Vercel. No local model, persistent local worker or shell execution is enabled. No authenticated model request or live deployment verification has been performed by this implementation.

## Pause and rollback

Open **AI needs attention** from the user dropdown or `/workspace/ai-attention` to inspect review-ready, blocked and failed runs across projects you can currently access. The view has no polling or email delivery. Filters and one-hour encrypted pagination cursors use existing session-secret infrastructure; no additional secret is required. Access is rechecked on each request. A page may contain no visible items but offer continuation because the bounded scan passed inaccessible or acknowledged records.

**Acknowledge for me** hides the current run revision only for the signed-in user. It neither approves nor resolves the run, and the complete record remains in project history. Changed run revisions become visible again. The page remains accessible while new planning is disabled. Approval and cancellation still happen through the existing scoped review/run screens.

Run history is available from the project planning page or `/workspace/projects/<id>/ai/runs`; select a run to inspect recorded events, usage, reservations and plan evidence. History and cancellation are available even when new planning is disabled. Only project-authorized viewers can read it and managers can cancel. These pages do not poll: use Refresh for newer state. They never expose prompt bodies or worker lease tokens. Organization/project reservations represent the same call against two limits, not two provider charges.

Turn off **Process queued AI requests** in Admin → AI Settings. To disable the planning page too, turn off planning in the same save. These database settings are rechecked, not tied to a deployment environment snapshot. An already-dispatched remote request may continue; changed policy blocks acceptance at subsequent checks. Cancellation does not promise provider-side termination.

Preserve run/audit records and investigate unknown costs before releasing reservations. Human task routes remain available. Do not roll back to the former environment-backed implementation without checking its old flags.

## Shared remote load safeguards

Admin → AI Settings includes a global daily attempt cap (default 48 per UTC day), minimum interval (default 300 seconds), and output-token cap (default 2048, maximum 4096). Existing stored settings receive these defaults on read. These controls require no new environment variables and do not enable processing automatically.

All organizations share one persistent counter. The counter and dispatch marker commit together before network I/O; failed, interrupted, or possibly sent attempts still count. Settings changes never reset the counter. UTC day rollover resets daily counting but preserves the interval from the last attempt. Limited jobs remain queued with their reservations and can be cancelled. Existing queued jobs with an older policy digest are rejected when eligible for processing and must be submitted again after review.

The **Shared inference usage** panel in Admin → AI Settings shows the current UTC allowance and last attempt. Use **Refresh usage** after changing limits or processing a request; there is no polling. The earliest eligible timestamp reflects request limits only, not a promised start time. Worker leases, queued work, credentials and budgets may delay or prevent processing. This administrator-only snapshot does not expose prompts, tokens, internal record IDs or host telemetry, and is not a history of daily usage.

The existing single-dispatch lock, 120-second request deadline, 8000-byte input limit and no-auto-retry behavior remain. These are application-side bounds, not a guarantee that the host has enough capacity or terminates inference on timeout. Confirm provider-side concurrency, token limits and timeout behavior with the endpoint owner before increasing limits. No local model or remote code execution is enabled.

## Organization and project pause controls

Managers can save **Pause remote AI requests** on the organization or project AI budget page. Existing settings default to unpaused. Parent pauses cannot be overridden by a project. Pause changes use the existing revision checks and settings audit; budget values, spent amounts and reservations are not reset.

The budget page also shows the current UTC month's settled spend, held reservations and remaining allowance in that exact scope. No ledger activity is labeled explicitly, not presented as proof that inference is free. Remaining allowance uses the current saved ceiling; lowering a ceiling never erases usage and can leave no allowance. This read does not create or modify budget ledgers. Reload for a fresh snapshot; there is no polling. Organization and project ledgers represent the same requests against separate ceilings and must not be added together. A project allowance does not guarantee admission when parent budgets or other controls block it.

**Monthly budget history** on the same page lists recorded months, 12 per page, using the existing scoped ledgers. Refresh and page navigation replace the snapshot without polling or resetting unsaved budget edits. No empty months or provider charges are fabricated. Each historical limit is the ledger's recorded admission limit, not the current configured ceiling; held reservations can change through later reconciliation. This is not immutable invoicing or a new metering system. Access is restricted by the same organization/project manager checks.

Paused scopes cannot submit new inference requests. Existing queued work is blocked when the worker checks it, and settings revisions invalidate old queued work even after resuming. Submit a fresh request after review. Policy checks reject a draft returned after a pause, but cannot terminate inference on the provider. Unknown charges retain reservations. Manual planning, history, previously created plans and cancellation stay available. Old open clients must reload to send an explicit pause state when saving budgets.

## Support diagnostics

Admin → AI Settings → **Planning diagnostics** provides a manually refreshed, administrator-only snapshot. Queue, running and expired-running-lease counts are capped at 100+. Expired leases are included in running records. A dispatch lease may remain intentionally held after an ambiguous provider response; it is not proof of active remote inference. Independent queries may observe slightly different moments.

For old queued requests, check processing controls, daily allowance/spacing, and Vercel cron logs. For expired running leases, the existing worker recovers at most ten per invocation while processing is enabled; recovery blocks uncertain attempts rather than resending them. Do not manually clear leases or reservations to force a retry. Diagnose unknown completion and charges first. The panel itself never changes jobs, calls inference, or tests provider health.

## Copied planning-context retention

Queued cancellation and terminal worker completion clear the job's redundant `input` field and record `inputClearedAt`, retaining its digest. Each authenticated cron invocation also clears at most 100 older inactive done/blocked/cancelled jobs without that marker. This privacy maintenance runs even when inference processing is paused; it does not send model requests. It rechecks terminal status at update time and leaves queued/running jobs alone.

Only the job's copied prompt is overwritten, not the original objective, approved or draft plans, events, reservations, or run history. The copied text cannot be recovered from that job after cleanup; the objective remains available under its existing permissions. No production cleanup was performed during implementation. This is not a general record-deletion or blob-retention policy.

## AI email updates

Review-ready and blocked planning runs enqueue one generic notification for the manager who requested the run, only if their existing workspace email preference is enabled. Notification creation shares the terminal run transaction. No emails are sent from the planning worker; the existing workspace digest cron handles delivery and its configured interval.

Before delivering AI events, the sender rechecks run revision/status, membership, manager role, project ownership and preference. Revoked or stale events are marked `suppressedAt` rather than reported sent. Messages use generic labels and a sign-in-protected run link; objective text, project names, model payloads and credentials are omitted. Previously created events are not backfilled. Personal attention acknowledgment does not change email preferences.

Digest batches now hold at most 100 events per recipient; remaining events wait for later eligible digests. Each recipient has a six-minute database lease, longer than the scheduled route's five-minute runtime ceiling, preventing overlapping scheduled invocations from sending that recipient concurrently. The worker rechecks the lease and notification opt-out before sending. Normal completion or unused claims release the lease; ambiguous email/acknowledgment failures retain it until expiry. A crash is recoverable after expiry. The email transport is still not exactly-once: retry after ambiguous provider completion may duplicate email. No live email delivery was tested during implementation; tests replace the email sender.

## Local tests

`npm test -- --maxWorkers=2` includes real transactions against a temporary localhost MongoDB replica set with synthetic data and mocked inference. First execution downloads/caches a MongoDB binary. The temporary database is removed afterward; the binary cache remains. No production credentials are required by these integration tests.
# Service identity and artifact integration status

Admin → AI Settings → Service identities now supports disabled registration, one-time credential issuance, activation, rotation, disablement/revocation, and short-lived run-scoped grants. These are Nucleas service credentials, not the inference provider token. Do not put them in provider settings. No production credentials were issued by implementation tests.

Project AI screens link to bounded artifact/review history. The service review endpoint accepts only authenticated, currently granted reviewer submissions. Human acceptance is transactional but fails closed for all currently stored artifacts because trusted sandbox attestation is not implemented. Do not manually flip verification flags or treat synthetic integration tests as execution evidence. A separately authorized remote worker, independent reviewer invocation and live acceptance checks remain deployment gates; nothing should run on the user's PC.
