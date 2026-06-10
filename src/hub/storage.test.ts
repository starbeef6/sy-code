import { afterEach, describe, expect, it } from 'vitest';
import { HUB_STORAGE_KEY } from './defaults';
import { loadHubPreferences } from './storage';

class MemoryStorage implements Storage {
  private items = new Map<string, string>();

  get length(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.items.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

describe('loadHubPreferences', () => {
  const previousLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  afterEach(() => {
    if (previousLocalStorage) {
      Object.defineProperty(globalThis, 'localStorage', previousLocalStorage);
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });

  it('migrates saved Claude product labels back to the manual launch command', () => {
    const localStorage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorage,
    });
    localStorage.setItem(
      HUB_STORAGE_KEY,
      JSON.stringify({
        taskRoot: '/tmp/tasks',
        taskRootLocked: true,
        agentConfigLocked: true,
        aiConfigs: [
          {
            id: 'claude-code',
            name: 'Claude Code',
            command: 'Claude code',
            folderName: 'claude-code',
            defaultChecked: true,
          },
        ],
      }),
    );

    const preferences = loadHubPreferences('/fallback');
    const claude = preferences.aiConfigs.find((agent) => agent.id === 'claude-code');

    expect(claude?.command).toBe('claude');
  });

  it('drops Terminal restored-session text from saved known-agent commands', () => {
    const localStorage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorage,
    });
    localStorage.setItem(
      HUB_STORAGE_KEY,
      JSON.stringify({
        taskRoot: '/tmp/tasks',
        taskRootLocked: true,
        agentConfigLocked: true,
        aiConfigs: [
          {
            id: 'claude-code',
            name: 'Claude Code',
            command: 'Restored session: 2026年 6月 5日 星期五 16时18分01秒 CST code',
            folderName: 'claude-code',
            defaultChecked: true,
          },
        ],
      }),
    );

    const preferences = loadHubPreferences('/fallback');
    const claude = preferences.aiConfigs.find((agent) => agent.id === 'claude-code');

    expect(claude?.command).toBe('claude');
  });

  it('keeps bare Gemini and Codex commands as native manual defaults', () => {
    const localStorage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorage,
    });
    localStorage.setItem(
      HUB_STORAGE_KEY,
      JSON.stringify({
        taskRoot: '/tmp/tasks',
        taskRootLocked: true,
        agentConfigLocked: true,
        aiConfigs: [
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
        ],
      }),
    );

    const preferences = loadHubPreferences('/fallback');
    const gemini = preferences.aiConfigs.find((agent) => agent.id === 'gemini');
    const codex = preferences.aiConfigs.find((agent) => agent.id === 'codex');

    expect(gemini?.command).toBe('gemini');
    expect(codex?.command).toBe('codex');
  });

  it('forces built-in agents back to native defaults when old wrapper commands were saved', () => {
    const localStorage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorage,
    });
    localStorage.setItem(
      HUB_STORAGE_KEY,
      JSON.stringify({
        taskRoot: '/tmp/tasks',
        taskRootLocked: true,
        agentConfigLocked: true,
        aiConfigs: [
          {
            id: 'claude-code',
            name: 'Claude Code',
            command: "/bin/zsh -lc 'agent-task-archive && claude code'",
            folderName: 'claude-code',
            defaultChecked: true,
          },
          {
            id: 'gemini',
            name: 'Gemini CLI',
            command: "/Users/yamijin/.gemini/gemini-shell-wrapper.sh gemini",
            folderName: 'gemini-cli',
            defaultChecked: true,
          },
          {
            id: 'codex',
            name: 'Codex CLI',
            command: "/Users/yamijin/.local/bin/codex -c developer_instructions='Codex CLI Memory Index'",
            folderName: 'codex-cli',
            defaultChecked: true,
          },
        ],
      }),
    );

    const preferences = loadHubPreferences('/fallback');
    const claude = preferences.aiConfigs.find((agent) => agent.id === 'claude-code');
    const gemini = preferences.aiConfigs.find((agent) => agent.id === 'gemini');
    const codex = preferences.aiConfigs.find((agent) => agent.id === 'codex');

    expect(claude?.command).toBe('claude');
    expect(gemini?.command).toBe('gemini');
    expect(codex?.command).toBe('codex');
  });
});
