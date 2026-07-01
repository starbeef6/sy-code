import { DEFAULT_AGENT_CONFIGS, DEFAULT_BROADCAST_SUFFIX, HUB_STORAGE_KEY } from './defaults';
import type { HubAgentConfig, HubPreferences, HubRecentTask } from './types';

const RECENT_TASKS_CAP = 8;

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

function normalizeRecentTask(raw: unknown): HubRecentTask | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.taskFolder !== 'string' || !raw.taskFolder.trim()) return null;
  return {
    taskFolder: raw.taskFolder,
    taskName: typeof raw.taskName === 'string' && raw.taskName ? raw.taskName : raw.taskFolder,
    lastOpenedAt: typeof raw.lastOpenedAt === 'number' ? raw.lastOpenedAt : 0,
  };
}

/** Newest-first, deduped by folder, capped — for the home quick-open list. */
export function pushRecentTask(list: HubRecentTask[], entry: HubRecentTask): HubRecentTask[] {
  const rest = list.filter((task) => task.taskFolder !== entry.taskFolder);
  return [entry, ...rest].slice(0, RECENT_TASKS_CAP);
}

function mergeAgentConfigs(stored: HubAgentConfig[] | null): HubAgentConfig[] {
  // First run / nothing persisted yet: seed the three built-in defaults.
  if (!stored || stored.length === 0) return DEFAULT_AGENT_CONFIGS;

  // Otherwise the user's curated list is authoritative — every agent (built-ins
  // included) can be renamed, re-commanded, added, or deleted, and the change
  // sticks across restarts. We only scrub legacy/stale command strings for the
  // known built-in ids on the way in (migration cleanup); custom ids pass through.
  const defaultCommandById = new Map(DEFAULT_AGENT_CONFIGS.map((agent) => [agent.id, agent.command]));
  return stored.map((agent) => {
    const defaultCommand = defaultCommandById.get(agent.id);
    if (defaultCommand === undefined) return agent;
    return { ...agent, command: normalizeKnownCommand(agent.id, agent.command, defaultCommand) };
  });
}

function fallbackPreferences(defaultTaskRoot: string): HubPreferences {
  return {
    taskRoot: defaultTaskRoot,
    taskRootLocked: true,
    agentConfigLocked: true,
    aiConfigs: DEFAULT_AGENT_CONFIGS,
    recentTasks: [],
    broadcastSuffix: DEFAULT_BROADCAST_SUFFIX,
  };
}

export function loadHubPreferences(defaultTaskRoot: string): HubPreferences {
  if (typeof localStorage === 'undefined') return fallbackPreferences(defaultTaskRoot);

  try {
    const raw = localStorage.getItem(HUB_STORAGE_KEY);
    if (!raw) return fallbackPreferences(defaultTaskRoot);

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const storedAgents = Array.isArray(parsed.aiConfigs)
      ? parsed.aiConfigs.map(normalizeAgentConfig).filter((agent): agent is HubAgentConfig => agent !== null)
      : null;
    const recentTasks = Array.isArray(parsed.recentTasks)
      ? parsed.recentTasks
          .map(normalizeRecentTask)
          .filter((task): task is HubRecentTask => task !== null)
          .slice(0, RECENT_TASKS_CAP)
      : [];

    return {
      taskRoot: typeof parsed.taskRoot === 'string' && parsed.taskRoot.trim() ? parsed.taskRoot : defaultTaskRoot,
      taskRootLocked: parsed.taskRootLocked !== false,
      agentConfigLocked: parsed.agentConfigLocked !== false,
      aiConfigs: mergeAgentConfigs(storedAgents),
      recentTasks,
      // An explicit empty string (user cleared it) is honored; only a missing
      // value falls back to the default.
      broadcastSuffix:
        typeof parsed.broadcastSuffix === 'string' ? parsed.broadcastSuffix : DEFAULT_BROADCAST_SUFFIX,
    };
  } catch {
    return fallbackPreferences(defaultTaskRoot);
  }
}

export function saveHubPreferences(preferences: HubPreferences): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(HUB_STORAGE_KEY, JSON.stringify(preferences));
}
