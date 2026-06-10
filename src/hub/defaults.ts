import type { HubAgentConfig } from './types';

export const HUB_STORAGE_KEY = 'ai-terminal-hub-preferences-v1';

export const DEFAULT_AGENT_CONFIGS: HubAgentConfig[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    command: 'claude',
    folderName: 'claude-code',
    defaultChecked: true,
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    command: 'gemini',
    folderName: 'gemini-cli',
    defaultChecked: true,
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    command: 'codex',
    folderName: 'codex-cli',
    defaultChecked: true,
  },
];
