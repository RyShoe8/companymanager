# Scoped service identity groundwork

Durable identity/grant storage, administrator registration and rotation, bearer authentication, and a transactional authorization primitive are implemented. Admin → AI Settings → Service identities provides disabled-by-default registration, one-time credential issuance, activation, disablement, permanent revocation, and five-minute run-grant issuance/revocation with bounded history. Current remote planning dispatch remains unchanged; this is not worker registration or execution enablement.

A current identity record specifies organization, role, active/disabled/revoked state and credential version. A grant binds exactly one identity, organization, project, run, operation, policy digest, revision and validity window. Supported operations are deliberately limited to `planning.infer` for architects and `artifact.review` for reviewers. There is no wildcard, shell, filesystem, task-completion, publication or deployment capability.

The validator requires an authenticated service principal with the current credential version and a matching active identity/grant. It rejects scope changes, revocation, stale revisions, changed policies, expiry, future issuance and unsupported fields. Rotation invalidates principals authenticated under older credential versions. This is authorization logic, not proof that a caller was authenticated.

## Implemented boundaries

Service credentials are distinct from the provider bearer token. Only their SHA-256 hashes are stored, credential fields are excluded from ordinary reads, and audit records contain no secrets. Credentials expire after 30 days. Rotation invalidates older credentials and grants; disablement increments a grant epoch so reactivation cannot revive old authority. Mutations use revision checks and transactional audit writes. Responses are private/no-store, and human administrator mutations require same-origin requests.

Grants bind a single eligible run for at most 15 minutes (the UI requests five). The protected review write rechecks current identity, credential, epoch, grant revision/expiry, issuing administrator, project ownership, run state, and planning policy/stop controls inside its transaction. Identity/grant/run fences contend with concurrent revocation and cancellation. Only `POST /api/ai/services/reviews` currently consumes this authorization primitive; there is no shell/tool endpoint.

## Remaining integration gates

- Select and authorize any remote execution host separately. The friend's inference bearer token grants no execution or platform-service authority.
- Integrate the implemented authentication/authorization primitive into any future runtime operation. Never accept the principal, grant or identity record directly from model or request JSON.
- Bind authorized actions to durable job leases, input versions and operation IDs. This validator is not an idempotency mechanism and does not consume a grant.
- Recheck/consume authority transactionally with consequential domain mutations. Do not rely on a previously validated grant after a policy or credential change.
- Require independently authenticated reviewer assignment and human acceptance for coding results; a reviewer grant cannot complete tasks.

No production credentials or live grants were created during implementation. Temporary database tests use synthetic credentials only. Remote worker registration, lease-bound operation idempotency, sandbox enforcement, dedicated coding policy and end-to-end use remain open. Application-level immutable fields/audit records are not database-administrator-proof WORM storage.
