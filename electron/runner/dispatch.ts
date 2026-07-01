import { randomUUID } from 'crypto';
import type { DispatchRequest, DispatchResponse, RunRecord } from '../ipc/contracts.js';
import { resolveAdapter } from '../agents/registry.js';
import { ensureAgentWorkDir } from '../task/task-folder.js';
import { ensureAgentInstructions } from '../task/agent-instructions.js';
import { buildWrappedPrompt } from '../task/prompt.js';
import type { RunStore } from '../persistence/run-store.js';
import type { RunManager } from './run-manager.js';

export interface DispatchHistoryEntry {
  dispatchId: string;
  userText: string;
  uploadedPaths: string[];
  autonomy: string;
  targetAgents: string[];
  sentTexts: string[];
  runs: RunRecord[];
}

export interface DispatchDeps {
  runManager: RunManager;
  runStore: RunStore;
  /** Optional sink for the append-only prompt history (best-effort). */
  recordHistory?: (taskFolder: string, entry: DispatchHistoryEntry) => void;
}

/**
 * Fan one user task out to N agents. Each agent gets its own run, started
 * independently — a failure to even build/spawn one agent never aborts the rest.
 */
export function dispatchRuns(request: DispatchRequest, deps: DispatchDeps): DispatchResponse {
  const dispatchId = randomUUID();
  const runs: RunRecord[] = [];
  const sentTexts: string[] = [];

  for (const agent of request.agents) {
    const runId = randomUUID();
    let workDir = '';
    let folderName = agent.folderName;

    try {
      const ensured = ensureAgentWorkDir(request.taskFolder, agent.folderName);
      workDir = ensured.workDir;
      folderName = ensured.folderName;
      ensureAgentInstructions(workDir, agent.agentId);

      const logPaths = deps.runStore.prepareRunDir(workDir, runId);
      const prompt = buildWrappedPrompt({
        workDir,
        userTask: request.userText,
        uploadedPaths: request.uploadedPaths,
      });
      const adapter = resolveAdapter(agent);
      const invocation = adapter.buildInvocation({
        prompt,
        workDir,
        accessRoot: request.taskFolder,
        autonomy: request.autonomy,
        model: agent.model,
      });

      const baseRecord: RunRecord = {
        runId,
        dispatchId,
        agentId: agent.agentId,
        agentName: agent.name,
        folderName,
        workDir,
        autonomy: request.autonomy,
        status: 'spawning',
        command: invocation.command,
        args: invocation.args,
        pid: null,
        exitCode: null,
        signal: null,
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        logPaths,
      };
      runs.push(deps.runManager.start(baseRecord, invocation, prompt));
      sentTexts.push(prompt);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const safeWorkDir = workDir || request.taskFolder;
      const logPaths = deps.runStore.prepareRunDir(safeWorkDir, runId);
      const failedBase: RunRecord = {
        runId,
        dispatchId,
        agentId: agent.agentId,
        agentName: agent.name,
        folderName,
        workDir: safeWorkDir,
        autonomy: request.autonomy,
        status: 'failed',
        command: '',
        args: [],
        pid: null,
        exitCode: null,
        signal: null,
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        logPaths,
      };
      runs.push(deps.runManager.failImmediately(failedBase, reason));
      sentTexts.push('');
    }
  }

  deps.recordHistory?.(request.taskFolder, {
    dispatchId,
    userText: request.userText,
    uploadedPaths: request.uploadedPaths,
    autonomy: request.autonomy,
    targetAgents: request.agents.map((agent) => agent.name),
    sentTexts,
    runs,
  });

  return { dispatchId, runs };
}
