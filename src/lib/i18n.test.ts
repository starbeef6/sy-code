import { describe, expect, it } from 'vitest';
import { normalizeUiLocale, translateUiText } from './i18n';

describe('i18n', () => {
  it('translates exact UI labels for zh-CN', () => {
    expect(translateUiText('Settings', 'zh-CN')).toBe('设置');
    expect(translateUiText('Add project', 'zh-CN')).toBe('添加项目');
    expect(translateUiText('Parallel Code', 'zh-CN')).toBe('SY CODE');
    expect(translateUiText('Reconnecting...', 'zh-CN')).toBe('正在重新连接...');
  });

  it('normalizes whitespace in multi-line UI copy before translating', () => {
    expect(
      translateUiText(
        `  Automatic updates are not available for this build.
 Download the latest release from GitHub to update.  `,
        'zh-CN',
      ),
    ).toBe('  此构建已关闭自动更新，以防官方版本覆盖 SY CODE。  ');
  });

  it('translates dynamic running-session messages for zh-CN', () => {
    expect(translateUiText('3 running terminal sessions', 'zh-CN')).toBe('3 个正在运行的终端会话');
    expect(
      translateUiText(
        'You have 3 running terminal sessions. They can be restored on app restart. Kill them and quit, keep them alive in the background, or cancel?',
        'zh-CN',
      ),
    ).toBe(
      '你有3 个正在运行的终端会话。重启应用后可以恢复。要结束它们并退出、让它们在后台继续运行，还是取消？',
    );
  });

  it('keeps English text unchanged for non-Chinese locales', () => {
    expect(translateUiText('Settings', 'en')).toBe('Settings');
  });

  it('normalizes Chinese locale variants', () => {
    expect(normalizeUiLocale('zh_CN')).toBe('zh-CN');
    expect(normalizeUiLocale('zh-TW')).toBe('zh-CN');
    expect(normalizeUiLocale('en-US')).toBe('en');
  });
});
