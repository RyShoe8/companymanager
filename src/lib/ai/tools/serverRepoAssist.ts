import { Types } from 'mongoose';
import { listIdeTree, readIdeFile } from '@/lib/ai/ideCommitPush';
import { extractChatHeuristicText } from '@/lib/ai/tools/serverBrowseAssist';

const PATH_HINT =
  /\b(rule|rules|task.?rule|planMode|ideChat|prompt|\.cursor|nucleas|architecture|companyChat|teamChat)\b/i;

/** Short seed list — keep GitHub calls ≤ ~6 (4 trees + 2 reads). */
const SEED_DIRS = ['', 'src/lib/ide', 'src/lib/ai', '.cursor'];
const MAX_FILES = 2;

export type RepoAssistResult = {
  ok: boolean;
  note: string;
  toolsUsed: string[];
  contextBlock: string;
};

function scorePath(path: string, query: string): number {
  let score = 0;
  if (PATH_HINT.test(path)) score += 4;
  const q = query.toLowerCase();
  for (const token of q.split(/\W+/).filter((t) => t.length > 3).slice(0, 12)) {
    if (path.toLowerCase().includes(token)) score += 2;
  }
  if (/\.(ts|tsx|md|mdc)$/i.test(path)) score += 1;
  return score;
}

/** Nucleas-side repo dig for free hosts that struggle with tool calling. */
export async function gatherRepoAssistContext(input: {
  organizationId: string;
  projectId: Types.ObjectId;
  userText: string;
}): Promise<RepoAssistResult> {
  const query = extractChatHeuristicText(input.userText);
  const toolsUsed: string[] = [];
  const candidateFiles: { path: string; score: number }[] = [];
  const treeLines: string[] = [];

  const rootTree = await listIdeTree(input.organizationId, input.projectId, '');
  toolsUsed.push('repo_tree');
  if (!rootTree.ok) {
    return {
      ok: false,
      note: rootTree.reason,
      toolsUsed: [...new Set(toolsUsed)],
      contextBlock: [
        'Repository dig (Nucleas):',
        `Note: ${rootTree.reason}`,
        'No repo tree available. Tell the user to bind a GitHub repository or connect the GitHub App for this project.',
      ].join('\n'),
    };
  }

  const nestedDirs = SEED_DIRS.filter((dir) => dir !== '');
  const nestedTrees = await Promise.all(
    nestedDirs.map(async (dir) => ({
      dir,
      tree: await listIdeTree(input.organizationId, input.projectId, dir),
    }))
  );
  for (const _ of nestedDirs) toolsUsed.push('repo_tree');

  const allTrees: { dir: string; tree: Awaited<ReturnType<typeof listIdeTree>> }[] = [
    { dir: '', tree: rootTree },
    ...nestedTrees,
  ];

  for (const { dir, tree } of allTrees) {
    if (!tree.ok) continue;
    treeLines.push(`Tree path="${dir || '/'}" branch=${tree.branch}:`);
    for (const entry of tree.entries.slice(0, 80)) {
      treeLines.push(`  ${entry.type}\t${entry.path}`);
      if (entry.type === 'file') {
        const score = scorePath(entry.path, query);
        if (score > 0) candidateFiles.push({ path: entry.path, score });
      }
    }
  }

  candidateFiles.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const uniquePaths = [...new Set(candidateFiles.map((c) => c.path))].slice(0, MAX_FILES);

  const fileBlocks: string[] = [];
  for (const path of uniquePaths) {
    const file = await readIdeFile(input.organizationId, input.projectId, path);
    toolsUsed.push('repo_read');
    if (!file.ok) {
      fileBlocks.push(`File ${path}: ${file.reason}`);
      continue;
    }
    fileBlocks.push(`File ${file.path} (branch ${file.branch}):\n${file.content.slice(0, 3500)}`);
  }

  const contextBlock = [
    'Repository dig results (use these; do not invent file contents beyond them):',
    `Query focus: ${query}`,
    treeLines.join('\n').slice(0, 4000),
    fileBlocks.length
      ? fileBlocks.join('\n\n').slice(0, 10000)
      : 'No high-confidence rule/architecture files were read. Use the tree listing and say what is missing.',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 14000);

  return {
    ok: true,
    note: uniquePaths.length ? `Read ${uniquePaths.length} file(s).` : 'Tree only; no scored files.',
    toolsUsed: [...new Set(toolsUsed)],
    contextBlock,
  };
}

export function formatRepoAssistContext(result: RepoAssistResult): string {
  return result.contextBlock;
}
