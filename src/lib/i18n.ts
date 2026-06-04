type UiLocale = 'en' | 'zh-CN';

const TEXT_NODE_EXCLUDE_SELECTOR =
  '.xterm, .monaco-editor, pre, code, [contenteditable="true"], [data-no-i18n]';
const ATTRIBUTE_EXCLUDE_SELECTOR = '.xterm, .monaco-editor, pre, code, [data-no-i18n]';
const TRANSLATABLE_ATTRIBUTES = ['title', 'placeholder', 'aria-label', 'alt'] as const;

const EXACT_TRANSLATIONS: Record<string, string> = {
  'Parallel Code': 'SY CODE',
  ParallelCode: 'SY CODE',
  Settings: '设置',
  Projects: '项目',
  General: '通用',
  Themes: '主题',
  Experimental: '实验性功能',
  Updates: '更新',
  Appearance: '外观',
  Diagnostics: '诊断',
  Coordinator: '协调器',
  'Coordinator mode': '协调器模式',
  'Auto-trust folders': '自动信任文件夹',
  'Desktop notifications': '桌面通知',
  'Font smoothing': '字体平滑',
  'Verbose logging': '详细日志',
  'Show plans': '显示计划',
  'More dimmed': '更暗',
  'No dimming': '不变暗',
  'MiniMax (M2.7)': 'MiniMax（M2.7）',
  'Customize your workspace. Shortcut:': '自定义你的工作区。快捷键：',
  'Close settings': '关闭设置',
  'Settings tabs': '设置标签页',
  'Add project': '添加项目',
  'Link Project': '关联项目',
  'Remove project': '移除项目',
  'Remove project?': '移除项目？',
  'Project settings': '项目设置',
  Project: '项目',
  'New task': '新建任务',
  'New terminal': '新建终端',
  'Quick add': '快速添加',
  'Saved presets': '已保存预设',
  Competitors: '参赛者',
  Prompt: '提示词',
  'Add AI agent': '添加 AI Agent',
  'Close AI agent': '关闭 AI Agent',
  'Push to remote': '推送到远端',
  'Open in editor': '在编辑器中打开',
  'Merge into': '合并到',
  'Changed Files': '变更文件',
  'Changed files': '变更文件',
  'Commit Tree': '提交树',
  'Commit tree': '提交树',
  'Command Bookmarks': '命令书签',
  'AI Prompt': 'AI 提示词',
  'Send prompt': '发送提示词',
  'Close Task': '关闭任务',
  'Close task': '关闭任务',
  'Close Terminal': '关闭终端',
  'Close terminal': '关闭终端',
  'Close help': '关闭帮助',
  'Close window': '关闭窗口',
  'Minimize window': '最小化窗口',
  'Panel crashed': '面板崩溃了',
  'Starting server...': '正在启动服务...',
  'Starting Docker container…': '正在启动 Docker 容器…',
  'Waiting to send prompt…': '等待发送提示词…',
  'No prompts sent yet': '还没有发送过提示词',
  '(current)': '（当前）',
  'No MCP log entries yet.': '还没有 MCP 日志。',
  'View MCP logs': '查看 MCP 日志',
  'Click to copy': '点击复制',
  'Click to restore': '点击恢复',
  'Copied!': '已复制！',
  'Connect Phone': '连接手机',
  'Not detected': '未检测到',
  Imported: '已导入',
  Review: '需要复查',
  Landed: '已落地',
  'Cleanup failed': '清理失败',
  'Landing blocked': '落地被阻止',
  'Landing failed': '落地失败',
  Reviewed: '已复查',
  'Landing reviewed': '已复查落地结果',
  'Landed — pending review': '已落地，等待复查',
  'Verification blocked': '验证被阻止',
  'Verification failed': '验证失败',
  'Ready to merge': '可合并',
  'Ready for review': '可复查',
  'Waiting for input': '等待输入',
  'Active — agent is working': '进行中：Agent 正在工作',
  'Error — agent exited with an error': '错误：Agent 异常退出',
  'Busy — agent recently active': '忙碌：Agent 最近仍在活跃',
  'Waiting — no changes yet': '等待中：尚无变更',
  'Running Terminals': '运行中的终端',
  'Kill & Quit': '结束并退出',
  'Keep in Background': '保留在后台',
  Cancel: '取消',
  Confirm: '确认',
  Delete: '删除',
  Retry: '重试',
  'Reset to default': '恢复默认',
  'Branch prefix': '分支前缀',
  'Default Git Isolation': '默认 Git 隔离方式',
  'Git Isolation': 'Git 隔离方式',
  Worktree: '工作树',
  'Current Branch': '当前分支',
  'This folder no longer exists.': '这个文件夹已经不存在。',
  Name: '名称',
  Color: '颜色',
  'coverage/coverage-summary.json': 'coverage/coverage-summary.json',
  'coverage/lcov.info': 'coverage/lcov.info',
  'Open terminal': '打开终端',
  'Send notes as a prompt to the agent': '将备注作为提示词发送给 Agent',
  'Close dialog and ask the AI agent to rebase': '关闭对话框并让 AI Agent 执行 rebase',
  'Clone as custom theme': '克隆为自定义主题',
  'Edit custom theme': '编辑自定义主题',
  'Theme CSS': '主题 CSS',
  'Commit message...': '提交信息...',
  'Add project first': '请先添加项目',
  'Push completed': '推送完成',
  'Push failed': '推送失败',
  'Failed to stop agent': '停止 Agent 失败',
  'No files touched.': '没有改动任何文件。',
  'No matches yet. Go fight!': '还没有对局结果，去打一场吧！',
  'View Results': '查看结果',
  Merged: '已合并',
  'Merged (total)': '已合并（累计）',
  'Merged today': '今日已合并',
  Arena: '竞技场',
  'Rate how it performed': '给它的表现打分',
  'Your phone and this computer must be on the same WiFi network.':
    '你的手机和这台电脑必须在同一个 Wi‑Fi 网络下。',
  'Your phone and this computer must be on the same Tailscale network.':
    '你的手机和这台电脑必须在同一个 Tailscale 网络下。',
  'Agent exited before prompt was sent': 'Agent 在提示词发送前就退出了',
  'Image not found locally.': '本地没有找到图片。',
  "Couldn't load branches.": '无法加载分支。',
  'No recent coverage data for this source file. Run npm run test:coverage to populate the radar.':
    '这个源文件没有最近的覆盖率数据。运行 npm run test:coverage 来填充覆盖率雷达。',
  'Remove competitor': '移除参赛者',
  'Delete preset': '删除预设',
  'Preset name': '预设名称',
  'Select a project...': '选择一个项目...',
  'Enter the coding task prompt that all competitors will receive...':
    '输入所有参赛者都会收到的编程任务提示词...',
  'Name (e.g. Claude, Codex, Gemini)': '名称（例如 Claude、Codex、Gemini）',
  'Command — use {prompt} for the arena prompt': '命令：使用 {prompt} 作为 Arena 提示词',
  'Name (e.g. OpenCode)': '名称（例如 OpenCode）',
  'Command (e.g. opencode)': '命令（例如 opencode）',
  'Resume args (optional, space-separated)': '恢复参数（可选，用空格分隔）',
  'Skip permissions args (optional, space-separated)': '跳过权限参数（可选，用空格分隔）',
  'e.g. code, cursor, zed, subl': '例如 code、cursor、zed、subl',
  'Enter your MINIMAX_API_KEY (stored in memory only)':
    '输入你的 MINIMAX_API_KEY（只保存在内存中）',
  'Close terminal (Ctrl+Shift+Q)': '关闭终端（Ctrl+Shift+Q）',
  'Cancel (Esc)': '取消（Esc）',
  Close: '关闭',
  'Remove bookmark': '删除书签',
  'Delete match and clean up worktrees': '删除对局并清理 worktree',
  'Delete this match? Any remaining worktrees will be removed.':
    '删除这场对局？所有剩余的 worktree 都会被移除。',
  'Reset all keybindings to defaults for the current preset?':
    '将当前预设的所有快捷键恢复为默认值？',
  Default: '默认',
  Navigation: '导航',
  Tasks: '任务',
  App: '应用',
  Clipboard: '剪贴板',
  Editing: '编辑',
  Copy: '复制',
  Paste: '粘贴',
  'Close current shell': '关闭当前 shell',
  'Merge task': '合并任务',
  'Push task': '推送任务',
  'Spawn shell for task': '为任务创建 shell',
  'Create terminal': '创建终端',
  'Create task': '创建任务',
  '(optional)': '（可选）',
  VS: '对战',
  'Toggle sidebar': '切换侧边栏',
  'Toggle settings': '切换设置',
  'Toggle help': '切换帮助',
  'Increase zoom': '放大',
  'Decrease zoom': '缩小',
  'Reset zoom': '重置缩放',
  'Copy selected text': '复制选中文本',
  'Paste clipboard': '粘贴剪贴板',
  'Focus pane above': '聚焦到上方面板',
  'Focus pane below': '聚焦到下面板',
  'Focus task left': '聚焦到左侧任务',
  'Focus task right': '聚焦到右侧任务',
  'Switch to previous task': '切换到上一个任务',
  'Switch to next task': '切换到下一个任务',
  'Move task left': '将任务向左移动',
  'Move task right': '将任务向右移动',
  'Close this task? Running agents and shells will be stopped.':
    '关闭这个任务？运行中的 Agent 和 shell 会被停止。',
  'Close this task? The worktree and branch will be deleted.':
    '关闭这个任务？对应的 worktree 和分支会被删除。',
  Loading: '正在加载',
  'Loading...': '正在加载...',
  'Loading…': '正在加载…',
  Terminal: '终端',
  'Closing task...': '正在关闭任务...',
  'waiting...': '等待中...',
  'no git': '非 Git 项目',
  Changes: '变更',
  'Search...': '搜索...',
  Branches: '分支',
  'Loading branches…': '正在加载分支…',
  'Search branches…': '搜索分支…',
  Minimize: '最小化',
  Restore: '还原',
  Maximize: '最大化',
  'Restore window': '还原窗口',
  'Maximize window': '最大化窗口',
  Previous: '上一个',
  Next: '下一个',
  'Uncommitted changes only': '只看未提交变更',
  'All changes (including uncommitted)': '全部变更（包括未提交变更）',
  Dismiss: '忽略',
  'Notes...': '备注...',
  'Expand projects': '展开项目',
  'Collapse projects': '折叠项目',
  'Remove all': '全部移除',
  Remove: '移除',
  'Merging...': '正在合并...',
  'Squash Merge': '压缩合并',
  Other: '其他',
  Merge: '合并',
  into: '到',
  Stop: '停止',
  'Review this task': '复查这个任务',
  'Exit focus mode': '退出专注模式',
  'Focus on this task': '专注于这个任务',
  'Collapse task': '折叠任务',
  'No agent available to receive review': '没有可接收复查意见的 Agent',
  'Jump to terminal moment': '跳转到终端对应时刻',
  'Decrease font size': '减小字号',
  'Increase font size': '增大字号',
  Back: '返回',
  '← Back': '← 返回',
  'Reconnecting...': '正在重新连接...',
  'Disconnected — check your network': '连接已断开，请检查网络',
  'Connecting...': '正在连接...',
  'No active agents': '没有活跃的 Agent',
  'This is an experimental feature.': '这是实验性功能。',
  'Report bugs': '报告问题',
  'Not authenticated.': '尚未认证。',
  'Scan the QR code from the SY CODE desktop app to connect.':
    '扫描 SY CODE 桌面应用中的二维码进行连接。',
  running: '运行中',
  stopped: '已停止',
  idle: '空闲',
  Connected: '已连接',
  Disconnected: '未连接',
  'Phone Connected': '手机已连接',
  Progress: '进度',
  Tips: '技巧',
  'No projects linked yet.': '还没有关联任何项目。',
  'Link your first project to get started': '先关联第一个项目开始使用',
  'A project is a local folder with your code': '项目就是存放代码的本地文件夹',
  'No tasks yet': '还没有任务',
  Press: '按下',
  'to create a new task': '即可创建新任务',
  'Keyboard Shortcuts': '快捷键',
  'Reset All': '全部重置',
  'for all shortcuts': '查看全部快捷键',
  'to navigate panels': '在面板间导航',
  Override: '覆盖',
  Swap: '交换',
  'QR code unavailable': '二维码不可用',
  'Failed to start server': '启动服务器失败',
  'Cannot disconnect while a coordinator is active. Stop the coordinator first.':
    '协调器运行时无法断开连接。请先停止协调器。',
  'Failed to disconnect. Please try again.': '断开连接失败，请重试。',
  'Generating QR code...': '正在生成二维码...',
  'Connection QR code': '连接二维码',
  'Automatic updates are not available for this build. Download the latest release from GitHub to update.':
    '此构建已关闭自动更新，以防官方版本覆盖 SY CODE。',
  'Checking…': '正在检查…',
  'Check for updates': '检查更新',
  'You are up to date.': '当前已是最新版本。',
  'Downloading update…': '正在下载更新…',
  'Update check failed:': '检查更新失败：',
  Light: '浅色',
  Dark: '深色',
  System: '跟随系统',
  'Custom theme': '自定义主题',
  'Dark Theme': '深色主题',
  'Light Theme': '浅色主题',
  'Update Theme': '更新主题',
  'Edit Theme': '编辑主题',
  'New Custom Theme': '新建自定义主题',
  Hide: '隐藏',
  Show: '显示',
  'Copy Prompt': '复制提示词',
  'Save Theme': '保存主题',
  'Press shortcut...': '按下快捷键...',
  'Word Left': '向左移动一个词',
  'Word Right': '向右移动一个词',
  'Add review comment...': '添加复查意见...',
  'Ask about this code...': '询问这段代码...',
  Comment: '评论',
  Ask: '提问',
  'Has commits': '有提交',
  Dirty: '有未提交变更',
  Clean: '干净',
  'Importing...': '正在导入...',
  'Import Selected': '导入所选项',
  'Project path not found': '找不到项目路径',
  'This will stop all running agents and shells and remove the imported task from SY CODE. The existing git worktree will be left untouched.':
    '这会停止所有运行中的 Agent 和 shell，并从 SY CODE 移除导入的任务。现有 Git worktree 不会被修改。',
  'This action cannot be undone. The following will be permanently deleted:':
    '此操作无法撤销。以下内容将被永久删除：',
  'The worktree will be removed but the branch will be kept:': 'worktree 将被移除，但分支会保留：',
  'Import existing git worktrees for this project as SY CODE tasks. Imported tasks':
    '将此项目现有的 Git worktree 导入为 SY CODE 任务。导入的任务',
  'Base branch': '基础分支',
  Branch: '分支',
  'Create Task': '创建任务',
  'Creating...': '正在创建...',
  'What should the agent work on?': '希望 Agent 完成什么任务？',
  'Add user authentication': '添加用户认证',
  'Creates a git branch and worktree so the AI agent can work in isolation without affecting your current branch.':
    '创建 Git 分支和 worktree，让 AI Agent 独立工作，不影响当前分支。',
  'The AI agent will work on your current branch in the project root.':
    'AI Agent 将直接在项目根目录的当前分支上工作。',
  'Instructs the agent to append progress entries to .claude/steps.json. Each entry is shown live in the Steps panel as the agent works.':
    '让 Agent 将进度追加到 .claude/steps.json；工作时会在步骤面板实时显示。',
  'Project image ready.': '项目镜像已就绪。',
  'Image ready.': '镜像已就绪。',
  'Only one coordinator per project can be active at a time': '每个项目同时只能运行一个协调器',
  'Folder not found': '找不到文件夹',
  'Open item': '打开项目',
  'Landing needs attention': '落地操作需要处理',
  'Verification did not pass': '验证未通过',
  'Waiting for your draft': '等待你的草稿',
  'Waiting for terminal input': '等待终端输入',
  'Waiting for idle': '等待空闲',
  'Sending when ready…': '就绪后发送…',
  'Auto delivery enabled': '已启用自动交付',
  'Coordinated sub-task': '协调子任务',
  'Failed to send review': '发送复查意见失败',
  'Commit or stash changes before rebasing': 'rebase 前请提交或暂存变更',
  'No prompts sent': '尚未发送提示词',
  'Failed to start': '启动失败',
  'Claude needs input. Answer in the terminal when ready.':
    'Claude 需要输入，请准备好后在终端中回答。',
  'Agent is waiting for input in terminal…': 'Agent 正在终端中等待输入…',
  'Send a prompt... (Enter to send, Shift+Enter for newline)':
    '发送提示词...（Enter 发送，Shift+Enter 换行）',
  'Tasks need attention off-screen to the left — click to scroll':
    '左侧屏幕外有任务需要处理，点击滚动查看',
  'Tasks need attention off-screen to the right — click to scroll':
    '右侧屏幕外有任务需要处理，点击滚动查看',
  'Scroll to start': '滚动到开头',
  'Scroll to end': '滚动到末尾',
  'MCP startup failed:': 'MCP 启动失败：',
  'Unknown error': '未知错误',
  'unknown error': '未知错误',
  'Unknown time': '未知时间',
  'unknown time': '未知时间',
  Modified: '已修改',
  Added: '已添加',
  Deleted: '已删除',
  'Run coverage and write either coverage/coverage-summary.json, coverage/lcov.info, or the configured project report path.':
    '运行覆盖率测试，并写入 coverage/coverage-summary.json、coverage/lcov.info 或项目配置的报告路径。',
  'Coverage summary': '覆盖率摘要',
  'Leave blank to try': '留空时依次尝试',
  then: '然后',
  'e.g. npm run dev': '例如 npm run dev',
  summary: '摘要',
  detail: '详情',
  'landing failed': '落地失败',
  'signalled done': '已发出完成信号',
  DNF: '未完成',
  Behavior: '行为',
  'Automatically accept trust and permission dialogs from agents':
    '自动接受 Agent 的信任和权限对话框',
  'Display Claude Code plan files in a tab next to Notes':
    '在备注旁边的标签页显示 Claude Code 计划文件',
  'Show native notifications when tasks finish or need attention':
    '任务完成或需要处理时显示系统通知',
  'Show prompt input box below terminal': '在终端下方显示提示词输入框',
  'When hidden, the terminal occupies the full panel and auto-focuses on activation':
    '隐藏后终端会占满整个面板，并在激活时自动聚焦',
  'Show progress section in sidebar': '在侧边栏显示进度区域',
  'Daily completed-task count and merged-line totals at the bottom of the sidebar':
    '在侧边栏底部显示每日完成任务数和合并代码行数',
  'Show tips section in sidebar': '在侧边栏显示技巧区域',
  'Keyboard shortcut hints at the bottom of the sidebar': '在侧边栏底部显示快捷键提示',
  'Enable antialiasing and geometric text rendering': '启用抗锯齿和几何文本渲染',
  Editor: '编辑器',
  'Editor command': '编辑器命令',
  'CLI command to open worktree folders. Click the path bar in a task to open it.':
    '用于打开 worktree 文件夹的 CLI 命令。点击任务中的路径栏即可打开。',
  'Ask about Code': '询问代码',
  'LLM provider': 'LLM 服务商',
  'MiniMax API key': 'MiniMax API 密钥',
  'Uses MiniMax M2.7 (204K context) via the OpenAI-compatible API — no Claude Code CLI required.':
    '通过 OpenAI 兼容 API 使用 MiniMax M2.7（204K 上下文），无需 Claude Code CLI。',
  'Uses the claude CLI to answer questions about selected code. Requires Claude Code to be installed.':
    '使用 claude CLI 回答关于所选代码的问题，需要安装 Claude Code。',
  'Docker Isolation': 'Docker 隔离',
  'Default image': '默认镜像',
  'Docker image used when "Run in Docker container" is enabled for a task. The agent runs inside the container with only the project directory mounted.':
    '任务启用“在 Docker 容器中运行”时使用的镜像。容器中只会挂载项目目录。',
  'will use a project-specific image instead.': '将改用项目专用镜像。',
  'Share agent auth across Linux containers': '在 Linux 容器之间共享 Agent 认证',
  'Persist agent credentials in a user-owned host directory so you only need to sign in once per agent type. Auth on first run is saved automatically for future containers.':
    '将 Agent 凭据保存在用户拥有的宿主机目录中，每种 Agent 只需登录一次；首次认证会自动供后续容器使用。',
  'Focus Dimming': '焦点变暗',
  'Inactive column opacity': '非活动列透明度',
  'Custom Agents': '自定义 Agent',
  'Terminal Font': '终端字体',
  'This font includes ligatures which may impact rendering performance.':
    '此字体包含连字，可能影响渲染性能。',
  'Emit debug-level logs to the developer console. Verbose logs may include file paths, branch names, commit messages, IPC channel activity, and pty lifecycle events. Review the contents before sharing.':
    '向开发者控制台输出调试级日志。详细日志可能包含文件路径、分支名、提交信息、IPC 活动和 PTY 生命周期事件，分享前请检查内容。',
  'Current version': '当前版本',
  'You are on the latest version.': '当前已是最新版本。',
  '+ Create New': '+ 新建',
  Clone: '克隆',
  Edit: '编辑',
  'Enable the Coordinator option when creating tasks. Coordinators can spawn sub-tasks, send prompts, and merge branches automatically via MCP tools. Requires app restart to fully disable.':
    '创建任务时启用协调器选项。协调器可以通过 MCP 工具自动创建子任务、发送提示词并合并分支。完全禁用需要重启应用。',
  'Coordinator notification delay (seconds)': '协调器通知延迟（秒）',
  'How long the coordinator waits before firing a notification after a sub-task completes. Default: 60s. Failed sub-tasks use max(10s, delay ÷ 4).':
    '子任务完成后协调器等待多久再发送通知。默认 60 秒；失败子任务使用 max(10 秒，延迟 ÷ 4)。',
  'Import Existing Worktrees': '导入现有 Worktree',
  'Import existing git worktrees for this project as SY CODE tasks. Imported tasks keep their existing branch and worktree, and closing them will only detach them from the app.':
    '将此项目现有的 Git worktree 导入为 SY CODE 任务。导入后会保留原分支和 worktree，关闭任务只会将其从应用中移除。',
  Worktrees: 'Worktree',
  'Scanning for existing worktrees...': '正在扫描现有 worktree...',
  'No importable worktrees were found for this project.': '没有找到可导入的 worktree。',
  'This will stop all running agents and shells for this task. No git operations will be performed.':
    '这会停止此任务中所有运行的 Agent 和 shell，不会执行任何 Git 操作。',
  'Warning: There are uncommitted changes that will be permanently lost.':
    '警告：未提交的变更将永久丢失。',
  'Warning: This branch has commits that have not been merged into main.':
    '警告：此分支有尚未合并到主分支的提交。',
  'Local feature branch': '本地功能分支',
  'Worktree at': 'Worktree 路径',
  'will be kept': '将被保留',
  'Push to Remote': '推送到远端',
  'Pushing...': '正在推送...',
  Push: '推送',
  'Commit message': '提交信息',
  'Commit & Merge': '提交并合并',
  'Discard uncommitted & Merge': '丢弃未提交变更并合并',
  'New Task': '新建任务',
  'Task name': '任务名称',
  '(optional — derived from prompt)': '（可选，根据提示词生成）',
  'Example: Work through the items in /path/to/todos.md. Only work from that file. Use <branch> as the baseBranch for all sub-tasks.':
    '示例：完成 /path/to/todos.md 中的事项，只根据该文件工作，并使用 <branch> 作为所有子任务的基础分支。',
  'main branch (detected on create)': '主分支（创建时自动检测）',
  'This project already has a task on the current branch': '此项目的当前分支已有任务',
  'Changes will be made on the selected branch without worktree isolation.':
    '变更将直接写入所选分支，不使用 worktree 隔离。',
  'This agent will be able to create tasks, send prompts, and merge branches automatically via MCP tools. The remote server will be started automatically.':
    '此 Agent 可以通过 MCP 工具自动创建任务、发送提示词和合并分支；远程服务器会自动启动。',
  'Max concurrent sub-tasks:': '最大并发子任务数：',
  'Propagate skip-permissions to sub-tasks': '将跳过权限确认传递给子任务',
  'All sub-tasks created by this coordinator will inherit': '此协调器创建的所有子任务都会继承',
  'and run without confirmation prompts.': '并在没有确认提示的情况下运行。',
  'Build failed:': '构建失败：',
  'Copy the prompt above and paste it into Claude Code (or any AI). The AI will ask about your preferences and generate a CSS theme. Paste the result below.':
    '复制上方提示词并粘贴到 Claude Code（或其他 AI）。AI 会询问你的偏好并生成 CSS 主题，请将结果粘贴到下方。',
  'Contrast warnings (theme will still save)': '对比度警告（仍可保存主题）',
  'Delete Theme': '删除主题',
  'Review Comments': '复查意见',
  'Send to Agent': '发送给 Agent',
  'Waiting for connection...': '等待连接...',
  Disconnect: '断开连接',
  'Scan the QR code or copy the URL to monitor and interact with your agent terminals from your phone.':
    '扫描二维码或复制网址，即可在手机上查看并操作 Agent 终端。',
  Agent: 'Agent',
  '(not installed)': '（未安装）',
  '+ Add custom agent': '+ 添加自定义 Agent',
  'Add Agent': '添加 Agent',
  'Symlink into worktree': '符号链接到 worktree',
  'Steps tracking': '步骤跟踪',
  'Dangerously skip all confirms': '危险操作：跳过所有确认',
  'The agent will run without asking for confirmation. It can read, write, and delete files, and execute commands without your approval.':
    'Agent 运行时不会询问确认；它可以读取、写入和删除文件，并在未经你批准的情况下执行命令。',
  'Tip: Enable Docker isolation to limit the blast radius of skip-permissions mode.':
    '提示：启用 Docker 隔离可以限制跳过权限确认模式的影响范围。',
  'Install Docker to enable container isolation for safer skip-permissions mode.':
    '安装 Docker 以启用容器隔离，使跳过权限确认模式更安全。',
  'Run in Docker container': '在 Docker 容器中运行',
  'The agent will run inside a Docker container. Only the project directory is mounted — files outside the project are protected from accidental deletion.':
    'Agent 将在 Docker 容器中运行。只挂载项目目录，项目外的文件不会被意外删除。',
  'Agent credentials are shared across containers.': 'Agent 凭据会在容器之间共享。',
  'Coordinator + Docker on macOS: the MCP server binds to all network interfaces so sub-task containers can reach it via host.docker.internal. The port is reachable from other hosts on your local network (token-protected).':
    'macOS 上的协调器 + Docker：MCP 服务器会绑定所有网络接口，让子任务容器可通过 host.docker.internal 访问。本地网络中的其他主机也能访问该端口（受令牌保护）。',
  'Using project Dockerfile:': '正在使用项目 Dockerfile：',
  'Image:': '镜像：',
  'Build Image': '构建镜像',
  'Building image... this may take a few minutes.': '正在构建镜像，可能需要几分钟...',
  'Image built successfully!': '镜像构建成功！',
  'Select an agent': '请选择 Agent',
  'Select a project': '请选择项目',
  'Compare arena results': '比较 Arena 结果',
  'Warning: You have uncommitted changes that will NOT be included in this merge.':
    '警告：未提交的变更不会包含在此次合并中。',
  'Rebase with AI': '使用 AI 执行 Rebase',
  'Rebase successful': 'Rebase 成功',
  'Delete branch and worktree after merge': '合并后删除分支和 worktree',
  'Squash commits': '压缩提交',
  'Add Competitor': '添加参赛者',
  'Fight!': '开始对战！',
  Save: '保存',
  'Save current as preset': '将当前配置保存为预设',
  'View match history': '查看对战历史',
  'Terminal output': '终端输出',
  'Compare All': '比较全部结果',
  Rematch: '再次对战',
  'New Match': '新对战',
  History: '历史记录',
  'Back to History': '返回历史记录',
  'Islands Dark': '群岛深色',
  'JetBrains-inspired dark panels on a tinted frame': '受 JetBrains 启发的深色面板和着色边框',
  'Islands Light': '群岛浅色',
  'JetBrains-inspired light panels on a soft tinted frame': '受 JetBrains 启发的浅色面板和柔和边框',
  Minimal: '极简',
  'Flat monochrome with warm off-white accent': '平面单色设计，搭配温暖的米白强调色',
  Graphite: '石墨',
  'Cool neon blue with subtle glow': '冷调霓虹蓝，带有细微光晕',
  Midnight: '午夜',
  'Graphite with pure black terminals': '石墨主题搭配纯黑终端',
  Classic: '经典',
  'Original dark utilitarian look': '原始深色实用风格',
  Indigo: '靛蓝',
  'Deep indigo base with electric violet accents': '深靛蓝底色，搭配电光紫强调色',
  Ember: '余烬',
  'Warm copper highlights and contrast': '温暖铜色高光与对比',
  Glacier: '冰川',
  'Clean teal accents with softer depth': '清爽青色强调和柔和层次',
  Zenburnesque: 'Zenburn 风格',
  'Warm sage and muted earth tones': '温暖鼠尾草绿与低饱和大地色',
  'Catppuccin Mocha': 'Catppuccin 摩卡',
  'Pastel mauve accents on the cozy Catppuccin Mocha palette':
    '舒适的 Catppuccin 摩卡配色，搭配柔和淡紫强调色',
  Workbench: '工作台',
  'VS Code-inspired flat three-tier dark with cobalt blue':
    '受 VS Code 启发的三层深色平面设计，搭配钴蓝色',
  'New task (alternate shortcut)': '新建任务（备用快捷键）',
  'Toggle focus mode / side-by-side view': '切换专注模式 / 并排视图',
  'Toggle help dialog': '切换帮助对话框',
  'Toggle help dialog (F1)': '切换帮助对话框（F1）',
  'Toggle settings dialog': '切换设置对话框',
  'Close dialogs': '关闭对话框',
  'Redraw terminals (fix rendering glitches)': '重绘终端（修复渲染问题）',
  'Copy selection': '复制所选内容',
  'Send newline (Shift+Enter)': '发送换行（Shift+Enter）',
  'Move to beginning of line': '移到行首',
  'Move to end of line': '移到行尾',
  'Kill line backward': '向后删除整行',
  'Scroll up one line': '向上滚动一行',
  'Scroll down one line': '向下滚动一行',
  'Scroll up one page': '向上滚动一页',
  'Scroll down one page': '向下滚动一页',
};

const REGEX_TRANSLATIONS: Array<readonly [RegExp, (...groups: string[]) => string]> = [
  [/^Show sidebar \((.+)\)$/u, (shortcut) => `显示侧边栏（${shortcut}）`],
  [/^Collapse sidebar \((.+)\)$/u, (shortcut) => `折叠侧边栏（${shortcut}）`],
  [/^Settings \((.+)\)$/u, (shortcut) => `设置（${shortcut}）`],
  [/^New task \((.+)\)$/u, (shortcut) => `新建任务（${shortcut}）`],
  [/^New terminal \((.+)\)$/u, (shortcut) => `新建终端（${shortcut}）`],
  [/^Open terminal \((.+)\)$/u, (shortcut) => `打开终端（${shortcut}）`],
  [/^Close terminal \((.+)\)$/u, (shortcut) => `关闭终端（${shortcut}）`],
  [/^Merge into (.+)$/u, (target) => `合并到 ${target}`],
  [/^Open (.+) in editor$/u, (target) => `在编辑器中打开 ${target}`],
  [/^Switch to (.+)$/u, (target) => `切换到 ${target}`],
  [/^Switch to (.+), current item$/u, (target) => `切换到 ${target}，当前项目`],
  [/^Copy (.+)$/u, (target) => `复制 ${target}`],
  [/^Sub-agent: (.+)$/u, (target) => `子 Agent：${target}`],
  [/^Verified (\d+)$/u, (count) => `已验证 ${count}`],
  [/^Hue (.+)$/u, (value) => `色相 ${value}`],
  [/^(\d+) added lines$/u, (count) => `${count} 行新增`],
  [/^(\d+) removed lines$/u, (count) => `${count} 行删除`],
  [
    /^(\d+) changed files? below 60% line coverage\.$/u,
    (count) => {
      return `${count} 个变更文件的行覆盖率低于 60%。`;
    },
  ],
  [
    /^(\d+) changed files? missing from the loaded coverage report\.$/u,
    (count) => {
      return `${count} 个变更文件未出现在已加载的覆盖率报告中。`;
    },
  ],
  [/^Jump to task (\d+)$/u, (index) => `跳转到任务 ${index}`],
  [/^Terminal (\d+)$/u, (index) => `终端 ${index}`],
  [/^Auto-sending in (\d+)s…?$/u, (seconds) => `${seconds} 秒后自动发送…`],
  [/^(\d+) lines hidden$/u, (count) => `已隐藏 ${count} 行`],
  [/^Version (.+) is available\..+$/u, (version) => `发现新版本 ${version}。`],
  [/^Version (.+) is downloaded\..+$/u, (version) => `版本 ${version} 已下载。`],
  [/^Downloading update… (.+)$/u, (progress) => `正在下载更新… ${progress}`],
  [/^Save to (.+) slot$/u, (slot) => `保存到 ${translateUiText(slot, 'zh-CN')}槽位`],
  [/^Remote access unavailable: (.+)$/u, (reason) => `远程访问不可用：${reason}`],
  [/^Editor failed: (.+)$/u, (reason) => `编辑器启动失败：${reason}`],
  [/^MCP startup failed: (.+)$/u, (reason) => `MCP 启动失败：${reason}`],
  [/^Push branch (.+) to remote\?$/u, (branch) => `将分支 ${branch} 推送到远端？`],
  [/^(.+) has uncommitted changes$/u, (name) => `${name} 有未提交的变更`],
  [/^Review Comments \((\d+)\)$/u, (count) => `复查意见（${count}）`],
  [/^Send to Agent \((\d+)\)$/u, (count) => `发送给 Agent（${count}）`],
  [/^(\d+) clients?\(s\) connected$/u, (count) => `已连接 ${count} 个客户端`],
  [
    /^Theme is valid — (\d+) variable\(s\) defined\.$/u,
    (count) => `主题有效，已定义 ${count} 个变量。`,
  ],
  [/^(\d+) contrast warning\(s\)\.$/u, (count) => `${count} 条对比度警告。`],
  [/^Failed to delete theme: (.+)$/u, (reason) => `删除主题失败：${reason}`],
  [/^Couldn't scan existing worktrees: (.+)$/u, (reason) => `扫描现有 worktree 失败：${reason}`],
  [/^Could not open project folder: (.+)$/u, (reason) => `无法打开项目文件夹：${reason}`],
  [/^Could not open folder: (.+)$/u, (reason) => `无法打开文件夹：${reason}`],
  [/^Cannot switch to "(.+)": (.+)$/u, (branch, reason) => `无法切换到“${branch}”：${reason}`],
  [/^Rebase onto (.+)$/u, (branch) => `Rebase 到 ${branch}`],
  [/^Use '(.+)'$/u, (branch) => `使用“${branch}”`],
  [/^Checking for conflicts with (.+)\.\.\.$/u, (branch) => `正在检查与 ${branch} 的冲突...`],
  [
    /^Nothing to merge: this branch has no committed changes compared to (.+)\.$/u,
    (branch) => `没有可合并内容：与 ${branch} 相比，此分支没有已提交的变更。`,
  ],
  [/^Competitor (\d+)$/u, (index) => `参赛者 ${index}`],
  [/^exit (.+)$/u, (code) => `退出码 ${code}`],
  [/^(\d+)(st|nd|rd|th)$/u, (rank) => `第 ${rank} 名`],
  [/^(\d+) stars$/u, (count) => `${count} 星`],
  [/^(\d+) star$/u, (count) => `${count} 星`],
  [/^Verified (.+)$/u, (value) => `已验证 ${value}`],
  [/^1 running terminal session$/u, () => '1 个正在运行的终端会话'],
  [/^(\d+) running terminal sessions$/u, (count) => `${count} 个正在运行的终端会话`],
  [
    /^You have (.+)\. They can be restored on app restart\. Kill them and quit, keep them alive in the background, or cancel\?$/u,
    (countLabel) =>
      `你有${translateUiText(countLabel, 'zh-CN')}。重启应用后可以恢复。要结束它们并退出、让它们在后台继续运行，还是取消？`,
  ],
];

function translateExact(text: string): string | null {
  const exact = EXACT_TRANSLATIONS[text];
  if (exact) return exact;
  for (const [pattern, replacer] of REGEX_TRANSLATIONS) {
    const match = text.match(pattern);
    if (match) return replacer(...match.slice(1));
  }
  return null;
}

function translatePreservingWhitespace(text: string): string {
  if (!/[A-Za-z]/u.test(text)) return text;
  const leading = text.match(/^\s*/u)?.[0] ?? '';
  const trailing = text.match(/\s*$/u)?.[0] ?? '';
  const core = text.trim();
  if (!core) return text;
  const translated = translateExact(core.replace(/\s+/gu, ' '));
  return translated ? `${leading}${translated}${trailing}` : text;
}

export function normalizeUiLocale(locale?: string | null): UiLocale {
  return locale?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

export function getUiLocale(): UiLocale {
  return typeof window === 'undefined' ? 'en' : 'zh-CN';
}

export function translateUiText(text: string, locale: UiLocale = getUiLocale()): string {
  if (locale !== 'zh-CN') return text;
  return translatePreservingWhitespace(text);
}

export function t(text: string): string {
  return translateUiText(text);
}

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;
  return !!parent?.closest(TEXT_NODE_EXCLUDE_SELECTOR);
}

function shouldSkipAttributeTranslation(el: Element): boolean {
  return !!el.closest(ATTRIBUTE_EXCLUDE_SELECTOR);
}

function translateTextNode(node: Text): void {
  if (shouldSkipTextNode(node)) return;
  const translated = t(node.data);
  if (translated !== node.data) node.data = translated;
}

function translateElementAttributes(el: Element): void {
  if (shouldSkipAttributeTranslation(el)) return;
  for (const attr of TRANSLATABLE_ATTRIBUTES) {
    const value = el.getAttribute(attr);
    if (!value) continue;
    const translated = t(value);
    if (translated !== value) el.setAttribute(attr, translated);
  }
}

function translateTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text);
    return;
  }
  if (!(root instanceof Element) && root !== document.body) return;
  if (root instanceof Element) {
    translateElementAttributes(root);
    if (root.matches(TEXT_NODE_EXCLUDE_SELECTOR)) return;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let current: Node | null = walker.currentNode;
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      translateTextNode(current as Text);
    } else if (current instanceof Element) {
      translateElementAttributes(current);
      if (current !== root && current.matches(TEXT_NODE_EXCLUDE_SELECTOR)) {
        current = walker.nextSibling();
        continue;
      }
    }
    current = walker.nextNode();
  }
}

export function installDomI18n(root: ParentNode = document.body): () => void {
  const locale = getUiLocale();
  if (typeof document === 'undefined' || locale !== 'zh-CN') return () => {};

  document.documentElement.lang = 'zh-CN';
  document.title = t(document.title);
  translateTree(root as Node);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData' && record.target instanceof Text) {
        translateTextNode(record.target);
        continue;
      }
      if (record.type === 'attributes' && record.target instanceof Element) {
        translateElementAttributes(record.target);
        continue;
      }
      for (const node of record.addedNodes) {
        translateTree(node);
      }
    }
  });

  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
  });

  return () => observer.disconnect();
}
