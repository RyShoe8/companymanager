import { Types } from 'mongoose';
import { listIdeTree, readIdeFile } from '@/lib/ai/ideCommitPush';
import { extractChatHeuristicText } from '@/lib/ai/tools/serverBrowseAssist';

const PATH_HINT =
  /\b(rule|rules|task.?rule|planMode|ideChat|prompt|\.cursor|nucleas|architecture|companyChat|teamChat)\b/i;

const SEED_DIRS = ['', 'src', 'src/lib', 'src/lib/ide', 'src/lib/ai', '.cursor', '.cursor/rules'];

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

  for (const dir of SEED_DIRS) {
    const tree = await listIdeTree(input.organizationId, input.projectId, dir);
    toolsUsed.push('repo_tree');
    if (!tree.ok) {
      if (dir === '') {
        return {
          ok: false,
          note: tree.reason,
          toolsUsed: [...new Set(toolsUsed)],
          contextBlock: [
            'Repository dig (Nucleas):',
            `Note: ${tree.reason}`,
            'No repo tree available. Tell the user to bind a GitHub repository or connect the GitHub App for this project.',
          ].join('\n'),
        };
      }
      continue;
    }
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
  const uniquePaths = [...new Set(candidateFiles.map((c) => c.path))].slice(0, 4);

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
