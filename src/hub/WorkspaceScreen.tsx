import { For, Show } from 'solid-js';
import type { AutonomyMode, HubAgentRunCard, HubTaskContext, RunStatus } from './types';
import { basenameFromPath } from './path';

interface WorkspaceScreenProps {
  task: HubTaskContext;
  cards: HubAgentRunCard[];
  uploadedPaths: string[];
  promptText: string;
  autonomy: AutonomyMode;
  uploading: boolean;
  dispatching: boolean;
  sendTargetCount: number;
  canUseOutputActions: boolean;
  onPromptInput: (value: string) => void;
  onAutonomyChange: (mode: AutonomyMode) => void;
  onDispatch: () => void;
  onUpload: (files: FileList | null) => void;
  onCopyDirectories: () => void;
  onCopyLatestFiles: () => void;
  onReturnToAiConfig: () => void;
  onSwitchToTerminal: () => void;
  onCopyUploadedPath: (filePath: string) => void;
  onRemoveUploadedFile: (filePath: string) => void;
  onToggleAgent: (configId: string, checked: boolean) => void;
  onOpenAgentPath: (card: HubAgentRunCard, shiftKey: boolean) => void;
  onCancelRun: (runId: string) => void;
  onRerun: (card: HubAgentRunCard) => void;
  runStatusLabel: (status: RunStatus | undefined) => string;
  isTerminalStatus: (status: RunStatus | undefined) => boolean;
}

const AUTONOMY_OPTIONS: Array<{ value: AutonomyMode; label: string; hint: string }> = [
  { value: 'safe', label: '安全', hint: '只读 / 需确认，不擅自改盘' },
  { value: 'auto-edit', label: '自动改文件', hint: '自动应用编辑，不碰危险操作' },
  { value: 'full-auto', label: '全自动', hint: '全部自动（仅限可信任务）' },
];

function formatDuration(ms: number | null): string {
  if (ms === null || ms < 0) return '';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function isRunning(status: RunStatus | undefined): boolean {
  return status === 'queued' || status === 'spawning' || status === 'running';
}

export default function WorkspaceScreen(props: WorkspaceScreenProps) {
  return (
    <section class="hub-workspace">
      <div class="hub-panel hub-workspace-panel">
        <div class="hub-panel-header">
          <div>
            <p class="hub-section-label">步骤三</p>
            <h2>工作区</h2>
            <p class="hub-muted">
              当前派发目标 {props.sendTargetCount} / 共 {props.cards.length} 个 AI
            </p>
          </div>
          <div class="hub-header-actions">
            <button class="hub-secondary-button" onClick={props.onSwitchToTerminal}>
              切到终端模式
            </button>
            <button
              class="hub-secondary-button"
              disabled={!props.canUseOutputActions}
              onClick={props.onCopyDirectories}
            >
              复制输出目录
            </button>
            <button
              class="hub-secondary-button"
              disabled={!props.canUseOutputActions}
              onClick={props.onCopyLatestFiles}
            >
              复制最新输出文件
            </button>
            <button class="hub-secondary-button" onClick={props.onReturnToAiConfig}>
              返回 AI 配置
            </button>
          </div>
        </div>

        <div class="hub-autonomy">
          <span class="hub-autonomy-label">自主模式</span>
          <div class="hub-autonomy-options" role="radiogroup" aria-label="自主模式">
            <For each={AUTONOMY_OPTIONS}>
              {(option) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={props.autonomy === option.value}
                  class={`hub-autonomy-option ${props.autonomy === option.value ? 'is-active' : ''}`}
                  title={option.hint}
                  onClick={() => props.onAutonomyChange(option.value)}
                >
                  {option.label}
                </button>
              )}
            </For>
          </div>
        </div>

        <div
          class={`hub-composer ${props.uploading ? 'is-uploading' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer!.dropEffect = 'copy';
          }}
          onDrop={(event) => {
            event.preventDefault();
            props.onUpload(event.dataTransfer?.files ?? null);
          }}
        >
          <textarea
            value={props.promptText}
            onInput={(event) => props.onPromptInput(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
                event.preventDefault();
                props.onDispatch();
              }
            }}
            placeholder={props.uploading ? '正在导入文件...' : '输入统一任务，或把文件直接拖进这里'}
          />
          <button class="hub-primary-button" disabled={props.dispatching} onClick={props.onDispatch}>
            {props.dispatching ? '派发中...' : '派发'}
          </button>
        </div>

        <Show when={props.uploadedPaths.length > 0}>
          <section class="hub-upload-strip">
            <div class="hub-upload-strip-header">
              <span>已上传文件</span>
              <p class="hub-upload-status">共 {props.uploadedPaths.length} 个，会随指令一起发送。</p>
            </div>

            <div class="hub-upload-list">
              <For each={props.uploadedPaths}>
                {(filePath) => (
                  <article class="hub-upload-item">
                    <div class="hub-upload-item-body">
                      <strong>{basenameFromPath(filePath)}</strong>
                      <code class="hub-upload-item-path">{filePath}</code>
                    </div>

                    <div class="hub-upload-item-actions">
                      <button
                        class="hub-secondary-button hub-secondary-button--small"
                        onClick={() => props.onCopyUploadedPath(filePath)}
                      >
                        复制路径
                      </button>
                      <button
                        class="hub-danger-button hub-secondary-button--small"
                        onClick={() => props.onRemoveUploadedFile(filePath)}
                      >
                        移除
                      </button>
                    </div>
                  </article>
                )}
              </For>
            </div>
          </section>
        </Show>

        <div class="hub-agent-run-grid">
          <For each={props.cards}>
            {(card) => (
              <article class="hub-agent-run-card">
                <div class="hub-agent-run-header">
                  <label class="hub-inline-check">
                    <input
                      type="checkbox"
                      checked={card.checked}
                      onChange={(event) => props.onToggleAgent(card.configId, event.currentTarget.checked)}
                    />
                    <span>{card.name}</span>
                  </label>
                  <span class={`hub-status hub-status--${card.run?.status ?? 'idle'}`}>
                    {props.runStatusLabel(card.run?.status)}
                  </span>
                </div>

                <code class="hub-agent-path">{card.workDir}</code>

                <Show when={card.run}>
                  {(run) => (
                    <p class="hub-session-meta">
                      <Show when={run().pid}>pid {run().pid} · </Show>
                      <Show when={run().exitCode !== null}>exit {run().exitCode} · </Show>
                      <Show when={run().durationMs !== null}>用时 {formatDuration(run().durationMs)}</Show>
                    </p>
                  )}
                </Show>

                <Show when={card.log.length > 0}>
                  <details class="hub-log" open>
                    <summary>实时输出</summary>
                    <pre class="hub-log-body">{card.log}</pre>
                  </details>
                </Show>

                <div class="hub-agent-actions">
                  <button
                    class="hub-secondary-button hub-secondary-button--small"
                    onClick={() => props.onOpenAgentPath(card, false)}
                  >
                    打开目录
                  </button>
                  <button
                    class="hub-secondary-button hub-secondary-button--small"
                    onClick={() => props.onOpenAgentPath(card, true)}
                  >
                    打开最新文件
                  </button>
                  <Show when={card.run && isRunning(card.run.status)}>
                    <button
                      class="hub-danger-button hub-secondary-button--small"
                      onClick={() => card.run && props.onCancelRun(card.run.runId)}
                    >
                      取消
                    </button>
                  </Show>
                  <Show when={props.isTerminalStatus(card.run?.status)}>
                    <button
                      class="hub-secondary-button hub-secondary-button--small"
                      onClick={() => props.onRerun(card)}
                    >
                      重跑
                    </button>
                  </Show>
                </div>

                <Show when={card.run?.errorReason}>
                  <p class="hub-error-text">{card.run?.errorReason}</p>
                </Show>
              </article>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}
