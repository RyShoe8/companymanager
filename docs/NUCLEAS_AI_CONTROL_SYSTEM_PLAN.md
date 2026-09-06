# Nucleas: Human + AI Work Control System

Final proposed implementation plan · September 5, 2026

Confirmed infrastructure clarification: no models will run on the user's computer. Self-hosted inference is provided by the friend's machine through an existing bearer-token-authenticated endpoint. Nucleas calls that endpoint from its backend. Endpoint protocol, available models, limits, and any execution capabilities remain to be verified; a bearer token does not imply shell access, worker installation rights, or control over the host.

## 1. Product decision

Nucleas becomes the control system for human and AI work, built on the workspace that already exists. It is not a replacement project manager, a chatbot bolted onto tasks, or a browser that runs agents all day.

Humans set objectives, own work, and approve consequential decisions. Nucleas maintains authoritative project state, permissions, budgets, and execution history. Models propose plans and actions. Restricted workers perform authorized work. Review and evidence determine whether results are accepted.

Build the object model and runtime contracts first, alongside a thin user workflow. Then implement one complete execution loop before expanding autonomy or redesigning the entire interface.

## 2. What we retain

Repository inspection confirms the following foundations:

- Next.js 16 / React 19 / TypeScript product application, MongoDB with Mongoose, and an internal billing-engine package. Keep these; the source proposal's PostgreSQL example does not describe this application.
- Projects with embedded task subdocuments and stable ObjectIds. Tasks already support multiple human assignees and active, in-review, and completed statuses.
- Organization membership, employee roles, project-team restrictions, and authenticated product routes. Extend these with machine identities and capability policies; authentication alone is not agent authorization.
- Schedule, Agenda, Capacity, project inspectors, and the Plan / Build workspace concepts. Preserve familiar daily workflows and existing navigation URLs.
- Assets linked to projects and stable task IDs, content items, comments, meetings, recordings, and Google integrations. These become controlled sources of context and result presentation.
- Workspace notification events. Reuse notification delivery for actionable AI updates, but do not mistake recipient notifications for a durable execution event log.
- Existing AI calls for intent parsing, estimates, recording summaries, and transcription. Migrate these into the gateway incrementally, preserving their current behavior.
- Nucleas OS is currently a web/PWA experience. It is not a native worker with filesystem or shell authority.
- Page visibility and idle tracking already exist. Preserve and measure the light-usage approach as AI surfaces are introduced.

This was a targeted source inspection for planning, not a full security audit, test run, or performance benchmark. Existing cleanup work is not proof of production readiness.

## 3. Changes to the supplied vision

1. Keep MongoDB, existing IDs, and existing human-work features. No database rewrite or mass ID migration.
2. Keep AI execution separate from product request handlers and browser lifecycle, but start with modular packages and a small number of deployable processes—not a service for every concept.
3. Implement authorization, approvals, cost accounting, and limits before any agent receives execution tools. The source plan places these too late in its final build order.
4. Start with Architect, Worker, and Reviewer. Implement Manager as deterministic application logic. Director and Judge come later, if measured workflows need them.
5. Treat remote self-hosted inference as potentially zero marginal provider fees, not free or unlimited compute. Track observed latency, usage, quotas, and any agreed charges. Report host resource metrics only if the endpoint exposes them.
6. Verify the friend's endpoint contract, available models, context limits, throughput, and concurrency before choosing workloads. Do not assume hardware administration access or infer performance from the stated RAM capacity.
7. A Git worktree isolates changes, not execution privileges. Shell execution requires an actual sandbox boundary.
8. Start with coding for an internal pilot project. Preserve general-purpose product concepts, but defer research/browser/desktop automation until the coding loop is reliable.

## 4. V1 scope and user journey

V1 succeeds when a user can perform this sequence inside an existing project:

1. Add an objective with constraints and acceptance criteria.
2. Select Plan with AI; view a draft plan, task dependencies, intended capabilities, and estimated budget.
3. Approve a specific plan version. Only then materialize its tasks into the existing project task list.
4. Select an AI-enabled task while preserving its human owner and other human assignees.
5. Use the friend's remote inference endpoint for model requests and a separately authorized remote execution worker for code and tests in a disposable sandbox. These may be on different hosts; inference access alone does not supply an execution environment.
6. See meaningful run updates without keeping the project open.
7. Run predefined tests and have a separate reviewer invocation inspect the requirements, diff, and test evidence.
8. Inspect the diff, artifacts, review findings, failures, and actual/estimated usage.
9. Accept the exact result. Record completion on the existing task only after required checks and human acceptance.

V1 ends at an accepted, reproducible change artifact. Publishing a branch or opening a PR is a separately authorized action if included in the pilot. Production deployment and automatic merge are out of scope. If delivery is only an unmerged patch, the task's definition of done must explicitly say that; implementation delivery is not the same as shipping a feature.

Explicit V1 exclusions: broad desktop control, personal browser access, arbitrary integrations, autonomous deployments, purchases, unrestricted delegation, self-modifying agents, full company autonomy, and automatic model-quality routing.

## 5. Architecture fitted to this repository

### Product application

Keep the current Next.js app as the human-facing UI and product API. Extract shared, server-side domain operations from relevant route handlers so existing human routes and scoped agent endpoints use the same validation and project-team rules. Do not implement a second, less-restricted task-update path for agents.

The product API owns projects, objectives, tasks, plan approvals, human acceptance, and linking results into assets/comments. Workers never receive production database credentials or a human's browser session.

### Nucleas Core

Introduce proposed modules:

- `packages/ai-contracts`: versioned schemas for jobs, model requests, events, tool calls, and worker protocol.
- `packages/ai-core`: workflow state machine, gateway, context assembly, capability checks, budgets, and scheduling logic.
- `services/ai-runtime`: durable dispatcher and job execution coordination, deployed independently of web requests.
- `apps/worker`: separately authorized remote execution daemon, sandbox lifecycle, and bounded telemetry. This is not required to call the friend's inference endpoint and is not installed on the user's computer under this plan.
- `src/components/ai`: project-facing AI controls and lazily loaded operations views.

These are proposed boundaries, not directories that already exist. Add workspace/build configuration deliberately; the existing local billing package is a starting convention, not proof that monorepo tooling is already configured.

Use MongoDB-backed jobs with atomic claims, leases, retries, and indexes for the initial low-concurrency pilot. This avoids another datastore initially. Put dispatch behind an interface so a managed queue can replace it if measured throughput or operations justify it. Confirm the deployment supports the transactions required for state-plus-event writes; otherwise implement a tested recoverable outbox design before execution.

The runtime must live on a host suitable for durable background processes. Do not depend on a long-running Next.js request or the current browser tab. Hosting selection and sandbox compatibility are Phase 0 decisions.

## 6. Data model and compatibility

### Extend existing objects

- Project: optional AI configuration, allowed repository connection, default policy, and budget reference. Non-AI projects remain unchanged.
- Existing task: optional objective/plan linkage, acceptance criteria, dependency references, AI execution configuration, and a small latest-run summary.
- Keep `assignedToEmployeeIds` for humans. Do not insert agent IDs into employee fields or count machine work as employee capacity. Model AI delegation separately.
- Keep task status compatible with existing views. Queued, blocked, executing, awaiting approval, and review failure belong to execution state, not an immediate global task-status redesign.
- Asset: add optional run provenance and integrity metadata where appropriate. Preserve existing project/task linking and private-by-default portal visibility.

### Add durable objects

- Objective: project, desired outcome, constraints, criteria, lifecycle, and accountable human.
- PlanRevision: immutable draft/approved plan, dependency graph, version, and approval reference.
- AgentDefinition: role and configured model/policy defaults. A run creates an ephemeral execution instance; no permanently spinning agent processes.
- ModelDefinition and WorkerNode: capabilities, model identifiers, price version, node trust, health, and resource availability.
- AgentRun: organization/project/task references, parent run, input versions, state, policy snapshot, model, node, attempts, timing, and completion evidence.
- ExecutionJob: queue state, lease, attempt, availability time, and idempotency key.
- RunEvent and ToolCall: ordered operational events and bounded/redacted tool metadata.
- Approval: exact action or plan version, requester, authorized decision-maker, expiry, decision, and consumption state.
- UsageRecord and BudgetReservation: append-only metering and atomic spend reservations.
- Review and Decision: versioned findings, cited evidence, acceptance decisions, and approved project memory.

Use existing ObjectIds internally. Friendly display IDs may be added without replacing stored references. Every new record carries explicit organization scope; resolve access through verified existing membership and ownership relationships. Existing projects are user-owned in the schema, with organization access derived in API helpers; do not assume an `organizationId` field already exists on every legacy object.

Runs, events, logs, and usage must be separate collections, not growing arrays inside projects. Store large diffs/test logs in private blob storage with access-checked, expiring links and retention policies.

All task mutations use stable task IDs, atomic targeted updates, and an expected revision. Do not replace whole task arrays with an agent's stale snapshot. Validate dependency existence and reject cycles. Changes to a task, plan, repository base, or policy can invalidate queued work and require reapproval. Deleting or archiving a task cancels or blocks its outstanding work.

Defer extracting tasks into a standalone collection unless document size or write contention measurements justify it. Keep a task repository/service boundary so later migration can preserve APIs and IDs.

## 7. Runtime reliability

The application owns legal transitions, not the model. Distinguish execution from review and acceptance:

`queued → running → review_required → reviewing → awaiting_acceptance → completed`

Explicit branches include waiting for approval, revision required, blocked, failed, cancellation requested, and cancelled. Cancellation is not confirmed until execution has stopped or the node has been fenced from further authority.

- At-least-once delivery with idempotent handlers; do not promise exactly-once execution.
- Heartbeats, expiring leases, and fencing tokens prevent stale workers from committing results.
- Persist checkpoints and events before advancing dependent work.
- Non-idempotent external actions require operation IDs and reconciliation after ambiguous timeouts; never blindly replay them.
- Bound wall-clock duration, tool calls, output size, retries, child runs, and concurrency.
- Start with at most two execution attempts per task; exhausted limits block for human direction. Cloud escalation cannot silently bypass the configured budget or data policy.
- Approval pauses survive worker/runtime restarts and do not occupy an expensive running sandbox unnecessarily.
- Version task inputs and repository commits so a review cannot approve one diff while another is applied.
- Provide organization, project, node, and run stop controls. Revocation must be checked at dispatch and before each tool action, not only when a run begins.

## 8. Gateway, context, and costs

All new model calls pass through a provider-neutral gateway with capability validation, cancellation, deadlines, normalized usage, error categories, and trace identifiers. V1 integrates one cloud provider and the friend's remote self-hosted endpoint. Model selection is configuration, not hard-coded agent behavior. Verify its protocol rather than assuming OpenAI compatibility.

Store the bearer token in backend secret storage and attach it only to authorized HTTPS requests to the configured endpoint. Never expose it through browser code, public environment variables, browser storage, model context, logs, or this plan. Do not forward it across redirects to another host. Support rotation, revoked/expired-token errors, timeouts, and rate limits. Do not automatically fall back to a cloud provider unless data-sharing policy and budget permit it.

Use separate methods for text/tool interaction and transcription rather than pretending all existing AI features have identical inputs. Route existing estimates, summaries, and intent parsing incrementally with feature-level regression tests.

Assemble context from the specific objective, approved plan, task, permitted project assets, relevant repository files, and approved decisions. Record sources and versions. Retrieved content and repository text are untrusted input, not permission grants. Do not send unrelated client data, credentials, or personal files to a model or third-party node.

Reserve estimated maximum spend atomically before dispatch; reconcile against recorded provider usage afterward. Include retries, planning, review, failed calls when billable, and parallel child runs. Unknown usage is marked unknown, not zero. Never silently route to a more expensive or externally hosted model.

Set organization/project/run limits initially; add task limits through aggregated reservations. Track remote inference duration and endpoint quotas separately. Keep AI budget enforcement distinct from existing Stripe subscriptions; usage invoicing is a later product decision, not implied by recording costs.

## 9. Worker and security requirements

- Worker registration requires explicit administrator authorization, revocable node credentials, rotation, and auditable project/organization grants.
- New execution workers initiate authenticated encrypted outbound connections. For the existing inference service, Nucleas instead calls the friend's authenticated HTTPS endpoint; do not require replacing its deployment with an outbound worker. Never expose an unauthenticated inference endpoint.
- Separate inference permission from filesystem/shell execution permission. A node can provide inference without receiving a repository or execution capability.
- Pilot with non-sensitive code or an explicitly trusted node. Outbound encryption does not make a friend's machine trusted; its operator may be able to inspect plaintext workloads.
- Execute coding tasks inside a restricted container or VM appropriate to the host OS, plus a disposable worktree. No privileged containers or host-container-management sockets.
- Enforce CPU, RAM, process, disk, output, network, and wall-clock limits. Disable GPU access unless required and explicitly isolated.
- Capabilities name permitted workspace roots, tool operations, network destinations, and scoped credentials. Enforce real path containment, including symlink/junction escapes.
- Shell access is broad execution authority; command-name allowlists alone are insufficient. Use OS-enforced isolation and network/secret restrictions.
- Never expose personal directories, SSH keys, password managers, personal browser profiles, or production credentials by default.
- Approvals bind to exact action arguments, target, artifact hash/version, scope, and expiry. Recheck policy and approver authority when the action executes. The agent cannot approve its own action.
- Production mutations, deletion, spending, and publication remain denied in V1 unless a narrowly defined action is explicitly added later.
- Redact secrets and sensitive payloads in logs. Log inputs/outputs only under retention and access policies. Show operational summaries, tool actions, and evidence—not private chain-of-thought.
- Sign and version worker distributions; reject incompatible or revoked nodes and define an update/rollback procedure before wider installation.

## 10. UI evolution, not a navigation reset

Keep the existing workspace and introduce progressive additions:

- Project overview: objective, AI-enabled indicator, latest execution outcome, blockers, and approvals.
- Plan experience: AI draft, editable task breakdown, criteria, dependencies, budget, and version-specific approval.
- Existing task inspector: human assignees, AI delegation, start/stop controls, latest run, review evidence, and result acceptance.
- Project artifacts: reuse Assets presentation for outputs with run provenance. Add Decisions only where approved memory exists.
- Workspace needs-attention area: approvals, blocked runs, and review-ready results using existing notification preferences.
- AI operations surface: Runs and Usage first. Model and Compute configuration restricted to appropriately authorized administrators. Add team templates later.

Use “AI Runs” or “Executions” to distinguish agent runs from the existing business-workflow terminology. Do not replace Schedule/Agenda/Capacity or force all users into an AI command center. Content and marketing execution can later reuse the runtime without becoming prerequisites for coding V1.

Avoid invented percentage-complete indicators. Show verified states, completed criteria, and bounded steps when a real denominator exists.

## 11. All-day light usage is a release requirement

AI continues server-side while the browser is hidden or closed. No model runtime or execution worker is installed on the user's computer under this plan. The browser displays state and submits authorized commands; remote infrastructure performs inference and execution.

- One shared, bounded update mechanism for the mounted AI view, not polling per task/agent/card.
- Prefer a resumable event feed when hosting supports it; otherwise use one visibility-aware incremental poll. Reconcile from a cursor/snapshot after reconnect.
- Batch event rendering and invalidate only affected records. Do not reload the entire workspace for every token or tool event.
- No token-level streaming outside an explicitly opened detail view. Paginate and virtualize run histories; lazy-load heavy logs and diffs.
- Release listeners, connections, timers, media resources, and cached detail payloads when views close. Cap browser caches.
- Node resource telemetry stays server-side unless the user opens Compute.

Proposed release budgets, to be calibrated against a Phase 0 reference machine and fixed dataset: hidden AI views perform no periodic AI UI polling; idle browser CPU averages below 1% over a defined 10-minute sample; retained heap after equivalent forced-GC snapshots grows no more than 10% between hour one and hour eight; opening an ordinary task remains below 200 ms p95 under the defined local interaction test. These are targets, not current measurements or universal hardware guarantees.

Run an eight-hour soak including visible idle, hidden, reconnect, repeated inspector opening, and worker activity. Inspect timers, detached DOM, request counts, long tasks, heap, and total browser-process memory. Passing functional tests alone is insufficient.

## 12. Ordered delivery phases and exit gates

### Phase 0 — Baseline and contracts

Inventory authorization and task mutations, capture current test/lint/typecheck/build results without filtering failures, and add regression coverage for login, user navigation, multi-assignee save, scheduling, and assets. Measure idle performance. Confirm runtime hosting, Mongo transaction support, blob access, the friend's endpoint protocol/model inventory/limits, and repository trust. Separately identify an authorized remote sandbox host; do not assume bearer-token access includes execution. Write state-machine, tenancy, worker-protocol, and policy contracts.

Exit: documented baseline, agreed pilot objective and reference dataset, viable sandbox/host selection, and explicit existing blockers. Do not begin a broad cleanup rewrite.

### Phase 1 — Governed execution foundation

Implement objectives, immutable plan drafts, runs/jobs/events, reviews, approvals, budget reservations, scoped service identities, and authoritative domain mutations. Add feature flags and audit fields. Build a minimal task-run inspector using simulated execution events.

Exit: cross-organization access is denied; duplicate delivery cannot duplicate tasks; stale writes conflict safely; approval expiry/replay and concurrent budget reservations are tested. Human-only projects continue to function.

### Phase 2 — Gateway and planning vertical slice

Connect one cloud provider through the gateway. Ship Objective → Plan with AI → Review draft → Approve → Existing tasks. Validate structured outputs, dependencies, budgets, and cancellation. Show usage from the first real invocation.

Exit: plan approval creates each task once, preserves human assignments, records source/version/usage, and leaves tasks untouched on invalid output or unapproved drafts.

### Phase 3 — Remote inference

Connect to the friend's existing inference endpoint through a backend adapter and securely stored bearer token. Verify supported requests, tool-call output, streaming, usage reporting, model availability, and error handling. Start at concurrency one and respect agreed endpoint limits. No installation on either machine is required for this inference integration.

Exit: cloud and remote self-hosted inference share the gateway contract; the token never reaches the browser or logs; invalid credentials and outages produce actionable run states. Benchmark model suitability before selecting coding workloads. Mark unavailable usage or host telemetry as unknown rather than fabricating it.

### Phase 4 — Sandboxed coding and review

Provision a separately authorized remote execution host and worker, including registration, revocable credentials, leases, heartbeats, and resource caps. Add private repository provisioning, disposable sandbox/worktree, filesystem/shell/Git tools, enforced capabilities, bounded logs, test execution, immutable diff artifacts, separate reviewer invocation, and human result acceptance. Manager remains deterministic. If access is inference-only and no execution host is available, planning and inference can ship, but coding execution is explicitly blocked until a host is selected and authorized—not redirected onto the user's computer.

Exit: one meaningful internal task completes the V1 loop with reproducible evidence. Escape/secret/network denial tests pass. Failed review cannot complete a task. Changed artifacts invalidate acceptance. Cancellation stops execution or fences authority.

### Phase 5 — Pilot release and operations

Finish Runs, Usage, approvals/needs-attention integration, node health, retention, support diagnostics, and stop controls. Test restart during execution, expired lease, approval pause, budget exhaustion, duplicate events, and partial uploads. Run the eight-hour browser soak and worker load test.

Exit: a predefined pilot suite completes with no tenant leakage, unauthorized effects, duplicate acceptance, or lost terminal state. Report completion rate, review rejection, human correction, wall time, provider cost, and available remote resource usage honestly. Release behind organization/project flags after all gates pass.

### Phase 6 — Controlled expansion

Add reusable project team profiles and selected additional work types on authorized remote infrastructure. No user-machine model hosting or worker installation is included. Add bounded Manager/Director delegation only after the fixed loop is reliable. Add Judge escalation and adaptive routing only when evaluation data demonstrates benefit.

Exit for each autonomy increase: scoped policy, spend/concurrency caps, stop/recovery tests, evaluation thresholds, and an explicit product approval. Never make unrestricted computer access the upgrade path.

Phases 0–5 constitute V1. Sequence work by these gates rather than promising the source plan's calendar estimates before hardware, staffing, and deployment constraints are known. UI and runtime work may proceed in parallel after contracts stabilize; execution tools remain blocked on security gates.

## 13. Rollout and rollback

Use additive schemas and optional fields. Keep legacy reads valid. Make backfills resumable and idempotent; retain stable task IDs and existing asset links. Release to one internal organization and one repository before broader access.

Independent flags control planning, remote inference, sandbox execution, and delegation. On rollback, prevent new dispatch, cancel/fence outstanding work, preserve audit evidence and accepted artifacts, and leave existing human workflows usable. Do not delete run data to disable AI.

Implementation is complete only with migration verification, negative security tests, workflow recovery tests, existing workflow regressions, operator documentation, and measured browser/worker performance. Any baseline failures must be explicitly resolved or waived with ownership—not hidden in filtered output.

## 14. Definition of success

The first success metric is not agent count or token volume. It is whether a real existing Nucleas project can move from objective to an accepted coding result with clear human ownership, traceable evidence, enforceable permissions, bounded cost, recoverable execution, and a browser that can stay open all day.

After that works, optimize cost per accepted task and human correction rate. A target such as 90% remote self-hosted inference is a hypothesis, not a requirement that overrides quality, latency, privacy, endpoint availability, or total infrastructure cost. Here, self-hosted always means the friend's remote service, never the user's computer.

## Source anchors

This plan adapts the supplied “Nucleas is not a project manager with AI features” document using the current repository, particularly:

- `package.json`
- `src/lib/models/Project.ts`
- `src/lib/models/Asset.ts`
- `src/lib/models/Organization.ts`
- `src/lib/models/WorkspaceNotificationEvent.ts`
- `src/app/api/projects/[id]/tasks/route.ts`
- `src/lib/auth/middleware.ts`
- `src/components/workspace/WorkspaceShell.tsx`
- `src/lib/os/nucleasOsManifest.ts`
- `src/hooks/usePageActivity.ts`
- `src/lib/ai/estimateHours.ts`, `summarizeRecording.ts`, and `transcribeAudio.ts`
- `src/app/api/parse-intent/route.ts`

No product code or original plan attachment was changed to produce this plan.
