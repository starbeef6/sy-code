import { IPC } from '../../electron/ipc/channels';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
        on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
        removeAllListeners: (channel: string) => void;
      };
      setZoomFactor: (factor: number) => void;
      getPathForFile: (file: File) => string;
    };
  }
}

/** True when running inside Electron (vs. plain browser preview). */
export function hasElectronRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.electron?.ipcRenderer?.invoke === 'function';
}

export async function invoke<T>(cmd: IPC, args?: Record<string, unknown>): Promise<T> {
  const safeArgs = args ? (JSON.parse(JSON.stringify(args)) as Record<string, unknown>) : undefined;
  return window.electron.ipcRenderer.invoke(cmd, safeArgs) as Promise<T>;
}

/**
 * Subscribe to a main → renderer event channel. Returns an unsubscribe fn.
 * No-op (returns a noop) when not running inside Electron.
 */
export function subscribe<T>(channel: IPC, listener: (payload: T) => void): () => void {
  if (typeof window === 'undefined' || typeof window.electron?.ipcRenderer?.on !== 'function') {
    return () => undefined;
  }
  return window.electron.ipcRenderer.on(channel, (payload) => listener(payload as T));
}
