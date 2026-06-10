# AI Terminal Hub

AI Terminal Hub 是一个本地桌面 App，用任务文件夹统一驱动多个 AI CLI。

当前 MVP 目标：

- 先创建或选择任务文件夹，再进入后续流程
- 选择要启动的 AI：`Claude Code`、`Gemini CLI`、`Codex CLI`，或自定义命令
- 为每个已勾选 AI 在当前任务目录下创建独立子目录，并在 macOS Terminal 中启动对应 CLI
- 在工作区输入一条统一指令，直接发送到当前已打开且已勾选的 AI 终端
- 将拖入文件统一复制到 `当前任务/00_input/uploaded_files/`
- 支持快速打开某个 AI 的工作目录，或打开其中最新修改的非日志文件
- 支持复制当前勾选 AI 的输出目录路径

## 技术栈

- Electron
- TypeScript
- SolidJS
- AppleScript + macOS Terminal.app

## 本地开发

```bash
npm install
npm run dev
```

默认会启动：

- Vite renderer: `http://localhost:1421`
- Electron main process

## 构建

```bash
npm run build
```

仅生成 macOS `.app` 目录用于本机验证：

```bash
npm run build:mac-dir
```

构建产物输出到：

- `release/`

## 目录结构

- `src/`：渲染层 UI
- `src/hub/`：AI Terminal Hub 的页面状态、默认配置、提示包装逻辑
- `electron/`：主进程、preload、IPC、Terminal 启动与文件操作
- `build/`：应用图标与 macOS 打包资源

## 运行前提

- 当前 Terminal 启动方案只实现了 macOS Terminal.app
- 需要本机已安装并可直接在 shell 中调用对应 AI CLI
- 默认任务根目录是 `~/AI-Terminal-Hub/tasks`

## 许可证

MIT
