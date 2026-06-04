// Dialog — wraps Electron dialog IPC calls.

import { IPC } from '../../electron/ipc/channels';
import { t } from './i18n';

interface ConfirmOptions {
  title?: string;
  kind?: string;
  okLabel?: string;
  cancelLabel?: string;
}

export async function confirm(message: string, options?: ConfirmOptions): Promise<boolean> {
  return window.electron.ipcRenderer.invoke(IPC.DialogConfirm, {
    ...options,
    message: t(message),
    title: options?.title ? t(options.title) : undefined,
    okLabel: options?.okLabel ? t(options.okLabel) : undefined,
    cancelLabel: options?.cancelLabel ? t(options.cancelLabel) : undefined,
  }) as Promise<boolean>;
}

interface ChoiceOptions {
  title?: string;
  kind?: string;
  buttons: string[];
  /** Button index selected by Enter. */
  defaultId?: number;
  /** Button index returned for Escape / window-close. */
  cancelId?: number;
}

/** Multi-button dialog. Resolves to the index of the chosen button. */
export async function choice(message: string, options: ChoiceOptions): Promise<number> {
  return window.electron.ipcRenderer.invoke(IPC.DialogChoice, {
    ...options,
    message: t(message),
    title: options.title ? t(options.title) : undefined,
    buttons: options.buttons.map((button) => t(button)),
  }) as Promise<number>;
}

interface OpenDialogOptions {
  directory?: boolean;
  multiple?: boolean;
}

export async function openDialog(options?: OpenDialogOptions): Promise<string | string[] | null> {
  return window.electron.ipcRenderer.invoke(IPC.DialogOpen, options) as Promise<
    string | string[] | null
  >;
}
