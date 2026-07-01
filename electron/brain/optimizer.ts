import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { buildAgentEnv, resolveCommandForSpawn } from '../env/resolver.js';
import { findLatestNonLogFile } from '../task/uploads.js';

/** Minimal view of the PtyManager the brain reads context from (read-only). */
export interface TerminalSource {
  list(): Array<{ sessionId: string; agentId: string; cwd: string }>;
  getScrollback(sessionId: string): string;
}

export interface GatherOptions {
  taskFolder: string;
  includeHistory: boolean;
  includeTerminals: boolean;
}

export interface GatherResult {
  contextText: string;
  summary: string;
}

const ANSI = /\x1b\[[0-9;?]*[a-zA-Z]|\x1b[()][AB0]|\x1b[<=>]/g;
const HISTORY_LIMIT = 20;
const TERMINAL_TAIL_BYTES = 2200;

function stripAnsi(text: string): string {
  return text.replace(ANSI, '');
}

/**
 * Read-only gather of the "scene" the brain may digest. Nothing here writes to
 * the terminals — it only reads prompt history and PTY scrollback.
 */
export async function gatherContext(
  opts: GatherOptions,
  terminals: TerminalSource,
): Promise<GatherResult> {
  const parts: string[] = [];
  const summaryBits: string[] = [];

  if (opts.includeHistory) {
    const histPath = path.join(opts.taskFolder, '00_input', 'prompt_history.jsonl');
    if (fs.existsSync(histPath)) {
      const lines = fs.readFileSync(histPath, 'utf8').split('\n').filter(Boolean);
      const recent = lines
        .slice(-HISTORY_LIMIT)
        .map((line) => {
          try {
            const parsed = JSON.parse(line) as Record<string, unknown>;
            const text = parsed.userText ?? parsed.text ?? parsed.prompt;
            return typeof text === 'string' ? text.trim() : '';
          } catch {
            return '';
          }
        })
        .filter(Boolean);
      if (recent.length > 0) {
        parts.push(
          '【我最近发过的指令】\n' + recent.map((text, i) => `${i + 1}. ${text}`).join('\n'),
        );
        summaryBits.push(`prompt历史 ${recent.length} 条`);
      }
    }
  }

  if (opts.includeTerminals) {
    const sessions = terminals.list();
    const termParts: string[] = [];
    for (const session of sessions) {
      const clean = stripAnsi(terminals.getScrollback(session.sessionId)).trim();
      const tail = clean.slice(-TERMINAL_TAIL_BYTES);
      let latestFile = '';
      try {
        latestFile = (await findLatestNonLogFile(session.cwd)) ?? '';
      } catch {
        latestFile = '';
      }
      termParts.push(
        `### ${session.agentId}（${session.cwd}）\n` +
          `最新产出文件: ${latestFile || '(无)'}\n` +
          `最近输出:\n${tail || '(暂无输出)'}`,
      );
    }
    if (termParts.length > 0) {
      parts.push('【终端现场】\n' + termParts.join('\n\n'));
      summaryBits.push(`${sessions.length} 终端`);
    }
  }

  return {
    contextText: parts.join('\n\n'),
    summary: summaryBits.length > 0 ? summaryBits.join(' · ') : '空',
  };
}

/** Build the optimizer instruction sent to Codex. */
export function buildOptimizerPrompt(contextText: string, taskText: string): string {
  return [
    '你是一个"指令优化器"。下面给你当前多终端 AI 工作台的现场上下文（可能为空），以及用户用大白话写的原始需求。',
    '请把用户的需求加工成一条【精炼、明确、信息完整、可直接粘贴给多个 AI 终端执行】的中文指令。',
    '要求：补全隐含信息、指明涉及的文件/路径、消除歧义、给出明确的产出要求；不要替用户臆造不存在的需求。',
    '只输出这条优化后的指令本身，不要任何解释、不要前后缀、不要代码块包裹。',
    '',
    '【现场上下文】',
    contextText || '(用户这次没有投喂上下文)',
    '',
    '【用户原始需求】',
    taskText || '(空)',
    '',
    '【优化后的指令】',
  ].join('\n');
}

export interface OptimizeOptions {
  command: string;
  taskFolder: string;
  prompt: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * Run Codex (full-auto, multimodal, the user's unlimited-quota account) on the
 * optimizer prompt and return its stdout. Codex can read files/paths the prompt
 * references because it runs with full access rooted at the task folder.
 */
export function runCodexOptimize(opts: OptimizeOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    let file: string;
    try {
      file = resolveCommandForSpawn(opts.command);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    const args = [
      'exec',
      '-',
      '--cd',
      opts.taskFolder,
      '--skip-git-repo-check',
      '--color',
      'never',
      '--dangerously-bypass-approvals-and-sandbox',
    ];
    if (opts.model) args.push('-m', opts.model);

    const child = spawn(file, args, { cwd: opts.taskFolder, env: buildAgentEnv() });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('优化超时（>180s）'));
    }, opts.timeoutMs ?? 180_000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (stdout.trim()) resolve(stdout);
      else reject(new Error(stderr.trim() || `codex 退出码 ${code}`));
    });
    child.stdin.end(opts.prompt);
  });
}
