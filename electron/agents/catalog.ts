import { resolveCommandForSpawn } from '../env/resolver.js';

export interface AgentCatalogEntry {
  id: string;
  name: string;
  /** Preferred absolute path (fast path). */
  preferredBinary: string;
  /** Bare name to resolve on PATH if the preferred path is missing. */
  bareName: string;
}

/**
 * The three known agents. `preferredBinary` matches the user's current install
 * locations; if those move, we fall back to a PATH lookup of `bareName`.
 */
export const AGENT_CATALOG: AgentCatalogEntry[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    preferredBinary: '/Users/yamijin/.local/bin/claude',
    bareName: 'claude',
  },
  {
    // The "gemini" slot now runs Antigravity (`agy`); Google retired the
    // standalone Gemini CLI's personal login. Keep the id 'gemini' so existing
    // configs, routing and the GEMINI.md instruction file keep working.
    id: 'gemini',
    name: 'Antigravity',
    preferredBinary: '/opt/homebrew/bin/agy',
    bareName: 'agy',
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    preferredBinary: '/Users/yamijin/.local/bin/codex',
    bareName: 'codex',
  },
];

export function getCatalogEntry(agentId: string): AgentCatalogEntry | undefined {
  return AGENT_CATALOG.find((entry) => entry.id === agentId);
}

function isExecutable(candidate: string): boolean {
  try {
    // Lazy require to keep this importable in non-node test contexts.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a known agent id to an absolute binary path: prefer the catalog
 * path, otherwise resolve the bare name on PATH.
 */
export function resolveCatalogBinary(agentId: string): string {
  const entry = getCatalogEntry(agentId);
  if (!entry) throw new Error(`Unknown agent id: ${agentId}`);
  if (isExecutable(entry.preferredBinary)) return entry.preferredBinary;
  return resolveCommandForSpawn(entry.bareName);
}
