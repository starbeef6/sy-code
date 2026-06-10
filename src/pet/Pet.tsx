import { For, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { IPC } from '../../electron/ipc/channels';
import { invoke } from '../lib/ipc';
import AgentTerminal from '../hub/AgentTerminal';
import './pet.css';

const IMAGE_EXT = ['.gif', '.png', '.jpg', '.jpeg', '.webp', '.apng'];

const DEFAULT_SYS =
  '你是我的"总指挥大脑"。我在用一个叫 AI Terminal Hub 的工具，同时控制三个 AI 终端' +
  '（Claude Code、Gemini CLI、Codex CLI），把同一个任务派给它们、对比结果。你是一个独立、' +
  '不受文件夹限制的 Codex 会话。我会把"现场"（三个终端最近的输出、我发过的指令、相关文件路径）' +
  '投喂给你。你的任务：理解现场，把我的大白话需求加工成一条精炼、明确、可直接粘贴给那三个终端' +
  '执行的中文指令；必要时先读文件或验证。回答简洁。';

function loadGifs(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem('pet.gifs') ?? '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function loadInterval(): number {
  const n = Number(localStorage.getItem('pet.intervalSec'));
  return Number.isFinite(n) && n >= 1 ? n : 8;
}
function isImagePath(p: string): boolean {
  const lower = p.toLowerCase();
  return IMAGE_EXT.some((ext) => lower.endsWith(ext));
}
function pathsFromDrop(event: DragEvent): string[] {
  const files = event.dataTransfer?.files;
  if (!files) return [];
  const out: string[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const p = window.electron?.getPathForFile?.(files[i]) ?? '';
    if (p) out.push(p);
  }
  return out;
}

interface GatherResult {
  contextText: string;
  summary: string;
}

export default function Pet() {
  const [gifs, setGifs] = createSignal<string[]>(loadGifs());
  const [intervalSec, setIntervalSec] = createSignal<number>(loadInterval());
  const [idx, setIdx] = createSignal(0);
  const [panel, setPanel] = createSignal<'none' | 'settings' | 'brain'>('none');

  // Brain (live Codex) state
  const [launched, setLaunched] = createSignal(false);
  const [codexSession, setCodexSession] = createSignal<string | null>(null);
  const [sysPrompt, setSysPrompt] = createSignal(localStorage.getItem('pet.sysPrompt') ?? DEFAULT_SYS);
  const [showSys, setShowSys] = createSignal(false);
  const [homeDir, setHomeDir] = createSignal('');
  const [chatInput, setChatInput] = createSignal('');
  const [includeHistory, setIncludeHistory] = createSignal(true);
  const [includeTerminals, setIncludeTerminals] = createSignal(true);
  const [status, setStatus] = createSignal('');

  // path -> data URL (read in the main process; bulletproof in <img>).
  const [urls, setUrls] = createSignal<Record<string, string>>({});
  const requested = new Set<string>();

  onMount(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    void invoke<{ homeDir?: string; defaultTaskRoot?: string }>(IPC.HubGetBootstrap).then((b) => {
      setHomeDir(b?.homeDir || b?.defaultTaskRoot || '');
    });
  });

  createEffect(() => {
    const list = gifs();
    localStorage.setItem('pet.gifs', JSON.stringify(list));
    if (idx() >= list.length) setIdx(0);
  });
  createEffect(() => {
    for (const p of gifs()) {
      if (requested.has(p)) continue;
      requested.add(p);
      void invoke<string>(IPC.PetReadImage, { path: p }).then((url) => {
        if (url) setUrls((prev) => ({ ...prev, [p]: url }));
      });
    }
  });
  createEffect(() => localStorage.setItem('pet.intervalSec', String(intervalSec())));
  createEffect(() => localStorage.setItem('pet.sysPrompt', sysPrompt()));

  createEffect(() => {
    const list = gifs();
    const secs = intervalSec();
    if (list.length <= 1) return;
    const timer = window.setInterval(() => setIdx((i) => (i + 1) % list.length), secs * 1000);
    onCleanup(() => window.clearInterval(timer));
  });

  // Resize the window to fit the open panel (it's also user-resizable).
  createEffect(() => {
    const p = panel();
    const availH = window.screen?.availHeight ?? 900;
    const size =
      p === 'brain'
        ? { width: 500, height: Math.min(820, availH - 60) }
        : p === 'settings'
          ? { width: 400, height: 470 }
          : { width: 200, height: 220 };
    void invoke(IPC.PetSetSize, size);
  });

  const current = () => {
    const list = gifs();
    return list.length > 0 ? list[idx() % list.length] : '';
  };

  function addGifs(paths: string[]): void {
    const imgs = paths.filter(isImagePath);
    if (imgs.length === 0) return;
    setGifs((prev) => [...prev, ...imgs.filter((p) => !prev.includes(p))]);
  }
  function removeGif(p: string): void {
    setGifs((prev) => prev.filter((x) => x !== p));
  }
  async function pickGifs(): Promise<void> {
    const picked = await invoke<string[]>(IPC.PetPickImages);
    if (Array.isArray(picked)) addGifs(picked);
  }

  // --- live Codex helpers ---
  function writeToCodex(data: string): void {
    const id = codexSession();
    if (id) void invoke(IPC.PtyInput, { sessionId: id, data });
  }
  function sendLine(text: string): void {
    if (!text) return;
    writeToCodex(text);
    window.setTimeout(() => writeToCodex('\r'), 60);
  }
  function launch(): void {
    if (!launched()) setLaunched(true);
  }
  function quitBrain(): void {
    // Unmounting AgentTerminal kills the PTY; this is the only real "stop".
    setLaunched(false);
    setCodexSession(null);
    setStatus('已退出 Codex 会话');
  }
  function onCodexSession(id: string | null): void {
    setCodexSession(id);
    if (id && sysPrompt().trim()) {
      // Let codex's TUI finish drawing, then prime it with the architecture.
      window.setTimeout(() => sendLine(sysPrompt().trim()), 2600);
      setStatus('已启动，正在告知架构…');
    }
  }
  function sendChat(): void {
    const text = chatInput().trim();
    if (!text || !codexSession()) return;
    sendLine(text);
    setChatInput('');
  }
  async function feed(): Promise<void> {
    if (!codexSession()) {
      setStatus('先点「启动」');
      return;
    }
    setStatus('投喂中…');
    try {
      const r = await invoke<GatherResult>(IPC.BrainGather, {
        includeHistory: includeHistory(),
        includeTerminals: includeTerminals(),
      });
      sendLine(`【现场情况，供你参考】\n${r.contextText || '(空)'}`);
      setStatus(`已投喂：${r.summary}`);
    } catch (error) {
      setStatus('投喂失败：' + String(error));
    }
  }
  function optimizeReq(): void {
    if (!codexSession()) {
      setStatus('先点「启动」');
      return;
    }
    sendLine(
      '请结合我上面说的需求和现场，把它加工成一条精炼、明确、可直接粘贴给三个 AI 终端执行的中文指令，只输出这条指令。',
    );
  }

  function togglePanel(which: 'settings' | 'brain'): void {
    setPanel((prev) => (prev === which ? 'none' : which));
  }

  return (
    <div class="pet-root">
      <Show when={panel() === 'settings'}>
        <div class="pet-card pet-nodrag">
          <div class="pet-card-head">
            <strong>宠物形象（GIF 轮播）</strong>
            <button class="pet-x" onClick={() => setPanel('none')}>
              ×
            </button>
          </div>
          <div
            class="pet-dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              e.preventDefault();
              addGifs(pathsFromDrop(e));
            }}
          >
            把 GIF 拖进来（可多张，按顺序循环播放）
            <button class="pet-mini" onClick={() => void pickGifs()}>
              选择文件
            </button>
          </div>
          <div class="pet-interval">
            每张播放
            <input
              type="number"
              min="1"
              value={intervalSec()}
              onInput={(e) => setIntervalSec(Math.max(1, Number(e.currentTarget.value) || 8))}
            />
            秒后切换
          </div>
          <div class="pet-gif-list">
            <Show when={gifs().length === 0}>
              <p class="pet-empty">还没有 GIF，拖几张进来吧</p>
            </Show>
            <For each={gifs()}>
              {(p, i) => (
                <div class={`pet-gif-item ${i() === idx() ? 'is-active' : ''}`}>
                  <Show when={urls()[p]} fallback={<div class="pet-thumb-empty" />}>
                    <img src={urls()[p]} alt="" />
                  </Show>
                  <span class="pet-gif-name">{p.split('/').pop()}</span>
                  <button class="pet-mini" onClick={() => removeGif(p)}>
                    移除
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      <Show when={panel() === 'brain' || launched()}>
        <div
          class={`pet-card pet-card--brain pet-nodrag ${panel() === 'brain' ? '' : 'pet-hidden'}`}
        >
          <div class="pet-card-head">
            <strong>大脑 · 实时 Codex</strong>
            <div class="pet-head-btns">
              <Show when={launched()}>
                <button class="pet-mini pet-quit" title="结束这个 Codex 会话" onClick={quitBrain}>
                  退出
                </button>
              </Show>
              <button class="pet-x" title="自定义指令" onClick={() => setShowSys((v) => !v)}>
                ⚙
              </button>
              <button class="pet-x" title="收起（会话在后台保留）" onClick={() => setPanel('none')}>
                ×
              </button>
            </div>
          </div>

          <Show when={showSys()}>
            <textarea
              class="pet-sys"
              value={sysPrompt()}
              onInput={(e) => setSysPrompt(e.currentTarget.value)}
              placeholder="自定义指令：告诉它我们的架构、各部分含义（启动时会先发给它）"
              rows={4}
            />
          </Show>

          <Show
            when={launched()}
            fallback={
              <div class="pet-launch">
                <p>启动一个独立、无限制的 Codex 会话——就像在终端里敲 codex 一样。</p>
                <button class="pet-primary" onClick={launch}>
                  启动 Codex
                </button>
              </div>
            }
          >
            <div class="pet-term">
              <AgentTerminal
                agentId="codex"
                command="codex"
                autonomy="full-auto"
                workDir={homeDir() || '.'}
                onSession={onCodexSession}
              />
            </div>
          </Show>

          <Show when={launched()}>
          <div class="pet-chatbar">
            <textarea
              class="pet-input"
              value={chatInput()}
              onInput={(e) => setChatInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                  e.preventDefault();
                  if (launched()) sendChat();
                  else launch();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const paths = pathsFromDrop(e).map((p) => (p.includes(' ') ? `'${p}'` : p));
                if (paths.length) setChatInput((prev) => (prev ? `${prev} ` : '') + paths.join(' '));
              }}
              placeholder={launched() ? '跟它聊 / 说需求（Enter 发送，可拖文件→路径）' : '点启动后在这里跟它聊'}
              rows={2}
            />
            <button class="pet-primary" onClick={() => (launched() ? sendChat() : launch())}>
              {launched() ? '发送' : '启动'}
            </button>
          </div>

          <div class="pet-feed-row">
            <label>
              <input
                type="checkbox"
                checked={includeHistory()}
                onChange={(e) => setIncludeHistory(e.currentTarget.checked)}
              />
              prompt 历史
            </label>
            <label>
              <input
                type="checkbox"
                checked={includeTerminals()}
                onChange={(e) => setIncludeTerminals(e.currentTarget.checked)}
              />
              三个终端现场
            </label>
            <button class="pet-mini" disabled={!codexSession()} onClick={() => void feed()}>
              投喂
            </button>
            <button class="pet-mini" disabled={!codexSession()} onClick={optimizeReq}>
              优化
            </button>
          </div>
          </Show>

          <Show when={status()}>
            <p class="pet-status">{status()}</p>
          </Show>
        </div>
      </Show>

      <div class="pet-dock">
        <div class="pet-toolbar pet-nodrag">
          <button class="pet-mini" title="大脑" onClick={() => togglePanel('brain')}>
            🧠
          </button>
          <button class="pet-mini" title="设置形象" onClick={() => togglePanel('settings')}>
            ⚙
          </button>
        </div>
        <div class="pet-avatar pet-drag" onDblClick={() => togglePanel('brain')}>
          <Show
            when={current() && urls()[current()]}
            fallback={
              <div class="pet-placeholder" title="双击=大脑，⚙=放 GIF">
                <span class="pet-eye" />
                <span class="pet-eye" />
                <b>⚡</b>
              </div>
            }
          >
            <img src={urls()[current()]} alt="pet" draggable={false} />
          </Show>
        </div>
      </div>
    </div>
  );
}
