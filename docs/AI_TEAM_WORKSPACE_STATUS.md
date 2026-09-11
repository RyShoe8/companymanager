# AI Team workspace — September 10/11 checkpoint

Additive project-scoped AI Team chat + queue platform, plus GitHub publish groundwork (fail-closed). The original control-system roadmap is unchanged. Live remote inference still depends on the friend’s endpoint/Cloudflare path.

## Implemented locally

- `/workspace/ai-team` and `/workspace/ai-team/queue`, linked from the user menu, project AI planning page, mobile bottom nav, and mobile menu tree.
- Four stable role presets: Marketing, Product Manager, Support and Engineering. Selected role survives project switching; roles do not enter human employee/assignee fields.
- **Conversation threads** with `user` / `assistant` / `status` roles. Sending a message persists the user turn, then attempts a real gateway reply via [`teamChat.ts`](../src/lib/ai/teamChat.ts). When inference is disabled or unreachable, a **status** turn is stored—never a simulated agent reply.
- Project context panel shows inference readiness, remote/planning flags, bounded recent objective/run counts, and what context is included (still no repository files).
- Cross-project **task request queue** with employee/status/recurring filters and pagination. Daily/weekly cadence saved as **inactive templates** until a scheduler exists. AI queue items do not mutate human project tasks.
- **GitHub project binding** (`AiProjectRepository`) + GET/PUT repository API + manager UI. **Accept & Open PR** control on artifact detail; publish route is fail-closed until verified artifact + binding + App credentials/install. See [`AI_GITHUB_PUBLISH_CONTRACT.md`](./AI_GITHUB_PUBLISH_CONTRACT.md).
- Admin diagnostic probes explain why Run is disabled (already attempted / loading / in progress); prior results are preserved; no automatic retries.
- Idempotent save keys, payload validation, same-origin mutation checks, additive unique indexes and sanitized API errors.
- Responsive role selection and composer; project switches warn before discarding an unsaved draft.

## Verification

- Full suite: **800 tests / 123 files** passed.
- TypeScript (`tsc --noEmit`): clean.
- Production `npm run build`: succeeded.
- Synthetic browser fixture (`scripts/browser-regressions`) checked at **390px** and **1280px** for chat + queue (local-only; not a production soak).
- Safe `npm audit fix` applied; remaining owned vulns noted in [`DEPENDENCY_AUDIT_NOTES.md`](./DEPENDENCY_AUDIT_NOTES.md).

## Not yet delivered

- Successful authenticated inference against `llm.rogly.net` (blocked on remote infrastructure).
- Live Octokit PR creation (endpoint contract exists; returns `publish_unavailable` when other gates pass).
- Sandbox host / attestation that flips `executionVerified`.
- Streamed conversations, rich document context assembly, conversation→plan conversion.
- Custom/persisted organization AI employee definitions or shared org conversations.
- Automatic employee routing, recurring occurrence generation (timezone/DST), merging AI queue into human task lists.
- Auto-merge to `main`, eight-hour performance soak, and full production browser acceptance.
- Gateway consolidation of legacy estimate/summary/intent callers.

Runtime connection and dispatch remain separate from saving work requests. Do not present unavailable inference as successful agent work. Do not invent pull request URLs.
