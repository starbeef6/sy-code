import { For, Show, createMemo, createSignal, onMount } from 'solid-js';
import AgentTerminal from './AgentTerminal';
import type { AutonomyMode } from './types';
import { IPC } from '../../electron/ipc/channels';
import { hasElectronRuntime, invoke } from '../lib/ipc';
import { quoteDroppedPath } from './path';

/** PTY ownership scope for the hub's workspace terminals (reattach + prune). */
export const HUB_TERMINAL_SCOPE = 'hub-workspace';

export interface TerminalAgent {
  agentId: string;
  configId: string;
  name: string;
  command: string;
  workDir: string;
}

interface TerminalWorkspaceProps {
  agents: TerminalAgent[];
  autonomy: AutonomyMode;
  model?: string;
  /** Appended (single-line) to a broadcast sent via the button — not via Enter. */
  broadcastSuffix?: string;
  onReturnToAiConfig: () => void;
}

/**
 * The interactive terminal workspace: one live xterm per agent plus a shared
 * input that broadcasts a line to every session at once. Each pane is also
 * directly clickable/typable for one-on-one interaction.
 */
export default function TerminalWorkspace(props: TerminalWorkspaceProps) {
  // configId -> session state: undefined = starting, string = live session id,
  // null = exited (or failed to start).
  const [paneSession, setPaneSession] = createSignal<Record<string, string | null | undefined>>({});
  // configId -> remount epoch; bumping it recreates the pane's AgentTerminal,
  // which (in reuse mode) replaces a dead session with a fresh spawn.
  const [paneEpoch, setPaneEpoch] = createSignal<Record<string, number>>({});
  const [broadcastText, setBroadcastText] = createSignal('');

  const liveCount = createMemo(
    () => Object.values(paneSession()).filter((value) => typeof value === 'string').length,
  );
  const canBroadcast = createMemo(() => liveCount() > 0 && broadcastText().trim().length > 0);

  // Terminals are persistent (reuse): leaving this screen detaches them, so on
  // re-entry kill exactly the hub sessions that no longer have a pane — agents
  // the user deselected, or a previous task folder's sessions.
  onMount(() => {
    if (!hasElectronRuntime()) return;
    void invoke(IPC.PtyPrune, {
      scope: HUB_TERMINAL_SCOPE,
      keep: props.agents.map((agent) => ({ agentId: agent.agentId, workDir: agent.workDir })),
    });
  });

  function setSession(configId: string, sessionId: string | null): void {
    setPaneSession((current) => ({ ...current, [configId]: sessionId }));
  }

  function restartPane(configId: string): void {
    setPaneSession((current) => ({ ...current, [configId]: undefined }));
    setPaneEpoch((current) => ({ ...current, [configId]: (current[configId] ?? 1) + 1 }));
  }

  function paneStatus(configId: string): 'live' | 'starting' | 'dead' {
    const value = paneSession()[configId];
    if (typeof value === 'string') return 'live';
    return value === undefined ? 'starting' : 'dead';
  }

  function writeAll(data: string): void {
    for (const sessionId of Object.values(paneSession())) {
      if (sessionId) void invoke(IPC.PtyInput, { sessionId, data });
    }
  }

  // Type the line into every session, then send a *discrete* Enter shortly after
  // so each CLI's TUI actually submits it. A "\r" sent in the same chunk as the
  // text is treated as a newline by some TUIs (the "had to press twice"
  // symptom), so we separate them.
  function sendToAll(text: string): void {
    writeAll(text);
    // First Enter submits for Claude/Codex. Gemini sometimes treats the first
    // \r as committing the just-written text rather than sending it, so it sits
    // there until you press Enter again — we send a second \r a beat later to
    // actually run it. By then the others' input boxes are empty, so the extra
    // \r is a harmless no-op. Safe because broadcasts are seconds/minutes apart.
    window.setTimeout(() => writeAll('\r'), 80);
    window.setTimeout(() => writeAll('\r'), 400);
    setBroadcastText('');
  }

  // Plain Enter: send exactly what the user typed, untouched.
  function broadcast(): void {
    if (!canBroadcast()) return;
    sendToAll(broadcastText());
  }

  // 广播发送 button: append the user-defined suffix (collapsed to a single line so
  // an embedded newline can't trip the TUI into submitting early) before sending.
  // An empty suffix makes this identical to a plain Enter.
  function broadcastWithSuffix(): void {
    if (!canBroadcast()) return;
    const suffix = (props.broadcastSuffix ?? '').replace(/\s*\n\s*/g, ' ').trim();
    const text = broadcastText();
    sendToAll(suffix ? `${text} ${suffix}` : text);
  }

  function handleDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const paths: string[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const filePath = window.electron?.getPathForFile?.(files[i]) ?? '';
      if (filePath) paths.push(quoteDroppedPath(filePath));
    }
    if (paths.length === 0) return;
    setBroadcastText((prev) => (prev ? `${prev} ` : '') + paths.join(' '));
  }

  return (
    <section class="hub-terminal-workspace">
      <div class="hub-terminal-bar">
        <div>
          <p class="hub-section-label">终端模式</p>
          <h2>交互终端</h2>
          <p class="hub-muted">
            {props.agents.length} 个真实会话 · {liveCount()} 个在线 · 直接点窗格可单独操作
          </p>
        </div>
        <div class="hub-header-actions">
          <button class="hub-secondary-button" onClick={props.onReturnToAiConfig}>
            返回 AI 配置
          </button>
        </div>
      </div>

      <div class="hub-terminal-grid" style={{ '--term-count': String(props.agents.length) }}>
        <For each={props.agents}>
          {(agent) => (
            <div class="hub-terminal-pane">
              <div class="hub-terminal-pane-head">
                <div class="hub-terminal-pane-title">
                  <span
                    class={`hub-terminal-dot is-${paneStatus(agent.configId)}`}
                    title={
                      paneStatus(agent.configId) === 'live'
                        ? '会话在线'
                        : paneStatus(agent.configId) === 'starting'
                          ? '正在启动…'
                          : '会话已退出'
                    }
                  />
                  <span class="hub-terminal-pane-name">{agent.name}</span>
                </div>
                <div class="hub-terminal-pane-tools">
                  <code class="hub-terminal-pane-cmd">{agent.command}</code>
                  <Show when={paneStatus(agent.configId) === 'dead'}>
                    <button
                      class="hub-terminal-restart"
                      title="重新启动这个 CLI 会话"
                      onClick={() => restartPane(agent.configId)}
                    >
                      重启
                    </button>
                  </Show>
                </div>
              </div>
              {/* Keyed on the epoch: bumping restartPane() remounts the
                  terminal, which (in reuse mode) replaces the dead session
                  with a fresh spawn. */}
              <Show when={paneEpoch()[agent.configId] ?? 1} keyed>
                {(_epoch) => (
                  <AgentTerminal
                    agentId={agent.agentId}
                    command={agent.command}
                    autonomy={props.autonomy}
                    model={props.model}
                    workDir={agent.workDir}
                    reuse
                    scope={HUB_TERMINAL_SCOPE}
                    onSession={(sessionId) => setSession(agent.configId, sessionId)}
                  />
                )}
              </Show>
            </div>
          )}
        </For>
      </div>

      <div
        class="hub-terminal-broadcast"
        onDragOver={(event) => {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={handleDrop}
      >
        <textarea
          value={broadcastText()}
          onInput={(event) => setBroadcastText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
              event.preventDefault();
              broadcast();
            }
          }}
          placeholder="一句话广播给全部会话（Enter 原样发送 / 点按钮附加提示词 / Shift+Enter 换行）· 可把文件拖进来插入路径"
          rows={4}
        />
        <button
          class="hub-primary-button"
          disabled={!canBroadcast()}
          title={liveCount() === 0 ? '没有在线的会话' : '发送并附加设置里的提示词（回车则原样发送）'}
          onClick={() => broadcastWithSuffix()}
        >
          广播发送
        </button>
      </div>
    </section>
  );
}
