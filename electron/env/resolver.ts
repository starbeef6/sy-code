import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

/**
 * Resolve a command to an absolute, spawnable path.
 *
 * Bare names are looked up on PATH (the login-shell PATH that `fixEnv()` already
 * imported into `process.env`). We deliberately avoid wrapping in a login shell
 * here: spawning the binary directly sidesteps the conda/zsh plugin hangs that
 * plagued the old `$SHELL -lic` launch protocol.
 */
export function resolveCommandForSpawn(command: string): string {
  if (path.isAbsolute(command)) return command;
  if (command.includes('/')) return command;

  try {
    const output = execFileSync('/bin/sh', ['-c', 'printf "%s" "$PATH"'], {
      encoding: 'utf8',
      env: process.env,
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const resolved = findExecutableOnPath(
      command,
      parseCommandLookupOutput(output) ?? process.env.PATH ?? '',
    );
    if (resolved) return resolved;
  } catch {
    // Fall through to a clear, renderer-facing error below.
  }
  throw new Error(`Command not found: ${command}`);
}

export function findExecutableOnPath(command: string, pathValue: string): string | null {
  if (!/^[^/]+$/u.test(command)) return null;
  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, command);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Keep walking PATH entries.
    }
  }
  return null;
}

export function parseCommandLookupOutput(output: string): string | null {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^Last login:/iu.test(line))
    .filter((line) => !/^Restored session:/iu.test(line));
  return lines.length > 0 ? lines[lines.length - 1] : null;
}

/**
 * Variables that a Claude Code / Claude Desktop host injects into ITS OWN
 * subprocess session. If the Hub itself was launched from inside such a session
 * (e.g. `open`ed from a Claude-hosted terminal), these leak in and would point
 * a spawned `claude` at the wrong endpoint/model — overriding the user's own
 * `~/.claude/settings.json`. They must never propagate to spawned agents.
 */
const CLAUDE_SESSION_MARKERS = ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT'];

const ANTHROPIC_ROUTING_VARS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_SMALL_FAST_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
];

/**
 * Scrub host-session leakage from a spawned process's environment.
 *
 * `CLAUDE_CODE_*`/`CLAUDECODE` are always removed (they're internal to the
 * launching Claude session). The Anthropic routing vars are removed only when a
 * Claude-session marker is present — i.e. only when they are injected pollution,
 * not a deliberate user export. This keeps each CLI using its own config
 * deterministically, whether spawned one-shot or as an interactive PTY.
 */
function scrubHostSessionLeakage(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const insideClaudeSession = CLAUDE_SESSION_MARKERS.some((key) => env[key]);

  for (const key of Object.keys(env)) {
    if (key.startsWith('CLAUDE_CODE_') || key === 'CLAUDECODE') delete env[key];
  }

  if (insideClaudeSession) {
    for (const key of ANTHROPIC_ROUTING_VARS) delete env[key];
  }

  return env;
}

/**
 * Environment for spawned (one-shot) agent processes: the user's full
 * (login-shell enriched) environment, with color disabled so streamed logs stay
 * clean. We never strip the environment wholesale (`env -i`) or inject isolated
 * HOME dirs — only the host-session leakage scrub above.
 */
export function buildAgentEnv(
  extra: Record<string, string> = {},
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return scrubHostSessionLeakage({
    ...baseEnv,
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    ...extra,
  });
}

/**
 * Environment for interactive PTY sessions: same scrub as {@link buildAgentEnv},
 * but color is ENABLED (the renderer's xterm.js wants ANSI), and a sensible
 * terminal type is advertised. Any inherited `NO_COLOR` is dropped so CLIs don't
 * suppress their TUI styling.
 */
export function buildInteractiveEnv(
  extra: Record<string, string> = {},
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env = scrubHostSessionLeakage({
    ...baseEnv,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    ...extra,
  });
  delete env.NO_COLOR;
  return env;
}
