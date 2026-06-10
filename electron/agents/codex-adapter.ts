import type { AgentAdapter, InvocationInput, Invocation } from './types.js';

/**
 * Codex CLI non-interactive adapter (`codex exec`).
 *
 * - Prompt is read from stdin (the `-` placeholder).
 * - Codex has the strictest sandbox, so we root its cwd at the task `accessRoot`
 *   (which contains both the attachments and the agent's output subfolder).
 *   The prompt itself directs output into the dedicated workDir.
 * - Verified against Codex 0.137.0-alpha.4 (see 架构.md appendix A).
 */
export function createCodexAdapter(binary: string): AgentAdapter {
  return {
    id: 'codex',
    displayName: 'Codex CLI',
    buildInvocation(input: InvocationInput): Invocation {
      const cwd = input.accessRoot || input.workDir;
      const args = ['exec', '-', '--cd', cwd, '--skip-git-repo-check', '--color', 'never'];

      if (input.autonomy === 'auto-edit') {
        args.push('--sandbox', 'workspace-write');
      } else if (input.autonomy === 'full-auto') {
        args.push('--dangerously-bypass-approvals-and-sandbox');
      } else {
        args.push('--sandbox', 'read-only');
      }

      if (input.model) args.push('-m', input.model);

      return {
        command: binary,
        args,
        stdin: input.prompt,
        cwd,
      };
    },
  };
}
