# Architecture Boundaries

审计基准：`product/foundation`，commit `7cb9e046e8ec58864d95c3ce30541e369fdc833e`，Harness `0.1.2-alpha.4`。下文区分当前事实、产品建议和尚未验证的能力。

## 1. 当前架构与产品层位置

当前事实：`electron.vite.config.ts` 只配置 Main / Preload 构建，没有自有产品 renderer 入口。Electron 加载 Harness 提供的 loopback Web UI；`src/shared/contracts.ts` 只有 Runtime / Update 等宿主合同，没有完整 Project / Task / Run 领域模型。

```text
当前：Electron Main ──生命周期──> 隔离 Harness 进程 ──> 唯一 Agent Runtime
          │                              │
          │ 原生能力 / 窄 IPC              └──> 127.0.0.1 随机端口 Web UI
          └──> sandboxed BrowserWindow + Preload ────────┘

拟新增：独立 Client Plugin / 桌面组件
          └──> Product Adapter（产品语义与只读映射）
                  └──> 已验证的 Harness Client 合同 / projections / events
```

拟新增部分不是当前已有代码。Adapter 不成为第二个模型调用层、调度层或事件数据库。

## 2. 分层职责与修改许可

“以后允许”仍需要明确代码任务授权。本轮所有实现层均不改，只新增本目录指定文档。

| 层 | 当前职责 / 证据 | 产品实现允许的范围 | 第一版禁止事项 |
| --- | --- | --- | --- |
| Desktop Host | `src/main/`；窗口、菜单、启动/停止、恢复、原生目录选择、手机桥接、更新 | 必要的独立桌面呈现；复用既有窄 IPC | 不写 Agent Loop；不变更 webPreferences、Safe Mode、权限、更新、凭证或安装恢复语义 |
| Harness Runtime | `@deepseek-ai/dsh`、`dsh-agent-loop` 及工具/Session 模块；唯一执行与持久化权威 | 通过已验证的现有接口消费能力；上游保持可替换、可升级 | 不复制/重写 loop，不为本产品扩大既有 Runtime patches |
| Harness Web UI | `dsh-client-ui-*`；Conversation、Sidebar、Plan、Approval、Settings、工具和产物呈现 | 先配置/Token，再公开 Slot 或独立组件 | 不整套复制 UI；不靠 DOM hash/私有函数伪装成稳定扩展 |
| Product Adapter Layer（计划） | 当前不存在；负责产品 Task 与 Workspace/Session/Turn 的映射、ViewModel 和能力缺失处理 | 小而明确的纯类型/纯函数接口；读已有 projections；未知状态显式保留 | 不重复 Session 日志、审批裁决、工具调度、模型重试；不预造通用 Runtime 抽象 |
| Client Plugin | `packages/dsh-desktop-client-ui`、market installer、`dshmarket` 已有真实 Slot 用法 | 自有视图和公开 Slot contribution，带 disposer 与兼容性测试 | 不抢占 Approval composer chain；不修改权限含义；不直接改 node_modules |
| MCP / Skills | 已锁定的 Harness MCP / Skill 模块提供既有扩展机制；本次未配置/执行实际 MCP Server 或 Skill | 未来经 Harness 接入工具/任务知识，并遵循原有授权路径 | 不增加独立执行 Runtime；第一版不实现 Browser / Computer Control / Automation |
| 本地文件与 Shell | Harness `ctx.fs` / terminal / subprocess 及已挂载 policy/backend 处理实际操作 | 通过现有工具与审批执行；显示目标 path/cwd 和真实结果 | 不加通用 renderer `fs` / `shell.exec` 后门；不以 Plan 批准替代具体工具审批 |
| 用户数据与凭证 | Electron userData 下的 Harness profiles、settings、sessions 等；凭证继续由 Harness 管理 | 产品元数据如未来必要，应单独设计最小存储与关联，不复制敏感内容 | 不读取/展示/复制凭证；不迁移生产数据；不把 RuntimeSnapshot 原样发送到 UI、报告或遥测 |

本地可扩展源码与上游 ownership 是两个维度。例如 preset-transfer 的 Host 路由由桌面插件拥有，但对应 Preset UI 仍有上游 bundle patch。

## 3. Runtime 生命周期不能被产品层接管

- `src/main/runtime/harness-runtime.ts` 用既有 CLI 参数启动 `web --patch … --no-open --host 127.0.0.1 --port …`。
- macOS 由 `src/main/index.ts` 的 `launchDisclaimedUtilityProcess()` 启动 Electron UtilityProcess；Windows 使用随包 Node。这里的进程隔离不代表 Agent 文件操作是只读。
- `build/harness-node-entry.mjs` 包装诊断并导入上游入口，没有第二 Agent Loop。
- `src/main/state/launch-root.ts` 使用 `userData/launch-root` 作为中立 cwd。添加 Workspace 不应改为从任意项目目录启动整个宿主；项目操作归 Harness Workspace 合同管理。
- 重连、取消、turn/step 状态、结果持久化、模型重试与未知调用恢复均继续由 Harness 主导。

“保持可替换”意味着将当前版本合同限制在明确的产品适配面，并记录兼容性验证；不意味着现在设计并实现第二个 Runtime adapter。

## 4. 产品对象与真实合同

证据前缀 `N` 表示 `node_modules/@deepseek-ai/`；上游原件可从 `packages/harness-0.1.2-alpha.4/npm-dsh/` 中同包 tarball 复查。完整类型/Slot 来源见 [UI_SURFACE_MAP.md](UI_SURFACE_MAP.md)。

| 对象 | 已证合同 / 事实 | Adapter 应保留的限制 |
| --- | --- | --- |
| Project | `dsh-api-workspace-controller/.../client/service.d.ts`：`IWorkspaces.create({ path })`、WorkspaceId、list/rename/delete | 删除注册不删除文件或 Session。不要把目录名当稳定 ID |
| Task | `dsh-api-session-controller/.../client/contract/sessions.d.ts`：create/open/fork；Session 合同有 rename | Task 的目标/验收不是原生完整模型。关联策略须明确；不能把每条消息都当新任务 |
| Run | `dsh-session/lib/types/types.d.ts`：`turn/start`、`turn/end(reason)`、`step/start/end` | 可用 `(sessionId, turn)` 派生执行记录；Task 可跨多个 turn。idle、进程退出或没有错误消息均不等于成功 |
| Plan | `dsh-plan-mode` 的 `plan` projection：`active/pending`；`exit_plan_mode` 提交 Markdown 供审核；`dsh-tool-todo` 的 `todo/write` 是另一个列表 | 模式、计划正文、Todo 三者不可混为同一持久化对象；TodoItem 无已证稳定 ID |
| Tool Action | `tool/call` 的 callId、turn、step、name、原始 arguments；`tool/result` 的 message/error/meta | 使用现有配对与呈现模型，区分失败、未派发、取消和结果未知；不要自己重建递归 subCalls |
| Approval | `dsh-client-ui-approval` PendingApproval、`approval/request`、`answer('allowed-once' / 'rejected')` | 当前请求是 transient，不可宣布已有可恢复的持久化 Approval ledger；旧批准不得自行重放 |
| Change | 工具结果 `meta` 和 `diff-card-model` 可携带结果时的 contextual diff | 尚未找到完整 Git Change Set / accept / rollback 公共合同。Diff 不是自动变更归属证明 |
| Deliverable | `dsh-client-ui-deliverables/.../turn-deliverables.d.ts`：produced / producedForClosing 等 | 主要覆盖受支持的成功文件变更工具；Bash 间接产物等不完整。文件链接 patch 扩大识别范围，不证明该文件由本 Run 创建 |

`...` 仅缩略路径，不是 Interface 名称；具体可定位路径在 UI Surface Map 的证据表中。

## 5. 安全、权限与用户数据：冻结实现，准确描述

### 桌面与 Runtime 的权限不同

主 BrowserWindow 明确设置 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`、`webSecurity: true`（`src/main/index.ts` 的 `createWindow()`）。`src/main/security.ts` / `security-policy.ts` 限制导航、webview、外链和浏览器权限。

原生 picker 通过 `window.dshDesktopDirectoryPicker.pick()` → `directory-picker:open` → `dialog.showOpenDialog()`，校验主窗口 sender 与 mainFrame；保留原合同。

不能声称所有 IPC 都有相同校验：`harness:restart` 仅校验 sender，部分 mobile/log/update handlers 没有等价 sender/mainFrame 检查。这里只记录现状，不更改安全策略；也不把这些现有入口视为新增产品代码可随意调用的授权。

### Dev / Prod 与 Safe Mode

| 数据范围 | 当前路径 / 行为 | 限制 |
| --- | --- | --- |
| Dev | `appData/dsh-desktop-dev`，名称 `DSH Desktop Dev` | 不同 dev worktree 默认共用此目录，不是逐 worktree 隔离 |
| Prod | `appData/dsh-desktop`，名称 `DSH Desktop` | 保持历史路径，不随未来品牌改变而迁移 |
| Harness | 对应 userData 下的 `harness`（DSH_HOME） | Session、设置与插件数据不放安装目录 |
| Safe Mode | 独立官方-core profile | **不是全量数据隔离**；仍共用 settings、credentials、sessions、workspaces |
| 启动维护 | `launchHarness()` 执行 store pin、profile/generation/迁移与修复相关逻辑 | “代码未改的基线启动”也会写 Dev 数据，不能描述为系统级完全只读 |

本轮实测首次启动只创建 Dev 数据目录；生产目录仍不存在。未读取 profile 内容或凭证。

### 网络与敏感信息

- Harness 本体只监听随机 loopback 端口。普通 Dev 启动会另启 `0.0.0.0:43128` 手机桥接，生产使用 43127；不是整个产品只有 loopback 监听。
- 未打开手机入口、未配对、未启用公网 tunnel。现有 `showMobilePairing()` 在无 LAN pairing URL 时可能启动 tunnel，不能把打开该入口视为无网络副作用。
- `resolveShellEnvironment()` 捕获登录 Shell 完整环境并传给 Harness，不只是 PATH。本次未读取或显示环境变量。
- `RuntimeSnapshot` 包含认证字段；Runtime 写日志后再提取启动 token，实际 `harness.log` 可能含认证信息。因此本次没有读取/复制该日志，也不运行会捕获 token 的认证诊断脚本。

## 6. 扩展优先级与 patch 准入

严格按以下顺序选择修改方式：

1. 现有配置与实际消费的 Theme Token。
2. Cordis Client Plugin / 已声明的公开 Slot。
3. 独立桌面组件，沿用窄 IPC 和既有安全边界。
4. 有充分依据的 `patch-package`。
5. 最后才评估修改或 Fork 上游 Harness；本阶段不执行。

single、keyed、list、chain 的语义不同：新 list id 才是追加；single 是整席位替换；chain 只选首个匹配。替换 root/整列还可能移除子槽，不能把“类型允许注册”当作低风险改版许可。

当前 19 个补丁不全是 UI：还涉及 module resolution、LLM 错误分类、Session 删除和持久化。完整逐项登记见 [UI_SURFACE_MAP.md](UI_SURFACE_MAP.md)。现有 patch 的存在不构成新增同类 patch 的理由；原生目录选择已有可供迁出的双 directoryFlow Slot。

每个以后提出的 patch 必须记录：

- 要解决的精确行为与调用链。
- 为什么配置、Token、Plugin/Slot、独立组件均不足；未验证不能写成“不可能”。
- 上游包名/精确版本、修改文件、已有合同与补丁范围。
- 上游升级时的 patch apply、types、行为测试和真实 UI 验证方法。
- 是否触碰 Runtime、安全、权限、更新或凭证禁区；以及退出/移除补丁的条件。

没有逐项依据的旧补丁，应登记为兼容债务，而不是补造历史理由。

## 7. 下一项最小改动

当前完整测试仍有一项确定失败。建议先另行授权处理发布说明脚本的同提交 tag 别名与测试隔离，**不涉及客户端更新系统**。本轮不修复。

之后首项产品改动建议：新增一个无副作用的 Product Adapter 类型/映射模块与契约测试，覆盖 Workspace / Session / Turn / Tool Action、`active/pending`、未知与不支持状态。验收为：不启动模型、不执行命令、不写用户数据、不新增 fs/Shell IPC、不改权限、不复制日志。待该接口经当前上游类型验证后，才选择最小公开 Slot 呈现它。

Discuss 强约束、Change Set 归属与回滚、审批断线/恢复仍是独立门槛，不能由纯 ViewModel 假装完成。参见 [MVP_VERTICAL_SLICE.md](MVP_VERTICAL_SLICE.md) 与 [BASELINE_AUDIT.md](BASELINE_AUDIT.md)。
