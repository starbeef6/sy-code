import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { createArenaWorktree, getChangedFiles, removeWorktree } from './git.js';

const tempRoots: string[] = [];

function makeTempRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sy-code-arena-empty-'));
  tempRoots.push(root);
  const repoRoot = path.join(root, 'repo');
  execFileSync('git', ['init', '-b', 'main', repoRoot], { stdio: 'ignore' });
  return repoRoot;
}

function makeTempGitFileRepo(): string {
  const repoRoot = makeTempRepo();
  const gitDir = path.join(path.dirname(repoRoot), 'external-gitdir');
  fs.renameSync(path.join(repoRoot, '.git'), gitDir);
  fs.writeFileSync(path.join(repoRoot, '.git'), `gitdir: ${gitDir}\n`);
  return repoRoot;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('createArenaWorktree', () => {
  it('falls back to an isolated repo copy for repositories with no commits', async () => {
    const repoRoot = makeTempRepo();
    fs.writeFileSync(path.join(repoRoot, 'README.md'), 'hello\n');
    fs.mkdirSync(path.join(repoRoot, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'node_modules', 'pkg.txt'), 'cached dependency\n');

    const created = await createArenaWorktree(repoRoot, 'arena/test-1', ['node_modules']);

    expect(created.mergeSupported).toBe(false);
    expect(created.path).toBe(path.join(repoRoot, '.worktrees', 'arena/test-1'));
    expect(fs.existsSync(created.path)).toBe(true);
    expect(fs.lstatSync(path.join(created.path, 'node_modules')).isSymbolicLink()).toBe(true);

    const head = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
      cwd: created.path,
      encoding: 'utf8',
    }).trim();
    expect(head).toHaveLength(40);

    const baselineStatus = execFileSync('git', ['status', '--short'], {
      cwd: created.path,
      encoding: 'utf8',
    }).trim();
    expect(baselineStatus).toBe('');

    fs.writeFileSync(path.join(created.path, 'README.md'), 'hello\nworld\n');
    const changed = await getChangedFiles(created.path);
    expect(changed.some((file) => file.path === 'README.md')).toBe(true);

    await removeWorktree(repoRoot, 'arena/test-1', true);
    expect(fs.existsSync(created.path)).toBe(false);
  });

  it('does not copy a source gitdir file into the arena sandbox', async () => {
    const repoRoot = makeTempGitFileRepo();
    fs.writeFileSync(path.join(repoRoot, 'README.md'), 'hello\n');

    const created = await createArenaWorktree(repoRoot, 'arena/test-gitfile', []);

    const sandboxGitEntry = path.join(created.path, '.git');
    expect(fs.lstatSync(sandboxGitEntry).isDirectory()).toBe(true);

    const resolvedGitDir = execFileSync('git', ['rev-parse', '--git-dir'], {
      cwd: created.path,
      encoding: 'utf8',
    }).trim();
    expect(resolvedGitDir).toBe('.git');

    await removeWorktree(repoRoot, 'arena/test-gitfile', true);
    expect(fs.existsSync(created.path)).toBe(false);
  });
});
