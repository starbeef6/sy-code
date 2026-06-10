import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { resolveUserPath, sanitizeSegment } from './task-folder.js';

describe('resolveUserPath', () => {
  it('expands tilde paths', () => {
    expect(resolveUserPath('~/AI-Terminal-Hub/tasks')).toBe(
      path.join(os.homedir(), 'AI-Terminal-Hub', 'tasks'),
    );
  });

  it('rejects relative paths', () => {
    expect(() => resolveUserPath('relative/path')).toThrow(/absolute or start with/);
  });
});

describe('sanitizeSegment', () => {
  it('replaces filesystem-illegal characters', () => {
    expect(sanitizeSegment('a/b:c*?', 'fallback')).toBe('a-b-c--');
  });

  it('strips control characters', () => {
    expect(sanitizeSegment('cleanname', 'fallback')).toBe('cleanname');
  });

  it('falls back when the result is empty', () => {
    expect(sanitizeSegment('...', 'agent')).toBe('agent');
  });

  it('keeps CJK names intact', () => {
    expect(sanitizeSegment('督导异常查找', 'fallback')).toBe('督导异常查找');
  });
});
