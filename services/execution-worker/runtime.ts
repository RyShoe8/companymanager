import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { chown, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type CommandEvidence = { command: string[]; exitCode: number | null; timedOut: boolean; output: string };
const OUTPUT_LIMIT = 16_000;

export function assertWorkspacePath(workspace: string, relative: string): string {
  if (!relative || relative.includes('\0') || path.isAbsolute(relative)) throw new Error('Path must be relative.');
  const normalized = path.normalize(relative).replace(/^[.][\\/]/, '');
  if (normalized === '.git' || normalized.startsWith(`.git${path.sep}`) || normalized.split(path.sep).includes('..')) {
    throw new Error('Path escapes the workspace or targets Git metadata.');
  }
  const target = path.resolve(workspace, normalized);
  const root = path.resolve(workspace);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('Path escapes the workspace.');
  return target;
}

async function assertNoSymlinkParent(workspace: string, target: string) {
  let cursor = path.dirname(target);
  const root = await realpath(workspace);
  while (cursor !== root) {
    try {
      if ((await lstat(cursor)).isSymbolicLink()) throw new Error('Symlinked paths are not writable.');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    cursor = path.dirname(cursor);
    if (cursor !== root && !cursor.startsWith(`${root}${path.sep}`)) throw new Error('Path escapes the workspace.');
  }
}

export async function readWorkspaceFile(workspace: string, relative: string): Promise<string> {
  const target = assertWorkspacePath(workspace, relative);
  const stat = await lstat(target);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 256_000) throw new Error('File is unavailable or too large.');
  return readFile(target, 'utf8');
}

export async function writeWorkspaceFile(workspace: string, relative: string, content: string, owner?: { uid: number; gid: number }): Promise<void> {
  if (Buffer.byteLength(content) > 256_000) throw new Error('File exceeds the write limit.');
  const target = assertWorkspacePath(workspace, relative);
  await assertNoSymlinkParent(workspace, target);
  try {
    if ((await lstat(target)).isSymbolicLink()) throw new Error('Symlinked files are not writable.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
  if (owner) await chown(target, owner.uid, owner.gid);
}

export async function setWorkspaceOwner(workspace: string, uid: number, gid: number, excludedDirectoryNames = new Set<string>()): Promise<void> {
  const root = await realpath(workspace);
  async function visit(current: string) {
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) return;
    if (current !== root && stat.isDirectory() && excludedDirectoryNames.has(path.basename(current))) return;
    await chown(current, uid, gid);
    if (!stat.isDirectory()) return;
    for (const entry of await readdir(current)) await visit(path.join(current, entry));
  }
  await visit(root);
}

export async function deleteWorkspaceFile(workspace: string, relative: string): Promise<void> {
  const target = assertWorkspacePath(workspace, relative);
  const stat = await lstat(target);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Only regular files can be deleted.');
  await rm(target, { force: true });
}

export async function runCommand(input: { cwd: string; argv: string[]; timeoutMs: number; allowedExecutables: Set<string>; extraEnv?: Record<string, string>; outputLimit?: number; uid?: number; gid?: number }): Promise<CommandEvidence> {
  if (!input.argv.length || input.argv.length > 33 || input.argv.some((part) => !part || part.length > 500 || /[\r\n\0]/.test(part))) throw new Error('Invalid command arguments.');
  const executable = path.basename(input.argv[0]).toLowerCase().replace(/\.cmd$|\.exe$/, '');
  if (!input.allowedExecutables.has(executable)) throw new Error(`Executable is not allowed: ${executable}`);
  const outputLimit = Math.max(1, Math.min(input.outputLimit ?? OUTPUT_LIMIT, 1_048_577));
  return new Promise((resolve, reject) => {
    let output = '';
    let timedOut = false;
    const child = spawn(input.argv[0], input.argv.slice(1), {
      cwd: input.cwd, shell: false, windowsHide: true,
      env: { PATH: process.env.PATH ?? '', HOME: input.cwd, USERPROFILE: input.cwd, TMPDIR: input.cwd, CI: 'true', NO_COLOR: '1', NODE_ENV: 'test', ...input.extraEnv } as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(process.platform !== 'win32' && input.uid != null && input.gid != null ? { uid: input.uid, gid: input.gid } : {}),
    }) as ChildProcessWithoutNullStreams;
    child.stdin.end();
    const append = (chunk: Buffer) => { if (output.length < outputLimit) output += chunk.toString('utf8').slice(0, outputLimit - output.length); };
    child.stdout.on('data', append); child.stderr.on('data', append); child.once('error', reject);
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, input.timeoutMs);
    child.once('close', (code) => { clearTimeout(timer); resolve({ command: input.argv, exitCode: code, timedOut, output: output.trim().slice(0, outputLimit) }); });
  });
}
