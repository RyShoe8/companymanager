# Artifact review groundwork

Durable artifact/review/acceptance storage, authenticated review submission, scoped read APIs and project artifact screens are implemented. The acceptance transaction can complete the exact existing task only after verified execution, a current passed review, and human manager approval. All artifacts currently enter storage as unverified; no production code can promote them to verified, so actual coding-task acceptance remains fail-closed. No code execution or reviewer invocation is enabled. Current inference-only planning is unchanged.

An artifact review binds organization, project, task, run, exact repository commit, artifact SHA-256 digest, criteria digest and policy digest. Reviews require a separate worker/reviewer identity, bounded evidence references, cited findings, a verdict, review time and expiry. A passed review cannot contain blocking findings.

Human acceptance references the exact review and artifact binding. The pure validator rejects expired/future reviews, decisions predating review, consumed decisions, changed evidence binding, incorrect principals, failed reviews and self-review. Schemas reject unknown fields and unsupported protocol versions.

## Required integration gates

- Authorize a remote sandbox and register its worker identity. The internal artifact storage function currently treats supplied worker/commit metadata as unverified; it is not an upload endpoint or proof of execution.
- Integrate an independently authenticated reviewer invocation. The review endpoint validates current service credentials/grants and exact stored bindings, but separate IDs alone do not establish independent execution.
- Verify repository commit and required tests against authoritative sandbox attestations for the exact stored bytes. SHA-256 patch/evidence digests, current criteria/policy checks and immutable application records are already implemented; none establish test truth.
- Recheck required test evidence and enforce the sandbox boundary before execution. This schema validates references, not test truth or code safety.
- Keep publication and deployment separately authorized. No remote sandbox is selected or enabled by these contracts.

Artifacts store at most 1 MiB of patch bytes and 20 evidence entries of at most 64 KiB each. Lists are scoped and bounded to 25 records/page; details exclude raw bytes and have no polling. Screens display bindings, evidence digests, findings and acceptance state. The on-demand patch/evidence viewer loads one selection and displays at most 16,384 characters per page as escaped React text, never HTML or executable links. Every content request rechecks project access and verifies the complete selected bytes against their stored SHA-256 digest. Invalid UTF-8 is rejected. Closing or changing artifacts clears the viewer; pages replace rather than accumulate content. Rich diff formatting and browser-interaction verification remain open.

Acceptance rechecks current manager membership, reviewer credential/grant authority, stored-byte integrity, current task/project version and policy, then atomically consumes one acceptance per run alongside task completion and a run event. Concurrent repeats return the same acceptance, preserving human assignments. Temporary database tests alone simulate verified execution using a guarded test-only database update; that is not an attestation implementation. Identical review submissions now acknowledge the existing current review without adding another review/event. Changed payloads or grants conflict; replay still rechecks current credentials, grants, issuer, policy, expiry and run state. Cancelled or superseded runs cannot replay a review. This is bounded current-authority replay handling, not permission to retry indefinitely after expiry/revocation.

The original roadmap remains unchanged. Worker registration, sandbox execution/attestation, actual reviewer invocation, independent evidence verification and end-to-end integration remain open. Publication/deployment remain separate permissions. Application immutability does not protect against privileged native database writes.
