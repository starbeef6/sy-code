import type { AutonomyMode } from '../ipc/contracts.js';

export interface InteractiveCommandInput {
  /** Catalog agent id: 'claude-code' | 'gemini' | 'codex' | other. */
  agentId: string;
  /** Resolved binary/command name (e.g. 'claude'). */
  command: string;
  /** Autonomy mode → per-CLI permission flags. */
  autonomy: AutonomyMode;
  /** Optional model override. */
  model?: string;
  /** Directory the agent runs in (PTY cwd) and may access. */
  workDir: string;
}

export interface InteractiveCommand {
  command: string;
  args: string[];
}

/**
 * Build the argv to launch a CLI in its INTERACTIVE TUI mode (no `-p`/`exec`).
 *
 * Unlike the one-shot adapters, an interactive session keeps the process alive
 * so the conversation is continuous and slash commands (`/model`, `/login`, …)
 * work. Autonomy still maps to the same per-CLI permission flags, but in
 * interactive mode the user can also answer prompts directly in the terminal,
 * so even "safe" is usable.
 */
export function buildInteractiveCommand(input: InteractiveCommandInput): InteractiveCommand {
  const { agentId, command, autonomy, model } = input;

  switch (agentId) {
    case 'claude-code': {
      const args: string[] = [];
      if (autonomy === 'auto-edit') args.push('--permission-mode', 'acceptEdits');
      else if (autonomy === 'full-auto') args.push('--dangerously-skip-permissions');
      if (model) args.push('--model', model);
      return { command, args };
    }

    case 'gemini': {
      // This slot now drives Antigravity (`agy`): Google retired the standalone
      // Gemini CLI's personal login and pushed users to Antigravity. agy does
      // NOT accept gemini's --approval-mode / --skip-trust (it errors out with
      // "flags provided but not defined"). Its auto-approve flag is
      // --dangerously-skip-permissions, and it has no separate "auto-edit"
      // tier — only prompt (default) vs skip-all. Model flag is --model.
      const args: string[] = [];
      if (autonomy === 'full-auto' || autonomy === 'auto-edit') {
        args.push('--dangerously-skip-permissions');
      }
      if (model) args.push('--model', model);
      return { command, args };
    }

    case 'codex': {
      const args: string[] = [];
      if (autonomy === 'auto-edit') args.push('--sandbox', 'workspace-write');
      else if (autonomy === 'full-auto') args.push('--dangerously-bypass-approvals-and-sandbox');
      if (model) args.push('-m', model);
      return { command, args };
    }

    default: {
      // Unknown agent: launch the bare interactive command, model-agnostic.
      return { command, args: [] };
    }
  }
}
