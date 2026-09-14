# Nucleas IDE UI (Phase 1)

Cursor-like IDE surface at `/ide` (top nav **IDE**, immediately left of Workspace).

## Layout

- Left: collapsible file tree (linked GitHub repo)
- Center: file editor + human-approved publish bar
- Right: chat with modes Plan / Build / Research / Marketing

## Project + repo

- Switch among accessible projects (`GET /api/ai/team/projects`)
- Repo binding from `AiProjectRepository` (`GET/PUT /api/projects/[id]/ai/repository`)
- UI fields: owner, repo, default branch, **Installation ID** (IDE header + project AI binding panel)
- No binding / missing App install / missing env → empty tree + CTA (fail-closed)

## Chat modes → employees

| Mode | Employee |
| --- | --- |
| Plan | `product` |
| Build | `engineering` |
| Research | `researcher` |
| Marketing | `marketing` |

Endpoint: `POST /api/projects/[id]/ai/ide/chat` → governed `attemptTeamChatReply` with task rules injected.

## Cost UI

Each completed reply shows **dollars**, never raw tokens:

- Settled `costMicros` → `$X.XX`
- Else reserved amount → `Reserved $X.XX (usage unknown)`
- `noProviderFee` → `$0.00 · no provider fee`

## Task rules

- Model: `AiProjectTaskRule` (`mode`: plan|build|research|marketing|all)
- APIs: `GET/POST /api/projects/[id]/ai/rules`, `PATCH/DELETE .../rules/[ruleId]`
- Enabled rules for `all` + active mode appended to system instructions (bounded)

## Publish (Cursor-style)

1. Edit file in the center pane
2. Review diff
3. One **Approve commit & push**
4. Octokit commits and updates the repository **default branch** (`main` / configured `defaultBranch`)

`POST /api/projects/[id]/ai/ide/publish` requires `confirm: true`, manager access, binding + App install. Never invents commit SHAs or URLs.

Requires `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY`.

## Deferred (not Phase 1)

- Work Spine home / Smart View / collapsing `/workspace/ai-team`
- Support AI as an IDE mode
- Sandbox verification host
- Live browser tools for Research
- Unsupervised / scheduled pushes
