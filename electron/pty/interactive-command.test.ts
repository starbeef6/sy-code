import { describe, expect, it } from 'vitest';
import { buildInteractiveCommand } from './interactive-command.js';

const base = { command: 'x', workDir: '/tmp/work' };

describe('buildInteractiveCommand', () => {
  it('claude: no -p, autonomy + model map to interactive flags', () => {
    expect(buildInteractiveCommand({ agentId: 'claude-code', autonomy: 'safe', ...base }).args).toEqual(
      [],
    );
    expect(
      buildInteractiveCommand({ agentId: 'claude-code', autonomy: 'auto-edit', ...base }).args,
    ).toEqual(['--permission-mode', 'acceptEdits']);
    expect(
      buildInteractiveCommand({
        agentId: 'claude-code',
        autonomy: 'full-auto',
        model: 'opus',
        ...base,
      }).args,
    ).toEqual(['--dangerously-skip-permissions', '--model', 'opus']);
  });

  it('gemini→agy: skip-permissions for full-auto, --model for model', () => {
    expect(
      buildInteractiveCommand({ agentId: 'gemini', autonomy: 'full-auto', model: 'pro', ...base })
        .args,
    ).toEqual(['--dangerously-skip-permissions', '--model', 'pro']);
  });

  it('codex: workspace-write for auto-edit, bypass for full-auto', () => {
    expect(buildInteractiveCommand({ agentId: 'codex', autonomy: 'auto-edit', ...base }).args).toEqual(
      ['--sandbox', 'workspace-write'],
    );
    expect(buildInteractiveCommand({ agentId: 'codex', autonomy: 'full-auto', ...base }).args).toEqual(
      ['--dangerously-bypass-approvals-and-sandbox'],
    );
  });

  it('never emits -p / exec (those are one-shot modes)', () => {
    for (const agentId of ['claude-code', 'gemini', 'codex']) {
      const { args } = buildInteractiveCommand({ agentId, autonomy: 'full-auto', ...base });
      expect(args).not.toContain('-p');
      expect(args).not.toContain('exec');
    }
  });

  it('unknown agent: bare command, no flags', () => {
    expect(buildInteractiveCommand({ agentId: 'mystery', autonomy: 'full-auto', ...base })).toEqual({
      command: 'x',
      args: [],
    });
  });
});
