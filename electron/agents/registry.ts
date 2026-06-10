import type { DispatchAgentInput } from '../ipc/contracts.js';
import { resolveCommandForSpawn } from '../env/resolver.js';
import { parseCommandLine } from './command-line.js';
import { resolveCatalogBinary } from './catalog.js';
import { createClaudeAdapter } from './claude-adapter.js';
import { createGeminiAdapter } from './gemini-adapter.js';
import { createCodexAdapter } from './codex-adapter.js';
import { createGenericAdapter } from './generic-adapter.js';
import type { AgentAdapter } from './types.js';

/**
 * Resolve the right adapter for a dispatched agent, with its binary resolved to
 * an absolute path. Known ids use their dedicated adapter; anything else falls
 * back to the generic command-line adapter.
 */
export function resolveAdapter(agent: DispatchAgentInput): AgentAdapter {
  switch (agent.agentId) {
    case 'claude-code':
      return createClaudeAdapter(resolveCatalogBinary('claude-code'));
    case 'gemini':
      return createGeminiAdapter(resolveCatalogBinary('gemini'));
    case 'codex':
      return createCodexAdapter(resolveCatalogBinary('codex'));
    default: {
      const parsed = parseCommandLine(agent.command);
      return createGenericAdapter(
        agent.agentId,
        agent.name,
        resolveCommandForSpawn(parsed.command),
        parsed.args,
      );
    }
  }
}
