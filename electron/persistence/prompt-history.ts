import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { PROMPT_HISTORY_PATH, prepareTaskFolder } from '../task/task-folder.js';
import type { RunRecord } from '../ipc/contracts.js';

export interface PromptHistoryInput {
  dispatchId: string;
  userText: string;
  uploadedPaths: string[];
  autonomy: string;
  targetAgents: string[];
  sentTexts: string[];
  runs: RunRecord[];
}

/**
 * Append one dispatch entry to the task-level prompt history (append-only).
 * Records *intent + pointers* at dispatch time; the authoritative per-run
 * outcome lives in each run's `meta.json`.
 */
export async function appendPromptHistory(
  taskFolder: string,
  input: PromptHistoryInput,
): Promise<string> {
  prepareTaskFolder(taskFolder);
  const historyPath = path.join(taskFolder, PROMPT_HISTORY_PATH);
  const entry = {
    id: randomUUID(),
    dispatchId: input.dispatchId,
    createdAt: new Date().toISOString(),
    taskFolder,
    userText: input.userText,
    uploadedPaths: input.uploadedPaths,
    autonomy: input.autonomy,
    targetAgents: input.targetAgents,
    sentTexts: input.sentTexts,
    perAgentResults: input.runs.map((run) => ({
      runId: run.runId,
      agentId: run.agentId,
      agentName: run.agentName,
      status: run.status,
      exitCode: run.exitCode,
      logPaths: run.logPaths,
    })),
  };

  await fs.promises.appendFile(historyPath, `${JSON.stringify(entry)}\n`, 'utf8');
  return historyPath;
}
