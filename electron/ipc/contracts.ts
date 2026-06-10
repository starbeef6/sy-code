// Shared, node-agnostic IPC contracts.
// Imported by both the Electron main process (NodeNext) and the SolidJS
// renderer (bundler). Keep this file free of any `node` or `dom` specific
// types so it resolves cleanly on both sides.

export type AutonomyMode = 'safe' | 'auto-edit' | 'full-auto';

export type RunStatus =
  | 'queued'
  | 'spawning'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export interface RunLogPaths {
  prompt: string;
  stdout: string;
  stderr: string;
  meta: string;
}

/** One execution of one agent. Fully serializable across the IPC boundary. */
export interface RunRecord {
  runId: string;
  dispatchId: string;
  agentId: string;
  agentName: string;
  folderName: string;
  workDir: string;
  autonomy: AutonomyMode;
  status: RunStatus;
  command: string;
  args: string[];
  pid: number | null;
  exitCode: number | null;
  signal: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  sessionId?: string;
  errorReason?: string;
  logPaths: RunLogPaths;
}

// ---- Renderer → Main (invoke) ----

export interface DispatchAgentInput {
  agentId: string;
  configId: string;
  name: string;
  folderName: string;
  /** Raw command line (used only for custom/unknown agents). */
  command: string;
  model?: string;
}

export interface DispatchRequest {
  taskFolder: string;
  userText: string;
  uploadedPaths: string[];
  autonomy: AutonomyMode;
  agents: DispatchAgentInput[];
}

export interface DispatchResponse {
  dispatchId: string;
  runs: RunRecord[];
}

export interface CancelResponse {
  runId: string;
  ok: boolean;
  status: RunStatus;
}

// ---- Main → Renderer (webContents.send) ----

export interface RunStartedEvent {
  runId: string;
  pid: number | null;
  startedAt: string;
}

export interface RunChunkEvent {
  runId: string;
  /** 'stdout' | 'stderr' is encoded by the channel name; this is the text. */
  chunk: string;
}

export interface RunExitEvent {
  runId: string;
  status: RunStatus;
  exitCode: number | null;
  signal: string | null;
  durationMs: number | null;
  sessionId?: string;
  errorReason?: string;
}
