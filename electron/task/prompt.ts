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

  lines.push('', `输出目录：${input.workDir}`, '请把生成文件保存在这个输出目录中。');
  return lines.join('\n');
}
