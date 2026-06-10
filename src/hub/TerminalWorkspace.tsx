import { For, createSignal, onMount } from 'solid-js';
import AgentTerminal from './AgentTerminal';
import type { AutonomyMode } from './types';
import { IPC } from '../../electron/ipc/channels';
import { invoke } from '../lib/ipc';

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
  onReturnToAiConfig: () => void;
}

/**
 * The interactive terminal workspace: one live xterm per agent plus a shared
 * input that broadcasts a line to every session at once. Each pane is also
 * directly clickable/typable for one-on-one interaction.
 */
export default function TerminalWorkspace(props: TerminalWorkspaceProps) {
  // configId -> live session id (null until started / after exit).
  const sessions = new Map<string, string | null>();
  const [broadcastText, setBroadcastText] = createSignal('');
  const [liveCount, setLiveCount] = createSignal(0);

  // Terminals are persistent (reuse): leaving this screen detaches them, so on
  // re-entry kill exactly the hub sessions that no longer have a pane — agents
  // the user deselected, or a previous task folder's sessions.
  onMount(() => {
    if (typeof window.electron?.ipcRenderer?.invoke !== 'function') return;
    void invoke(IPC.PtyPrune, {
      scope: HUB_TERMINAL_SCOPE,
      keep: props.agents.map((agent) => ({ agentId: agent.agentId, workDir: agent.workDir })),
    });
  });

  function recomputeLive(): void {
    let n = 0;
    for (const value of sessions.values()) if (value) n += 1;
    setLiveCount(n);
  }

  function writeAll(data: string): void {
    for (const sessionId of sessions.values()) {
      if (sessionId) void invoke(IPC.PtyInput, { sessionId, data });
    }
  }

  // One click = type the line into every session, then send a *discrete* Enter
  // shortly after so each CLI's TUI actually submits it. A "\r" sent in the same
  // chunk as the text is treated as a newline by some TUIs (the "had to press
  // twice" symptom), so we separate them.
  function broadcast(): void {
    writeAll(broadcastText());
    window.setTimeout(() => writeAll('\r'), 80);
    setBroadcastText('');
  }

  function handleDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const paths: string[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const filePath = window.electron?.getPathForFile?.(files[i]) ?? '';
      if (filePath) paths.push(filePath.includes(' ') ? `'${filePath}'` : filePath);
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
                <span class="hub-terminal-pane-name">{agent.name}</span>
                <code class="hub-terminal-pane-cmd">{agent.command}</code>
              </div>
              <AgentTerminal
                agentId={agent.agentId}
                command={agent.command}
                autonomy={props.autonomy}
                model={props.model}
                workDir={agent.workDir}
                reuse
                scope={HUB_TERMINAL_SCOPE}
                onSession={(sessionId) => {
                  sessions.set(agent.configId, sessionId);
                  recomputeLive();
                }}
              />
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
          placeholder="一句话广播给全部会话（Enter 发送 / Shift+Enter 换行）· 可把文件拖进来插入路径"
          rows={4}
        />
        <button class="hub-primary-button" onClick={() => broadcast()}>
          广播发送
        </button>
      </div>
    </section>
  );
}
