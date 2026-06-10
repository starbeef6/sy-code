import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { IPC } from '../../electron/ipc/channels';
import type {
  DispatchResponse,
  RunChunkEvent,
  RunExitEvent,
  RunRecord,
  RunStartedEvent,
} from '../../electron/ipc/contracts';
import type { AgentDef } from '../ipc/types';
import { invoke, subscribe } from '../lib/ipc';
import { DEFAULT_AGENT_CONFIGS } from './defaults';
import { basenameFromPath } from './path';
import { loadHubPreferences, saveHubPreferences } from './storage';
import type {
  AutonomyMode,
  HubAgentConfig,
  HubAgentRunCard,
  HubAgentRunView,
  HubNotice,
  HubScreen,
  HubTaskContext,
  RunStatus,
} from './types';
import WorkspaceScreen from './WorkspaceScreen';
import TerminalWorkspace, { HUB_TERMINAL_SCOPE, type TerminalAgent } from './TerminalWorkspace';

type WorkspaceMode = 'dispatch' | 'terminal';

interface BootstrapResult {
  defaultTaskRoot: string;
}

interface PreparedTaskFolder {
  taskFolder: string;
  inputDir: string;
}

interface UploadedResult {
  inputDir: string;
  copiedPaths: string[];
}

const LIVE_LOG_CAP = 40_000;
const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set([
  'succeeded',
  'failed',
  'cancelled',
  'timed_out',
]);

function selectionFromConfigs(configs: HubAgentConfig[]): Record<string, boolean> {
  return Object.fromEntries(configs.map((config) => [config.id, config.defaultChecked]));
}

export function runStatusLabel(status: RunStatus | undefined): string {
  switch (status) {
    case 'queued':
      return '排队中';
    case 'spawning':
      return '启动中';
    case 'running':
      return '运行中';
    case 'succeeded':
      return '完成';
    case 'failed':
      return '失败';
    case 'cancelled':
      return '已取消';
    case 'timed_out':
      return '超时';
    default:
      return '未运行';
  }
}

export default function HubApp() {
  const [screen, setScreen] = createSignal<HubScreen>('home');
  const [taskRoot, setTaskRoot] = createSignal('');
  const [taskRootLocked, setTaskRootLocked] = createSignal(true);
  const [agentConfigLocked, setAgentConfigLocked] = createSignal(true);
  const [newTaskName, setNewTaskName] = createSignal('');
  const [currentTask, setCurrentTask] = createSignal<HubTaskContext | null>(null);
  const [aiConfigs, setAiConfigs] = createSignal<HubAgentConfig[]>(DEFAULT_AGENT_CONFIGS);
  const [agentSelection, setAgentSelection] = createSignal<Record<string, boolean>>(
    selectionFromConfigs(DEFAULT_AGENT_CONFIGS),
  );
  const [agentAvailability, setAgentAvailability] = createSignal<Record<string, boolean>>({});
  const [runViews, setRunViews] = createSignal<HubAgentRunView[]>([]);
  const [runStore, setRunStore] = createSignal<Record<string, RunRecord>>({});
  const [logStore, setLogStore] = createSignal<Record<string, string>>({});
  const [uploadedPaths, setUploadedPaths] = createSignal<string[]>([]);
  const [promptText, setPromptText] = createSignal('');
  const [autonomy, setAutonomy] = createSignal<AutonomyMode>('full-auto');
  const [workspaceMode, setWorkspaceMode] = createSignal<WorkspaceMode>('terminal');
  const [lastUserText, setLastUserText] = createSignal('');
  const [notice, setNotice] = createSignal<HubNotice | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [uploading, setUploading] = createSignal(false);
  const [dispatching, setDispatching] = createSignal(false);

  const selectedAgents = createMemo(() =>
    aiConfigs().filter((config) => agentSelection()[config.id] === true),
  );

  const sendTargets = createMemo(() => runViews().filter((view) => view.checked));

  const cards = createMemo<HubAgentRunCard[]>(() => {
    const task = currentTask();
    const runs = runStore();
    const logs = logStore();
    return runViews().map((view) => {
      const run = view.currentRunId ? (runs[view.currentRunId] ?? null) : null;
      const log = view.currentRunId ? (logs[view.currentRunId] ?? '') : '';
      const workDir = run?.workDir ?? (task ? `${task.taskFolder}/${view.folderName}` : view.folderName);
      return {
        configId: view.configId,
        agentId: view.agentId,
        name: view.name,
        folderName: view.folderName,
        command: view.command,
        checked: view.checked,
        workDir,
        run,
        log,
      };
    });
  });

  // Stable across streaming log updates: only changes when the set/identity of
  // checked agents changes, so live terminals are NOT remounted (which would
  // kill their PTY sessions) on every output chunk.
  const terminalAgents = createMemo<TerminalAgent[]>(
    () =>
      cards()
        .filter((card) => card.checked)
        .map((card) => ({
          agentId: card.agentId,
          configId: card.configId,
          name: card.name,
          command: card.command,
          workDir: card.workDir,
        })),
    [],
    {
      equals: (prev, next) =>
        prev.length === next.length &&
        prev.every(
          (agent, index) =>
            agent.configId === next[index].configId &&
            agent.command === next[index].command &&
            agent.workDir === next[index].workDir,
        ),
    },
  );

  function hasElectronRuntime(): boolean {
    return typeof window !== 'undefined' && typeof window.electron?.ipcRenderer?.invoke === 'function';
  }

  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    if (noticeTimer) clearTimeout(noticeTimer);
  });

  function showNotice(kind: HubNotice['kind'], message: string): void {
    if (noticeTimer) clearTimeout(noticeTimer);
    setNotice({ kind, message });
    // Errors stay until dismissed; success/info clear themselves so the banner
    // never piles up permanently on screen.
    if (kind !== 'error') {
      noticeTimer = setTimeout(() => setNotice(null), 4000);
    }
  }

  function dismissNotice(): void {
    if (noticeTimer) clearTimeout(noticeTimer);
    setNotice(null);
  }

  function updateAgentConfig(configId: string, patch: Partial<HubAgentConfig>): void {
    setAiConfigs((current) =>
      current.map((config) => (config.id === configId ? { ...config, ...patch } : config)),
    );
  }

  function addCustomAgent(): void {
    const customId = `custom-${crypto.randomUUID()}`;
    const next: HubAgentConfig = {
      id: customId,
      name: 'Custom AI',
      command: '',
      folderName: 'custom-ai',
      defaultChecked: false,
      isCustom: true,
    };
    setAiConfigs((current) => [...current, next]);
    setAgentSelection((current) => ({ ...current, [customId]: next.defaultChecked }));
  }

  function removeCustomAgent(configId: string): void {
    setAiConfigs((current) => current.filter((config) => config.id !== configId));
    setAgentSelection((current) => {
      const next = { ...current };
      delete next[configId];
      return next;
    });
  }

  function resetWorkspace(): void {
    setRunViews([]);
    setRunStore({});
    setLogStore({});
    setUploadedPaths([]);
    setPromptText('');
    setLastUserText('');
  }

  // ---- streamed run events (main → renderer) ----

  function applyRunPatch(runId: string, patch: Partial<RunRecord>): void {
    setRunStore((current) => {
      const existing = current[runId];
      if (!existing) return current;
      return { ...current, [runId]: { ...existing, ...patch } };
    });
  }

  function appendLog(runId: string, chunk: string): void {
    setLogStore((current) => {
      const next = (current[runId] ?? '') + chunk;
      const capped = next.length > LIVE_LOG_CAP ? next.slice(next.length - LIVE_LOG_CAP) : next;
      return { ...current, [runId]: capped };
    });
  }

  onMount(() => {
    const unsubscribers = [
      subscribe<RunStartedEvent>(IPC.RunStarted, (event) =>
        applyRunPatch(event.runId, { status: 'running', pid: event.pid, startedAt: event.startedAt }),
      ),
      subscribe<RunChunkEvent>(IPC.RunStdout, (event) => appendLog(event.runId, event.chunk)),
      subscribe<RunChunkEvent>(IPC.RunStderr, (event) => appendLog(event.runId, event.chunk)),
      subscribe<RunExitEvent>(IPC.RunExit, (event) =>
        applyRunPatch(event.runId, {
          status: event.status,
          exitCode: event.exitCode,
          signal: event.signal,
          durationMs: event.durationMs,
          sessionId: event.sessionId,
          errorReason: event.errorReason,
        }),
      ),
    ];
    onCleanup(() => unsubscribers.forEach((unsub) => unsub()));
  });

  // ---- task lifecycle ----

  async function prepareSelectedTask(taskFolder: string): Promise<void> {
    if (!hasElectronRuntime()) {
      showNotice('info', '浏览器预览模式下不可操作本地任务文件夹。');
      return;
    }
    const prepared = await invoke<PreparedTaskFolder>(IPC.HubPrepareTaskFolder, { taskFolder });
    setCurrentTask({
      taskFolder: prepared.taskFolder,
      inputDir: prepared.inputDir,
      taskName: basenameFromPath(prepared.taskFolder),
    });
    resetWorkspace();
    setScreen('ai-select');
  }

  async function handleCreateTask(): Promise<void> {
    if (!hasElectronRuntime()) {
      showNotice('info', '浏览器预览模式下不可创建本地任务文件夹。');
      return;
    }
    if (!newTaskName().trim()) {
      showNotice('error', '先输入任务名称。');
      return;
    }

    setBusy(true);
    try {
      const prepared = await invoke<PreparedTaskFolder>(IPC.HubCreateTaskFolder, {
        taskRoot: taskRoot(),
        taskName: newTaskName(),
      });
      setCurrentTask({
        taskFolder: prepared.taskFolder,
        inputDir: prepared.inputDir,
        taskName: basenameFromPath(prepared.taskFolder),
      });
      resetWorkspace();
      setNewTaskName('');
      setScreen('ai-select');
      showNotice('success', '任务文件夹已创建。');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectExistingTask(): Promise<void> {
    if (!hasElectronRuntime()) {
      showNotice('info', '浏览器预览模式下不可选择本地文件夹。');
      return;
    }
    try {
      const selected = await invoke<string | null>(IPC.DialogOpen, { directory: true });
      if (!selected) return;
      await prepareSelectedTask(selected);
      showNotice('success', '已载入已有任务文件夹。');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : String(error));
    }
  }

  function startWorkspace(): void {
    const chosen = selectedAgents();
    if (chosen.length === 0) {
      showNotice('error', '至少勾选一个 AI 才能进入工作区。');
      return;
    }
    setRunViews(
      chosen.map<HubAgentRunView>((config) => ({
        configId: config.id,
        agentId: config.id,
        name: config.name,
        folderName: config.folderName,
        command: config.command,
        checked: true,
        currentRunId: null,
      })),
    );
    setRunStore({});
    setLogStore({});
    setUploadedPaths([]);
    setPromptText('');
    setScreen('workspace');
  }

  // ---- dispatch / cancel / rerun ----

  function bindRunsToViews(targets: HubAgentRunView[], runs: RunRecord[]): void {
    const additions: Record<string, RunRecord> = {};
    const resetLogs: Record<string, string> = {};
    targets.forEach((_target, index) => {
      const run = runs[index];
      if (run) {
        additions[run.runId] = run;
        resetLogs[run.runId] = '';
      }
    });
    setRunStore((current) => ({ ...current, ...additions }));
    setLogStore((current) => ({ ...current, ...resetLogs }));
    setRunViews((current) =>
      current.map((view) => {
        const index = targets.findIndex((target) => target.configId === view.configId);
        if (index === -1) return view;
        const run = runs[index];
        return { ...view, currentRunId: run ? run.runId : view.currentRunId };
      }),
    );
  }

  async function dispatchTo(targets: HubAgentRunView[], userText: string): Promise<void> {
    const task = currentTask();
    if (!task) return;
    setDispatching(true);
    try {
      const response = await invoke<DispatchResponse>(IPC.RunDispatch, {
        taskFolder: task.taskFolder,
        userText,
        uploadedPaths: uploadedPaths(),
        autonomy: autonomy(),
        agents: targets.map((view) => ({
          agentId: view.agentId,
          configId: view.configId,
          name: view.name,
          folderName: view.folderName,
          command: view.command,
        })),
      });
      bindRunsToViews(targets, response.runs);
      setLastUserText(userText);
      const failedNow = response.runs.filter((run) => run.status === 'failed');
      if (failedNow.length > 0) {
        showNotice(
          'error',
          `已派发 ${response.runs.length} 个，其中 ${failedNow.length} 个未能启动：${failedNow
            .map((run) => `${run.agentName}（${run.errorReason ?? '未知原因'}）`)
            .join('、')}`,
        );
      } else {
        showNotice('success', `已派发到 ${response.runs.length} 个 AI。`);
      }
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : String(error));
    } finally {
      setDispatching(false);
    }
  }

  async function dispatchPrompt(): Promise<void> {
    if (dispatching()) return;
    if (!hasElectronRuntime()) {
      showNotice('info', '浏览器预览模式下不可派发到本地 AI CLI。');
      return;
    }
    const userText = promptText().trim();
    if (!userText) {
      showNotice('error', '先输入要派发的统一指令。');
      return;
    }
    const targets = sendTargets();
    if (targets.length === 0) {
      showNotice('error', '当前没有勾选的 AI。');
      return;
    }
    await dispatchTo(targets, userText);
    setPromptText('');
  }

  async function rerunAgent(card: HubAgentRunCard): Promise<void> {
    if (!hasElectronRuntime()) {
      showNotice('info', '浏览器预览模式下不可重跑。');
      return;
    }
    const userText = promptText().trim() || lastUserText();
    if (!userText) {
      showNotice('error', '没有可重跑的指令，请先输入并派发一次。');
      return;
    }
    const view = runViews().find((item) => item.configId === card.configId);
    if (!view) return;
    await dispatchTo([view], userText);
  }

  async function cancelRun(runId: string): Promise<void> {
    if (!hasElectronRuntime()) return;
    try {
      await invoke(IPC.RunCancel, { runId });
    } catch (error) {
      showNotice('error', `取消失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function toggleAgent(configId: string, checked: boolean): void {
    setRunViews((current) =>
      current.map((view) => (view.configId === configId ? { ...view, checked } : view)),
    );
  }

  // ---- uploads ----

  async function handleUpload(files: FileList | null): Promise<string[]> {
    if (!hasElectronRuntime()) {
      showNotice('info', '浏览器预览模式下不可导入本地文件。');
      return [];
    }
    const task = currentTask();
    if (!task || !files || files.length === 0) return [];

    setUploading(true);
    try {
      let skipped = 0;
      const items = Array.from(files).flatMap((file) => {
        const sourcePath = window.electron.getPathForFile(file);
        if (!sourcePath) {
          skipped += 1;
          return [];
        }
        return [{ name: file.name, sourcePath }];
      });

      if (items.length === 0) {
        showNotice('error', '只支持从本地文件系统拖入的文件。');
        return [];
      }

      const result = await invoke<UploadedResult>(IPC.HubImportUploadedFiles, {
        taskFolder: task.taskFolder,
        items,
      });
      setUploadedPaths((current) => Array.from(new Set([...current, ...result.copiedPaths])));
      const skippedText = skipped > 0 ? `，跳过 ${skipped} 个无本地路径的文件` : '';
      showNotice('success', `已导入 ${result.copiedPaths.length} 个文件${skippedText}。`);
      return result.copiedPaths;
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : String(error));
      return [];
    } finally {
      setUploading(false);
    }
  }

  async function copyUploadedFilePath(filePath: string): Promise<void> {
    if (!hasElectronRuntime()) return;
    try {
      await invoke(IPC.HubWriteClipboardText, { text: filePath });
      showNotice('success', `已复制文件路径：${basenameFromPath(filePath)}`);
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : String(error));
    }
  }

  async function removeUploadedFile(filePath: string): Promise<void> {
    if (!hasElectronRuntime()) return;
    const task = currentTask();
    if (!task) return;
    try {
      await invoke(IPC.HubDeleteUploadedFile, { taskFolder: task.taskFolder, filePath });
      setUploadedPaths((current) => current.filter((currentPath) => currentPath !== filePath));
      showNotice('success', `已移除文件：${basenameFromPath(filePath)}`);
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : String(error));
    }
  }

  // ---- output directory actions ----

  function checkedCards(): HubAgentRunCard[] {
    return cards().filter((card) => card.checked);
  }

  async function openAgentPath(card: HubAgentRunCard, shiftKey: boolean): Promise<void> {
    if (!hasElectronRuntime()) return;
    try {
      if (!shiftKey) {
        await invoke(IPC.OpenPath, { filePath: card.workDir });
        return;
      }
      const latestFile = await invoke<string | null>(IPC.HubFindLatestNonLogFile, {
        directoryPath: card.workDir,
      });
      if (!latestFile) {
        showNotice('info', `${card.name} 目录下还没有可打开的非日志文件。`);
        return;
      }
      await invoke(IPC.OpenPath, { filePath: latestFile });
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : String(error));
    }
  }

  async function copySelectedDirectories(): Promise<void> {
    if (!hasElectronRuntime()) return;
    const selected = checkedCards().map((card) => card.workDir);
    if (selected.length === 0) {
      showNotice('error', '当前没有勾选的输出目录。');
      return;
    }
    try {
      await invoke(IPC.HubWriteClipboardText, { text: selected.join('\n') });
      showNotice('success', `已复制 ${selected.length} 个输出目录路径。`);
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : String(error));
    }
  }

  async function copyLatestSelectedFiles(): Promise<void> {
    if (!hasElectronRuntime()) return;
    const selected = checkedCards();
    if (selected.length === 0) {
      showNotice('error', '当前没有勾选的输出目录。');
      return;
    }
    try {
      const latestFiles = await Promise.all(
        selected.map((card) =>
          invoke<string | null>(IPC.HubFindLatestNonLogFile, { directoryPath: card.workDir }),
        ),
      );
      const found = latestFiles.filter(
        (filePath): filePath is string => typeof filePath === 'string' && filePath.length > 0,
      );
      if (found.length === 0) {
        showNotice('error', '当前勾选的 AI 目录里还没有可复制的最新输出文件。');
        return;
      }
      await invoke(IPC.HubWriteClipboardText, { text: found.join('\n') });
      const missingCount = latestFiles.length - found.length;
      const missingText = missingCount > 0 ? `，另有 ${missingCount} 个目录暂时没有文件` : '';
      showNotice('success', `已复制 ${found.length} 个最新输出文件路径${missingText}。`);
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : String(error));
    }
  }

  // ---- bootstrap + persistence ----

  onMount(() => {
    // macOS uses a hiddenInset title bar, so the traffic-light buttons overlay
    // the top-left. Tag the root so CSS can keep the topbar clear of them.
    if (/Mac/i.test(navigator.userAgent)) {
      document.documentElement.classList.add('is-mac');
    }
  });

  onMount(async () => {
    if (!hasElectronRuntime()) {
      const preferences = loadHubPreferences('~/AI-Terminal-Hub/tasks');
      setTaskRoot(preferences.taskRoot);
      setTaskRootLocked(preferences.taskRootLocked);
      setAgentConfigLocked(preferences.agentConfigLocked);
      setAiConfigs(preferences.aiConfigs);
      setAgentSelection(selectionFromConfigs(preferences.aiConfigs));
      showNotice('info', '当前为浏览器预览模式。实际派发、文件拖入和目录操作需要在 Electron 中运行。');
      return;
    }

    try {
      const [bootstrap, agents] = await Promise.all([
        invoke<BootstrapResult>(IPC.HubGetBootstrap),
        invoke<AgentDef[]>(IPC.ListAgents),
      ]);
      const preferences = loadHubPreferences(bootstrap.defaultTaskRoot);
      const availability = Object.fromEntries(agents.map((agent) => [agent.id, agent.available === true]));
      const mergedConfigs = preferences.aiConfigs.map((config) => ({
        ...config,
        available: availability[config.id],
      }));

      setTaskRoot(preferences.taskRoot);
      setTaskRootLocked(preferences.taskRootLocked);
      setAgentConfigLocked(preferences.agentConfigLocked);
      setAiConfigs(mergedConfigs);
      setAgentSelection(selectionFromConfigs(mergedConfigs));
      setAgentAvailability(availability);
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : String(error));
    }
  });

  createEffect(() => {
    const root = taskRoot();
    if (!root) return;
    saveHubPreferences({
      taskRoot: root,
      taskRootLocked: taskRootLocked(),
      agentConfigLocked: agentConfigLocked(),
      aiConfigs: aiConfigs().map((config) => ({
        id: config.id,
        name: config.name,
        command: config.command,
        folderName: config.folderName,
        defaultChecked: config.defaultChecked,
        isCustom: config.isCustom,
      })),
    });
  });

  return (
    <div class="hub-app">
      <header class="hub-topbar">
        <div>
          <p class="hub-kicker">AI Terminal Hub</p>
        </div>

        <div class="hub-topbar-actions">
          <Show when={currentTask()}>
            {(task) => (
              <div class="hub-task-chip">
                <span>当前任务</span>
                <strong>{task().taskName}</strong>
              </div>
            )}
          </Show>

          <Show when={screen() === 'workspace'}>
            <button
              class="hub-secondary-button"
              onClick={() => {
                if (!window.confirm('返回首页会关闭当前所有终端会话，确定要返回吗？')) return;
                // Terminals are persistent (they survive screen switches), so
                // closing the workspace must kill its sessions explicitly.
                if (hasElectronRuntime()) {
                  void invoke(IPC.PtyPrune, { scope: HUB_TERMINAL_SCOPE, keep: [] });
                }
                resetWorkspace();
                setCurrentTask(null);
                setScreen('home');
              }}
            >
              返回首页
            </button>
          </Show>
        </div>
      </header>

      <Show when={notice()}>
        {(activeNotice) => (
          <div class={`hub-notice hub-notice--${activeNotice().kind}`} role="alert">
            <span class="hub-notice-message">{activeNotice().message}</span>
            <button
              class="hub-notice-close"
              type="button"
              aria-label="关闭通知"
              onClick={dismissNotice}
            >
              ✕
            </button>
          </div>
        )}
      </Show>

      <Show when={screen() === 'home'}>
        <section class="hub-home">
          <div class="hub-home-header">
            <div>
              <p class="hub-section-label">默认任务根目录</p>
              <p class="hub-muted">锁定时不可修改，解锁后才允许编辑。</p>
            </div>
            <button class="hub-lock-button" onClick={() => setTaskRootLocked((locked) => !locked)} type="button">
              {taskRootLocked() ? '已锁定' : '已解锁'}
            </button>
          </div>

          <label class="hub-field">
            <span>任务根目录</span>
            <input
              value={taskRoot()}
              readOnly={taskRootLocked()}
              aria-disabled={taskRootLocked()}
              onInput={(event) => setTaskRoot(event.currentTarget.value)}
              placeholder="~/AI-Terminal-Hub/tasks"
            />
          </label>

          <div class="hub-home-cards">
            <article class="hub-card">
              <div class="hub-card-heading">
                <div class="hub-card-icon hub-card-icon--plus" aria-hidden="true" />
                <div>
                  <h2>新建任务</h2>
                  <p>基于默认任务根目录创建一个新的任务文件夹。</p>
                </div>
              </div>

              <label class="hub-field">
                <span>任务名称</span>
                <input
                  value={newTaskName()}
                  onInput={(event) => setNewTaskName(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleCreateTask();
                  }}
                  placeholder="例如：周报自动化排查"
                />
              </label>

              <button class="hub-primary-button" onClick={() => void handleCreateTask()} disabled={busy()}>
                {busy() ? '创建中...' : '创建并进入'}
              </button>
            </article>

            <article class="hub-card">
              <div class="hub-card-heading">
                <div class="hub-card-icon hub-card-icon--folder" aria-hidden="true" />
                <div>
                  <h2>选择已有任务文件夹</h2>
                  <p>载入一个已经存在的任务目录，继续后续派发流程。</p>
                </div>
              </div>

              <button class="hub-primary-button hub-primary-button--ghost" onClick={() => void handleSelectExistingTask()}>
                选择文件夹
              </button>
            </article>
          </div>
        </section>
      </Show>

      <Show when={screen() === 'ai-select' && currentTask()}>
        {(task) => (
          <section class="hub-select">
            <div class="hub-panel-header">
              <div>
                <p class="hub-section-label">步骤二</p>
                <h2>选择本次要派发的 AI</h2>
                <p class="hub-muted hub-path">{task().taskFolder}</p>
              </div>

              <div class="hub-header-actions">
                <button class="hub-secondary-button" onClick={() => setScreen('home')}>
                  更换任务文件夹
                </button>
                <button
                  class="hub-lock-button"
                  type="button"
                  onClick={() => setAgentConfigLocked((locked) => !locked)}
                >
                  {agentConfigLocked() ? '配置已锁定' : '配置已解锁'}
                </button>
              </div>
            </div>

            <div class="hub-agent-grid">
              <For each={aiConfigs()}>
                {(config) => (
                  <article class="hub-agent-card">
                    <label class="hub-agent-card-header">
                      <input
                        type="checkbox"
                        checked={agentSelection()[config.id] === true}
                        onChange={(event) =>
                          setAgentSelection((current) => ({
                            ...current,
                            [config.id]: event.currentTarget.checked,
                          }))
                        }
                      />
                      <div>
                        <strong>{config.name}</strong>
                        <p>{config.command || '未填写命令'}</p>
                      </div>
                    </label>

                    <div class="hub-agent-badges">
                      <span class="hub-badge">{config.folderName}</span>
                      <Show when={agentAvailability()[config.id] !== undefined}>
                        <span class={`hub-badge ${agentAvailability()[config.id] ? 'is-ready' : 'is-missing'}`}>
                          {agentAvailability()[config.id] ? '默认 CLI 已检测到' : '默认 CLI 未检测到'}
                        </span>
                      </Show>
                    </div>

                    <div class="hub-agent-fields">
                      <label class="hub-field">
                        <span>name</span>
                        <input
                          value={config.name}
                          disabled={agentConfigLocked()}
                          onInput={(event) => updateAgentConfig(config.id, { name: event.currentTarget.value })}
                        />
                      </label>
                      <label class="hub-field">
                        <span>command</span>
                        <input
                          value={config.command}
                          disabled={agentConfigLocked()}
                          onInput={(event) => updateAgentConfig(config.id, { command: event.currentTarget.value })}
                        />
                      </label>
                      <label class="hub-field">
                        <span>folderName</span>
                        <input
                          value={config.folderName}
                          disabled={agentConfigLocked()}
                          onInput={(event) => updateAgentConfig(config.id, { folderName: event.currentTarget.value })}
                        />
                      </label>
                      <label class="hub-inline-check">
                        <input
                          type="checkbox"
                          checked={config.defaultChecked}
                          disabled={agentConfigLocked()}
                          onChange={(event) =>
                            updateAgentConfig(config.id, { defaultChecked: event.currentTarget.checked })
                          }
                        />
                        <span>defaultChecked</span>
                      </label>
                    </div>

                    <Show when={config.isCustom}>
                      <button
                        class="hub-danger-button"
                        disabled={agentConfigLocked()}
                        onClick={() => removeCustomAgent(config.id)}
                      >
                        删除自定义 AI
                      </button>
                    </Show>
                  </article>
                )}
              </For>
            </div>

            <div class="hub-select-footer">
              <button class="hub-secondary-button" disabled={agentConfigLocked()} onClick={addCustomAgent}>
                添加自定义 AI
              </button>
              <div class="hub-select-summary">
                <span>当前勾选 {selectedAgents().length} 个 AI</span>
                <button class="hub-primary-button" onClick={startWorkspace}>
                  进入工作区
                </button>
              </div>
            </div>
          </section>
        )}
      </Show>

      <Show when={screen() === 'workspace' && currentTask()}>
        {(task) => (
          <Show
            when={workspaceMode() === 'terminal'}
            fallback={
              <WorkspaceScreen
                task={task()}
                cards={cards()}
            uploadedPaths={uploadedPaths()}
            promptText={promptText()}
            autonomy={autonomy()}
            uploading={uploading()}
            dispatching={dispatching()}
            sendTargetCount={sendTargets().length}
            canUseOutputActions={checkedCards().length > 0}
            onPromptInput={setPromptText}
            onAutonomyChange={setAutonomy}
            onDispatch={() => void dispatchPrompt()}
            onUpload={(files) => void handleUpload(files)}
            onCopyDirectories={() => void copySelectedDirectories()}
            onCopyLatestFiles={() => void copyLatestSelectedFiles()}
            onReturnToAiConfig={() => setScreen('ai-select')}
            onCopyUploadedPath={(filePath) => void copyUploadedFilePath(filePath)}
            onRemoveUploadedFile={(filePath) => void removeUploadedFile(filePath)}
            onToggleAgent={toggleAgent}
            onOpenAgentPath={(card, shiftKey) => void openAgentPath(card, shiftKey)}
            onCancelRun={(runId) => void cancelRun(runId)}
            onRerun={(card) => void rerunAgent(card)}
            runStatusLabel={runStatusLabel}
                isTerminalStatus={(status) => (status ? TERMINAL_STATUSES.has(status) : false)}
                onSwitchToTerminal={() => setWorkspaceMode('terminal')}
              />
            }
          >
            <TerminalWorkspace
              agents={terminalAgents()}
              autonomy={autonomy()}
              onReturnToAiConfig={() => setScreen('ai-select')}
            />
          </Show>
        )}
      </Show>
    </div>
  );
}
