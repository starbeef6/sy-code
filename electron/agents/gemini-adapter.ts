import type { AgentAdapter, InvocationInput, Invocation } from './types.js';

/**
 * Gemini CLI non-interactive adapter (`gemini -p`).
 *
 * - Prompt is passed as the value of `-p` (Gemini's documented headless input).
 * - `--skip-trust` replaces the old fragile "detect trust prompt and stuff 1\r".
 * - Verified against Gemini CLI 0.45.2 (see 架构.md appendix A).
 */
export function createGeminiAdapter(binary: string): AgentAdapter {
  return {
    id: 'gemini',
    displayName: 'Gemini CLI',
    buildInvocation(input: InvocationInput): Invocation {
      const args = ['-p', input.prompt, '-o', 'text', '--skip-trust'];

      if (input.autonomy === 'auto-edit') {
        args.push('--approval-mode', 'auto_edit');
      } else if (input.autonomy === 'full-auto') {
        args.push('--approval-mode', 'yolo');
      } else {
        args.push('--approval-mode', 'default');
      }

      if (input.model) args.push('-m', input.model);
      if (input.accessRoot) args.push('--include-directories', input.accessRoot);
      if (input.resumeSessionId) args.push('--resume', input.resumeSessionId);

      return {
        command: binary,
        args,
        cwd: input.workDir,
      };
    },
  };
}
