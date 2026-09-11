# Dependency audit notes (GitHub publish groundwork stretch)

Safe `npm audit fix` (no `--force`) applied once. Remaining issues need breaking upgrades or a dedicated TipTap/sharp bump.

## Applied

- Non-breaking lockfile updates from `npm audit fix` (overall reported issues dropped from 49 toward the mid-20s).

## Remaining (owned / deferred)

Do **not** run `npm audit fix --force` in this stretch; it proposes breaking majors (e.g. vitest 5, sharp 0.35).

After safe fix, production (`npm audit --omit=dev`) still reported **25** issues (24 moderate, 1 high), dominated by the TipTap package tree plus deferred high-severity packages that require `--force`.

| Area | Severity | Notes |
| --- | --- | --- |
| TipTap (`@tiptap/*`) | moderate | Transitive; upgrade TipTap in a dedicated PR |
| `sharp` | high | Force would install breaking `0.35.x`; defer with image pipeline check |
| `@vitest/mocker` / `vitest` | moderate | Dev-only; force to vitest 5 deferred |
| `esbuild` | — | Dev-server advisory on Windows when still listed |

Re-check with `npm audit` after major dependency bumps. No secrets were rotated as part of this audit.
