import type { AutonomyMode, RunRecord, RunStatus } from '../../electron/ipc/contracts';

export type { AutonomyMode, RunRecord, RunStatus };

export type HubScreen = 'home' | 'ai-select' | 'workspace';

export interface HubAgentConfig {
  id: string;
  name: string;
  command: string;
  folderName: string;
  defaultChecked: boolean;
  isCustom?: boolean;
  available?: boolean;
}

/** One entry in the home screen's quick-open list of recent task folders. */
export interface HubRecentTask {
  taskFolder: string;
  taskName: string;
  lastOpenedAt: number;
}

export interface HubPreferences {
  taskRoot: string;
  taskRootLocked: boolean;
  agentConfigLocked: boolean;
  aiConfigs: HubAgentConfig[];
  recentTasks: HubRecentTask[];
}

export interface HubTaskContext {
  taskFolder: string;
  inputDir: string;
  taskName: string;
}

/**
 * The workspace view of a single agent. Points at its latest run by id; the
 * run record and live log live in id-keyed stores so streamed events that
 * arrive before the dispatch response is bound are never lost.
 */
export interface HubAgentRunView {
  configId: string;
  agentId: string;
  name: string;
  folderName: string;
  command: string;
  checked: boolean;
  currentRunId: string | null;
}

/** A view joined with its current run + live log + resolved output dir. */
export interface HubAgentRunCard {
  configId: string;
  agentId: string;
  name: string;
  folderName: string;
  command: string;
  checked: boolean;
  workDir: string;
  run: RunRecord | null;
  log: string;
}

export interface HubNotice {
  kind: 'info' | 'success' | 'error';
  message: string;
}
