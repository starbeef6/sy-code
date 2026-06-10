import { spawn } from 'child_process';
import type { Invocation } from '../agents/types.js';
import { buildAgentEnv } from '../env/resolver.js';

export interface ProcessHooks {
  onStdout: (chunk: string) => void;
  onStderr: (chunk: string) => void;
  onExit: (code: number | null, signal: string | null) => void;
  onError: (error: Error) => void;
}

export interface ProcessHandle {
  pid: number | null;
  /** Terminate the process tree (SIGTERM, then SIGKILL after a grace period). */
  cancel: () => void;
}

export interface ProcessRunner {
  start(invocation: Invocation, hooks: ProcessHooks): ProcessHandle;
}

const KILL_GRACE_MS = 2000;

function killProcessTree(pid: number): void {
  // The child is a process-group leader (detached), so signalling -pid hits the
  // whole tree. Fall back to the bare pid if the group signal is unavailable.
  const signalGroup = (signal: NodeJS.Signals): void => {
    try {
      process.kill(-pid, signal);
    } catch {
      try {
        process.kill(pid, signal);
      } catch {
        // Already gone.
      }
    }
  };

  signalGroup('SIGTERM');
  setTimeout(() => signalGroup('SIGKILL'), KILL_GRACE_MS).unref();
}

export class RealProcessRunner implements ProcessRunner {
  start(invocation: Invocation, hooks: ProcessHooks): ProcessHandle {
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      env: buildAgentEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    });

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => hooks.onStdout(chunk));
    child.stderr?.on('data', (chunk: string) => hooks.onStderr(chunk));
    child.on('error', (error) => hooks.onError(error));
    child.on('close', (code, signal) => hooks.onExit(code, signal));

    // Feed the prompt via stdin, then close so the CLI stops waiting for input.
    if (child.stdin) {
      child.stdin.on('error', () => {
        // Ignore EPIPE if the child exits before consuming stdin.
      });
      if (invocation.stdin !== undefined) child.stdin.write(invocation.stdin);
      child.stdin.end();
    }

    let cancelled = false;
    return {
      pid: child.pid ?? null,
      cancel: () => {
        if (cancelled) return;
        cancelled = true;
        if (child.pid !== undefined) killProcessTree(child.pid);
      },
    };
  }
}
