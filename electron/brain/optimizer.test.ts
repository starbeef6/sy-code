import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildOptimizerPrompt, gatherContext, type TerminalSource } from './optimizer.js';

const tempDirs: string[] = [];

function makeTaskFolder(historyLines: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aihub-brain-'));
  tempDirs.push(dir);
  const inputDir = path.join(dir, '00_input');
  fs.mkdirSync(inputDir, { recursive: true });
  fs.writeFileSync(path.join(inputDir, 'prompt_history.jsonl'), historyLines.join('\n'));
  return dir;
}

const emptyTerminals: TerminalSource = { list: () => [], getScrollback: () => '' };

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('buildOptimizerPrompt', () => {
  it('embeds the user text and context under the expected headers', () => {
    const prompt = buildOptimizerPrompt('某些上下文', '帮我分析数据');
    expect(prompt).toContain('指令优化器');
    expect(prompt).toContain('某些上下文');
    expect(prompt).toContain('帮我分析数据');
    expect(prompt).toContain('【优化后的指令】');
  });

  it('marks empty context/task explicitly', () => {
    const prompt = buildOptimizerPrompt('', '');
    expect(prompt).toContain('用户这次没有投喂上下文');
  });
});

describe('gatherContext', () => {
  it('returns empty when nothing selected', async () => {
    const folder = makeTaskFolder(['{"userText":"hi"}']);
    const result = await gatherContext(
      { taskFolder: folder, includeHistory: false, includeTerminals: false },
      emptyTerminals,
    );
    expect(result.contextText).toBe('');
    expect(result.summary).toBe('空');
  });

  it('includes prompt history when requested', async () => {
    const folder = makeTaskFolder(['{"userText":"第一条"}', '{"userText":"第二条"}']);
    const result = await gatherContext(
      { taskFolder: folder, includeHistory: true, includeTerminals: false },
      emptyTerminals,
    );
    expect(result.contextText).toContain('第一条');
    expect(result.contextText).toContain('第二条');
    expect(result.summary).toContain('prompt历史 2 条');
  });

  it('includes terminal scrollback (ANSI stripped) when requested', async () => {
    const folder = makeTaskFolder([]);
    const terminals: TerminalSource = {
      list: () => [{ sessionId: 's1', agentId: 'codex', cwd: folder }],
      getScrollback: () => '\x1b[31m红色\x1b[0m 输出内容',
    };
    const result = await gatherContext(
      { taskFolder: folder, includeHistory: false, includeTerminals: true },
      terminals,
    );
    expect(result.contextText).toContain('红色 输出内容');
    expect(result.contextText).not.toContain('\x1b[31m');
    expect(result.summary).toContain('1 终端');
  });
});
