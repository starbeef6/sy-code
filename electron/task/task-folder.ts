import fs from 'fs';
import os from 'os';
import path from 'path';

export const INPUT_SUBDIR = path.join('00_input', 'uploaded_files');
export const PROMPT_HISTORY_PATH = path.join('00_input', 'prompt_history.jsonl');

export interface PreparedTaskFolder {
  taskFolder: string;
  inputDir: string;
}

export interface AgentWorkDir {
  folderName: string;
  workDir: string;
}

function isAbsoluteOrTilde(value: string): boolean {
  return value.startsWith('/') || value === '~' || value.startsWith('~/');
}

export function resolveUserPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) throw new Error('Path must not be empty');
  if (!isAbsoluteOrTilde(trimmed)) {
    throw new Error('Path must be absolute or start with ~/');
  }

  const expanded =
    trimmed === '~'
      ? os.homedir()
      : trimmed.startsWith('~/')
        ? path.join(os.homedir(), trimmed.slice(2))
        : trimmed;
  const normalized = path.resolve(expanded);
  if (!path.isAbsolute(normalized)) throw new Error('Resolved path must be absolute');
  return normalized;
}

export function getDefaultTaskRoot(): string {
  return path.join(os.homedir(), 'AI-Terminal-Hub', 'tasks');
}

const ILLEGAL_SEGMENT_CHARS = /[\\/:*?"<>|]/g;

function stripControlChars(value: string): string {
  let out = '';
  for (const ch of value) {
    if (ch.charCodeAt(0) >= 0x20) out += ch;
  }
  return out;
}

export function sanitizeSegment(value: string, fallback: string): string {
  const sanitized = stripControlChars(value.trim())
    .replace(ILLEGAL_SEGMENT_CHARS, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .trim();
  return sanitized || fallback;
}

function splitExtension(name: string): { stem: string; ext: string } {
  const ext = path.extname(name);
  if (!ext) return { stem: name, ext: '' };
  return { stem: name.slice(0, -ext.length), ext };
}

export function uniquePath(targetPath: string): string {
  if (!fs.existsSync(targetPath)) return targetPath;
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  const { stem, ext } = splitExtension(base);
  let counter = 2;
  while (true) {
    const candidate = path.join(dir, `${stem}-${counter}${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
    counter += 1;
  }
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function isPathInsideDir(targetPath: string, dirPath: string): boolean {
  const relative = path.relative(dirPath, targetPath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function prepareTaskFolder(taskFolder: string): PreparedTaskFolder {
  ensureDir(taskFolder);
  const inputDir = path.join(taskFolder, INPUT_SUBDIR);
  ensureDir(inputDir);
  return { taskFolder, inputDir };
}

export function createTaskFolder(taskRoot: string, taskName: string): PreparedTaskFolder {
  ensureDir(taskRoot);
  const fallback = `task-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
  const safeName = sanitizeSegment(taskName, fallback);
  const taskFolder = uniquePath(path.join(taskRoot, safeName));
  ensureDir(taskFolder);
  return prepareTaskFolder(taskFolder);
}

export function ensureAgentWorkDir(taskFolder: string, folderName: string): AgentWorkDir {
  const safeFolderName = sanitizeSegment(folderName, 'agent');
  const workDir = path.join(taskFolder, safeFolderName);
  ensureDir(workDir);
  return { folderName: safeFolderName, workDir };
}
