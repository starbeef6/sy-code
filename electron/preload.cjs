const { contextBridge, ipcRenderer, webFrame, webUtils } = require('electron');

const ALLOWED_CHANNELS = new Set([
  'list_agents',
  '__dialog_open',
  'open_path',
  'hub_get_bootstrap',
  'hub_create_task_folder',
  'hub_prepare_task_folder',
  'hub_import_uploaded_files',
  'hub_delete_uploaded_file',
  'hub_find_latest_non_log_file',
  'hub_write_clipboard_text',
  // Run orchestration
  'run_dispatch',
  'run_cancel',
  // Run events (main → renderer)
  'run_started',
  'run_stdout',
  'run_stderr',
  'run_exit',
  // Interactive PTY terminals
  'pty_open',
  'pty_input',
  'pty_resize',
  'pty_kill',
  'pty_prune',
  'pty_data',
  'pty_exit',
  // Brain / pet coordinator
  'brain_gather',
  'brain_optimize',
  // Pet companion window
  'pet_set_size',
  'pet_pick_images',
  'pet_toggle',
  'pet_read_image',
]);

function assertAllowedChannel(channel) {
  if (!ALLOWED_CHANNELS.has(channel)) {
    throw new Error(`Blocked IPC channel: ${channel}`);
  }
}

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => {
      assertAllowedChannel(channel);
      return ipcRenderer.invoke(channel, ...args);
    },
    on: (channel, listener) => {
      assertAllowedChannel(channel);
      const wrapped = (_event, ...eventArgs) => listener(...eventArgs);
      ipcRenderer.on(channel, wrapped);
      return () => ipcRenderer.removeListener(channel, wrapped);
    },
    removeAllListeners: (channel) => {
      assertAllowedChannel(channel);
      ipcRenderer.removeAllListeners(channel);
    },
  },
  setZoomFactor: (factor) => webFrame.setZoomFactor(factor),
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file) || '';
    } catch {
      return '';
    }
  },
});
