import type {
  RunChunkEvent,
  RunExitEvent,
  RunRecord,
  RunStartedEvent,
  RunStatus,
} from '../ipc/contracts.js';
import type { Invocation } from '../agents/types.js';
import type { ProcessHandle, ProcessRunner } from './process-runner.js';
import type { RunStore } from '../persistence/run-store.js';

export type RunEvent =
  | { channel: 'started'; payload: RunStartedEvent }
  | { channel: 'stdout'; payload: RunChunkEvent }
  | { channel: 'stderr'; payload: RunChunkEvent }
  | { channel: 'exit'; payload: RunExitEvent };

export interface RunManagerDeps {
  processRunner: ProcessRunner;
  runStore: RunStore;
  emit: (event: RunEvent) => void;
  /** Per-run wall-clock budget; on expiry the process tree is killed. */
  timeoutMs?: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

export const DEFAULT_RUN_TIMEOUT_MS = 30 * 60_000;

interface ActiveRun {
  record: RunRecord;
  startedAtMs: number;
  handle: ProcessHandle | null;
  timer: ReturnType<typeof setTimeout> | null;
  finished: boolean;
  cancelRequested: boolean;
  timedOut: boolean;
}

/**
 * Owns the lifecycle of every in-flight run: spawns the process, streams its
 * output to disk + renderer, and resolves a terminal status from the OS process
 * exit — never from scraping terminal text.
 */
export class RunManager {
  private readonly active = new Map<string, ActiveRun>();
  private readonly timeoutMs: number;
  private readonly now: () => number;

  constructor(private readonly deps: RunManagerDeps) {
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS;
    this.now = deps.now ?? Date.now;
  }

  /** Begin a run from a prepared record + invocation. Returns a running snapshot. */
  start(record: RunRecord, invocation: Invocation, promptText: string): RunRecord {
    this.deps.runStore.writePrompt(record.logPaths, promptText);

    const startedAtMs = this.now();
    const startedAt = new Date(startedAtMs).toISOString();
    let running: RunRecord = { ...record, status: 'running', startedAt };

    const state: ActiveRun = {
      record: running,
      startedAtMs,
      handle: null,
      timer: null,
      finished: false,
      cancelRequested: false,
      timedOut: false,
    };
    this.active.set(record.runId, state);

    const handle = this.deps.processRunner.start(invocation, {
      onStdout: (chunk) => {
        this.deps.runStore.appendStdout(record.logPaths, chunk);
        this.deps.emit({ channel: 'stdout', payload: { runId: record.runId, chunk } });
      },
      onStderr: (chunk) => {
        this.deps.runStore.appendStderr(record.logPaths, chunk);
        this.deps.emit({ channel: 'stderr', payload: { runId: record.runId, chunk } });
      },
      onExit: (code, signal) => this.finishFromExit(record.runId, code, signal),
      onError: (error) => this.finishFromError(record.runId, error),
    });

    state.handle = handle;
    running = { ...running, pid: handle.pid };
    state.record = running;

    state.timer = setTimeout(() => {
      const current = this.active.get(record.runId);
      if (!current || current.finished) return;
      current.timedOut = true;
      current.handle?.cancel();
    }, this.timeoutMs);
    state.timer.unref?.();

    this.deps.runStore.writeMeta(running);
    const startedEvent: RunStartedEvent = { runId: record.runId, pid: handle.pid, startedAt };
    this.deps.emit({ channel: 'started', payload: startedEvent });
    return running;
  }

  /** Record a run that could not even be spawned (e.g. binary not found). */
  failImmediately(record: RunRecord, reason: string): RunRecord {
    const finishedAt = new Date(this.now()).toISOString();
    const failed: RunRecord = {
      ...record,
      status: 'failed',
      errorReason: reason,
      finishedAt,
      durationMs: 0,
    };
    this.deps.runStore.writeMeta(failed);
    this.deps.emit({
      channel: 'exit',
      payload: {
        runId: record.runId,
        status: 'failed',
        exitCode: null,
        signal: null,
        durationMs: 0,
        errorReason: reason,
      },
    });
    return failed;
  }

  cancel(runId: string): { runId: string; ok: boolean; status: RunStatus } {
    const state = this.active.get(runId);
    if (!state || state.finished) {
      return { runId, ok: false, status: state?.record.status ?? 'cancelled' };
    }
    state.cancelRequested = true;
    state.handle?.cancel();
    return { runId, ok: true, status: 'running' };
  }

  private finishFromExit(runId: string, code: number | null, signal: string | null): void {
    const state = this.active.get(runId);
    if (!state || state.finished) return;
    const status: RunStatus = state.cancelRequested
      ? 'cancelled'
      : state.timedOut
        ? 'timed_out'
        : code === 0
          ? 'succeeded'
          : 'failed';
    const reason =
      status === 'failed'
        ? `agent exited with code ${code ?? 'null'}${signal ? ` (signal ${signal})` : ''}`
        : status === 'timed_out'
          ? 'agent timed out and was terminated'
          : undefined;
    this.finalize(state, { status, exitCode: code, signal, errorReason: reason });
  }

  private finishFromError(runId: string, error: Error): void {
    const state = this.active.get(runId);
    if (!state || state.finished) return;
    this.finalize(state, {
      status: 'failed',
      exitCode: null,
      signal: null,
      errorReason: error.message,
    });
  }

  private finalize(
    state: ActiveRun,
    outcome: { status: RunStatus; exitCode: number | null; signal: string | null; errorReason?: string },
  ): void {
    state.finished = true;
    if (state.timer) clearTimeout(state.timer);
    const finishedAtMs = this.now();
    const durationMs = finishedAtMs - state.startedAtMs;
    const finished: RunRecord = {
      ...state.record,
      status: outcome.status,
      exitCode: outcome.exitCode,
      signal: outcome.signal,
      finishedAt: new Date(finishedAtMs).toISOString(),
      durationMs,
      errorReason: outcome.errorReason,
    };
    state.record = finished;
    this.deps.runStore.writeMeta(finished);
    const exitEvent: RunExitEvent = {
      runId: finished.runId,
      status: finished.status,
      exitCode: finished.exitCode,
      signal: finished.signal,
      durationMs,
      sessionId: finished.sessionId,
      errorReason: finished.errorReason,
    };
    this.deps.emit({ channel: 'exit', payload: exitEvent });
    this.active.delete(finished.runId);
  }
}
