import type { HubAgentConfig } from './types';

export const HUB_STORAGE_KEY = 'ai-terminal-hub-preferences-v1';

/**
 * Default text appended when the user sends a broadcast via the 广播发送 button.
 * Phrased relatively ("当前工作目录") so one shared line is correct for every
 * pane regardless of its own cwd. Must not start with `@` or `/` (some CLIs
 * would parse those as a file-reference or slash-command).
 */
export const DEFAULT_BROADCAST_SUFFIX =
  '（请把本次生成的所有文件保存到当前工作目录内，不要写到桌面或其它目录；读取外部输入文件不受限。）';

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
    name: 'Antigravity',
    command: 'agy',
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
