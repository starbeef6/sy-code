import type { AgentAdapter, InvocationInput, Invocation } from './types.js';

/**
 * Fallback adapter for custom / unknown agents. We can't know a third-party
 * CLI's flags, so we run the user-provided command verbatim and feed the prompt
 * on stdin. Best effort: CLIs that don't read stdin won't receive the task.
 */
export function createGenericAdapter(
  id: string,
  displayName: string,
  command: string,
  baseArgs: string[],
): AgentAdapter {
  return {
    id,
    displayName,
    buildInvocation(input: InvocationInput): Invocation {
      return {
        command,
        args: [...baseArgs],
        stdin: input.prompt,
        cwd: input.workDir,
      };
    },
  };
}
