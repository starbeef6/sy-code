import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunManager, type RunEvent } from './run-manager.js';
import type { ProcessHooks, ProcessRunner } from './process-runner.js';
import type { RunStore } from '../persistence/run-store.js';
import type { Invocation } from '../agents/types.js';
import type { RunRecord } from '../ipc/contracts.js';

class FakeProcessRunner implements ProcessRunner {
  hooks: ProcessHooks | null = null;
  cancelled = false;

  start(_invocation: Invocation, hooks: ProcessHooks) {
    this.hooks = hooks;
    return {
      pid: 4242,
      cancel: () => {
        this.cancelled = true;
      },
    };
  }
}

const noopStore: RunStore = {
  prepareRunDir: () => ({ prompt: 'p', stdout: 'o', stderr: 'e', meta: 'm' }),
  writePrompt: () => undefined,
  appendStdout: () => undefined,
  appendStderr: () => undefined,
  writeMeta: () => undefined,
};

const invocation: Invocation = { command: '/bin/agent', args: [], cwd: '/task/agent' };

function baseRecord(): RunRecord {
  return {
    runId: 'run-1',
    dispatchId: 'dispatch-1',
    agentId: 'claude-code',
    agentName: 'Claude Code',
    folderName: 'claude-code',
    workDir: '/task/claude-code',
    autonomy: 'safe',
    status: 'spawning',
    command: '/bin/agent',
    args: [],
    pid: null,
    exitCode: null,
    signal: null,
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    logPaths: { prompt: 'p', stdout: 'o', stderr: 'e', meta: 'm' },
  };
}

function setup(timeoutMs?: number) {
  const runner = new FakeProcessRunner();
  const events: RunEvent[] = [];
  let clock = 1000;
  const manager = new RunManager({
    processRunner: runner,
    runStore: noopStore,
    emit: (event) => events.push(event),
    now: () => clock,
    timeoutMs,
  });
  return { runner, events, manager, setClock: (value: number) => (clock = value) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('RunManager', () => {
  it('marks a clean exit as succeeded with a measured duration', () => {
    const { runner, events, manager, setClock } = setup();
    const running = manager.start(baseRecord(), invocation, 'prompt');
    expect(running.status).toBe('running');
    expect(running.pid).toBe(4242);
    expect(events.find((e) => e.channel === 'started')).toBeTruthy();

    runner.hooks!.onStdout('hello ');
    runner.hooks!.onStderr('warn');
    setClock(1500);
    runner.hooks!.onExit(0, null);

    const exit = events.find((e) => e.channel === 'exit');
    expect(exit?.payload).toMatchObject({ status: 'succeeded', exitCode: 0, durationMs: 500 });
    expect(events.filter((e) => e.channel === 'stdout')).toHaveLength(1);
    expect(events.filter((e) => e.channel === 'stderr')).toHaveLength(1);
  });

  it('marks a non-zero exit as failed with a reason', () => {
    const { runner, events, manager } = setup();
    manager.start(baseRecord(), invocation, 'prompt');
    runner.hooks!.onExit(2, null);
    const exit = events.find((e) => e.channel === 'exit');
    expect(exit?.payload.status).toBe('failed');
    expect(exit?.payload).toHaveProperty('exitCode', 2);
  });

  it('marks a user cancel as cancelled and kills the process', () => {
    const { runner, events, manager } = setup();
    manager.start(baseRecord(), invocation, 'prompt');
    const result = manager.cancel('run-1');
    expect(result.ok).toBe(true);
    expect(runner.cancelled).toBe(true);
    runner.hooks!.onExit(null, 'SIGTERM');
    expect(events.find((e) => e.channel === 'exit')?.payload.status).toBe('cancelled');
  });

  it('marks a timed-out run as timed_out and kills the process', () => {
    vi.useFakeTimers();
    const { runner, events, manager } = setup(1000);
    manager.start(baseRecord(), invocation, 'prompt');
    vi.advanceTimersByTime(1000);
    expect(runner.cancelled).toBe(true);
    runner.hooks!.onExit(null, 'SIGKILL');
    expect(events.find((e) => e.channel === 'exit')?.payload.status).toBe('timed_out');
  });

  it('reports a spawn error as failed', () => {
    const { runner, events, manager } = setup();
    manager.start(baseRecord(), invocation, 'prompt');
    runner.hooks!.onError(new Error('ENOENT'));
    const exit = events.find((e) => e.channel === 'exit');
    expect(exit?.payload.status).toBe('failed');
    expect(exit?.payload).toHaveProperty('errorReason', 'ENOENT');
  });

  it('failImmediately emits a terminal failed run without spawning', () => {
    const { events, manager } = setup();
    const failed = manager.failImmediately(baseRecord(), 'Command not found: claude');
    expect(failed.status).toBe('failed');
    expect(failed.errorReason).toBe('Command not found: claude');
    expect(events.find((e) => e.channel === 'exit')?.payload.status).toBe('failed');
  });

  it('ignores cancel for an unknown or finished run', () => {
    const { manager } = setup();
    expect(manager.cancel('nope').ok).toBe(false);
  });
});
