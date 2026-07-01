export function basenameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/u).filter(Boolean).pop() ?? filePath;
}

/**
 * Wrap a dropped file path in single quotes before inserting it into a CLI's
 * input. Always quoting (not just when it contains a space) is deliberate: a
 * raw path begins with `/`, which several TUIs (opencode, and the slash-command
 * menus in claude/gemini/codex) treat as "open command palette" — the popup
 * then swallows the Enter and the message never sends. A leading `'` sidesteps
 * that, also escapes spaces, and avoids `@` being read as a file-reference
 * trigger. Embedded single quotes are escaped shell-style so the quoting stays
 * balanced.
 */
export function quoteDroppedPath(filePath: string): string {
  return `'${filePath.replace(/'/gu, "'\\''")}'`;
}
