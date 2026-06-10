import { BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron';
import { listAgents } from './agents.js';
import { IPC } from './channels.js';
import type {
  AutonomyMode,
  DispatchAgentInput,
  DispatchRequest,
} from './contracts.js';
import {
  createTaskFolder,
  ensureDir,
  getDefaultTaskRoot,
  prepareTaskFolder,
  resolveUserPath,
} from '../task/task-folder.js';
import {
  deleteUploadedItem,
  findLatestNonLogFile,
  importUploadedItems,
} from '../task/uploads.js';
import { appendPromptHistory } from '../persistence/prompt-history.js';
import { RealRunStore } from '../persistence/run-store.js';
import { RealProcessRunner } from '../runner/process-runner.js';
import { RunManager, type RunEvent } from '../runner/run-manager.js';
import { dispatchRuns } from '../runner/dispatch.js';
import os from 'os';
import path from 'path';
import { PtyManager } from '../pty/manager.js';
import { buildInteractiveCommand } from '../pty/interactive-command.js';
import { buildOptimizerPrompt, gatherContext, runCodexOptimize } from '../brain/optimizer.js';

const AUTONOMY_MODES: ReadonlySet<string> = new Set<AutonomyMode>(['safe', 'auto-edit', 'full-auto']);

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
}

function validatePath(value: unknown, field: string): asserts value is string {
  assertString(value, field);
  resolveUserPath(value);
}

function parseDispatchRequest(args: unknown): DispatchRequest {
  if (!args || typeof args !== 'object') throw new Error('dispatch payload must be an object');
  const record = args as Record<string, unknown>;
  assertString(record.taskFolder, 'taskFolder');
  assertString(record.userText, 'userText');
  const autonomy = typeof record.autonomy === 'string' ? record.autonomy : 'safe';
  if (!AUTONOMY_MODES.has(autonomy)) throw new Error(`invalid autonomy: ${autonomy}`);
  if (!Array.isArray(record.uploadedPaths)) throw new Error('uploadedPaths must be an array');
  if (!Array.isArray(record.agents) || record.agents.length === 0) {
    throw new Error('agents must be a non-empty array');
  }

  const uploadedPaths = (record.uploadedPaths as unknown[]).map((item, index) => {
    assertString(item, `uploadedPaths[${index}]`);
    return item;
  });

  const agents: DispatchAgentInput[] = (record.agents as unknown[]).map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`agents[${index}] must be an object`);
    const agent = item as Record<string, unknown>;
    assertString(agent.agentId, `agents[${index}].agentId`);
    assertString(agent.configId, `agents[${index}].configId`);
    assertString(agent.name, `agents[${index}].name`);
    assertString(agent.folderName, `agents[${index}].folderName`);
    const command = typeof agent.command === 'string' ? agent.command : '';
    const model =
      typeof agent.model === 'string' && agent.model.trim().length > 0 ? agent.model : undefined;
    return {
      agentId: agent.agentId,
      configId: agent.configId,
      name: agent.name,
      folderName: agent.folderName,
      command,
      model,
    };
  });

  return {
    taskFolder: resolveUserPath(record.taskFolder),
    userText: record.userText,
    uploadedPaths,
    autonomy: autonomy as AutonomyMode,
    agents,
  };
}

/**
 * @param envReady resolves once the login-shell environment has been imported
 * into `process.env` (see `fixEnv` in main.ts). Handlers that probe PATH or
 * spawn CLIs await it, so the window can open before the import finishes.
 */
export function registerAllHandlers(envReady: Promise<void> = Promise.resolve()): PtyManager {
  // Renderer messages go to every open window; each renderer filters by id, so
  // broadcasting is safe and keeps the IPC layer independent of any single
  // window. That matters because handlers are registered exactly once at
  // startup while windows are created/destroyed (e.g. re-opened from the Dock).
  const broadcast = (channel: IPC, payload: unknown): void => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send(channel, payload);
    }
  };

  const runStore = new RealRunStore();
  const channelFor: Record<RunEvent['channel'], IPC> = {
    started: IPC.RunStarted,
    stdout: IPC.RunStdout,
    stderr: IPC.RunStderr,
    exit: IPC.RunExit,
  };
  const runManager = new RunManager({
    processRunner: new RealProcessRunner(),
    runStore,
    emit: (event: RunEvent) => broadcast(channelFor[event.channel], event.payload),
  });

  ipcMain.handle(IPC.ListAgents, async () => {
    await envReady; // availability detection walks the login-shell PATH
    return listAgents();
  });

  ipcMain.handle(IPC.DialogOpen, async (_e, args) => {
    const options = args && typeof args === 'object' ? (args as { directory?: unknown }) : {};
    const result = await dialog.showOpenDialog({
      properties: options.directory === true ? ['openDirectory'] : ['openFile'],
    });
    if (result.canceled) return null;
    return result.filePaths[0] ?? null;
  });

  ipcMain.handle(IPC.OpenPath, async (_e, args) => {
    assertString(args.filePath, 'filePath');
    const error = await shell.openPath(resolveUserPath(args.filePath));
    if (error) throw new Error(error);
  });

  ipcMain.handle(IPC.HubGetBootstrap, () => ({
    defaultTaskRoot: getDefaultTaskRoot(),
    homeDir: os.homedir(),
  }));

  ipcMain.handle(IPC.HubCreateTaskFolder, (_e, args) => {
    assertString(args.taskRoot, 'taskRoot');
    assertString(args.taskName, 'taskName');
    return createTaskFolder(resolveUserPath(args.taskRoot), args.taskName);
  });

  ipcMain.handle(IPC.HubPrepareTaskFolder, (_e, args) => {
    assertString(args.taskFolder, 'taskFolder');
    return prepareTaskFolder(resolveUserPath(args.taskFolder));
  });

  ipcMain.handle(IPC.HubImportUploadedFiles, async (_e, args) => {
    assertString(args.taskFolder, 'taskFolder');
    if (!Array.isArray(args.items)) throw new Error('items must be an array');
    const items = (args.items as unknown[]).map((item: unknown, index: number) => {
      if (!item || typeof item !== 'object') throw new Error(`items[${index}] must be an object`);
      const r = item as { name?: unknown; sourcePath?: unknown; dataBase64?: unknown };
      assertString(r.name, `items[${index}].name`);
      if (r.sourcePath !== undefined) validatePath(r.sourcePath, `items[${index}].sourcePath`);
      if (r.dataBase64 !== undefined && typeof r.dataBase64 !== 'string') {
        throw new Error(`items[${index}].dataBase64 must be a string`);
      }
      return { name: r.name, sourcePath: r.sourcePath as string | undefined, dataBase64: r.dataBase64 };
    });
    return importUploadedItems(resolveUserPath(args.taskFolder), items);
  });

  ipcMain.handle(IPC.HubDeleteUploadedFile, async (_e, args) => {
    assertString(args.taskFolder, 'taskFolder');
    assertString(args.filePath, 'filePath');
    await deleteUploadedItem(resolveUserPath(args.taskFolder), resolveUserPath(args.filePath));
  });

  ipcMain.handle(IPC.HubFindLatestNonLogFile, async (_e, args) => {
    assertString(args.directoryPath, 'directoryPath');
    return findLatestNonLogFile(resolveUserPath(args.directoryPath));
  });

  ipcMain.handle(IPC.RunDispatch, async (_e, args) => {
    await envReady;
    const request = parseDispatchRequest(args);
    return dispatchRuns(request, {
      runManager,
      runStore,
      recordHistory: (taskFolder, entry) => {
        void appendPromptHistory(taskFolder, entry).catch((error) => {
          console.warn('[prompt-history] append failed:', error instanceof Error ? error.message : error);
        });
      },
    });
  });

  ipcMain.handle(IPC.RunCancel, (_e, args) => {
    assertString(args.runId, 'runId');
    return runManager.cancel(args.runId);
  });

  ipcMain.handle(IPC.HubWriteClipboardText, (_e, args) => {
    assertString(args.text, 'text');
    clipboard.writeText(args.text);
  });

  // --- Interactive PTY terminals ---------------------------------------------
  // Tracks the task folder the live terminals belong to, so the (possibly
  // separate-window) brain can gather context without being told the path.
  let currentTaskFolder = getDefaultTaskRoot();

  // PTY output must reach whichever window owns the session — the main window
  // (the 3 terminals) AND the pet window (its live Codex brain). Each terminal
  // filters by sessionId, so broadcasting to all windows is safe. Teardown is
  // owned centrally by main.ts (on before-quit), not tied to a window's close.
  const ptyManager = new PtyManager({
    onData: (sessionId, chunk) => broadcast(IPC.PtyData, { sessionId, chunk }),
    onExit: (sessionId, exitCode, signal) => broadcast(IPC.PtyExit, { sessionId, exitCode, signal }),
  });

  ipcMain.handle(IPC.PtyOpen, async (_e, args) => {
    await envReady; // command resolution + spawn need the login-shell PATH
    assertString(args.agentId, 'agentId');
    assertString(args.command, 'command');
    validatePath(args.workDir, 'workDir');
    const autonomy = typeof args.autonomy === 'string' ? args.autonomy : 'safe';
    if (!AUTONOMY_MODES.has(autonomy)) throw new Error(`invalid autonomy: ${autonomy}`);
    const model =
      typeof args.model === 'string' && args.model.trim().length > 0 ? args.model : undefined;
    const cols = typeof args.cols === 'number' ? args.cols : undefined;
    const rows = typeof args.rows === 'number' ? args.rows : undefined;
    const scope = typeof args.scope === 'string' && args.scope ? args.scope : 'default';
    const reuse = args.reuse === true;
    const workDir = resolveUserPath(args.workDir);
    // Terminal mode may open before any dispatch created the subfolder; node-pty
    // refuses to spawn into a non-existent cwd, so guarantee it exists.
    ensureDir(workDir);
    currentTaskFolder = path.dirname(workDir);

    const { command, args: cmdArgs } = buildInteractiveCommand({
      agentId: args.agentId,
      command: args.command,
      autonomy: autonomy as AutonomyMode,
      model,
      workDir,
    });

    const opts = {
      agentId: args.agentId,
      command,
      args: cmdArgs,
      cwd: workDir,
      cols,
      rows,
      scope,
    };
    if (reuse) {
      const result = ptyManager.attachOrCreate(opts);
      return { ...result.info, scrollback: result.scrollback, attached: result.attached };
    }
    return { ...ptyManager.create(opts), scrollback: '', attached: false };
  });

  ipcMain.handle(IPC.PtyInput, (_e, args) => {
    assertString(args.sessionId, 'sessionId');
    if (typeof args.data !== 'string') throw new Error('data must be a string');
    ptyManager.write(args.sessionId, args.data);
  });

  ipcMain.handle(IPC.PtyResize, (_e, args) => {
    assertString(args.sessionId, 'sessionId');
    if (typeof args.cols !== 'number' || typeof args.rows !== 'number') {
      throw new Error('cols and rows must be numbers');
    }
    ptyManager.resize(args.sessionId, args.cols, args.rows);
  });

  ipcMain.handle(IPC.PtyKill, (_e, args) => {
    assertString(args.sessionId, 'sessionId');
    ptyManager.kill(args.sessionId);
  });

  ipcMain.handle(IPC.PtyPrune, (_e, args) => {
    assertString(args.scope, 'scope');
    if (!Array.isArray(args.keep)) throw new Error('keep must be an array');
    const keep = (args.keep as unknown[]).map((item, index) => {
      if (!item || typeof item !== 'object') throw new Error(`keep[${index}] must be an object`);
      const key = item as Record<string, unknown>;
      assertString(key.agentId, `keep[${index}].agentId`);
      assertString(key.workDir, `keep[${index}].workDir`);
      return { agentId: key.agentId, cwd: resolveUserPath(key.workDir) };
    });
    ptyManager.prune(args.scope, keep);
  });

  // --- Brain / pet coordinator (Codex-powered, read-only over terminals) -----
  function resolveBrainTaskFolder(value: unknown): string {
    return typeof value === 'string' && value.trim() ? resolveUserPath(value) : currentTaskFolder;
  }

  ipcMain.handle(IPC.BrainGather, (_e, args) => {
    const taskFolder = resolveBrainTaskFolder(args?.taskFolder);
    return gatherContext(
      {
        taskFolder,
        includeHistory: args?.includeHistory === true,
        includeTerminals: args?.includeTerminals === true,
      },
      ptyManager,
    );
  });

  ipcMain.handle(IPC.BrainOptimize, async (_e, args) => {
    await envReady;
    const taskFolder = resolveBrainTaskFolder(args?.taskFolder);
    const command =
      typeof args?.command === 'string' && args.command.trim() ? args.command : 'codex';
    const model =
      typeof args?.model === 'string' && args.model.trim().length > 0 ? args.model : undefined;
    const contextText = typeof args?.contextText === 'string' ? args.contextText : '';
    const taskText = typeof args?.taskText === 'string' ? args.taskText : '';
    const prompt = buildOptimizerPrompt(contextText, taskText);
    return runCodexOptimize({ command, taskFolder, prompt, model });
  });

  return ptyManager;
}
