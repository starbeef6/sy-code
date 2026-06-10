import type { AutonomyMode } from '../ipc/contracts.js';

export type { AutonomyMode };

export interface InvocationInput {
  /** Final text handed to the CLI (user task + attachment paths + output dir). */
  prompt: string;
  /** Where the agent should write its output (its dedicated subfolder). */
  workDir: string;
  /**
   * The task folder root. Both the agent's output dir and the uploaded
   * attachments live under here. Adapters grant the agent access to this root
   * (Claude `--add-dir`, Gemini `--include-directories`, or Codex by rooting
   * its sandbox cwd here) so strict sandboxes can still read attachments.
   */
  accessRoot: string;
  /** How autonomous the agent is allowed to be (maps to per-CLI flags). */
  autonomy: AutonomyMode;
  /** Optional model override. */
  model?: string;
  /** Optional session id to resume a previous conversation. */
  resumeSessionId?: string;
}

/** A concrete, ready-to-spawn process description. */
export interface Invocation {
  command: string;
  args: string[];
  /** When present, written to the child's stdin then closed. */
  stdin?: string;
  cwd: string;
}

export interface AgentAdapter {
  id: string;
  displayName: string;
  /**
   * Translate a task into a concrete CLI invocation. Pure: given the same
   * input it must produce the same output, so it can be unit-tested without
   * a real CLI. This is the single place per-CLI flag knowledge lives.
   */
  buildInvocation(input: InvocationInput): Invocation;
}
