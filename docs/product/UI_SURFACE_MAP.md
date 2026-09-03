# UI Surface Map：所有权、扩展合同与补丁登记

审计日期：2026-09-03。审计分支：`product/foundation`。审计 HEAD：`7cb9e046e8ec58864d95c3ce30541e369fdc833e`。Harness 锁定版本：`0.1.2-alpha.4`。

本文是现有代码的审计结果，不是实施授权。未实施视觉、CSS、品牌、产品功能或补丁修改。基线命令、实际 GUI 检查及失败结果以 [BASELINE_AUDIT.md](BASELINE_AUDIT.md) 为准；产品约束见 [ARCHITECTURE_BOUNDARIES.md](ARCHITECTURE_BOUNDARIES.md)。本轮未执行 Agent 任务，不把代码存在当作端到端验收通过。

## 读法与证据边界

- 仓库路径均相对仓库根目录；`N/` 明确表示 `node_modules/@deepseek-ai/`，不是新的源码目录。
- 上游包原件位于 `packages/harness-0.1.2-alpha.4/npm-dsh/deepseek-ai-<包名>-0.1.2-alpha.4.tgz`；表中 `lib/...` 对应压缩包内 `package/lib/...`。
- 先审计锁定 tgz 的代码、类型及 README，再交叉确认 `npm ci` 应用现有补丁后的 installed types/JS。当前事实优先级为：已安装且已应用补丁的代码 → 类型合同 → 包 README。补丁修改类型时，不沿用原件后半段行号。
- A/B 是所有权；C/D 是修改途径，不是互斥分类。同一区域可以 Harness-owned，同时有公开插槽和没有插槽的内部细节。
- “颜色/样式可改”仅指该组件实际消费的 Token 或自有组件样式；不能推导为任意内部 CSS 都有稳定覆盖接口。
- 修改风险和上游风险是基于耦合的审计判断，不是运行测试结果。“技术可改”不等于本轮允许修改；安全、权限、更新、凭证边界仍冻结。

## 关键结论

1. 主 Web UI 由 Harness 包拥有。Desktop 提供 Electron 窗口、启动恢复、原生桥及少量注入界面，不应重新实现 Agent Loop。
2. 当前已有足够的公开接口添加独立 Conversation View、标题动作、输入区域附加组件、Settings 页面、单工具 renderer 和目录选择适配。
3. `single` Slot 的整区域替换不等于内部定制接口。替换整列/Composer 可能同时失去原有子槽、Store、键盘行为和审批入口。
4. 现有 19 个 patch 不等于 19 个“必须 patch”区域。尤其原生目录选择已有两个公开 directory-flow Slot，可在未来迁移为独立 Client Plugin。
5. Plan mode 不是强只读边界；单调用 Diff 不是 Git Change Set；可点击路径也不等于本轮 Deliverable。当前没有已证实的完整 Change Set / 接受 / 回滚公共合同。

## A. Desktop-owned

| 区域 / 当前所属文件 | 当前职责 | 颜色 / 样式 | 排版 | 插入新组件 | 修改风险 / 上游风险 | 推荐修改方式 |
|---|---|---|---|---|---|---|
| 启动页：`build/splash.html`；`src/main/index.ts` 的 splash 加载 | Harness ready 前显示等待状态 | 自有 HTML/CSS 可改 | 可 | 可 | 低 / 低 | 独立桌面页面；不把此等待页误当产品首页 |
| 插件恢复页：`build/plugin-recovery.html`、`src/main/plugin-recovery-view.ts`、`src/main/index.ts` | 启动失败、重试、日志、插件卸载、Safe Mode 入口 | 自有呈现可改 | 可 | 可 | 呈现低，动作高 / 中 | 保留恢复动作语义；只在另行授权后改呈现 |
| Safe Mode 管理：`build/safe-mode.html`、`src/main/safe-mode.ts`、`src/main/state/safe-mode-profile.ts` | 独立本地管理窗口与安全配置流程 | 自有呈现可改 | 可 | 可 | 高安全/数据风险 / 中 | 第一版保持；不改安全策略 |
| Safe Mode 状态条：`src/preload/index.ts:207` | closed Shadow DOM 状态提示 | 自有样式可改 | 可，受覆盖位置约束 | 自有树内可 | 中 / 低中 | 保留状态真实性；不依赖 Harness 内部 CSS |
| 原生主窗口 / traffic lights：`src/main/index.ts:888` | 窗口大小、背景、原生按钮、Web preferences | 部分原生参数可改；OS 按钮不能任意 CSS | 窗口参数可调 | 可独立 view；非 Harness Slot | 中 / 低；安全参数高 | 使用现有窗口配置；冻结 `webPreferences` 安全设置 |
| macOS 拖拽/主题适配：`src/main/index.ts:491` | `executeJavaScript` 注入透明 drag region，固定几何 | 自有注入样式可改 | 可，但与 Header 位置耦合 | 可覆盖层，非公开 Slot | 中高 / 中高 | 保持最小桥；实测拖拽、点击、traffic lights，不推广 DOM 注入模式 |
| 原生菜单 / 右键：`src/main/index.ts:2235`、`src/shared/desktop-menu.ts`、`src/main/context-menu.ts` | 原生菜单项与桌面命令 | macOS 原生样式，非任意 CSS | 菜单顺序可调 | 可增加菜单项，非 React 内嵌 | 中 / 低 | 使用既有菜单模型；安全、更新命令冻结 |
| Windows 标题栏：`src/preload/windows-titlebar.ts`、`src/preload/windows-menu.ts`、`build/windows-menu.html` | Windows 自有 titlebar / menu view | 可 | 可 | 自有 view 内可 | 中高 / 高 DOM 耦合 | 非首平台；保留，不扩展依赖 `data-dsh-sidebar-*` 的模式 |
| 原生 Workspace picker：`src/preload/index.ts:143`、`src/main/index.ts:2455` | `window.dshDesktopDirectoryPicker.pick()` → IPC → `showOpenDialog({properties:["openDirectory"]})` | OS chooser 不可任意 CSS | OS 控制 | 不可插入 React 组件 | 桥接中，安全高 / 低 | 保持窄桥、sender/mainFrame 校验；Web 端走公开 directory-flow Slot |
| About：`src/preload/index.ts:582`、`src/main/index.ts:1420` | closed Shadow DOM About 和原生 fallback | 自有部分可 | 可 | 可 | 低中 / 低 | 独立桌面组件；保留相关更新行为 |
| 更新 UI：`src/preload/index.ts:375`、`src/preload/update-view.ts`、`src/main/update/update-manager.ts` | 自有更新浮层和生命周期提示 | 自有部分可 | 可 | 可 | 高更新/数据风险 / 中 | 第一版保留，不更改更新逻辑或来源 |
| 手机按钮：`src/preload/index.ts:157` | 追加到 Sidebar Settings 同行 | 自有样式可 | 受上游锚点约束 | 当前为 `appendChild`，不是公开 Slot | 中高 / 高 | 记录现有债务；不扩展手机能力；同行要求与 footer Slot 不同 |
| 手机桥页面 / 窗口：`src/main/mobile/lan-mobile-pages.ts`、`src/main/mobile/lan-mobile-bridge.ts`、`src/main/index.ts:2350` | LAN/mobile 专用页面、窗口和桥接 | 自有 UI 可 | 可 | 可 | 高传输/认证风险 / 中 | 第一版不扩展，保留未来边界 |
| 原生任务通知 | 在已审计 `src/main`、`src/preload`、`src/shared` 中未发现对应 Notification 实现 | 未确认 | 未确认 | 未确认 | 未评估 / 未评估 | 不把更新浮层或手机按钮称作已有原生任务通知 |
| 桌面品牌 occupant：`packages/dsh-desktop-client-ui/client.js` | 通过三处真实 Slot 提供 Sidebar mark/name 与 Hero mark | 自有样式和 light/dark 资源可改 | 仅自己的组件内可 | 自有组件内可；不能重排 Sidebar 壳 | 低中 / 中 | 已有 Client Plugin；本轮不改品牌 |
| 插件市场安装/管理页：`packages/dsh-desktop-market-installer/client.js` | 自有 Settings section 或 Plugins tab | 自有 CSS/Token 可改 | 自有组件内可 | 可 | UI 中，安装行为高 / 中 | 保留真实 Slot；安装/卸载与安全动作冻结 |
| Preset 导入导出 Host 支持：`packages/dsh-desktop-preset-transfer/index.js` | 提供精确导入/导出 routes 与归档校验；UI 仍由上游 preset patch 提供 | 本包不是 UI | 不适用 | 不适用 | 高文件/数据风险 / 中 | 区分 Host Plugin 与上游 UI patch；不作为 Task Adapter 通用写入通道 |
| HMR fallback：`packages/dsh-desktop-hmr-fallback/index.js` | 在缺 internal module loader 时监听配置并串行 refresh | 非 UI | 不适用 | 不适用 | 中启动风险 / 中 | 独立 Host Plugin，不是第二个 Runtime 或页面扩展点 |

手机按钮同行选择的现有说明见 `build/dsh-desktop.patch.yml:6-10`：公开 `sidebar.footer.action` 使用独立行，因此不能直接等价替代“Settings 同行”布局。该理由不意味着所有 Sidebar 扩展都必须依赖私有 DOM。

## B. Harness-owned

下表的 Slot 全名、kind、scope 和 owner props 在 C 节展开。

| 区域 / 当前所属文件或符号 | 当前职责 | 颜色 / 样式 | 排版 | 插入新组件 | 修改风险 / 上游风险 | 推荐方式 |
|---|---|---|---|---|---|---|
| AppFrame：`N/dsh-client-ui-layout/lib/types/client/index.d.ts`；`computeColumns` | 三列、resize、concession、theme presenter | 现有 Token 可改 | 内部列算法无同粒度公开配置 | `shell.overlay` 可追加；整列 single 可替换 | 追加低中，几何高 / 中高 | Token、overlay；保留 AppFrame |
| Sidebar：`N/dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts` | 品牌、New Session、collapse、Workspace/Settings seats | Token、品牌 seats | 自有 occupant 可排版；壳内部无细槽 | 品牌替换、footer action | 中 / 中；DOM patch 高 | 使用内层 seats，勿为加一入口替换整列 |
| Workspace / Session 浏览器：`N/dsh-client-ui-workspace/lib/types/client/contract/slots.d.ts` | 搜索、分组、行、菜单、创建/选择 Workspace | Token | 整浏览器可替换；内部行布局无已证细槽 | 双目录流程；整区替换 | 高 / 高 | 保留浏览器，目录流程独立插件 |
| Conversation / Composer：`N/dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts` | hero、Session header、View nav、resident editor、提交/queue | Token、内容字号 | 新 View 自有；Composer 内部需整体替换或 patch | header、dock、left/right、overlay | 外围中，整 composer 高 / 中高 | 新 View / additive Slot，保留交互链 |
| Chat transcript：`N/dsh-client-ui-chat/lib/types/client/contract/slots.d.ts` | 事件投影、消息/命令/工具节点、阅读位置 | Token | 按 node kind 接管 renderer；内部私有细节无通用 hook | assistant actions、turn-tail chain | 单 node 中，整 transcript 高 / 中高 | keyed renderer，不复制事件配对/assembly |
| Plan mode chip：`N/dsh-client-ui-plan/lib/types/client/PlanModeControl.d.ts` | 读取 `plan` projection，执行 `/plan off` | Token | 整个 plan seat 可替换 | 专用 single；不是多项追加 | 呈现中，语义高 / 中 | 只做投影呈现，保留 Host 行为 |
| TodoDock：`N/dsh-client-ui-conversation/lib/types/client/skeleton/TodoPanel.d.ts` | 展示 `todos` projection 的步骤状态 | Token | 自有替换组件可 | input dock 中 `id=todo`，新 id 可追加 | 中 / 中 | 保留事实来源；TodoItem 不是完整产品 Plan |
| Approval：`N/dsh-client-ui-approval/lib/types/client/contract/slots.d.ts` | pending request 接管 composer，返回一次允许/拒绝 | Token | detail 可整体替换；按钮/flow 无细槽 | `conversation.approval.detail` | 高 / 高 | 保留审批 flow；第一版不改权限语义 |
| Model Selection：`N/dsh-client-ui-model-selection/lib/types/client/slots.d.ts` | model directory、选择、reasoning selection | Token | model seat 可完整替换；内部列表无细槽 | 整 single selector | 中高 / 中高 | 优先原有配置；必要时独立 seat renderer |
| Permission：`N/dsh-client-ui-conversation/lib/client.js` 的 `InputBar` / `PermissionSelect`；`N/dsh-client-ui-permission-presets/lib/types/client/index.d.ts` | access control、`/permission` popup、默认 preset 设置、风险确认 | Token | InputBar 内硬编码，无 `conversation.input.permission` Slot | 周边槽可追加，不能变成权限内部 hook | 高 / 高 | 第一版不改，不能视作普通显示开关 |
| Settings shell：`N/dsh-client-ui-settings/lib/types/client/contract/slots.d.ts` | trigger、modal、页导航、onboarding | Token、文字 seats | section 内自由；壳几何无通用布局 hook | section/item/tab/action | 追加低中，壳修改高 / 中高 | 追加自有页，保留原有安全/模型设置 |
| Models Settings：`N/dsh-client-ui-settings-models/lib/types/client/slot-contract.d.ts` | provider 编辑、模型配置、onboarding | Token | 附加区自由；内部 editor 无细槽 | provider-card extras、footer；整 section 可换 | 高 / 高 | 使用附加区；第一版不动凭证表单 |
| Agent Preset：`N/dsh-client-ui-agent-preset/lib/types/client/index.d.ts` | 创建前选择、运行中标签、管理页 | Token | 三个外层 seats 可换，内部菜单/表单无细槽 | hero/header/settings | 中高 / 中高 | 复用既有 preset 入口和 Host composition |
| Tool Call：`N/dsh-client-ui-tool/lib/types/client/contract/slots.d.ts` | call tree、single tool renderer、generic fallback | Token；自有 tool renderer 可自有样式 | keyed tool renderer 内自由 | 按 wire name 注册 | 中 / 中 | `tool.call.toolview`；不重做 topology / pairing |
| Tool Details / Diff：`N/dsh-client-ui-chat/lib/client.js` 的 `DetailsPanel`；`N/dsh-client-ui-tool/lib/types/client/tool/models/diff-card-model.d.ts` | 选中调用详情、部分文件工具 contextual diff | Token | 整 details body 可替换 | `conversation.details.tool` | 中 / 中；变更语义高 | 只读展示可独立；不是接受/回滚接口 |
| Deliverables：`N/dsh-client-ui-deliverables/lib/types/client/turn-deliverables.d.ts` | 成功 mutation 的产物路径、closing prose 文件链接 | Token | turn-tail occupant 自有；chain 非多行追加 | chain 或另一个 additive 位置 | 中高事实风险 / 中高 | 只展示已证 mutation facts，标出覆盖缺口 |
| Theme：`N/dsh-client-ui-theme/lib/types/client/index.d.ts` | light/dark/system、字号、token layer | 公开 API 支持 | 不是 DOM 重排 API | 不负责组件插入 | 低中 / 中 | 优先 ThemeRuntime，勿用 hash class 定制 |

两处已安装行为与部分上游文字不同：

- macOS 收起 Sidebar 实际为 **80 px**，其他平台为 56 px；证据为 `N/dsh-client-ui-layout/lib/client.js` 的 `COLLAPSED_SIDEBAR_WIDTH`，来自现有 layout patch。
- 当前 `details` occupant 的实际注册位于 `N/dsh-client-ui-chat/lib/client.js` 的 `DetailsPanel`。layout 类型注释/README 仍提 ui-conversation；实际所有权以注册代码为准。

## C. 公开 Plugin / Slot / Theme 合同

### C1. Client Plugin 载入与生命周期

`N/dsh-client-modules/README.md` 的 “Declaring a client plugin / Sharing modules” 定义：包声明 `dsh.client.platform: web`、导出 `./client` bundle，非 baseline 的模块请求声明在 `dsh.client.external`。React、Cordis 和静态 UI 库来自同一平台 module table；不能通过另打一个 React 副本绕过共享身份。

真实本地实例：

- `packages/dsh-desktop-client-ui/client.js:69-84` 经 `slots.inject/register` 占用 `sidebar.brand.mark/name` 和 `conversation.hero.brand.mark`；`build/dsh-desktop.patch.yml` 禁用官方品牌 occupant，避免默认同 priority 冲突。
- `packages/dsh-desktop-market-installer/package.json` 声明 `./client` 和 `dsh.client`。
- `packages/dsh-desktop-market-installer/client.js:676-709` 使用 `ctx.slots.inject/register` 注册 `settings.plugins.tab` 或 `settings.section`。
- `packages/dshmarket/src/client/index.ts:105-124,145-149` 注册 Settings section 和 `shell.overlay`。

Slot 规则来自 `N/dsh-client-ui-slots/lib/types/index.d.ts` 的 `SlotCore.register`、`ChainSelect`、kind options，以及 `N/dsh-client-ui-renderer/lib/types/client/registry.d.ts` 的 `inject`：

1. 用 `ctx.slots.inject(name, () => ctx.slots.register(...))` 依赖声明生命周期，不猜插件加载顺序。
2. 向未声明 Slot 注册会抛错；一个子槽只有一个声明者，只有该声明者有 render 权限。
3. `single` / `keyed` / `list` 同一个 cell 的最低 priority 获胜；相同 cell、相同 priority 会抛错。不要以为第二次注册自动追加。
4. `list` 新 `id` 才追加；同 id 是 shadow。`chain` 按 priority 升序选第一个 non-null selector，不是累积呈现。
5. disposer/unload 清理 contribution；声明者卸载会级联清理子槽。跨插件数据走公开 service/observable，避免复制内部 Store。
6. 整区域 replacement 需承担原 occupant 的所有行为与子槽合同；不是对私有 DOM 的安全局部手术。

### C2. props 约定

以下表只列 owner 额外 props。`N/dsh-client-ui-session/lib/types/client/index.d.ts` 为标准份额提供：

- root global：`useSessions`、`useSessionPendingInteraction`；Workspace 插件另提供 `useWorkspaces`。
- session：`sessionId`、`useSession`、`useProjection`。
- session-maybe：同名字段允许未选 Session 时 absent。
- `ui-conversation` 进一步提供 `useConversation`、`useInput`、`inputActions`；具体组件通过 `ComposedProps` / `PropsRuntime` 等组合，不自行伪造这些字段。

### C3. Layout、Sidebar、Workspace 精确表

| Slot | kind / scope | Owner props | 当前边界 |
|---|---|---|---|
| `root` | single / root | 空 | 已被 AppFrame 占用；类型明确警告不要注册来追加 UI |
| `sidebar` | single / root | `collapsed, width` | 整导航列替换，原子槽随原 occupant 生命周期结束 |
| `conversation` | single / session-maybe | 空 | 整中列，含无 Session 状态与 resident composer |
| `details` | single / session | 空 | 整右列；开关仍属 `ctx.layout` |
| `shell.overlay` | list / root | 空 | frame-wide 追加；层默认 click-through，组件自管 pointer events |
| `sidebar.brand.mark` | single / root | `size` | 只替换 mark，保留周边控制 |
| `sidebar.brand.name` | single / root | 空 | 只替换 name |
| `sidebar.workspaces` | single / root | `wide, expandSidebar()` | 整搜索、分组、Session 行和 Workspace dialogs |
| `sidebar.settings` | single / root | `wide` | 已有 settings trigger + panel seat，不是追加入口 |
| `sidebar.footer.action` | list / root | `wide` | 追加 footer action，不承诺 Settings 同行 |
| `conversation.hero.workspace` | single / root | `open, anchorRef?, selectedId?, onPick, onClose` | 整 hero picker |
| `conversation.hero.workspace.directoryFlow` | single / root | `open, busy, onPicked(path), onCancel(), onError(message)` | occupant 完整拥有选择交互；父持有创建/采用路径和错误处理 |
| `sidebar.workspaces.directoryFlow` | single / root | 同上 | 与 hero 的独立声明生命周期；相同适配器须覆盖两处 |

证据：`N/dsh-client-ui-renderer/lib/types/client/registry.d.ts` 的 root 声明；`N/dsh-client-ui-layout/lib/types/client/index.d.ts` 的 SlotMap；`N/dsh-client-ui-sidebar/lib/types/client/contract/slots.d.ts`；`N/dsh-client-ui-workspace/lib/types/client/contract/slots.d.ts` 的 `DirectoryFlowOwnerProps` / `DirectoryFlowSlotName`；`N/dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts` 的 `EmptyWorkspaceOwnerProps`。

`ctx.layout` 的公开 `ILayout` 只含 `toggleSidebar()`、`openDetails()`、`closeDetails()`；没有任意列宽 setter。证据：`N/dsh-client-ui-layout/lib/types/client/service.d.ts`。

### C4. Conversation、Plan、Chat、Approval、Tool 精确表

| Slot | kind / scope | Owner props | 当前边界 |
|---|---|---|---|
| `conversation.session` | single / session | 空 | 整 Session body |
| `conversation.session.header` | single / session | 空 | 整 title / action / View nav |
| `conversation.session.header.lineage` | single / session | `lineageSessionId, displayTitle, openTitle?` | 单个 breadcrumb title |
| `conversation.session.header.actions` | list / session | 空 | title 邻接动作；现有 preset entry id=`agent-preset` |
| `conversation.session.header.utilities` | list / session | 空 | 右侧 utilities |
| `conversation.view` | list / session | `viewRequest, openView(view, focus), completeViewRequest()` | id/label 投影为 tab；一次只显示一个 View，不是自动并排 |
| `conversation.composer` | chain / session | `sessionId?, session?, pendingInteraction?` | temporary takeover，首个 selector wins；避免抢占审批 |
| `conversation.hero.brand.mark` | single / root | `size, className?` | 空态 mark |
| `conversation.hero.agentPreset` | single / root | 空 | 创建前 preset 选择 |
| `conversation.input.dock` | list / session | `session, input` | composer 卡上方 full-width；已有 `id=todo` |
| `conversation.input.overlay` | list / session | 空 | composer 卡内浮层 |
| `conversation.composer.dock` | list / session | 空 | composer 卡下方 ambient 区 |
| `conversation.input.left` | list / session | 空 | 工具行左侧 compact controls |
| `conversation.input.right` | list / session | 空 | submit 前 compact controls |
| `conversation.composer.bar` | single / session-maybe | `disabled?, workspacePickerOpen?, onRequestWorkspace?, placeholder?, accessory?` | 整 resident editor；替换需保留队列、附件、键盘和提交行为 |
| `conversation.input.attachments` | single / session-maybe | `attachments, canAcceptDrop, onAddImages, onRemoveImage, dropLimits?` | draft image rail / drop |
| `conversation.input.plan` | single / session | `locked` | 整 Plan chip |
| `conversation.input.model` | single / session | `locked` | 整 Model selector |
| `conversation.chat.node` | keyed / session | 按 kind 类型化的 `node`；`selectedCallId?, cwd?, openFile, inspectCall, forkAt, renderMessageImages, fileMentions, turnProcess?` | 相同 key 接管该 renderer；无人注册的 kind 不渲染 row |
| `conversation.message.images` | single / session | `images, loadImage, align` | 整 message gallery |
| `conversation.chat.commandview` | keyed / session | `node, compaction?` | 按 command name；未注册使用 generic fallback |
| `conversation.chat.turnTail` | chain / session | `turn, seq, openFile` | completed Turn action row 前；不是可任意追加多个尾部行的 list |
| `conversation.chat.assistant-actions` | list / session | `messageId` | finalized assistant 的追加动作 |
| `conversation.details.tool` | single / session | `block, cwd?` | 选中 Tool 的整个 details body |
| `tool.call.toolview` | keyed / session | `callId, toolName, block, cwd?, home?, openFile, inspect?` | 按准确 wire tool name；新工具为追加，已有工具为接管 |
| `conversation.approval.detail` | single / session | `callId` | correlated Tool detail，不是 approval buttons hook |

证据：

- `N/dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts` 的 SlotMap、`InputZone`、`ComposerBarOwnerProps`、`ComposerChainProps`、`InputControlOwnerProps`。
- `N/dsh-client-ui-chat/lib/types/client/contract/slots.d.ts` 的 SlotMap、`ChatNodeOwnerProps`、`TurnTailOwnerProps`、`DetailsToolOwnerProps`。
- `N/dsh-client-ui-tool/lib/types/client/contract/slots.d.ts` 的 `ToolCallOwnerProps`。
- `N/dsh-client-ui-approval/lib/types/client/contract/slots.d.ts` 的 `ApprovalDetailOwnerProps`；其 `lib/client.js` 注册 composer chain、priority=1，并监听 `approval/request`。
- `N/dsh-client-ui-conversation/lib/client.js` 的 `TodoDock` 读取 `useProjection("todos")`，在 input dock 注册 `id=todo`。

数据层新增 View 不必复制 Runtime：`N/dsh-client-ui-conversation/lib/types/client/conversation/assembly.d.ts` 的 `UiConversation.events/views/binding()`，以及 `ConversationEventRegistry.register()` / `ConversationViewRegistry.register()` 提供公开注册合同。新 builder 仍应消费既有事件事实，不能创建第二套执行循环。

### C5. Settings 精确表

| Slot | kind / scope | Owner props | 当前边界 |
|---|---|---|---|
| `settings.trigger` | single / root | `wide` | icon/label 内容；button chrome/open state 属壳 |
| `settings.header` | single / root | 空 | panel title text |
| `settings.action` | list / root | 空 | 内容列 Header，Close 前 |
| `settings.close` | single / root | 空 | visually-hidden accessible label，不是 close button 几何 |
| `settings.section` | list / root | `close()` | id/order/label，每 entry 是完整页 |
| `settings.plugins.tab` | list / root | 空 | Plugins section 内的 tab |
| `settings.plugin.item` | keyed / root | 空 | Configurable Plugins tab 内按 settings namespace 分派的整卡；卡自管内部，Host namespace 与 Client key 配对 |
| `settings.onboarding` | list / root | `stepId, complete(), openSection(id)` | 顺序 step；registrant 自管 modal、readiness、inert |
| `settings.general.item` | list / root | 空 | 自带 label/control 的 preference row |
| `settings.models.provider-card` | keyed / root | `provider, configured, keyConfigured` | key=`settingsNs`；仅卡片附加区域，不是 provider 卡本体 |
| `settings.models.footer` | list / root | 空 | provider rows 和 add controls 之后 |

证据：`N/dsh-client-ui-settings/lib/types/client/contract/slots.d.ts`；`N/dsh-client-ui-settings-plugins/lib/types/client/slot-contract.d.ts`；`N/dsh-client-ui-settings-models/lib/types/client/slot-contract.d.ts`。已安装代码的 `settings.section` 中，Models 使用 `id=models`，Agent Presets 使用 `id=agent-presets`；替换整个页会承担完整业务行为，不等于能在原 Editor 内部随意插字段。

### C6. Theme Token 合同

`N/dsh-client-ui-theme/lib/types/client/index.d.ts` 的 `ThemeRuntime` 公开：

| API | 能力 | 限制 |
|---|---|---|
| `getTheme()` / `exportInspectTokens()` | 读取快照和 token 目录 | 不改 UI；inspection 并不证明某 token 被所有组件消费 |
| `setTheme(id)` | 选择已注册主题或 system | 内置偏好与第三方 in-process 注册不能混同为同一持久化 schema |
| `setFontSize(px)` | 内容字号 | 整数 12–17；不是全局任意 typography 系统 |
| `register({id, colorScheme, tokens})` | 注册 light/dark 语义和 token override | 重复 id 抛错；不能把 `system` 注册为具体主题 |
| `overrideTokens(source, tokens)` | 可释放的分层覆盖；同 source 重注册整体替换层 | 每值必须 `{light, dark}` 字符串对；后层覆盖前层，不改变 DOM 排版 |

已声明的目录包含 `--dsw-alias-bg-base`、`--dsw-alias-bg-layer-1`、`--dsw-alias-bg-layer-2`、`--dsw-alias-bg-overlay`、`--dsw-alias-border-l1`、`--dsw-alias-border-l2`、`--dsw-alias-brand-primary`、`--dsw-alias-label-primary`、`--dsw-alias-label-secondary`，以及 `--dsw-specific-sidebar-fill`。此外还有 error/success/warn 状态相关变量。证据：installed `lib/client.js` 的 `BUILTIN_INSPECT_TOKENS`。

`validateOverrides` 只检查 light/dark 值形状，不保证名字拼写、实际消费、对比度或布局效果。布局硬编码、组件 CSS Module 和未消费变量不能凭 Token API 的存在就宣称可定制。优先对公开、已消费变量做 light/dark 检查；不以散布私有 hash class 覆盖建立产品层。

## D. 有条件的 Patch-only

这里的 “Patch-only” 限定为：**保留现有组件和行为，只改变其未暴露的内部细节**。不作“任何插件方案都不可能”的绝对断言；整区域重写虽然技术上可行，也不能自动认为比一个小补丁更安全。

| 受限内部改动 | 当前没有同粒度公开合同的证据 | 可用但不等价的替代 | 判断 |
|---|---|---|---|
| AppFrame 收起宽度 / concession 内部算法 | `computeColumns`；`ILayout` 只有三项面板动作 | 整 root 替换会接管全部 frame | 保留 frame 时需内部 patch；优先验证未来上游是否给配置 |
| Sidebar New Session / collapse padding / 同行私有锚点 | 壳只声明 brand、workspaces、settings、footer seats | footer 为独立行；整 sidebar 接管成本高 | 当前细布局 patch；品牌替换本身不是 patch-only |
| `PermissionSelect` 内部菜单和 RiskConfirmation | InputBar 直接构造组件，无 permission 专用 Slot | 整 composer.bar 替换会承担安全交互 | 属敏感内部区域；第一版禁止修改，无需为产品改版动它 |
| 既有 Models/Presets/Workspace 组件内部搜索、行菜单、表单 Store | 仅发现整区域/附加区域 seats，未发现这些内部字段钩子 | 整 section/browser/selector replacement | 仅“保留旧组件的内部细改”属于当前 patch 路径；不能称整区域必需 patch |
| 原生 picker bridge 适配 | 双 `directoryFlow` single 已完整描述 open/result 协议 | 独立 Client Plugin 注册两个 occupant | **不是必须 patch**，优先未来迁移验证 |
| 调用错误 formatter / file-mention resolver 的局部语义 | 当前内部函数，未找到对应同粒度插件 setter | keyed node 或 service replacement 需另外论证 | current patch；未证完全不可替代 |
| Session 删除、持久化、Workspace registry 清理 | 涉及 Host/Storage lifecycle，不是 UI Slot 职责 | 等价 Host plugin 尚未完成论证 | 高风险 Runtime patch，第一版不改；不能包装成 UI 定制 |

### D1. 19 个既有补丁完整登记

范围是仓库当前 `patches/` 的全部 19 个文件。包均属 `@deepseek-ai/`；除 `cordis-plugin-loader@1.0.3` 外均为 `0.1.2-alpha.4`。下表的测试名称是**现有或建议的升级验证入口**，不是“本轮该测试通过”的声明。实际运行结果统一见 [BASELINE_AUDIT.md](BASELINE_AUDIT.md)。

共同升级门槛：重新审阅目标函数/类型/Slot 合同，确认上游是否已吸收改动；在干净安装中应用补丁；运行相关测试、typecheck/build 和所列真实交互。补丁成功应用或字符串测试成功不等于行为兼容。每项不得把旧补丁无审查地搬到新 bundle。

| # | 补丁文件 / 上游包版本 | 当前修改与风险 | 为什么 Plugin / Slot 不能完成，或尚未证明 | 上游升级如何验证 |
|---|---|---|---|---|
| 1 | `@deepseek-ai+cordis-plugin-loader+1.0.3.patch` | `lib/index.js`：bare import 失败后按 `ctx.baseUrl` 用 createRequire/resolve 回退；启动风险高 | Loader 内部解析，无已记录公开同粒度 hook；当前 patch，不宣称所有 Host 方案都不可能 | `test/cordis-plugin-loader-patch.test.ts`、`test/client-modules-resolution-patch.test.ts`；真实打包插件载入/路径失败回退 |
| 2 | `@deepseek-ai+dsh+0.1.2-alpha.4.patch` | `package.json`：加入四个 dsh-desktop-* 依赖，维持 desktop plugin closure；高启动风险 | 已有明确理由：profile 镜像锚定 dsh manifest 闭包，仅 composition 插入不足；见 `docs/harness-0.1.2-upgrade.md:176-189` | `test/desktop-plugin-closure.test.ts`、profile consistency 与真实启动；确认 manifest/安装镜像闭包 |
| 3 | `@deepseek-ai+dsh-api-session-controller+0.1.2-alpha.4.patch` | client/host、RPC schema/types：Session 永久删除、handle lifecycle、Workspace 清理、remote-event projection 调整；高 Runtime 风险 | UI Slot 不能控制 Host 删除/teardown；等价 Host plugin 尚未论证 | `test/session-delete-patch.test.ts`、`test/session-create-remote-event-patch.test.ts`；真实 RPC→teardown→storage→registry→UI、并发/失败、严格 schema |
| 4 | `@deepseek-ai+dsh-client-modules+0.1.2-alpha.4.patch` | `lib/index.js`：ClientModuleRegistry 解析失败时相对 baseUrl 解析 package.json；高启动兼容风险 | 未记录公开内部 resolution hook；current patch | `test/client-modules-resolution-patch.test.ts`、loader 相关检查；真实 Web plugin graph 与打包模块加载 |
| 5 | `@deepseek-ai+dsh-client-ui-agent-preset+0.1.2-alpha.4.patch` | `lib/client.js`：搜索、最近四项、分组、链接、导入预览/冲突、导出、Store/CSS；高维护风险 | 有 hero/header/settings 外层 seats，内部菜单/表单无已证细槽；**不是整区域 must patch** | `test/preset-transfer-patch.test.ts`；真实 picker、预览→确认、ID 冲突、导出、取消/失败，保留 Session preset 约束 |
| 6 | `@deepseek-ai+dsh-client-ui-chat+0.1.2-alpha.4.patch` | `failureMessage` 增加 QUOTA/FORBIDDEN 和中英文文案；中风险 | 内部 formatter 无已证 hook；替换整 node 不等价局部 formatter | `test/provider-error-patch.test.ts` + 受控错误展示；确认当前 patch 只做错误文案，不沿用旧说明中的 Markdown/path seam 结论 |
| 7 | `@deepseek-ai+dsh-client-ui-deliverables+0.1.2-alpha.4.patch` | `localPathReference` 扩展；无 produced paths 时仍提供 file-mention resolver；中高事实/路径风险 | 当前服务行为 patch；独立 service replacement 是否等价未论证 | `test/local-path-links.test.ts`；path/URI/line suffix/歧义/原有访问确认；可点击路径不可错误标作 produced |
| 8 | `@deepseek-ai+dsh-client-ui-directory-picker-native+0.1.2-alpha.4.patch` | `ctx.uiWorkspace.pickDirectory` 替换为 `window.dshDesktopDirectoryPicker.pick` 窄桥；桥接风险中 | **已证双 directoryFlow Slot 可由独立 Plugin 接管，不属于 must patch** | `test/directory-picker.test.ts`；hero/sidebar 两入口的实际选择、取消、回填、桥错误；保持 sender/mainFrame 安全校验 |
| 9 | `@deepseek-ai+dsh-client-ui-layout+0.1.2-alpha.4.patch` | `computeColumns`：macOS 收起 80 px，其他 56 px；中高布局风险 | 未证同粒度配置；brand Slot 不控制列算法，整 root 替换非等价小改 | `test/branding-patch.test.ts`；窄窗、收起/展开、resize、traffic lights、拖拽点击实机检查 |
| 10 | `@deepseek-ai+dsh-client-ui-model-selection+0.1.2-alpha.4.patch` | ModelSelect 搜索/filter/focus/keyboard/空态/CSS；中高风险 | `conversation.input.model` 能换整 selector；没有已证内部搜索细槽，**不是整区域 must patch** | `test/model-selection-search-patch.test.ts`；键盘/focus、分组/搜索、空态、reasoning effort、选择失败 |
| 11 | `@deepseek-ai+dsh-client-ui-settings-models+0.1.2-alpha.4.patch` | provider onboarding/grid/search/order、图片输入、catalog、reasoning、sticky footer；大 bundle、高维护/凭证 UI 风险 | provider-card/footer 只是附加区；整 section 可替换，不等于修改内部 editor 字段；第一版不改敏感表单 | `test/onboarding-patch.test.ts`、`test/model-picker-patch.test.ts`、`test/model-reasoning-efforts-patch.test.ts`、`test/model-settings-catalog-ux-patch.test.ts`；真实设置/取消/错误与不泄露凭证检查 |
| 12 | `@deepseek-ai+dsh-client-ui-sidebar+0.1.2-alpha.4.patch` | top/rail padding 与 `data-dsh-sidebar-root/wide/settings` 锚点；私有 DOM 跨层高耦合 | 品牌有 Slot；手机同行与 footer 独立行不等价，有现有理由；不能推广为整个 Sidebar 无扩展点 | `test/branding-patch.test.ts`、Windows titlebar 相关检查；实机 Settings 同行、collapse、锚点、拖拽/点击 |
| 13 | `@deepseek-ai+dsh-client-ui-trajectory+0.1.2-alpha.4.patch` | requestErrorMessage QUOTA/FORBIDDEN 及 locale；中风险 | 内部 formatter 无已证同粒度 hook；current patch | `test/provider-error-patch.test.ts`；受控 request-error detail 展示与中英文切换 |
| 14 | `@deepseek-ai+dsh-llm-deepseek+0.1.2-alpha.4.patch` | quota 优先、401 AUTH / 403 FORBIDDEN 分类；中高 adapter 风险 | Runtime adapter 内部，不适用 UI Slot；整 adapter 替换不在 MVP 范围 | `test/provider-error-patch.test.ts`；后续 mock HTTP 覆盖 quota/401/403/其他错误，确保重试/报错语义不漂移 |
| 15 | `@deepseek-ai+dsh-llm-pi-ai+0.1.2-alpha.4.patch` | quota 优先，再用错误文本正则分离 401/403；中高上游格式耦合 | Runtime adapter 内部，不是 UI patch；未论证同粒度插件 hook | 同一 provider-error 检查；后续 mock 多 provider 错误 payload、边界文本和 fallback |
| 16 | `@deepseek-ai+dsh-session-persistence+0.1.2-alpha.4.patch` | `assertDeletable`、串行 delete、`deleteStored?`、协调器/types；禁止 reserved/committing/live 删除；高数据风险 | Slot 无法控制持久化 lifecycle；等价 Host plugin 未论证 | `test/session-delete-patch.test.ts`；reserved/live/committing、retirement 写入、backend 不支持、durable artifact 丢失、并发失败 |
| 17 | `@deepseek-ai+dsh-session-persistence-jsonl+0.1.2-alpha.4.patch` | backend delete→coordinator，精确单 log 删除和 POSIX sync；不删 project 目录；高数据风险 | backend 内部，不是 Slot；current Runtime patch | session-delete 临时目录集成：目标单 log、其他 log/Workspace 保留；异常/并发/端到端恢复另验 |
| 18 | `@deepseek-ai+dsh-workspace+0.1.2-alpha.4.patch` | `forgetSession` 串行清理 membership/archive/header/path caches；高一致性风险 | Registry 内部，不是 UI；未论证同粒度 Host plugin | session-delete 相关检查 + 真实 Workspace/archive/cache 一致性、重启和失败恢复 |
| 19 | `@deepseek-ai+dsh-client-ui-workspace+0.1.2-alpha.4.patch` | JS + types：unread、Finder、delete、右键菜单、拖拽、确认/error/桥接和 Store；高风险 | 整 browser/hero 有 single；行 menu/内部 Store 无已证细槽；仅保留组件内部结构时走 current patch | `test/workspace-unread-patch.test.ts`、`test/open-in-finder.test.ts`、`test/session-delete-patch.test.ts`；真实 unread/read/restart、右键/Finder、delete 取消/失败，不能只依赖字符串检查 |

所有文件均位于仓库 `patches/`；表中逐项保存了完整文件名、包/版本、替代性结论和升级验证要求。现有项目文档中的逐补丁“Plugin/Slot 无法完成”论证并不完备；标为“未论证”的项是审计缺口，不自动补写为确定事实。

## E. 对 MVP 的直接限制

此处仅解释 UI 显示与底层事实的边界；完整施工标准见 [MVP_VERTICAL_SLICE.md](MVP_VERTICAL_SLICE.md)。

| UI 看起来已有的能力 | 代码实际支持 | 不能据此宣称 |
|---|---|---|
| Plan / Discuss | `plan` projection `{active,pending}`、`/plan`、`exit_plan_mode` Markdown review；另有 `todo/write` | 强只读 Discuss 或统一、持久、带稳定步骤 id 的 Product Plan |
| Task / Run | Workspace、Session 和 `turn/start,end` / `step/start,end` | 已有独立产品 Task 状态机；`running=false` 不等于成功 |
| Tool Action | 已配对 call/result、callId、turn/step、result/error/meta、subCalls | UI 应重建工具调用配对、重写 Runtime loop |
| Approval | transient `PendingApproval`，一次允许/拒绝，原 Remote waterfall | 已有独立 durable Approval ledger，或断线后同一 pending 操作已获批准 |
| Changed Files / Diff | 一些文件工具的 call-level contextual diff | 全部 Git working-tree 变更、完整 Run 归属、用户接受或安全回滚 |
| Deliverables | 成功 write/edit/mutating str_replace_editor 的路径集合；现有 patch 另扩展一般本地路径链接 | Bash 产物已完整覆盖、删除也算产物、可点击文件必定由本 Run 产生 |

关键证据：

- `N/dsh-plan-mode/README.md:12,32,81,183` 和 `N/dsh-client-ui-plan/README.md:80` 明确：Plan mode 通过文字 guidance，而非过滤 tool capabilities；所有 tools 仍可调用。强制限制须依赖既有独立 sandbox/approval 能力，且本轮禁止修改这些边界。
- `N/dsh-tool-todo/lib/types/types.d.ts`：TodoItem 仅 `content`、`status`，`todo/write` 为全量替换，没有稳定步骤 id。
- `N/dsh-session/lib/types/types.d.ts`：`SessionEventMap` 的 turn/step/tool 事件；`tool/result.meta` 为 producing tool 拥有的 JSON presentation payload。
- `N/dsh-client-ui-approval/lib/types/client/contract/slots.d.ts`：`ApprovalDecision` 只有 `allowed-once` / `rejected`；PendingApproval 的 answer/delegate/abort 控制当前交互生命周期。
- `N/dsh-client-ui-tool/lib/types/client/tool/models/diff-card-model.d.ts`：running / settled root write/edit 与部分 str_replace_editor 规则，未建立 Git Change Set。
- `N/dsh-client-ui-deliverables/lib/types/client/turn-deliverables.d.ts` 的 `producedForClosing` / `DeliverablesTurnData`；以及当前 deliverables patch 的 `localPathReference`。

第一版 UI 的施工优先级仍是：现有配置与 Theme Token → Client Plugin / Slot → 独立桌面组件 → 有记录且可验证的 patch-package → 最后才评估上游修改或 Fork。没有已证 Change Set / rollback 合同时，先定义并验证 Adapter 与变更归属，不把一个 Diff 面板当作闭环完成。
