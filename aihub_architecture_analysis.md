# AI Terminal Hub 架构问题分析报告

## 核心结论

**根本架构错误：把"终端模拟器控制"当成了"命令执行"来做。**

你要的是"我说一件事，三个 AI 去做"——这是一个**任务派发系统**。

但现在做成了"往三个终端的输入框里塞键盘字符"——这是**UI 自动化**。

这两件事的复杂度完全不在一个量级。

---

## 一直在解决的真正问题

**把 AI Terminal Hub 做成一个可靠的"本地多 AI 终端控制器"。**

目标应该是：用户在 Hub 里输入一次任务，包括文字、路径、文件信息、上下文；Hub 必须把这一次输入完整保存，然后可靠地发送给 Claude Code、Gemini CLI、Codex CLI 三个彼此独立的终端，并确认它们真的收到、真的提交、真的开始运行。失败时必须能看出失败在哪一步，并且可以恢复，不影响别的 AI、不污染系统环境。

---

## 反复出错的根因分类

### 1. 输入没有被可靠送达
- 说了一大段话，但目标终端里 `[用户原始任务]` 为空，或者内容没进去，或者只进了一部分
- `screen readbuf/paste` 显示了 `Slurped ... characters into buffer`，但这只说明 screen 读进了缓冲区，不代表 Claude/Gemini/Codex 的输入框真的收到文本

### 2. 发送协议不可靠
- 发送不是"像人复制粘贴一整段再按回车"，而是把多行文本按行拆开，每行后都塞一次回车
- `screen -X stuff` 不能承载大段多行正文，遇到换行会拆坏，报 `stuff: one or two arguments required`
- 回车/提交时机不稳定：有时文字还没进输入框，回车已经发了

### 3. 终端状态判断错了
- 程序把"screen 存在 / 终端打开了"当成"AI 已经准备好接收输入"
- `screen hardcopy -h` 读取了历史滚屏，把已经过去的 trust 文案误读成当前状态
- 实际 Claude/Gemini/Codex 可能还在启动、报错、卡住、欢迎页、旧会话里

### 4. 环境没有彻底隔离（但隔离又导致"不原生"）
- 新开的 Codex/Gemini/Claude 可能继承了全局配置、hooks、shell wrapper
- 导致"新开一个"还是会坏
- 但过度隔离（`CODEX_HOME`/`GEMINI_CLI_HOME`/`env -i`）又让 Hub 打开的 CLI 和手动打开的不一样

### 5. 旧会话没有生命周期管理
- 旧的 `aihub-*` screen 还活着（累积到 51 个）
- 新的任务可能连到旧状态，或者旧进程继续污染行为

### 6. 没有可观测性
- 发出去之后，没有清楚记录：原始输入是什么、实际发给谁、每个 AI 有没有收到
- UI 显示"paste ok / readbuf ok"，但实际没有送达 AI 输入框，误导排查方向

---

## 本次修复过程中的主要改动（按时间线）

| 阶段 | 问题 | 修复方式 |
|------|------|------|
| 早期 | 旧格式 `[当前 AI 名称]` 包裹 prompt | 改成以用户原话开头，必要信息用 `---` 分隔 |
| 早期 | `screen -X stuff` 每行按一次回车 | 改成 `readbuf + paste`，最后只提交一次 |
| 中期 | 多个终端提交时序不稳 | 改成两阶段：先全部 paste，再广播回车重试 5 秒 |
| 中期 | 旧 App 没有被新版覆盖 | 清理桌面/Applications 多个同名旧版，强制覆盖 |
| 中期 | 新开终端仍被全局 shell wrapper 污染 | 绝对路径启动 + `GEMINI_CLI_HOME` + `CODEX_HOME` 隔离 |
| 中期 | `screen hardcopy -h` 读历史导致误判 | 改为不带 `-h`，只读当前屏幕 |
| 中期 | 提交键 `\n` 对 TUI 无效 | 改为真正回车 `\r` |
| 中期 | `screen readbuf/paste` 大文本失败 | 改成 `screen readreg + paste`，正文写临时文件 |
| 后期 | 过度隔离导致 Hub 与手动打开不一样 | 移除 `env -i`/`CODEX_HOME`/`GEMINI_CLI_HOME`，回归原生 `$SHELL -lic` |
| 后期 | `zsh -lic` 触发 conda 插件报错卡住 | 正在解决中 |

---

## 正确的架构方向

### 现在的问题

在用 `screen readreg/paste/stuff/hardcopy` 这套东西模拟人的键盘操作，而 Claude/Gemini/Codex 是为人类交互设计的 TUI，不是为程序控制设计的。它们有内部状态机、readline 缓冲、alt buffer、trust prompt、bracketed paste 处理……每一层都可能不按预期响应。

**UI 自动化是最脆弱的东西，修一个漏一个，因为这条路本来就不该走。**

### 正确做法：非交互模式

Claude Code、Gemini CLI、Codex 都支持非交互式调用：

```bash
claude --print "你的任务"     # 直接输出结果
gemini --prompt "你的任务"    # 直接输出结果
codex "你的任务"               # 直接执行
```

Hub 的正确实现：

1. 用户输入任务
2. 保存到 `prompt_history.jsonl`
3. 用 `child_process.spawn` 分别调用三个 CLI 的非交互模式
4. 捕获输出，显示在 UI 里
5. 如果用户想看终端过程，挂一个可选的"实时日志"面板

---

## 现在的取舍建议

### 保留的原则
- 账号登录和基础配置不乱动
- Hub 打开的 CLI 尽量等同于手动在终端里输入命令
- 用户输入保存到任务级 `prompt_history.jsonl`

### 不该做的
- 不给 CLI 注入隔离的 `HOME`/配置目录（除非用户明确要求）
- 不用 `env -i` 清空用户环境
- 不用 `screen readbuf/paste/hardcopy` 这套 UI 自动化
- 不让旧 `aihub-*` screen 无限积累

### 两条路

**路线 A（继续修现有架构）**
接受它永远不会完全稳定，因为在做 fragile UI automation。每次 CLI 更新都可能再次破坏。

**路线 B（用非交互模式重写，推荐）**
大概一两天工作量，之后不会再有这些烂问题。稳定、可控、可测试。

---

## prompt_history.jsonl 字段说明

每次发送自动记录，格式：

```json
{
  "id": "uuid",
  "createdAt": "2026-06-08T...",
  "taskFolder": "/Users/.../督导异常查找",
  "userText": "你真正输入的原话",
  "uploadedPaths": ["/path/to/file.xlsx"],
  "targetAgents": ["Claude Code", "Gemini CLI", "Codex CLI"],
  "sentTexts": ["实际发给 Claude 的文本", "..."],
  "perAgentResults": [
    {
      "agentName": "Claude Code",
      "ok": true,
      "status": "submitted",
      "stages": {
        "payloadPrepared": true,
        "inputCleared": true,
        "payloadStuffed": true,
        "submitAttempts": 3,
        "runningLikely": true
      }
    }
  ]
}
```

