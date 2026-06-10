// Throwaway end-to-end smoke: dispatch a trivial, file-safe prompt to the real
// CLIs via the actual compiled backend, and observe streamed output + exit +
// on-disk run artifacts. Pass agent ids as argv (default: gemini codex).
import os from 'os';
import path from 'path';
import fs from 'fs';
import { dispatchRuns } from '../dist-electron/runner/dispatch.js';
import { RunManager } from '../dist-electron/runner/run-manager.js';
import { RealProcessRunner } from '../dist-electron/runner/process-runner.js';
import { RealRunStore } from '../dist-electron/persistence/run-store.js';
import { createTaskFolder } from '../dist-electron/task/task-folder.js';

const ALL = {
  'claude-code': { name: 'Claude Code', folderName: 'claude-code', command: 'claude' },
  gemini: { name: 'Gemini CLI', folderName: 'gemini-cli', command: 'gemini' },
  codex: { name: 'Codex CLI', folderName: 'codex-cli', command: 'codex' },
};
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['gemini', 'codex'];

const taskRoot = path.join(os.tmpdir(), 'aihub-smoke');
const { taskFolder } = createTaskFolder(taskRoot, `smoke-${Date.now()}`);
console.log('task folder:', taskFolder, '\n');

const runStore = new RealRunStore();
const pending = new Set();
const runManager = new RunManager({
  processRunner: new RealProcessRunner(),
  runStore,
  timeoutMs: 120000,
  emit: (e) => {
    if (e.channel === 'started') {
      pending.add(e.payload.runId);
      console.log(`▶ STARTED ${e.payload.runId.slice(0, 8)} pid=${e.payload.pid}`);
    } else if (e.channel === 'stdout') {
      process.stdout.write(e.payload.chunk);
    } else if (e.channel === 'stderr') {
      process.stderr.write(e.payload.chunk);
    } else if (e.channel === 'exit') {
      pending.delete(e.payload.runId);
      console.log(
        `\n■ EXIT ${e.payload.runId.slice(0, 8)} status=${e.payload.status} code=${e.payload.exitCode} ms=${e.payload.durationMs}${e.payload.errorReason ? ' reason=' + e.payload.errorReason : ''}`,
      );
    }
  },
});

const request = {
  taskFolder,
  userText: '请用一句话中文回答：你好，路线 B 已经跑通。不要创建或修改任何文件。',
  uploadedPaths: [],
  autonomy: 'safe',
  agents: ids.map((id) => ({ agentId: id, configId: id, ...ALL[id] })),
};

const res = dispatchRuns(request, { runManager, runStore });
console.log('dispatched:', res.runs.map((r) => `${r.agentName}=${r.status}`).join(', '), '\n');

const startedAt = Date.now();
const timer = setInterval(() => {
  if (pending.size === 0 || Date.now() - startedAt > 130000) {
    clearInterval(timer);
    console.log('\n--- run artifacts on disk ---');
    for (const r of res.runs) {
      const dir = path.join(r.workDir, 'runs', r.runId);
      try {
        console.log(`${r.agentName}: ${fs.readdirSync(dir).join(', ')}  @ ${dir}`);
      } catch {
        console.log(`${r.agentName}: (no run dir)`);
      }
    }
    setTimeout(() => process.exit(0), 200);
  }
}, 500);
