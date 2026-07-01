import { describe, expect, it } from 'vitest';
import { buildWrappedPrompt } from './prompt.js';

describe('buildWrappedPrompt', () => {
  it('keeps the user task first and appends compact delivery context', () => {
    const result = buildWrappedPrompt({
      workDir: '/tmp/task/codex-cli',
      userTask: '整理上传的数据并输出结果',
      uploadedPaths: ['/tmp/task/00_input/uploaded_files/report.xlsx'],
    });

    expect(result.startsWith('整理上传的数据并输出结果\n\n附件路径：\n')).toBe(true);
    expect(result).toContain('1. /tmp/task/00_input/uploaded_files/report.xlsx');
    expect(result).toContain('【输出目录】/tmp/task/codex-cli');
    expect(result).toContain('所有生成的文件必须保存在上述输出目录（或其子目录）中。');
    expect(result).toContain('不要把生成的文件写到附件所在目录、桌面或主目录');
  });

  it('omits the attachment block when no files were uploaded', () => {
    const result = buildWrappedPrompt({
      workDir: '/tmp/task/claude-code',
      userTask: '只做分析',
      uploadedPaths: [],
    });

    expect(result.startsWith('只做分析\n\n---\n【输出目录】/tmp/task/claude-code\n')).toBe(true);
    expect(result).not.toContain('附件路径');
  });
});
