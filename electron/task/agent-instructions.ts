import fs from 'fs';
import path from 'path';

/**
 * Per-CLI instruction filenames that the known CLIs read automatically from
 * their cwd on startup. Anything not listed here (custom/user-added agents)
 * falls back to AGENTS.md — the cross-tool standard that opencode, Codex and
 * most other CLIs honor — so a custom agent is still confined to its folder.
 */
const INSTRUCTION_FILENAMES: Record<string, string> = {
  'claude-code': 'CLAUDE.md',
  gemini: 'GEMINI.md',
  codex: 'AGENTS.md',
};

const FALLBACK_FILENAME = 'AGENTS.md';

function buildInstructionContent(workDir: string): string {
  return [
    '# 输出目录规则',
    '',
    `**这是你的专属工作目录（${workDir}），所有生成的文件必须保存在这个目录或其子目录内。**`,
    '',
    '- 即使任务中提到的输入/参考文件位于其他目录（例如桌面），生成的文件也不要写到那些目录。',
    '- 禁止写入桌面、用户主目录，或本目录之外的任何路径。',
    '- 读取附件可以使用附件给出的绝对路径，但写出结果时必须使用本目录下的相对路径。',
    '',
  ].join('\n');
}

/**
 * Drop a startup instruction file (CLAUDE.md / GEMINI.md / AGENTS.md) into an
 * agent's dedicated work directory, telling it to confine its output to that
 * directory. Known agents get their native filename; custom/unknown agents
 * fall back to AGENTS.md so they're covered too. Idempotent: never overwrites
 * an existing file, so it won't clobber a user's own customizations.
 */
export function ensureAgentInstructions(workDir: string, agentId: string): void {
  const filename = INSTRUCTION_FILENAMES[agentId] ?? FALLBACK_FILENAME;
  const filePath = path.join(workDir, filename);
  if (fs.existsSync(filePath)) return;
  fs.writeFileSync(filePath, buildInstructionContent(workDir), 'utf8');
}
