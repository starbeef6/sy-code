import type { AgentAdapter, InvocationInput, Invocation } from './types.js';

/**
 * Claude Code non-interactive adapter (`claude -p`).
 *
 * - Prompt is fed via stdin (no argv length limits, no newline breakage).
 * - stream-json is intentionally avoided in v1; plain text streams fine.
 * - Verified against Claude Code 2.1.168 (see 架构.md appendix A).
 */
export function createClaudeAdapter(binary: string): AgentAdapter {
  return {
    id: 'claude-code',
    displayName: 'Claude Code',
    buildInvocation(input: InvocationInput): Invocation {
      const args = ['-p', '--output-format', 'text'];

      if (input.autonomy === 'auto-edit') {
        args.push('--permission-mode', 'acceptEdits');
      } else if (input.autonomy === 'full-auto') {
        args.push('--dangerously-skip-permissions');
      } else {
        args.push('--permission-mode', 'default');
      }

      if (input.model) args.push('--model', input.model);
      if (input.accessRoot) args.push('--add-dir', input.accessRoot);
      if (input.resumeSessionId) args.push('--resume', input.resumeSessionId);

      return {
        command: binary,
        args,
        stdin: input.prompt,
        cwd: input.workDir,
      };
    },
  };
}
