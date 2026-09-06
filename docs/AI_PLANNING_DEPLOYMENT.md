# Remote planning deployment

## Secrets stay in Vercel

Keep only `NUCLEAS_AI_REMOTE_BEARER_TOKEN` and the existing `CRON_SECRET` as AI-related server environment secrets. The cron secret is shared with other scheduled routes: do not replace it with the model token. Never expose either through `NEXT_PUBLIC_` or source control.

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

The existing Vercel cron invokes `/api/cron/ai-planning` every five minutes; confirm your deployment supports that interval and the configured 300-second function. Each invocation processes at most one model call, with a six-minute lease and two-minute gateway deadline. This is bounded pilot throughput, not a scalable execution service.

Use a synthetic objective first, without client/repository/secret data. Confirm it queues, becomes a reviewable draft, and creates no tasks until a manager explicitly approves. Verify replay, cancellation and stale-project rejection before sending real context.

Models run on the remote endpoint; the dispatcher runs on Vercel. No local model, persistent local worker or shell execution is enabled. No authenticated model request or live deployment verification has been performed by this implementation.

## Pause and rollback

Run history is available from the project planning page or `/workspace/projects/<id>/ai/runs`; select a run to inspect recorded events, usage, reservations and plan evidence. History and cancellation are available even when new planning is disabled. Only project-authorized viewers can read it and managers can cancel. These pages do not poll: use Refresh for newer state. They never expose prompt bodies or worker lease tokens. Organization/project reservations represent the same call against two limits, not two provider charges.

Turn off **Process queued AI requests** in Admin → AI Settings. To disable the planning page too, turn off planning in the same save. These database settings are rechecked, not tied to a deployment environment snapshot. An already-dispatched remote request may continue; changed policy blocks acceptance at subsequent checks. Cancellation does not promise provider-side termination.

Preserve run/audit records and investigate unknown costs before releasing reservations. Human task routes remain available. Do not roll back to the former environment-backed implementation without checking its old flags.

## Local tests

`npm test -- --maxWorkers=2` includes real transactions against a temporary localhost MongoDB replica set with synthetic data and mocked inference. First execution downloads/caches a MongoDB binary. The temporary database is removed afterward; the binary cache remains. No production credentials are required by these integration tests.
