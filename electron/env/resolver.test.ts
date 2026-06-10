import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildAgentEnv,
  buildInteractiveEnv,
  findExecutableOnPath,
  parseCommandLookupOutput,
  resolveCommandForSpawn,
} from './resolver.js';

const tempDirs: string[] = [];

function makeExecutable(name: string): { dir: string; file: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aihub-bin-'));
  tempDirs.push(dir);
  const file = path.join(dir, name);
  fs.writeFileSync(file, '#!/bin/sh\necho hi\n', { mode: 0o755 });
  return { dir, file };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('findExecutableOnPath', () => {
  it('returns an executable file path from PATH', () => {
    const { dir, file } = makeExecutable('mybin');
    expect(findExecutableOnPath('mybin', dir)).toBe(file);
  });

  it('returns null for a name that is not present', () => {
    const { dir } = makeExecutable('present');
    expect(findExecutableOnPath('absent', dir)).toBeNull();
  });
});

describe('parseCommandLookupOutput', () => {
  it('ignores shell startup noise and keeps the final line', () => {
    const output = 'Last login: today\nRestored session: foo\n/opt/homebrew/bin/gemini\n';
    expect(parseCommandLookupOutput(output)).toBe('/opt/homebrew/bin/gemini');
  });
});

describe('resolveCommandForSpawn', () => {
  it('keeps absolute commands unchanged', () => {
    expect(resolveCommandForSpawn('/usr/bin/env')).toBe('/usr/bin/env');
  });

  it('throws a clear error for a missing bare command', () => {
    expect(() => resolveCommandForSpawn('definitely-not-a-real-binary-xyz')).toThrow(/not found/);
  });
});

describe('buildAgentEnv', () => {
  it('disables color and preserves ordinary user vars', () => {
    const env = buildAgentEnv({}, { PATH: '/usr/bin', HOME: '/Users/x' });
    expect(env.NO_COLOR).toBe('1');
    expect(env.FORCE_COLOR).toBe('0');
    expect(env.PATH).toBe('/usr/bin');
    expect(env.HOME).toBe('/Users/x');
  });

  it('always strips CLAUDE_CODE_* and CLAUDECODE session leakage', () => {
    const env = buildAgentEnv(
      {},
      { CLAUDE_CODE_ENTRYPOINT: 'claude-desktop', CLAUDE_CODE_SESSION_ID: 'abc', CLAUDECODE: '1' },
    );
    expect(env.CLAUDE_CODE_ENTRYPOINT).toBeUndefined();
    expect(env.CLAUDE_CODE_SESSION_ID).toBeUndefined();
    expect(env.CLAUDECODE).toBeUndefined();
  });

  it('strips injected ANTHROPIC routing vars when a Claude session marker is present', () => {
    const env = buildAgentEnv(
      {},
      {
        CLAUDE_CODE_ENTRYPOINT: 'claude-desktop',
        ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
        ANTHROPIC_AUTH_TOKEN: 'sk-leaked',
        ANTHROPIC_MODEL: 'deepseek-v4-pro',
      },
    );
    expect(env.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
    expect(env.ANTHROPIC_MODEL).toBeUndefined();
  });

  it('keeps ANTHROPIC vars a user set deliberately (no Claude session marker)', () => {
    const env = buildAgentEnv(
      {},
      { ANTHROPIC_BASE_URL: 'https://my-proxy.example', ANTHROPIC_API_KEY: 'sk-mine' },
    );
    expect(env.ANTHROPIC_BASE_URL).toBe('https://my-proxy.example');
    expect(env.ANTHROPIC_API_KEY).toBe('sk-mine');
  });
});

describe('buildInteractiveEnv', () => {
  it('enables color and advertises a terminal type', () => {
    const env = buildInteractiveEnv({}, { PATH: '/usr/bin' });
    expect(env.TERM).toBe('xterm-256color');
    expect(env.COLORTERM).toBe('truecolor');
    expect(env.FORCE_COLOR).toBeUndefined();
  });

  it('drops any inherited NO_COLOR so TUI styling is not suppressed', () => {
    const env = buildInteractiveEnv({}, { NO_COLOR: '1', PATH: '/usr/bin' });
    expect(env.NO_COLOR).toBeUndefined();
  });

  it('still scrubs Claude-session leakage like the one-shot env', () => {
    const env = buildInteractiveEnv(
      {},
      { CLAUDE_CODE_ENTRYPOINT: 'claude-desktop', ANTHROPIC_BASE_URL: 'https://api.anthropic.com' },
    );
    expect(env.CLAUDE_CODE_ENTRYPOINT).toBeUndefined();
    expect(env.ANTHROPIC_BASE_URL).toBeUndefined();
  });
});
