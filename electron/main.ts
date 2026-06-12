import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, screen, session, shell } from 'electron';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { IPC } from './ipc/channels.js';
import { registerAllHandlers } from './ipc/register.js';
import { resolveUserShell } from './user-shell.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom scheme so the pet window can show GIFs the user drags in from anywhere
// on disk (file:// is blocked under the renderer's CSP).
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'pet-asset',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

const IMAGE_MIME: Record<string, string> = {
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.apng': 'image/apng',
};

let petWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
// IPC handlers register exactly once; we keep the PtyManager around so quit can
// tear every live terminal down centrally (see app.on('before-quit')).
let ptyManager: ReturnType<typeof registerAllHandlers> | null = null;

const PROTECTED_ENV_KEYS = new Set([
  'ELECTRON_RUN_AS_NODE',
  'NODE_OPTIONS',
  'NODE_EXTRA_CA_CERTS',
  'LD_PRELOAD',
  'LD_LIBRARY_PATH',
  'DYLD_INSERT_LIBRARIES',
  'DYLD_LIBRARY_PATH',
]);

const execFileAsync = promisify(execFile);

/**
 * Import the user's login-shell environment (PATH, API keys, …) into
 * process.env. Runs in the background so the window can open immediately;
 * heavy zsh setups (conda, nvm, plugins) can take seconds. Handlers that
 * spawn CLIs or probe PATH await the returned promise (never rejects).
 */
async function fixEnv(): Promise<void> {
  if (process.platform === 'win32') return;
  try {
    const loginShell = resolveUserShell();
    const sentinel = '__AI_TERMINAL_HUB_ENV__';
    const { stdout: result } = await execFileAsync(
      loginShell,
      [
        '-ilc',
        `printf '${sentinel}' && perl -e 'print "$_=$ENV{$_}\\0" for keys %ENV' && printf '${sentinel}'`,
      ],
      { encoding: 'utf8', timeout: 5000, maxBuffer: 10 * 1024 * 1024 },
    );
    const startIdx = result.indexOf(sentinel);
    const endIdx = result.lastIndexOf(sentinel);
    if (startIdx === -1 || endIdx === -1 || startIdx === endIdx) return;

    const envBlock = result.slice(startIdx + sentinel.length, endIdx);
    for (const entry of envBlock.split('\0')) {
      if (!entry) continue;
      const eqIdx = entry.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = entry.slice(0, eqIdx);
      if (PROTECTED_ENV_KEYS.has(key)) continue;
      process.env[key] = entry.slice(eqIdx + 1);
    }
  } catch (err) {
    console.warn('[fixEnv] Failed to resolve login shell environment:', err);
  }
}

function installApplicationMenu(): void {
  if (process.platform !== 'darwin') return;

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'AI Terminal Hub',
      submenu: [
        { role: 'about', label: '关于 AI Terminal Hub' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏 AI Terminal Hub' },
        { role: 'hideOthers', label: '隐藏其他应用' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出 AI Terminal Hub' },
      ],
    },
    {
      label: '文件',
      submenu: [{ role: 'close', label: '关闭窗口' }],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新载入' },
        { role: 'forceReload', label: '强制重新载入' },
        { role: 'toggleDevTools', label: '切换开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' },
        { type: 'separator' },
        { label: '显示/隐藏 宠物', accelerator: 'CmdOrCtrl+Shift+P', click: () => togglePet() },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        { type: 'separator' },
        { role: 'front', label: '前置全部窗口' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  // Re-opening from the Dock (or a second launch) should surface the existing
  // window, not spawn another one.
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  // Open large by default (sized to the screen's work area) so the interactive
  // terminals are comfortably tall without the user resizing every launch.
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(1600, Math.round(screenW * 0.92));
  const height = Math.round(screenH * 0.94);

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 980,
    minHeight: 640,
    title: 'AI Terminal Hub',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('closed', () => {
    if (petWindow && !petWindow.isDestroyed()) petWindow.close();
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

/** Re-anchor the pet window to the bottom-right of the work area at a new size. */
function anchorPetBottomRight(width: number, height: number): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  const { x, y, width: aw, height: ah } = screen.getPrimaryDisplay().workArea;
  const nx = Math.round(x + aw - width - 24);
  const ny = Math.round(y + ah - height - 24);
  petWindow.setBounds({ x: nx, y: ny, width, height });
}

function createPetWindow(): void {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.show();
    petWindow.focus();
    return;
  }
  petWindow = new BrowserWindow({
    width: 200,
    height: 220,
    minWidth: 160,
    minHeight: 160,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  anchorPetBottomRight(200, 220);

  petWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void petWindow.loadURL(`${devUrl}?window=pet`);
  } else {
    void petWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { window: 'pet' },
    });
  }

  petWindow.on('closed', () => {
    petWindow = null;
  });
}

function togglePet(): void {
  if (petWindow && !petWindow.isDestroyed()) {
    if (petWindow.isVisible()) petWindow.hide();
    else {
      petWindow.show();
      petWindow.focus();
    }
  } else {
    createPetWindow();
  }
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();

// A second launch — or clicking the Dock icon on macOS — must surface the
// window we already have instead of starting a parallel copy. createWindow()
// reuses the existing window (restoring it if minimized), so both are safe.
app.on('second-instance', () => createWindow());
app.on('activate', () => {
  createWindow();
  // The always-on-top pet window keeps the app "alive" with a visible window,
  // so a Dock click may not bring the app forward on its own. Force it, or a
  // restored-from-minimized main window can stay stuck behind other apps.
  if (process.platform === 'darwin') app.focus({ steal: true });
});

app.whenReady().then(() => {
  if (!gotTheLock) return; // losing instance: do nothing, we're already quitting

  // Kick the login-shell env import off in the background instead of blocking
  // window creation on it (it can take seconds on heavy shell setups). The
  // PATH-dependent IPC handlers await this promise before spawning anything.
  const envReady = fixEnv();

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    if (permission === 'clipboard-read' || permission === 'clipboard-sanitized-write') {
      callback(true);
      return;
    }
    if (permission === 'media') {
      const types = (details as { mediaTypes?: string[] }).mediaTypes ?? [];
      callback(types.every((type) => type === 'audio'));
      return;
    }
    callback(false);
  });

  // Serve user-chosen GIFs (any path) to the pet window.
  protocol.handle('pet-asset', async (request) => {
    try {
      const filePath = decodeURIComponent(new URL(request.url).pathname);
      const data = await fs.promises.readFile(filePath);
      const mime = IMAGE_MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
      return new Response(new Uint8Array(data), { headers: { 'content-type': mime } });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });

  ipcMain.handle(IPC.PetSetSize, (_e, args) => {
    if (!petWindow || petWindow.isDestroyed()) return;
    const width = Math.max(160, Math.round(Number(args?.width) || 200));
    const height = Math.max(160, Math.round(Number(args?.height) || 220));
    // Keep the pet's CURRENT bottom-right corner fixed (where the user dragged
    // it); the panel grows up/left from there instead of snapping to a corner.
    const b = petWindow.getBounds();
    const wa = screen.getDisplayMatching(b).workArea;
    let x = b.x + b.width - width;
    let y = b.y + b.height - height;
    x = Math.max(wa.x, Math.min(x, wa.x + wa.width - width));
    y = Math.max(wa.y, Math.min(y, wa.y + wa.height - height));
    petWindow.setBounds({ x, y, width, height });
  });

  ipcMain.handle(IPC.PetPickImages, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['gif', 'png', 'jpg', 'jpeg', 'webp', 'apng'] }],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle(IPC.PetReadImage, async (_e, args) => {
    try {
      const filePath = typeof args?.path === 'string' ? args.path : '';
      if (!filePath) return '';
      const data = await fs.promises.readFile(filePath);
      const mime = IMAGE_MIME[path.extname(filePath).toLowerCase()] ?? 'image/png';
      return `data:${mime};base64,${data.toString('base64')}`;
    } catch {
      return '';
    }
  });

  ipcMain.handle(IPC.PetToggle, () => togglePet());

  // Register IPC handlers exactly once and keep the PtyManager for quit-time
  // teardown; windows are then free to come and go (Dock reopen, etc.).
  ptyManager = registerAllHandlers(envReady);
  installApplicationMenu();
  createWindow();
  createPetWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

// Tear every live terminal down up front. A lingering CLI grandchild keeps
// node-pty's helper thread — and thus Electron's event loop — alive, which is
// what previously left the app unquittable without a manual force-quit.
//
// The teardown must NOT proceed straight into app exit: node-pty delivers each
// PTY's exit to JS via a ThreadSafeFunction from a watcher thread, and if Node
// is already tearing the environment down when that callback lands, pty.node
// aborts the whole app (SIGABRT via Napi::Error::ThrowAsJavaScriptException).
// So kill first, give the exit events one short beat to flush while the JS
// environment is still alive, then resume the actual quit.
let ptyTeardownDone = false;
app.on('before-quit', (event) => {
  if (ptyTeardownDone) return;
  ptyTeardownDone = true;
  event.preventDefault();
  ptyManager?.killAll();
  setTimeout(() => app.quit(), 250);
});
