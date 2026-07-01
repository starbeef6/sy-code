export interface WrappedPromptInput {
  workDir: string;
  userTask: string;
  uploadedPaths: string[];
}

/**
 * Compose the final text handed to an agent: the user's task verbatim first,
 * then a compact, unambiguous delivery context (attachment paths + output dir).
 * Kept deliberately minimal — no role wrappers, no noise.
 */
export function buildWrappedPrompt(input: WrappedPromptInput): string {
  const userTask = input.userTask.trim();
  const lines = [userTask];

  if (input.uploadedPaths.length > 0) {
    lines.push(
      '',
      '附件路径：',
      ...input.uploadedPaths.map((filePath, index) => `${index + 1}. ${filePath}`),
    );
  }

  lines.push(
    '',
    '---',
    `【输出目录】${input.workDir}`,
    '所有生成的文件必须保存在上述输出目录（或其子目录）中。',
    '即使附件位于其他目录（例如桌面），也不要把生成的文件写到附件所在目录、桌面或主目录。',
  );
  return lines.join('\n');
}
