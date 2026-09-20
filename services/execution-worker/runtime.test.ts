import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assertWorkspacePath, runCommand, writeWorkspaceFile } from './runtime';

describe('execution worker runtime', () => {
  it('contains paths and rejects Git metadata', () => {
    const root = path.resolve('sandbox');
    expect(assertWorkspacePath(root, 'src/app.ts')).toBe(path.join(root, 'src', 'app.ts'));
    expect(() => assertWorkspacePath(root, '../secret')).toThrow();
    expect(() => assertWorkspacePath(root, '.git/config')).toThrow();
  });
  it('rejects writes through a symlinked directory', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nucleas-worker-test-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'nucleas-worker-outside-'));
    await mkdir(path.join(root, 'src'));
    await symlink(outside, path.join(root, 'src', 'linked'), 'junction');
    await expect(writeWorkspaceFile(root, 'src/linked/pwned.txt', 'no')).rejects.toThrow(/Symlinked/);
  });
  it('uses argv execution and enforces the executable policy', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nucleas-worker-command-'));
    await expect(runCommand({ cwd: root, argv: ['not-allowed'], timeoutMs: 1000, allowedExecutables: new Set(['node']) })).rejects.toThrow(/not allowed/);
    const result = await runCommand({ cwd: root, argv: [process.execPath, '-e', 'process.stdout.write("ok")'], timeoutMs: 5000, allowedExecutables: new Set(['node']) });
    expect(result).toMatchObject({ exitCode: 0, timedOut: false, output: 'ok' });
  });
  it('does not inherit controller secrets', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nucleas-worker-env-'));
    process.env.NUCLEAS_TEST_CONTROLLER_SECRET = 'must-not-leak';
    try {
      const result = await runCommand({
        cwd: root,
        argv: [process.execPath, '-e', 'process.stdout.write(process.env.NUCLEAS_TEST_CONTROLLER_SECRET ?? "missing")'],
        timeoutMs: 5000,
        allowedExecutables: new Set(['node']),
      });
      expect(result).toMatchObject({ exitCode: 0, timedOut: false, output: 'missing' });
    } finally {
      delete process.env.NUCLEAS_TEST_CONTROLLER_SECRET;
    }
  });
});
