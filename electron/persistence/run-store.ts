import fs from 'fs';
import path from 'path';
import type { RunLogPaths, RunRecord } from '../ipc/contracts.js';

const RUNS_SUBDIR = 'runs';

export interface RunStore {
  /** Create runs/<runId>/ under the agent workDir and return its artifact paths. */
  prepareRunDir(workDir: string, runId: string): RunLogPaths;
  writePrompt(paths: RunLogPaths, text: string): void;
  appendStdout(paths: RunLogPaths, chunk: string): void;
  appendStderr(paths: RunLogPaths, chunk: string): void;
  writeMeta(record: RunRecord): void;
}

export class RealRunStore implements RunStore {
  prepareRunDir(workDir: string, runId: string): RunLogPaths {
    const dir = path.join(workDir, RUNS_SUBDIR, runId);
    fs.mkdirSync(dir, { recursive: true });
    return {
      prompt: path.join(dir, 'prompt.txt'),
      stdout: path.join(dir, 'stdout.log'),
      stderr: path.join(dir, 'stderr.log'),
      meta: path.join(dir, 'meta.json'),
    };
  }

  writePrompt(paths: RunLogPaths, text: string): void {
    safeWrite(() => fs.writeFileSync(paths.prompt, text, 'utf8'));
  }

  appendStdout(paths: RunLogPaths, chunk: string): void {
    safeWrite(() => fs.appendFileSync(paths.stdout, chunk, 'utf8'));
  }

  appendStderr(paths: RunLogPaths, chunk: string): void {
    safeWrite(() => fs.appendFileSync(paths.stderr, chunk, 'utf8'));
  }

  writeMeta(record: RunRecord): void {
    safeWrite(() => fs.writeFileSync(record.logPaths.meta, `${JSON.stringify(record, null, 2)}\n`, 'utf8'));
  }
}

/** Persistence must never crash a run; log failures are non-fatal. */
function safeWrite(action: () => void): void {
  try {
    action();
  } catch (error) {
    console.warn('[run-store] write failed:', error instanceof Error ? error.message : error);
  }
}
