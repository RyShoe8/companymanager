# AI GitHub publish contract

Fail-closed contract for linking a Nucleas project to a GitHub repository and opening a pull request from an accepted, sandbox-verified artifact.

## Product rules

- Remote sandbox (when available) produces the change; **GitHub is the sync point**. Local machines stay current with `git pull` after merge.
- User action this stretch: **Accept** (artifact) then **Open pull request** (one click). Auto-merge to `main` is out of scope.
- Publish mode is **`pull_request` only**.
- No pull request from unverified artifacts (`executionVerified !== true`).
- Accepting a review **does not** open a PR by itself.

## Data model

Collection: `AiProjectRepository` (scoped by `organizationId` + `projectId`).

| Field | Notes |
| --- | --- |
| `host` | `'github'` |
| `owner`, `repo`, `defaultBranch` | Binding path |
| `installationId` | Nullable until GitHub App install is connected |
| `publishMode` | `'pull_request'` |

Do not overload Project social `github` links or `devUrl`.

## APIs

- `GET/PUT /api/projects/[id]/ai/repository` — read/update binding (PUT requires project manager). Validation via `projectRepositorySchema` in [`src/lib/ai/githubPublish.ts`](../src/lib/ai/githubPublish.ts).
- `POST /api/projects/[id]/ai/reviews/[reviewId]/publish` — attempt publish.

### Publish preconditions (ordered)

1. Review accepted
2. Artifact `executionVerified`
3. Repository binding present
4. Server GitHub App credentials configured (`GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY`)
5. `installationId` connected for the binding

Otherwise the handler returns **blocked** with a sanitized reason and **`pullRequestUrl: null`**. It never invents a PR URL.

When all gates pass but Octokit create-ref / create-PR is not wired yet, status remains blocked with `publish_unavailable`.

## Server secrets (env)

Documented for deployment; never sent to the browser:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- (future) webhook secret as needed

## UI

- Project AI panel: repository owner/repo/default branch + connection status (`configured` / `awaiting_app_install` / `github_not_configured`).
- Artifact detail: **Open pull request** after acceptance; surfaces the blocked reason when publish cannot proceed.
