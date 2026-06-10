import { DEFAULT_AGENT_CONFIGS, HUB_STORAGE_KEY } from './defaults';
import type { HubAgentConfig, HubPreferences } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeAgentConfig(raw: unknown): HubAgentConfig | null {
  if (!isRecord(raw)) return null;
  if (
    typeof raw.id !== 'string' ||
    typeof raw.name !== 'string' ||
    typeof raw.command !== 'string' ||
    typeof raw.folderName !== 'string'
  ) {
    return null;
  }

  return {
    id: raw.id,
    name: raw.name,
    command: raw.command,
    folderName: raw.folderName,
    defaultChecked: raw.defaultChecked === true,
    isCustom: raw.isCustom === true,
    available: typeof raw.available === 'boolean' ? raw.available : undefined,
  };
}

function normalizeKnownCommand(agentId: string, savedCommand: string, defaultCommand: string): string {
  const trimmed = savedCommand.trim();
  const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
  if (!trimmed) return defaultCommand;
  if (normalized.includes('restored session:')) return defaultCommand;
  if (
    agentId === 'claude-code' &&
    (normalized === 'claude' || normalized === 'claude code' || normalized === 'claude-code')
  ) {
    return defaultCommand;
  }
  if (agentId === 'gemini' && (normalized === 'gemini' || normalized === 'gemini cli')) return defaultCommand;
  if (agentId === 'codex' && (normalized === 'codex' || normalized === 'codex cli')) return defaultCommand;
  if (agentId === 'claude-code' && /agent-task|claude-mem|dangerously-skip-permissions/iu.test(trimmed)) {
    return defaultCommand;
  }
  if (
    agentId === 'gemini' &&
    /gemini-shell-wrapper|gemini_cli_home|ai-terminal-hub\/config\/gemini|--approval-mode\s+yolo\s+--skip-trust\s+--sandbox\s+false/iu.test(
      trimmed,
    )
  ) {
    return defaultCommand;
  }
  if (
    agentId === 'codex' &&
    /developer_instructions=|codex_home|ai-terminal-hub\/config\/codex|dangerously-bypass-approvals-and-sandbox/iu.test(
      trimmed,
    )
  ) {
    return defaultCommand;
  }
  return trimmed;
}

function mergeAgentConfigs(stored: HubAgentConfig[] | null): HubAgentConfig[] {
  const byId = new Map((stored ?? []).map((agent) => [agent.id, agent]));
  const defaults = DEFAULT_AGENT_CONFIGS.map((agent) => {
    const saved = byId.get(agent.id);
    return saved
      ? {
          ...agent,
          name: saved.name,
          command: normalizeKnownCommand(agent.id, saved.command, agent.command),
          folderName: saved.folderName,
          defaultChecked: saved.defaultChecked,
        }
      : agent;
  });

  const custom = (stored ?? []).filter((agent) => agent.isCustom);
  return [...defaults, ...custom];
}

export function loadHubPreferences(defaultTaskRoot: string): HubPreferences {
  if (typeof localStorage === 'undefined') {
    return {
      taskRoot: defaultTaskRoot,
      taskRootLocked: true,
      agentConfigLocked: true,
      aiConfigs: DEFAULT_AGENT_CONFIGS,
    };
  }

  try {
    const raw = localStorage.getItem(HUB_STORAGE_KEY);
    if (!raw) {
      return {
        taskRoot: defaultTaskRoot,
        taskRootLocked: true,
        agentConfigLocked: true,
        aiConfigs: DEFAULT_AGENT_CONFIGS,
      };
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const storedAgents = Array.isArray(parsed.aiConfigs)
      ? parsed.aiConfigs.map(normalizeAgentConfig).filter((agent): agent is HubAgentConfig => agent !== null)
      : null;

    return {
      taskRoot: typeof parsed.taskRoot === 'string' && parsed.taskRoot.trim() ? parsed.taskRoot : defaultTaskRoot,
      taskRootLocked: parsed.taskRootLocked !== false,
      agentConfigLocked: parsed.agentConfigLocked !== false,
      aiConfigs: mergeAgentConfigs(storedAgents),
    };
  } catch {
    return {
      taskRoot: defaultTaskRoot,
      taskRootLocked: true,
      agentConfigLocked: true,
      aiConfigs: DEFAULT_AGENT_CONFIGS,
    };
  }
}

export function saveHubPreferences(preferences: HubPreferences): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(HUB_STORAGE_KEY, JSON.stringify(preferences));
}
