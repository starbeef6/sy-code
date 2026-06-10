import { describe, expect, it } from 'vitest';
import { parseCommandLine } from './command-line.js';

describe('parseCommandLine', () => {
  it('splits a bare command', () => {
    expect(parseCommandLine('codex')).toEqual({ command: 'codex', args: [] });
  });

  it('preserves quoted arguments', () => {
    expect(parseCommandLine('mycli --flag "a b" \'c d\'')).toEqual({
      command: 'mycli',
      args: ['--flag', 'a b', 'c d'],
    });
  });

  it('supports empty quoted arguments', () => {
    expect(parseCommandLine('mycli ""')).toEqual({ command: 'mycli', args: [''] });
  });

  it('rejects unmatched quotes', () => {
    expect(() => parseCommandLine('mycli "oops')).toThrow(/unmatched quote/);
  });

  it('rejects an empty command', () => {
    expect(() => parseCommandLine('   ')).toThrow(/must not be empty/);
  });
});
