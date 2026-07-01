import type { AgentAdapter, InvocationInput, Invocation } from './types.js';

/**
 * Antigravity (`agy`) non-interactive adapter — the Gemini slot now runs
 * Antigravity, since Google retired the standalone Gemini CLI's personal login.
 *
 * agy's flags differ from gemini's: print mode is `-p` (plain text by default,
 * so no `-o text`); there is no `--skip-trust`/`--approval-mode` (it errors on
 * those) — auto-approve is `--dangerously-skip-permissions`; workspace dirs use
 * `--add-dir` (not `--include-directories`); resume is `--conversation <id>`;
 * model is `--model`.
 */
export function createGeminiAdapter(binary: string): AgentAdapter {
  return {
    id: 'gemini',
    displayName: 'Antigravity',
    buildInvocation(input: InvocationInput): Invocation {
      const args = ['-p', input.prompt];

      // agy has no granular "auto-edit" tier: anything above "safe" maps to
      // its single auto-approve flag.
      if (input.autonomy === 'full-auto' || input.autonomy === 'auto-edit') {
        args.push('--dangerously-skip-permissions');
      }

      if (input.model) args.push('--model', input.model);
      if (input.accessRoot) args.push('--add-dir', input.accessRoot);
      if (input.resumeSessionId) args.push('--conversation', input.resumeSessionId);

      return {
        command: binary,
        args,
        cwd: input.workDir,
      };
    },
  };
}
