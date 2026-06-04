import { t } from './i18n';

// Maps the close-confirmation dialog's button index to a close action.
//
// The dialog (shown when the window is closed with live PTY sessions) offers
// three choices. Cancel is last and is also the safe fallback for any
// out-of-range index (e.g. Escape / window-X mapped to cancelId).

export type CloseAction = 'kill' | 'background' | 'abort';

export const CLOSE_DIALOG_BUTTONS = [
  t('Kill & Quit'),
  t('Keep in Background'),
  t('Cancel'),
] as const;

export function resolveCloseChoice(index: number): CloseAction {
  switch (index) {
    case 0:
      return 'kill';
    case 1:
      return 'background';
    default:
      return 'abort';
  }
}
