import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureAgentInstructions } from './agent-instructions.js';

describe('ensureAgentInstructions', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-instr-'));
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('falls back to AGENTS.md for a custom agent id', () => {
    ensureAgentInstructions(workDir, 'custom-1234');
    const filePath = path.join(workDir, 'AGENTS.md');
    expect(fs.existsSync(filePath)).toBe(true);
    const body = fs.readFileSync(filePath, 'utf8');
    expect(body).toContain('输出目录');
    expect(body).toContain(workDir);
  });

  it('uses CLAUDE.md / GEMINI.md / AGENTS.md by agent id', () => {
    ensureAgentInstructions(workDir, 'claude-code');
    expect(fs.existsSync(path.join(workDir, 'CLAUDE.md'))).toBe(true);

    ensureAgentInstructions(workDir, 'gemini');
    expect(fs.existsSync(path.join(workDir, 'GEMINI.md'))).toBe(true);

    ensureAgentInstructions(workDir, 'codex');
    expect(fs.existsSync(path.join(workDir, 'AGENTS.md'))).toBe(true);
  });

  it('never overwrites an existing instruction file', () => {
    const filePath = path.join(workDir, 'CLAUDE.md');
    fs.writeFileSync(filePath, 'user content', 'utf8');
    ensureAgentInstructions(workDir, 'claude-code');
    expect(fs.readFileSync(filePath, 'utf8')).toBe('user content');
  });
});
