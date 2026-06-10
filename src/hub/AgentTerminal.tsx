import { onCleanup, onMount } from 'solid-js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { IPC } from '../../electron/ipc/channels';
import { invoke, subscribe } from '../lib/ipc';
import type { AutonomyMode } from './types';

interface PtyOpenResult {
  sessionId: string;
  pid: number;
  running: boolean;
  /** Buffered output of a reattached session, replayed on mount. */
  scrollback: string;
  attached: boolean;
}

export interface AgentTerminalProps {
  agentId: string;
  command: string;
  autonomy: AutonomyMode;
  model?: string;
  workDir: string;
  /**
   * When true, the PTY session outlives this component: unmounting detaches
   * (instead of killing), and remounting reattaches to the still-running
   * session and replays its scrollback. Cleanup of abandoned sessions is then
   * the owner's job (via IPC.PtyPrune with the matching scope).
   */
  reuse?: boolean;
  /** Ownership group used for reattach matching and pruning. */
  scope?: string;
  /** Reports the live PTY session id (null once it exits / fails to start). */
  onSession?: (sessionId: string | null) => void;
}

function hasRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.electron?.ipcRenderer?.invoke === 'function';
}

/**
 * A real interactive terminal for one agent: an xterm.js view wired to a
 * persistent node-pty session in the main process. Keystrokes flow to the PTY,
 * PTY output streams back — full continuity, slash commands and TUIs all work.
 */
export default function AgentTerminal(props: AgentTerminalProps) {
  let container!: HTMLDivElement;
  let term: Terminal | undefined;
  let fit: FitAddon | undefined;
  let sessionId: string | null = null;
  const disposers: Array<() => void> = [];

  onMount(() => {
    term = new Terminal({
      fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
      fontSize: 12.5,
      lineHeight: 1.2,
      cursorBlink: true,
      scrollback: 10000,
      theme: {
        background: '#0a0d14',
        foreground: '#d7dce5',
        cursor: '#7aa2f7',
        selectionBackground: '#2a3050',
      },
    });
    fit = new FitAddon();
    term.loadAddon(fit);
    try {
      term.loadAddon(new WebLinksAddon());
    } catch {
      // Optional addon; ignore if unavailable.
    }
    term.open(container);
    safeFit();

    if (!hasRuntime()) {
      term.writeln('\x1b[33m[未在 Electron 运行时中，终端不可用]\x1b[0m');
      return;
    }

    void startSession();

    const onData = term.onData((data) => {
      if (sessionId) void invoke(IPC.PtyInput, { sessionId, data });
    });
    disposers.push(() => onData.dispose());

    const ro = new ResizeObserver(() => {
      safeFit();
      if (sessionId && term) {
        void invoke(IPC.PtyResize, { sessionId, cols: term.cols, rows: term.rows });
      }
    });
    ro.observe(container);
    disposers.push(() => ro.disconnect());
  });

  async function startSession(): Promise<void> {
    if (!term) return;
    let info: PtyOpenResult;
    try {
      info = await invoke<PtyOpenResult>(IPC.PtyOpen, {
        agentId: props.agentId,
        command: props.command,
        autonomy: props.autonomy,
        model: props.model,
        workDir: props.workDir,
        cols: term.cols,
        rows: term.rows,
        reuse: props.reuse === true,
        scope: props.scope,
      });
    } catch (error) {
      term.writeln('\x1b[31m[启动失败] ' + String(error) + '\x1b[0m');
      props.onSession?.(null);
      return;
    }
    sessionId = info.sessionId;
    props.onSession?.(sessionId);

    // Replay the detached session's buffer before any live chunk can arrive:
    // events sent after the open response are dispatched after this turn, so
    // writing the snapshot here keeps the output ordered.
    if (info.attached && info.scrollback) term.write(info.scrollback);

    disposers.push(
      subscribe<{ sessionId: string; chunk: string }>(IPC.PtyData, (payload) => {
        if (payload.sessionId === sessionId) term?.write(payload.chunk);
      }),
    );
    disposers.push(
      subscribe<{ sessionId: string; exitCode: number }>(IPC.PtyExit, (payload) => {
        if (payload.sessionId !== sessionId) return;
        term?.write(`\r\n\x1b[90m[会话已退出 code=${payload.exitCode}]\x1b[0m\r\n`);
        sessionId = null;
        props.onSession?.(null);
      }),
    );

    term.focus();
  }

  function safeFit(): void {
    try {
      fit?.fit();
    } catch {
      // Container not laid out yet; the ResizeObserver will retry.
    }
  }

  onCleanup(() => {
    for (const dispose of disposers.splice(0)) {
      try {
        dispose();
      } catch {
        // ignore
      }
    }
    // reuse mode: detach only — the session keeps running in the main process
    // and the next mount for the same (scope, agentId, workDir) reattaches.
    if (sessionId && props.reuse !== true) void invoke(IPC.PtyKill, { sessionId });
    sessionId = null;
    term?.dispose();
    term = undefined;
  });

  return <div class="hub-terminal" ref={container} />;
}
