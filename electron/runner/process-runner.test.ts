import { describe, expect, it } from 'vitest';
import { RealProcessRunner } from './process-runner.js';

describe('RealProcessRunner (integration)', () => {
  it('streams stdin through to stdout and exits cleanly', async () => {
    const runner = new RealProcessRunner();
    const output = await new Promise<{ out: string; code: number | null }>((resolve, reject) => {
      let out = '';
      runner.start(
        { command: '/bin/cat', args: [], stdin: 'hello world\n', cwd: process.cwd() },
        {
          onStdout: (chunk) => (out += chunk),
          onStderr: () => undefined,
          onExit: (code) => resolve({ out, code }),
          onError: reject,
        },
      );
    });
    expect(output.code).toBe(0);
    expect(output.out).toContain('hello world');
  });

  it('terminates a long-running process when cancelled', async () => {
    const runner = new RealProcessRunner();
    const result = await new Promise<{ code: number | null; signal: string | null }>(
      (resolve, reject) => {
        const handle = runner.start(
          { command: '/bin/sleep', args: ['30'], cwd: process.cwd() },
          {
            onStdout: () => undefined,
            onStderr: () => undefined,
            onExit: (code, signal) => resolve({ code, signal }),
            onError: reject,
          },
        );
        setTimeout(() => handle.cancel(), 100);
      },
    );
    // Killed by signal => non-clean exit (code null + signal, or non-zero).
    expect(result.code === null || result.code !== 0).toBe(true);
  });
});
