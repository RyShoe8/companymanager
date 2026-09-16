# AI / IDE audit — September 16, 2026

## Outcome

21 findings: 13 high-priority (P1) and 8 medium-priority (P2). These are prioritized engineering findings, not a claim that every issue was exploited or reproduced in production. The current uncommitted patch is **not ready to deploy**: its expanded message size exceeds the shared gateway contract.

This was an audit, not a remediation pass. Application code and the original plan were not changed during this audit. Existing uncommitted fixes were preserved. No commit, push, deployment, paid inference, production mutation, credential inspection, or internal-network probing was performed.

## Relationship to the reported Plan-mode failure

The reported HTTP 504 identifies a failed upstream HTTP response in the worker path; it does not establish whether the model, router, reverse proxy, or another upstream hop timed out. This audit did not rerun that production request, so it cannot identify the exact host-side cause. The code has independent defects that can make a multi-stage run fail, lose history, discard useful progress, or mislabel an incomplete answer as accepted. Fixing those does not by itself prove the remote 504 is resolved.

## Scope and evidence

Reviewed the current AI/IDE architecture and principal execution paths: shared contracts/gateway, model profiles, company/team/direct chat, role pipeline, queued planning worker, tools and browsing, leases and budgets, repository binding/publishing, history/rules/plan parsing, AI/IDE API authorization, and IDE client state. The source inventory included 283 files; this is not a claim that every line or every possible interaction was exhaustively verified.

Evidence labels below distinguish offline reproductions, source-confirmed gaps, and cases still requiring browser or deployment verification. Existing safeguards include tenant-scoped access checks, encrypted credentials, human confirmation for publishing, and stronger lease/recovery/fencing mechanisms in the older durable planning flow. Reuse these patterns instead of creating another divergent execution path.

## Verification

- Main AI/IDE, packages, and related API suite: 557 tests; 555 passed, 2 failed.
- Isolated Mongo planning-worker integration and cron suite: 89 tests; 87 passed, 2 failed.
- Combined: **646 tests; 642 passed, 4 failed across 76 files**.
- TypeScript: `npx tsc --noEmit` passed.
- Scoped ESLint: 0 errors, 15 warnings.
- Tests used a synthetic auth secret. Mongo integration used its isolated in-memory replica-set fixture; no production database or model calls.
- Offline reproductions confirmed missing-gate acceptance, incompatible message/output/history limits, accepted loopback URL forms, and the real Mongoose model silently rejecting worker chat inserts.

### Failing tests

1. `src/lib/ai/teamChat.test.ts:191`: budget/reservation expectation receives the remote-connection/processing prerequisite message.
2. `src/lib/ai/control/dispatchLimits.test.ts:36`: expects 4,097 output tokens to be rejected although the settings contract now allows more.
3. `services/ai-runtime/planningWorker.integration.test.ts:216`: expects the old assistant path but receives missing Planner configuration.
4. `services/ai-runtime/planningWorker.integration.test.ts:687`: expects 2,048 default tokens; current result is 3,072.

These appear to be fixture/assertion drift, but the suite is not green and should not be described as passing. More importantly, the passing tests missed the boundary defects below, including persistence validation hidden by database mocks.

## Findings

### F01 — P1 — Worker chat can silently fail to persist

Evidence: Reproduced offline.

Worker threads deliberately use empty directProfileId/directModel, but both model fields are required strings. With ordered:false, Mongoose rejects these documents during validation yet resolves insertMany with an empty array. appendIdeChatTurns then returns true. A real-model offline reproduction returned zero documents and made zero database writes without throwing.

Sources: [src/lib/models/AiIdeChatTurn.ts:44](D:/Nucleas/nucleas/src/lib/models/AiIdeChatTurn.ts:44), [src/lib/ide/chatHistory.ts:214](D:/Nucleas/nucleas/src/lib/ide/chatHistory.ts:214).

Recommended correction: Make required fields conditional on direct mode and verify the inserted or already-existing turn IDs before reporting persistence success.

Required regression coverage: Use the real Mongoose schema in an isolated database test: worker and direct threads survive reload, and partial validation failures never report full success.

### F02 — P1 — Reviewer acceptance fails open

Evidence: Reproduced offline and traced.

Missing or invalid nucleas-gate output is treated as acceptance; unknown statuses also fall through to acceptance. A non-final reply such as 'Still checking, not ready.' passes. This undermines the completion gate even with the previous patch that handles explicit needs_more exhaustion.

Sources: [src/lib/ide/parseReviewerGate.ts:29](D:/Nucleas/nucleas/src/lib/ide/parseReviewerGate.ts:29), [src/lib/ai/teamChat.ts:621](D:/Nucleas/nucleas/src/lib/ai/teamChat.ts:621).

Recommended correction: Require a valid structured accept decision. Treat malformed, missing, or unknown decisions as incomplete; optionally perform a bounded format repair.

Required regression coverage: Cover missing and malformed fences, reject/unknown statuses, incomplete reasoning, explicit acceptance, and exhausted review passes.

### F03 — P1 — Expanded context exceeds the gateway contract

Evidence: Schema rejection reproduced.

The current uncommitted patch permits 48,000-character messages and a 40,000-character user payload, while the gateway allows 32,000 per message. Large planner/repository handoffs fail before reaching a provider. This is a regression in my previous patch, not a provider timeout.

Sources: [src/lib/ai/companyChat.ts:366](D:/Nucleas/nucleas/src/lib/ai/companyChat.ts:366), [src/lib/ai/companyChat.ts:594](D:/Nucleas/nucleas/src/lib/ai/companyChat.ts:594), [packages/ai-contracts/src/index.ts:61](D:/Nucleas/nucleas/packages/ai-contracts/src/index.ts:61).

Recommended correction: Use shared limits and a context packer that budgets instructions, user input, repository evidence, and handoffs together. Do not deploy the expansion as-is.

Required regression coverage: Test the actual request schemas/gateway with long planner drafts and repository context; mock the transport rather than bypassing gateway validation.

### F04 — P1 — Length-limit retry requests an invalid output budget

Evidence: Schema rejection reproduced.

Chat supports a 16,384-token cap and retries an 8,192-token response at 16,384. Both gateway request contracts cap output at 8,192, so that retry is rejected locally. Raising only the UI or policy setting cannot fix it.

Sources: [src/lib/ai/companyChat.ts:342](D:/Nucleas/nucleas/src/lib/ai/companyChat.ts:342), [src/lib/ai/companyChat.ts:570](D:/Nucleas/nucleas/src/lib/ai/companyChat.ts:570), [packages/ai-contracts/src/index.ts:63](D:/Nucleas/nucleas/packages/ai-contracts/src/index.ts:63).

Recommended correction: Define one supported output contract, validate per-provider capabilities, and handle truncated responses with an explicit continuation strategy where appropriate.

Required regression coverage: Exercise a finish_reason=length response through the real gateway validation and verify valid continuation or a clear incomplete result.

### F05 — P1 — A long answer or approved plan can make the next request invalid

Evidence: Schema rejection reproduced and UI traced.

Each request/history text is capped at 6,000 characters, but the client resends unbounded previous replies and can submit an 8,000-character plan plus a Build prefix. A 6,001-character history entry fails validation. The just-entered user message is also included in both history and text.

Sources: [src/lib/ide/ideChatSchema.ts:16](D:/Nucleas/nucleas/src/lib/ide/ideChatSchema.ts:16), [src/components/ide/IdeChatPane.tsx:661](D:/Nucleas/nucleas/src/components/ide/IdeChatPane.tsx:661), [src/components/ide/IdeChatPane.tsx:782](D:/Nucleas/nucleas/src/components/ide/IdeChatPane.tsx:782).

Recommended correction: Separate stored conversation from bounded model context; send conversation/approved-plan IDs and versions instead of copying oversized artifacts into request text. Exclude the current message from prior history.

Required regression coverage: Test a long answer followed by 'continue', approval of a long plan, and absence of duplicated current user input.

### F06 — P1 — GitHub installation ownership is not verified at binding

Evidence: Confirmed missing code check; exploit not attempted.

An authorized manager can save a caller-supplied installationId and repository into their own project. Repository access then creates an installation client using the platform GitHub App credentials without a verified tenant-to-installation ownership check. Knowing another installation ID/repository could cross tenant boundaries if that installation grants the App access.

Sources: [src/app/api/projects/[id]/ai/repository/route.ts:59](D:/Nucleas/nucleas/src/app/api/projects/[id]/ai/repository/route.ts:59), [src/lib/ai/ideCommitPush.ts:77](D:/Nucleas/nucleas/src/lib/ai/ideCommitPush.ts:77), [src/lib/ai/githubAppClient.ts](D:/Nucleas/nucleas/src/lib/ai/githubAppClient.ts).

Recommended correction: Bind repositories only through verified installation onboarding and tenant-owned installation records. Validate the selected repository against that installation's grants at binding and access time.

Required regression coverage: Use two tenant/install fixtures; reject foreign installation IDs and repository grants. Production impact depends on actual installation scopes, which were not exercised.

### F07 — P1 — Tool profiles are advertised but not enforced at execution

Evidence: Confirmed code-path gap.

Plan mode advertises only repository reads, but returned tool names are dispatched directly to the common executor without checking membership in the active tool catalog. That executor also supports browsing and image generation/asset creation. A hallucinated or injected known tool name can escape the selected profile if its downstream prerequisites are configured.

Sources: [src/lib/ai/tools/definitions.ts:9](D:/Nucleas/nucleas/src/lib/ai/tools/definitions.ts:9), [src/lib/ai/tools/runToolLoop.ts:117](D:/Nucleas/nucleas/src/lib/ai/tools/runToolLoop.ts:117), [src/lib/ai/tools/executeTool.ts:35](D:/Nucleas/nucleas/src/lib/ai/tools/executeTool.ts:35).

Recommended correction: Enforce the active server-side tool allowlist and typed arguments before dispatch; require explicit authorization for side-effecting tools independently of model instructions.

Required regression coverage: Return image_generate or web_fetch from a repo-only mock model and assert no external call or asset write occurs.

### F08 — P1 — URL checks do not reliably exclude private destinations

Evidence: URL guard bypass reproduced; no network probe.

The shared guard accepts https://localhost./ and IPv4-mapped loopback normalized to ::ffff:7f00:1. It does not resolve DNS to exclude private addresses. The browser worker has a separate weaker guard, follows redirects, and does not constrain subresource requests. Chromium launches with --no-sandbox. Reachability depends on deployment network isolation.

Sources: [src/lib/ai/tools/ssrf.ts:40](D:/Nucleas/nucleas/src/lib/ai/tools/ssrf.ts:40), [src/lib/ai/tools/webFetch.ts](D:/Nucleas/nucleas/src/lib/ai/tools/webFetch.ts), [services/ai-runtime/browserWorker.ts:37](D:/Nucleas/nucleas/services/ai-runtime/browserWorker.ts:37).

Recommended correction: Centralize host normalization and public-address validation; enforce redirect/subresource and DNS-rebinding protections with a controlled egress boundary. Run the browser in an appropriately sandboxed, resource-limited environment.

Required regression coverage: Use synthetic DNS/redirect/subresource fixtures covering private IPv4, mapped IPv6, trailing dots, and rebinding. Do not test against live internal services.

### F09 — P1 — Dispatch leases expire before allowed work completes

Evidence: Confirmed timing/ownership mismatch.

Chat/stage leases last 90 seconds, while a remote model call can allow 120 seconds and tool loops run longer. No renewal protects the full operation. The shared lock helper also treats holders without runId as stealable, while other callers use that lock without runId. Cancellation releases a lease before remote generation is necessarily stopped.

Sources: [src/lib/ai/companyChat.ts:44](D:/Nucleas/nucleas/src/lib/ai/companyChat.ts:44), [src/lib/ai/rolePipeline/stageInvoke.ts:20](D:/Nucleas/nucleas/src/lib/ai/rolePipeline/stageInvoke.ts:20), [src/lib/ai/control/dispatchLock.ts:18](D:/Nucleas/nucleas/src/lib/ai/control/dispatchLock.ts:18).

Recommended correction: Use a consistent owner identity, renewable/fenced leases, and conservative handling of uncertain remote cancellation across every caller.

Required regression coverage: Fake-clock tests must prevent overlapping calls after 90 seconds and protect active queued-worker/diagnostic leases. Test lease-loss and uncertain abort behavior.

### F10 — P1 — Publishing can overwrite changes made since a file was opened

Evidence: Confirmed code-path gap.

The read API returns a blob SHA, but the publish payload does not require the expected blob/base version. Publish overlays editor content onto the latest branch head. Non-force ref updates protect only races after that head is fetched, not collaborator edits made since the editor originally opened the file.

Sources: [src/lib/ai/ideCommitPush.ts:174](D:/Nucleas/nucleas/src/lib/ai/ideCommitPush.ts:174), [src/lib/ai/ideCommitPush.ts:210](D:/Nucleas/nucleas/src/lib/ai/ideCommitPush.ts:210), [src/lib/ai/idePublishSchema.ts](D:/Nucleas/nucleas/src/lib/ai/idePublishSchema.ts).

Recommended correction: Carry expected file/base versions through the editor and reject stale writes with a conflict response before creating the publish commit.

Required regression coverage: Open version A, advance the repository to B, then try to publish an edit based on A; require conflict resolution and preserve B.

### F11 — P1 — Editor requests can apply to the wrong project; dirty buffers are discarded

Evidence: Confirmed asynchronous state paths; browser reproduction pending.

File reads lack the generation/abort guards used by chat. An old file response can update the editor after a project switch, leaving content from one project in another project's publish context. Opening files or switching projects also clears edits without a dirty-buffer confirmation or per-file buffer preservation.

Sources: [src/components/ide/IdeShell.tsx:313](D:/Nucleas/nucleas/src/components/ide/IdeShell.tsx:313), [src/components/ide/IdeShell.tsx:372](D:/Nucleas/nucleas/src/components/ide/IdeShell.tsx:372), [src/components/ide/IdeShell.tsx:483](D:/Nucleas/nucleas/src/components/ide/IdeShell.tsx:483).

Recommended correction: Scope editor state to project/repository/ref/path, cancel or ignore stale requests, retain dirty buffers, and add navigation/unload protection. Guard publish completion against subsequent edits.

Required regression coverage: Use delayed A/B file responses and project switches in browser tests; verify content ownership and unsaved-change protection.

### F12 — P1 — Multi-call failures can lose usage, and reservations are not hard spend caps

Evidence: Confirmed accounting-path gap; no paid calls made.

The tool loop accumulates usage only in its eventual successful return. A later failure throws away earlier successful-call usage; a successful fallback can then settle using only fallback usage. A stage reserves once but may perform many provider calls without a fresh per-call budget admission. Actual cost can exceed the reservation and intended remaining limit.

Sources: [src/lib/ai/tools/runToolLoop.ts:65](D:/Nucleas/nucleas/src/lib/ai/tools/runToolLoop.ts:65), [src/lib/ai/companyChat.ts](D:/Nucleas/nucleas/src/lib/ai/companyChat.ts).

Recommended correction: Persist and settle usage per provider attempt, retain unknown charges conservatively, and reserve/check a bounded cost before each additional call. Include separately billed tools in the ledger.

Required regression coverage: Mock two billed successes followed by failure/fallback; assert every known charge remains accounted for and insufficient remaining budget prevents the next call.

### F13 — P1 — Role-pipeline fee handling is not tied to the selected provider

Evidence: Confirmed code-path discrepancy.

The separate role-pipeline runtime uses the global noProviderFee policy to settle at zero or unknown, rather than deriving fee treatment from the selected profile. A global free-host setting can therefore mark a paid provider call free; with the flag off, even successful calls are not priced here. This differs from companyChat accounting.

Sources: [src/lib/ai/rolePipeline/stageInvoke.ts:214](D:/Nucleas/nucleas/src/lib/ai/rolePipeline/stageInvoke.ts:214), [src/lib/ai/rolePipeline/stageInvoke.ts:224](D:/Nucleas/nucleas/src/lib/ai/rolePipeline/stageInvoke.ts:224).

Recommended correction: Unify profile-aware pricing and usage settlement between the IDE and role-pipeline runtimes. Keep genuinely unpriced usage explicit, not falsely zero.

Required regression coverage: Run a paid profile with the free-host flag enabled and a free profile with it disabled; verify provider-specific accounting and reservation release.

### F14 — P2 — Deep tool loops exceed the maximum message count

Evidence: Confirmed incompatible bounds.

The loop permits 32 rounds, but the gateway accepts at most 40 messages. Each tool round appends an assistant message and one or more tool messages, without compaction. Deep exploration can therefore fail validation after earlier successful work.

Sources: [src/lib/ai/tools/runToolLoop.ts:12](D:/Nucleas/nucleas/src/lib/ai/tools/runToolLoop.ts:12), [src/lib/ai/tools/runToolLoop.ts:95](D:/Nucleas/nucleas/src/lib/ai/tools/runToolLoop.ts:95), [packages/ai-contracts/src/index.ts:118](D:/Nucleas/nucleas/packages/ai-contracts/src/index.ts:118).

Recommended correction: Budget message count and context before each request; compact completed tool exchanges into evidence summaries while preserving IDs and provenance.

Required regression coverage: Test enough one-tool and multi-tool rounds to cross 40 messages through the real gateway schema.

### F15 — P2 — Repository tool output is cut into invalid JSON and cannot be paged

Evidence: Confirmed deterministic truncation.

repo_read constructs JSON with up to 100,000 content characters and then slices the serialized result to 12,000. This can remove closing JSON and the truncation indicator. There is no offset/line-range input to fetch the missing remainder. The server-side fallback also clips file evidence and uses Nucleas-specific seed paths, reducing relevance for other projects.

Sources: [src/lib/ai/tools/executeTool.ts:59](D:/Nucleas/nucleas/src/lib/ai/tools/executeTool.ts:59), [src/lib/ai/tools/runToolLoop.ts:157](D:/Nucleas/nucleas/src/lib/ai/tools/runToolLoop.ts:157), [src/lib/ai/tools/serverRepoAssist.ts:63](D:/Nucleas/nucleas/src/lib/ai/tools/serverRepoAssist.ts:63).

Recommended correction: Truncate fields before serialization, return explicit coverage/range metadata, and support bounded line-range reads. Discover project structure instead of assuming Nucleas paths.

Required regression coverage: Read a file with a required fact beyond character 12,000; retrieve it in a later range and validate every response as JSON.

### F16 — P2 — Completed answers and plans are silently shortened

Evidence: Confirmed storage/parser limits.

Stored text and plan markdown are capped at 8,000 characters; tool-loop answers are capped at 16,000. A longer answer can lose its ending on persistence/reload. Rebuilt plan markdown can omit prose or visual material outside the structured plan fields, so the approved artifact may not contain the whole answer.

Sources: [src/lib/ide/chatHistory.ts:93](D:/Nucleas/nucleas/src/lib/ide/chatHistory.ts:93), [src/lib/ide/chatHistory.ts:116](D:/Nucleas/nucleas/src/lib/ide/chatHistory.ts:116), [src/lib/ide/parseNucleasPlan.ts](D:/Nucleas/nucleas/src/lib/ide/parseNucleasPlan.ts), [src/lib/ai/tools/runToolLoop.ts:90](D:/Nucleas/nucleas/src/lib/ai/tools/runToolLoop.ts:90).

Recommended correction: Persist complete versioned answer/plan artifacts separately from bounded prompt excerpts. Surface any truncation explicitly and preserve visual/prose sections needed for approval.

Required regression coverage: Round-trip a long answer and a plan containing a wireframe through streaming, persistence, reload, and approval without losing the ending or visual.

### F17 — P2 — Reasoning-only or length-limited output can be treated as a final answer

Evidence: Confirmed response handling.

The gateway falls back to reasoning_content when normal content is absent. The tool loop returns visible text without preserving a completion-status distinction. Combined with the permissive reviewer parser, intermediate or truncated reasoning can look like a completed deliverable.

Sources: [packages/ai-core/src/gateway.ts:211](D:/Nucleas/nucleas/packages/ai-core/src/gateway.ts:211), [src/lib/ai/tools/runToolLoop.ts:87](D:/Nucleas/nucleas/src/lib/ai/tools/runToolLoop.ts:87), [src/lib/ide/parseReviewerGate.ts:39](D:/Nucleas/nucleas/src/lib/ide/parseReviewerGate.ts:39).

Recommended correction: Keep reasoning, answer content, and completion state distinct. Require an actual final answer and successful completion gate; handle token-limit continuation explicitly.

Required regression coverage: Test reasoning-only, empty content, finish_reason=length, and interrupted structured output. None should become an approved final plan by accident.

### F18 — P2 — Configured rules and reviewer retries are not faithfully applied

Evidence: Confirmed configuration/runtime mismatch.

Rule creation permits 8,000-character bodies, but runtime clips each title/body to 2,000 characters and stops at 12,000 total. Important tail instructions can silently disappear. IDE orchestration also hardcodes six completion passes rather than honoring the team's maxWorkerRetries setting.

Sources: [src/lib/ide/loadTaskRules.ts:31](D:/Nucleas/nucleas/src/lib/ide/loadTaskRules.ts:31), [src/lib/ide/taskRuleSchema.ts](D:/Nucleas/nucleas/src/lib/ide/taskRuleSchema.ts), [src/lib/ai/teamChat.ts:584](D:/Nucleas/nucleas/src/lib/ai/teamChat.ts:584).

Recommended correction: Expose and validate effective rule budgets, never silently drop mandatory instructions, and use one clearly defined retry policy across settings and runtimes.

Required regression coverage: Put a required instruction near the end of an accepted rule; verify inclusion or explicit rejection. Test each supported retry setting against actual model call counts.

### F19 — P2 — One synchronous request can outlive the serverless deadline

Evidence: Confirmed architectural bound mismatch; no live timeout test.

The route allows 300 seconds, but planner, repeated worker/reviewer calls, and nested tool loops can exceed that duration. Per-call timeouts do not enforce an overall deadline. A host termination can prevent final history and accounting updates.

Sources: [src/app/api/projects/[id]/ai/ide/chat/route.ts:27](D:/Nucleas/nucleas/src/app/api/projects/[id]/ai/ide/chat/route.ts:27), [src/lib/ai/teamChat.ts:584](D:/Nucleas/nucleas/src/lib/ai/teamChat.ts:584), [src/lib/ai/tools/runToolLoop.ts:65](D:/Nucleas/nucleas/src/lib/ai/tools/runToolLoop.ts:65).

Recommended correction: Use durable stage orchestration with checkpoints, or enforce a shared absolute deadline with enough time for cleanup. Recover interrupted state rather than restarting the whole workflow.

Required regression coverage: Fake-clock or integration tests should stop/checkpoint before the host deadline and recover after interruption without losing paid work.

### F20 — P2 — Retrying an IDE POST can duplicate paid work

Evidence: Confirmed missing request identity.

The client generates a user turn ID locally but does not send a durable idempotency key for execution; the server creates a new random ID for each POST. Retrying after a lost response or persistence error can rerun the pipeline and incur another charge.

Sources: [src/app/api/projects/[id]/ai/ide/chat/route.ts:155](D:/Nucleas/nucleas/src/app/api/projects/[id]/ai/ide/chat/route.ts:155), [src/components/ide/IdeChatPane.tsx:661](D:/Nucleas/nucleas/src/components/ide/IdeChatPane.tsx:661).

Recommended correction: Send a stable client request ID, claim it durably within the tenant/project/user scope, and return or resume the same execution on retry.

Required regression coverage: Simulate response loss after completion and simultaneous duplicate POSTs; require one execution and one accounting record.

### F21 — P2 — Build mode has a capability gap, not an execution backend

Evidence: Confirmed available tool surface.

The inspected IDE model tools read repositories and browse/generate images; they do not edit repository files or execute repository tests. Manual editor publishing is separate. An approved plan sent into Build should not be interpreted as proof that implementation or verification actually occurred.

Sources: [src/lib/ai/tools/definitions.ts](D:/Nucleas/nucleas/src/lib/ai/tools/definitions.ts), [src/components/ide/IdeChatPane.tsx:782](D:/Nucleas/nucleas/src/components/ide/IdeChatPane.tsx:782), [src/lib/ai/ideCommitPush.ts](D:/Nucleas/nucleas/src/lib/ai/ideCommitPush.ts).

Recommended correction: Clearly label advisory versus executing workflows. Only mark implementation steps complete with actual patch/test evidence from an authorized runner; design that runner separately if desired.

Required regression coverage: Assert that advisory output cannot claim verified execution or a published commit without corresponding backend evidence.

## Recommended remediation sequence

1. **Contain security exposure:** verified GitHub installation ownership, execution-time tool permissions, and hardened browser/network egress.
2. **Protect user work:** fix actual history persistence, preserve full answers/artifacts, guard editor project/file races, and require optimistic concurrency for publishing.
3. **Make completion trustworthy:** strict reviewer acceptance; shared context/output/history limits; explicit truncation/continuation; usable paged repository evidence.
4. **Unify execution reliability:** shared per-attempt accounting, provider-aware fees, renewable fenced leases, absolute deadlines/durable checkpoints, and idempotent requests.
5. **Honor settings and prove behavior:** rule/retry parity, clear Build capabilities, green tests, and desktop/mobile browser regressions.

Each item should land with a regression test that exercises the real boundary it protects. Do not merely change assertions to make tests green.

## Coverage limits / remaining validation

- No live browser regression pass was performed in this audit. Project-switch races, dirty-state UX, long-answer reload behavior, and mobile layouts need browser verification after fixes.
- No production telemetry, Vercel execution logs, GitHub installation inventory, provider invoices, or remote router logs were inspected.
- Security gaps were assessed locally without cross-tenant access attempts or private-address requests. Deployment controls may reduce exploitability but do not replace application checks.
- No inference load test or all-day memory/CPU soak was run. Browser worker concurrency and IDE lifecycle/resource behavior need bounded performance tests.
- A separate authorized execution environment remains necessary for actual repository code execution. Model inference access alone is not execution authorization.
- Dependency vulnerability scanning and a whole-platform penetration test were outside this AI/IDE source audit.

Snapshot: local HEAD a99aa2a plus six pre-existing modified application/test files. Findings should be rechecked against subsequent changes.

