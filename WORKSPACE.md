# Workspace root (don't open a worktree by mistake)

**Open this folder in Cursor** — the repo root that contains `package.json`, `src/`, and `.cursor/`.

If you use **git worktrees**, keep using this root as your main Cursor workspace. If you open a worktree folder (e.g. something like `.../worktrees/nucleas/afl`) as the Cursor workspace, all edits and AI actions will apply there instead of here, which is easy to miss.

**To avoid that:**

- Use **File -> Open Folder** and choose this repo root (e.g. `d:\Nucleas\nucleas` or wherever you cloned it).
- If you use worktrees, open the **main clone** in Cursor, not the worktree folder.
- If Cursor ever "switches" to a different folder, re-open this root so your work stays in the right place.
