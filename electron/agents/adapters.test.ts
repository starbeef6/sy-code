import { describe, expect, it } from 'vitest';
import { createClaudeAdapter } from './claude-adapter.js';
import { createGeminiAdapter } from './gemini-adapter.js';
import { createCodexAdapter } from './codex-adapter.js';
import { createGenericAdapter } from './generic-adapter.js';
import type { InvocationInput } from './types.js';

const base: InvocationInput = {
  prompt: '整理数据',
  workDir: '/task/claude-code',
  accessRoot: '/task',
  autonomy: 'safe',
};

describe('claude adapter', () => {
  const adapter = createClaudeAdapter('/bin/claude');

  it('feeds the prompt via stdin and grants the task root', () => {
    const inv = adapter.buildInvocation(base);
    expect(inv.command).toBe('/bin/claude');
    expect(inv.args).toEqual([
      '-p',
      '--output-format',
      'text',
      '--permission-mode',
      'default',
      '--add-dir',
      '/task',
    ]);
    expect(inv.stdin).toBe('整理数据');
    expect(inv.cwd).toBe('/task/claude-code');
  });

  it('maps autonomy modes to permission flags', () => {
    expect(adapter.buildInvocation({ ...base, autonomy: 'auto-edit' }).args).toContain('acceptEdits');
    expect(adapter.buildInvocation({ ...base, autonomy: 'full-auto' }).args).toContain(
      '--dangerously-skip-permissions',
    );
  });

  it('passes model and resume when provided', () => {
    const inv = adapter.buildInvocation({ ...base, model: 'opus', resumeSessionId: 'abc' });
    expect(inv.args).toEqual(expect.arrayContaining(['--model', 'opus', '--resume', 'abc']));
  });
});

describe('gemini→antigravity (agy) adapter', () => {
  const adapter = createGeminiAdapter('/bin/agy');

  it('passes the prompt via -p and adds the access root with --add-dir', () => {
    const inv = adapter.buildInvocation({ ...base, workDir: '/task/gemini-cli' });
    expect(inv.command).toBe('/bin/agy');
    // "safe" autonomy → no auto-approve flag (agy prompts by default).
    expect(inv.args).toEqual(['-p', '整理数据', '--add-dir', '/task']);
    expect(inv.stdin).toBeUndefined();
    expect(inv.cwd).toBe('/task/gemini-cli');
  });

  it('maps full-auto to --dangerously-skip-permissions', () => {
    expect(adapter.buildInvocation({ ...base, autonomy: 'full-auto' }).args).toContain(
      '--dangerously-skip-permissions',
    );
  });
});

describe('codex adapter', () => {
  const adapter = createCodexAdapter('/bin/codex');

  it('reads from stdin and roots its cwd at the access root', () => {
    const inv = adapter.buildInvocation({ ...base, workDir: '/task/codex-cli' });
    expect(inv.command).toBe('/bin/codex');
    expect(inv.args).toEqual([
      'exec',
      '-',
      '--cd',
      '/task',
      '--skip-git-repo-check',
      '--color',
      'never',
      '--sandbox',
      'read-only',
    ]);
    expect(inv.stdin).toBe('整理数据');
    expect(inv.cwd).toBe('/task');
  });

  it('maps autonomy modes to sandbox flags', () => {
    expect(adapter.buildInvocation({ ...base, autonomy: 'auto-edit' }).args).toContain('workspace-write');
    expect(adapter.buildInvocation({ ...base, autonomy: 'full-auto' }).args).toContain(
      '--dangerously-bypass-approvals-and-sandbox',
    );
  });
});

describe('generic adapter', () => {
  it('runs the parsed command verbatim and feeds the prompt on stdin', () => {
    const adapter = createGenericAdapter('custom-1', 'My CLI', '/bin/mycli', ['--flag']);
    const inv = adapter.buildInvocation({ ...base, workDir: '/task/custom' });
    expect(inv.command).toBe('/bin/mycli');
    expect(inv.args).toEqual(['--flag']);
    expect(inv.stdin).toBe('整理数据');
    expect(inv.cwd).toBe('/task/custom');
  });
});
