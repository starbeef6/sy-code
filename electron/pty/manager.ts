import crypto from 'crypto';
import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { buildInteractiveEnv, resolveCommandForSpawn } from '../env/resolver.js';

/** Cap retained per-session output so a re-mounting renderer can restore view. */
const MAX_SCROLLBACK_BYTES = 256 * 1024;
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

export interface PtyCreateOptions {
  /** Catalog agent id (for routing/labelling). */
  agentId: string;
  /** Bare or absolute command (resolved against the login-shell PATH). */
  command: string;
  args: string[];
  cwd: string;
  cols?: number;
  rows?: number;
  /** Extra env on top of the scrubbed, color-enabled interactive base. */
  env?: Record<string, string>;
  /**
   * Ownership group for reattach/prune. Hub workspace terminals share one
   * scope so leaving the workspace can clean exactly its sessions without
   * touching e.g. the pet window's independent brain session.
   */
  scope?: string;
}

export interface PtyOpenResult {
  info: PtySessionInfo;
  /** Buffered output to replay into a freshly mounted renderer terminal. */
  scrollback: string;
  /** True when an already-running session was reused instead of spawned. */
  attached: boolean;
}

export interface PtySessionInfo {
  sessionId: string;
  agentId: string;
  pid: number;
  command: string;
  cwd: string;
  cols: number;
  rows: number;
  running: boolean;
}

export interface PtyEvents {
  onData: (sessionId: string, chunk: string) => void;
  onExit: (sessionId: string, exitCode: number, signal: number | undefined) => void;
}

interface Session {
  id: string;
  agentId: string;
  scope: string;
  proc: IPty;
  command: string;
  cwd: string;
  cols: number;
  rows: number;
  running: boolean;
  scrollback: string[];
  scrollbackBytes: number;
}

function toStringEnv(env: NodeJS.ProcessEnv): { [key: string]: string } {
  const out: { [key: string]: string } = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

/**
 * Owns the live interactive PTY sessions. Each session is a real terminal
 * running a CLI in its interactive TUI — the connection is a direct node-pty
 * pipe (no screen-scraping), so it's reliable and supports full continuity,
 * slash commands and arbitrary input.
 */
export class PtyManager {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly events: PtyEvents) {}

  create(opts: PtyCreateOptions): PtySessionInfo {
    const cols = opts.cols && opts.cols > 0 ? Math.floor(opts.cols) : DEFAULT_COLS;
    const rows = opts.rows && opts.rows > 0 ? Math.floor(opts.rows) : DEFAULT_ROWS;
    const file = resolveCommandForSpawn(opts.command);
    const env = buildInteractiveEnv(opts.env ?? {});

    const proc = pty.spawn(file, opts.args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: opts.cwd,
      env: toStringEnv(env),
    });

    const id = crypto.randomUUID();
    const session: Session = {
      id,
      agentId: opts.agentId,
      scope: opts.scope ?? 'default',
      proc,
      command: opts.command,
      cwd: opts.cwd,
      cols,
      rows,
      running: true,
      scrollback: [],
      scrollbackBytes: 0,
    };
    this.sessions.set(id, session);

    proc.onData((chunk) => {
      this.appendScrollback(session, chunk);
      this.events.onData(id, chunk);
    });
    proc.onExit(({ exitCode, signal }) => {
      session.running = false;
      this.events.onExit(id, exitCode, signal);
    });

    return this.infoOf(session);
  }

  /**
   * Reuse a still-running session for the same (scope, agentId, cwd) — the
   * renderer remounted (screen switch) and wants its terminal back — or spawn a
   * fresh one. Returns the buffered scrollback so the caller can repaint.
   */
  attachOrCreate(opts: PtyCreateOptions): PtyOpenResult {
    const scope = opts.scope ?? 'default';
    let match: Session | undefined;
    for (const session of this.sessions.values()) {
      if (session.scope !== scope || session.agentId !== opts.agentId || session.cwd !== opts.cwd) {
        continue;
      }
      if (session.running) {
        match = session; // keep scanning: latest matching session wins
      } else {
        // A dead leftover for this pane; drop it so they can't pile up.
        this.sessions.delete(session.id);
      }
    }

    if (match) {
      const scrollback = match.scrollback.join('');
      if (opts.cols && opts.rows) this.resize(match.id, opts.cols, opts.rows);
      return { info: this.infoOf(match), scrollback, attached: true };
    }
    return { info: this.create(opts), scrollback: '', attached: false };
  }

  /**
   * Kill every session in `scope` whose (agentId, cwd) is not in `keep`. Lets
   * the workspace clean up panes the user deselected (or a previous task's
   * sessions) without touching other scopes.
   */
  prune(scope: string, keep: Array<{ agentId: string; cwd: string }>): void {
    for (const session of [...this.sessions.values()]) {
      if (session.scope !== scope) continue;
      const kept = keep.some((key) => key.agentId === session.agentId && key.cwd === session.cwd);
      if (kept) continue;
      if (session.running) this.terminate(session.proc, false);
      this.sessions.delete(session.id);
    }
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.running) session.proc.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.running) return;
    if (!(cols > 0) || !(rows > 0)) return;
    session.cols = Math.floor(cols);
    session.rows = Math.floor(rows);
    try {
      session.proc.resize(session.cols, session.rows);
    } catch {
      // Resizing a process that just exited can throw; ignore.
    }
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    // User closed one terminal: ask politely, then force the whole group if a
    // stuck CLI ignores it. Async escalation is fine for a single close.
    this.terminate(session.proc, false);
    this.sessions.delete(sessionId);
  }

  /**
   * Tear down every live terminal. Called on app quit, so it kills hard and
   * synchronously: a lingering CLI grandchild (claude/codex/gemini) keeps
   * node-pty's helper thread — and thus Electron's event loop — alive, which is
   * what previously left the app impossible to quit without a force-quit.
   */
  killAll(): void {
    for (const session of this.sessions.values()) {
      this.terminate(session.proc, true);
    }
    this.sessions.clear();
  }

  /**
   * Kill a PTY child and everything it spawned. node-pty children are session
   * leaders (forkpty calls setsid), so the child pid doubles as its
   * process-group id — signalling the negative pid reaches the shell AND every
   * descendant. Killing only `proc` would orphan grandchildren.
   */
  private terminate(proc: IPty, immediate: boolean): void {
    const pid = proc.pid;
    const sigkillGroup = (): void => {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        // Group already reaped.
      }
      try {
        proc.kill('SIGKILL');
      } catch {
        // Already gone.
      }
    };

    if (immediate) {
      sigkillGroup();
      return;
    }

    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      // Fall through to proc.kill / the SIGKILL sweep below.
    }
    try {
      proc.kill();
    } catch {
      // Already gone.
    }
    // Anything still alive after the grace period gets SIGKILL. unref() so this
    // timer never by itself keeps the process from exiting.
    setTimeout(sigkillGroup, 800).unref();
  }

  getScrollback(sessionId: string): string {
    return this.sessions.get(sessionId)?.scrollback.join('') ?? '';
  }

  list(): PtySessionInfo[] {
    return [...this.sessions.values()].map((session) => this.infoOf(session));
  }

  private appendScrollback(session: Session, chunk: string): void {
    session.scrollback.push(chunk);
    session.scrollbackBytes += Buffer.byteLength(chunk);
    while (session.scrollbackBytes > MAX_SCROLLBACK_BYTES && session.scrollback.length > 1) {
      const removed = session.scrollback.shift();
      if (removed !== undefined) session.scrollbackBytes -= Buffer.byteLength(removed);
    }
  }

  private infoOf(session: Session): PtySessionInfo {
    return {
      sessionId: session.id,
      agentId: session.agentId,
      pid: session.proc.pid,
      command: session.command,
      cwd: session.cwd,
      cols: session.cols,
      rows: session.rows,
      running: session.running,
    };
  }
}
