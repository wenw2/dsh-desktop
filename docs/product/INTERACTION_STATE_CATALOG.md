# Agent Vertical Slice — Interaction State Catalog

## 审计边界与读法

- 审计日期：2026-09-03，Australia/Sydney。
- 产品分支：`product/agent-vertical-slice`；基准 HEAD：`ef99927013e91aa0dbe5f7c0e8cda53edf16e8ac`。
- 唯一 Agent Runtime 为 DeepSeek Harness；Electron 负责宿主与产品适配。本文件没有修改 Runtime、权限、安全或凭证逻辑。
- 实测 Workspace：`/private/tmp/dsh-agent-vertical-slice.VFBPH4`，位于产品仓库外。实际模型为 `DeepSeek-V4-Flash`（composer 简称 `Flash`），推理档位为 `High`，Agent Preset 为 `标准模式`。实际使用 `Read Only`、`Workspace Write`，没有使用 `Full Access`。
- 证据来自主审计员操作的真实 Electron App、隔离 Workspace 的文件 / Git 核对，以及独立只读进程观察。源码只用于确定所有权和扩展层，不能替代界面实测。
- **本文件的状态名是审计分类，不代表界面真的显示同名标签。** 特别是 `Planning`、`Cancelled`、`Review Changes`、`Session Restored`，须按各节说明解读。
- 风险等级表示用户在该状态下误判或误操作的风险，不等于 Gap 的 P0 / P1 优先级；优先级见 [Capability Gap Matrix](CAPABILITY_GAP_MATRIX.md)。
- 截图保存在临时证据目录，未复制到仓库；链接只覆盖已捕获的非凭证界面。临时目录被系统或用户清理后，链接可能失效。

## 状态覆盖总览

| 审计状态 | 覆盖 | 实际观察边界 |
|---|---|---|
| Idle | 已观察 | 主界面可操作；恢复历史但不发消息时没有进行中状态 |
| Planning | 已观察语义状态 | 三步计划出现在正文；不等于独立、持久化的产品 Plan 对象 |
| Running | 已观察 | Sidebar `进行中`、`深度求索中`、输入框的 Stop |
| Tool Executing | 已观察 | 文件 / Bash 工具行、执行状态、可展开详情 |
| Waiting for Approval | 已观察 | 工具权限审批；与计划确认不是同一决定 |
| Permission Denied | 已观察 | Sandbox 拒绝，以及用户拒绝审批后的失败工具结果 |
| Completed | 已观察 | 工具完成、最终正文、过程默认折叠；不证明最终正文每个数字正确 |
| Warning / Partial Success | **未观察独立状态** | 失败后采用其他方式完成任务，不作为部分成功场景验收 |
| Failed | 已观察 | 工具失败，包括被拒绝、`exit_plan_mode` 失败、取消后的 Bash 失败 |
| Cancelled | 已观察语义状态 | UI Stop 真实提前终止命令，但界面显示失败，未见独立 Cancelled 标签 |
| Review Changes | 已观察有限形态 | 只有工具级 Diff 查看；未见任务级 Changed Files / Review 页面 |
| Session Restored | 已观察语义状态 | 正常退出重启后手动选择历史；未观察独立恢复成功提示 |
| Waiting for Answer | 已观察 | `ask_user` 独立确认卡、Sidebar 等待回答；不是工具权限审批 |

## 01 — Idle

证据：[主界面 Idle](/private/tmp/dsh-agent-audit-evidence.vNWjZg/01-main-idle.png)。

| 项目 | 真实记录 |
|---|---|
| 1. 触发方式 | App 主界面加载；添加隔离 Workspace、新建 Session 后尚未发消息；或已结束任务后等待下一条消息。 |
| 2. 用户最需要知道 | 当前选中哪个 Workspace / Session，以及发送消息时使用的模型、Preset 和权限。 |
| 3. 当前界面实际显示 | Workspace / Session 导航、消息输入区；模型和权限通常在输入框底部，Preset 入口可用。 |
| 4. 当前界面缺少什么 | 未观察到一个统一、持续可见的任务上下文摘要；审批 / 提问替换 composer 后，原模型 / 权限摘要不可见。 |
| 5. 用户可执行的操作 | 选择 Workspace、创建或打开 Session、输入消息、访问 Settings / 模型 / Preset / 权限入口。 |
| 6. 风险等级 | 中：看错 Workspace 或执行权限会改变后续任务边界。 |
| 7. UI 所属方 | Harness `dsh-client-ui-workspace`、`dsh-client-ui-conversation` 及模型 / Preset / 权限组件；Electron 拥有原生窗口和目录选择桥。 |
| 8. 推荐实现层 | 优先 **Plugin + Slot**，用 session header utilities 增加紧凑上下文摘要；Theme 只处理层级 / 对比度，不改变权限含义。不需新增 Runtime。 |

## 02 — Planning

证据：[只读三步计划](/private/tmp/dsh-agent-audit-evidence.vNWjZg/04-readonly-plan-completed.png)、[计划确认卡](/private/tmp/dsh-agent-audit-evidence.vNWjZg/09-plan-confirmation.png)。

| 项目 | 真实记录 |
|---|---|
| 1. 触发方式 | 只读任务要求读两个文件并提出三步修改计划；Workspace Write 新 Session 要求先计划、确认后才修改。 |
| 2. 用户最需要知道 | 哪些内容来自真实读取、计划是否等待确认、确认将允许什么；计划确认不替代工具权限审批。 |
| 3. 当前界面实际显示 | 只读任务的三步计划在正文，末尾用文字询问是否执行。Write 任务先出现一次 `exit_plan_mode` 工具失败，随后正文三步计划和 `ask_user` 独立确认卡。未见统一的独立 Planning 标签。 |
| 4. 当前界面缺少什么 | 正文计划没有显式的版本 / 待审 / 已审生命周期。本次 `ask_user` 确认可用，但不能据此证明所有任务都强制走同一 Plan gate。 |
| 5. 用户可执行的操作 | 阅读计划、在消息中调整要求；本次 Write 任务可通过确认卡确认、取消或输入意见。确认前 Git 保持干净。 |
| 6. 风险等级 | 高：把模型文字询问或 Plan 确认误认为具体工具执行授权，会混淆两种决策。 |
| 7. UI 所属方 | Harness Conversation / Chat 正文；Plan 行为由 `dsh-plan-mode` / `dsh-client-ui-plan` 拥有；本次确认实际通过 `ask_user` 提问 UI。 |
| 8. 推荐实现层 | **Plugin + Slot** 消费已有 Plan / Session projection，区分正文计划、Plan mode 与用户确认。Theme 可优化正文层级；不得用隐藏按钮或文字标签制造强只读约束。 |

## 03 — Running

证据：[只读执行中](/private/tmp/dsh-agent-audit-evidence.vNWjZg/03-readonly-running.png)、[Bash 运行中](/private/tmp/dsh-agent-audit-evidence.vNWjZg/12-sleep-tool-running.png)。

| 项目 | 真实记录 |
|---|---|
| 1. 触发方式 | 发出读取、修改或 Bash 任务后，Agent 正在处理。 |
| 2. 用户最需要知道 | 是否仍在运行、当前做什么、如何停止；请求停止是否已经落实。 |
| 3. 当前界面实际显示 | Sidebar `进行中`，对话区 `深度求索中`；输入框为空时出现蓝色方形 Stop。完成后过程默认折叠。 |
| 4. 当前界面缺少什么 | 未观察到持续可见的统一任务状态条；Stop 的可见位置随 composer 状态变化。本次停止后的 Failed 呈现不区分主动取消。 |
| 5. 用户可执行的操作 | 展开工具过程；运行期间点击 Stop。本次停止后同一 Session 可以继续发消息。 |
| 6. 风险等级 | 高：用户需要迅速停止操作，不能把 UI 已结束等同于进程已退出。 |
| 7. UI 所属方 | Harness Workspace / Conversation / Chat；取消请求与执行生命周期属于 Harness Session / Agent。 |
| 8. 推荐实现层 | **Plugin + Slot** 展示真实 turn 状态和停止进展；Theme 提高现有 Stop 的可发现性。沿用现有 cancel API，不另建停止 Runtime 或改变队列语义。 |

## 04 — Tool Executing

证据：[工具 Diff 与命令](/private/tmp/dsh-agent-audit-evidence.vNWjZg/11-tool-diff-and-command.png)、[Bash 运行中](/private/tmp/dsh-agent-audit-evidence.vNWjZg/12-sleep-tool-running.png)。

| 项目 | 真实记录 |
|---|---|
| 1. 触发方式 | Agent 执行文件读取、Edit 或 Bash。只读任务共观察到 5 个工具：Bash `pwd` / `ls`、2 次 glob、2 次 read。 |
| 2. 用户最需要知道 | 具体命令 / 文件、工作目录、执行中还是已完成、实际结果是否符合请求。 |
| 3. 当前界面实际显示 | 工具行与状态可见；可展开查看参数、绝对路径、结果。写入后有 Edit Diff，Bash `git diff -- README.md` 有完成状态和输出。取消时显示 `Bash Error: tool call aborted`。 |
| 4. 当前界面缺少什么 | 详情分散在工具过程内，完成后默认折叠；没有把调用级结果自动整理为任务级变更审阅。不能将源码存在的字段算作本次已见字段：本目录不单独声称所有调用均显式展示 cwd / 数值退出码。 |
| 5. 用户可执行的操作 | 展开 / 检查工具与结果；运行时通过 Session Stop 取消。没有观察到逐工具独立取消入口。 |
| 6. 风险等级 | 高：工具可能已改变磁盘，成功图标或模型总结不是完整副作用证明。 |
| 7. UI 所属方 | Harness `dsh-client-ui-tool` 的 ToolCall / ToolDetails 与 `dsh-client-ui-chat` 的 DetailsPanel；工具执行属 Harness。 |
| 8. 推荐实现层 | **Plugin + Slot** 优先使用 `conversation.details.tool` 或工具 keyed Slot 增强细节。只读聚合另用 `conversation.view`；不修改工具执行 / 审批边界。 |

## 05 — Waiting for Approval

证据：[等待权限审批](/private/tmp/dsh-agent-audit-evidence.vNWjZg/06-waiting-approval.png)、[审批关联拟议 Diff](/private/tmp/dsh-agent-audit-evidence.vNWjZg/07-approval-proposed-diff.png)。

| 项目 | 真实记录 |
|---|---|
| 1. 触发方式 | 保持 Read Only 要求追加 README。首次写入被 sandbox 拒绝，随后 Agent 请求提升到 Workspace Write，进入审批。 |
| 2. 用户最需要知道 | 正在批准哪项写入、哪个文件、为什么需要、许可覆盖范围以及拒绝的后果。 |
| 3. 当前界面实际显示 | 审批正文含英文 reason 与文件名；有 `拒绝`、`允许一次`。关联工具行可展开绝对路径与拟议 Diff。本次没有观察到长期许可范围。 |
| 4. 当前界面缺少什么 | 原模型 / 权限摘要在 composer 被审批替换时不可见；完整路径 / 拟议 Diff 需要查看关联工具，信息未集中在主审批正文。未验证审批等待时重启恢复。 |
| 5. 用户可执行的操作 | 查看关联工具；拒绝或允许一次。本次只点击拒绝，没有允许一次，也没有提升长期权限。 |
| 6. 风险等级 | 高：这是实际授权边界，不能和 Plan 的方向确认混用。 |
| 7. UI 所属方 | Harness `dsh-client-ui-approval`；关联详情由 Tool / Chat 提供；权限裁决由 Harness 原策略负责。 |
| 8. 推荐实现层 | 优先 **Plugin + Slot** 增强 `conversation.approval.detail` 及外部上下文摘要；该 Slot 不是审批按钮 hook。不抢占 composer 审批链，不通过 Desktop / Patch 改授权范围。 |

## 06 — Permission Denied

证据：[拒绝后的结果](/private/tmp/dsh-agent-audit-evidence.vNWjZg/08-permission-denied.png)。

| 项目 | 真实记录 |
|---|---|
| 1. 触发方式 | Read Only 写入先被 sandbox 拦截；随后用户在权限审批中点击拒绝。 |
| 2. 用户最需要知道 | 哪个动作没有获准、目标文件是否未变、Agent 是否停止尝试执行该写入。 |
| 3. 当前界面实际显示 | 工具失败，结果含 `user rejected`。Agent 后续只复读 README，并解释停止写入。独立 Git 核对保持干净。 |
| 4. 当前界面缺少什么 | 拒绝主要表现为工具错误；未见一个独立、醒目的 Permission Denied 任务标签。本次安全停止由消息与 Git 共同核实，不能只由错误样式推断。 |
| 5. 用户可执行的操作 | 阅读拒绝结果、继续对话。本次没有批准后续升级，也没有自动放宽权限。 |
| 6. 风险等级 | 高：拒绝后仍执行写入会破坏边界；本次未发生。 |
| 7. UI 所属方 | Harness Approval 与 Tool / Chat；拒绝结果及后续 Agent 行为由 Harness 产生。 |
| 8. 推荐实现层 | **Plugin + Slot** 区分“用户拒绝”与技术失败，保持原始原因与文件目标；不重写权限系统。 |

## 07 — Completed

证据：[只读完成](/private/tmp/dsh-agent-audit-evidence.vNWjZg/04-readonly-plan-completed.png)、[写入完成](/private/tmp/dsh-agent-audit-evidence.vNWjZg/10-write-completed.png)。

| 项目 | 真实记录 |
|---|---|
| 1. 触发方式 | 只读任务返回文件说明和计划；Write 任务在用户确认后修改 README 并运行 Git Diff；第一次 `sleep 20` 自然完成。 |
| 2. 用户最需要知道 | 哪些动作确实完成、修改了什么、是否存在未解决问题，以及下一步如何审阅 / 保留 / 恢复。 |
| 3. 当前界面实际显示 | 工具完成与最终正文，过程默认折叠。Write 实际仅 README 净增 4 行；最终正文说“+3 行”，但其粘贴的 Diff 内容正确。 |
| 4. 当前界面缺少什么 | 最终数字与磁盘证据未自动对齐；缺任务级 Changed Files、接受 / 拒绝 / 回滚入口。任务结束不等于变更审阅闭环完成。 |
| 5. 用户可执行的操作 | 展开已完成工具、查看工具级 Diff 和 Bash 输出、发送下一条消息。 |
| 6. 风险等级 | 中至高：用户可能依据完成文案误判实际改动量或以为已有回滚保障。 |
| 7. UI 所属方 | Harness Chat / Tool / Deliverables；最终自然语言由模型产生；磁盘事实由工具与 Workspace 决定。 |
| 8. 推荐实现层 | **Plugin + Slot** 形成来源明确的完成摘要；数字来自可验证结果，不把模型文本当权威。任务级变更能力另需合同设计，Theme 不能补齐。 |

## 08 — Failed

证据：[权限拒绝](/private/tmp/dsh-agent-audit-evidence.vNWjZg/08-permission-denied.png)、[取消被显示为失败](/private/tmp/dsh-agent-audit-evidence.vNWjZg/13-cancelled-shown-as-failed.png)。

| 项目 | 真实记录 |
|---|---|
| 1. 触发方式 | 只读权限 / 用户拒绝导致写工具失败；Write 计划阶段 `exit_plan_mode` 失败；UI Stop 后 Bash 返回 aborted。 |
| 2. 用户最需要知道 | 是技术故障、用户拒绝还是主动取消；是否已有副作用；是否可以安全继续。 |
| 3. 当前界面实际显示 | 失败工具行和原始错误。`exit_plan_mode` 失败后 Agent 改用正文计划 + `ask_user`，最终完成任务；Stop 后为 `失败 Bash Error: tool call aborted`。 |
| 4. 当前界面缺少什么 | 工具错误与任务整体结果没有统一、清晰的分类；用户拒绝和主动取消容易被理解成普通技术故障。不能把一个工具失败等同于整个任务失败。 |
| 5. 用户可执行的操作 | 查看错误与后续正文、继续消息。本次没有测试一般技术故障的重试按钮或自动重试策略。 |
| 6. 风险等级 | 高：把取消 / 拒绝当作可盲重试故障，可能重复执行副作用。 |
| 7. UI 所属方 | Harness Tool / Chat 呈现；turn end 和 tool result 的真实原因属于 Harness Session。 |
| 8. 推荐实现层 | **Plugin + Slot** 基于现有原因分类，不丢原始错误；仅当缺少必需公开 seam 且另行授权时才评估最小 Patch。本轮不改代码。 |

## 09 — Cancelled

证据：[取消后的失败呈现](/private/tmp/dsh-agent-audit-evidence.vNWjZg/13-cancelled-shown-as-failed.png)、[同一会话继续](/private/tmp/dsh-agent-audit-evidence.vNWjZg/14-session-continues.png)，以及下方独立进程观测。

| 项目 | 真实记录 |
|---|---|
| 1. 触发方式 | 第二轮执行无副作用的 `sleep 60`，运行中点击 UI Stop。第一轮 `sleep 20` 没有点击 Stop，属自然完成，不计取消通过。 |
| 2. 用户最需要知道 | 停止请求是否已落实、是否还有运行中进程、已经发生的副作用是否仍存在，以及会话能否继续。 |
| 3. 当前界面实际显示 | Stop 后从运行中转为 `失败 Bash Error: tool call aborted`，发送按钮恢复；没有独立 Cancelled 标签。同一 Session 随后回复“会话可以继续”。独立证据显示命令提前退出。 |
| 4. 当前界面缺少什么 | 主动取消与 Failed 未清楚区分；未显示“停止不等于撤销”。本次没有验证有副作用命令、后台任务或队列项的停止语义。 |
| 5. 用户可执行的操作 | 查看错误结果，并在同一 Session 继续消息。未观察到取消后的产品回滚入口。 |
| 6. 风险等级 | 高：本次停止有效，但不能扩展为所有子进程 / 后台任务 / 已排队工作均已停止或所有副作用已撤销。 |
| 7. UI 所属方 | Harness Conversation 的 Stop，Session cancel API，Tool / Chat 的结果分类；真实进程执行由 Harness 管理。 |
| 8. 推荐实现层 | 首选 **Plugin + Slot** 准确映射 durable turn 结果；只有 `aborted` 且原因明确为 `user` 时才呈现“用户已取消”，不能仅凭工具 aborted 推断发起者。保持现有取消 API 和队列语义；不创建第二执行层。 |

### 取消独立证据

仅轮询名为 `sleep` 的 PID，再读取这些 PID 的 PPID、已运行时长与参数；未读取环境变量或其他进程命令，未启动或 kill 测试进程。下列时间是轮询观测时刻，不是精确的内核进程创建 / 退出事件时间。

| 场景 | 本机时间 Australia/Sydney | 观察 |
|---|---|---|
| 第一轮基线 | 22:49:53.181 | 无 sleep 进程 |
| 第一轮出现 | 22:50:11.080 | PID 24881，PPID 24880，`etime=00:01`，`sleep 20` |
| 第一轮消失 | 22:50:30.955 | 出现到消失 19.875 秒；没有点击 Stop，归类自然完成 |
| 第二轮基线 | 22:51:18.638 | 无 sleep 进程 |
| 第二轮出现 | 22:51:36.123 | PID 27804，PPID 27803，`etime=00:01`，`sleep 60` |
| UI Stop 调用前 | 22:51:45.232 | 主审计员记录点击调用前的时间 |
| 第二轮消失 | 22:51:45.358 | 比 Stop 调用前晚 126ms；出现到消失 9.235 秒，明显短于 60 秒 |
| 第二轮观察结束 | 22:52:47.663 | 消失后未再出现 sleep |

该组合证据支持本次 UI Stop 真实提前终止 `sleep 60`，不是只改变 UI。它不证明文件回滚或所有取消边界均通过。

## 10 — Review Changes

证据：[工具级 Diff 与 Git 命令输出](/private/tmp/dsh-agent-audit-evidence.vNWjZg/11-tool-diff-and-command.png)。

| 项目 | 真实记录 |
|---|---|
| 1. 触发方式 | Write 任务完成后展开 Edit 工具与 Bash `git diff -- README.md`。 |
| 2. 用户最需要知道 | 磁盘实际改了什么、哪些属于本任务、是否已落盘，以及如何保留或安全恢复。 |
| 3. 当前界面实际显示 | 工具级 Edit Diff 为 `+7 / -3`（整段替换）；Git 净变更仅 README `+4 / -0`。Bash 输出展示净增内容。未见独立任务级 Review Changes 页面。 |
| 4. 当前界面缺少什么 | 未见任务级 Changed Files、逐文件 Accept / Reject / Revert、明确产品回滚入口；工具级替换统计不能直接当 Git 净变化。 |
| 5. 用户可执行的操作 | 查看工具 Diff、查看 Git 命令输出。不能逐文件接受 / 拒绝或通过本次观察到的产品入口恢复。 |
| 6. 风险等级 | 高：修改已落盘，但用户缺少可见、可验证的产品审阅 / 回滚闭环。 |
| 7. UI 所属方 | Harness Tool / Chat 的 DiffBlock 与 DetailsPanel；现有调用级 Diff 不是任务级 Change Set。Desktop 的安装迁移 rollback 与本能力无关。 |
| 8. 推荐实现层 | 只读整理优先 **Plugin + Slot** 的 `conversation.view`。安全 Accept / Revert 需要先确认前态、归属、并发冲突和失败合同，再另行评估窄 Host Plugin / Desktop 实现；不是加 Theme 或按钮即可完成。 |

## 11 — Session Restored

证据：[重启后取消历史仍可查看](/private/tmp/dsh-agent-audit-evidence.vNWjZg/15-restored-cancelled-history.png)。

| 项目 | 真实记录 |
|---|---|
| 1. 触发方式 | 正常关闭 DSH Desktop Dev，重新运行 `npm run dev`，在导航中手动选择本次测试历史。 |
| 2. 用户最需要知道 | 是否回到同一 Workspace / Session、历史与权限是否保留，以及查看历史会不会启动新工作。 |
| 3. 当前界面实际显示 | 临时 Workspace 和两个测试 Session 保留；启动落在新会话，手动选择后找回历史。Read Only 权限保留；Write Session 的计划、确认记录、工具、最终消息和取消错误均可查看。打开历史时未显示进行中，也未发送新消息。 |
| 4. 当前界面缺少什么 | 未见独立 Session Restored 提示；未自动落回测试历史。只验证正常退出恢复，没有验证崩溃、审批中退出、工具结果未知或 Plan mode pending 断点。 |
| 5. 用户可执行的操作 | 从 Workspace 导航选择已有 Session、查看历史；本次恢复检查没有主动继续执行新 Run。 |
| 6. 风险等级 | 高：历史恢复不等于副作用 exactly-once；取消错误保留也不等于状态分类已经正确。 |
| 7. UI 所属方 | Harness Workspace / Session Client、历史 API 和 Session persistence；Electron 只负责关闭 / 重启宿主。 |
| 8. 推荐实现层 | **Plugin + Slot** 补充明确的恢复上下文与真实结果分类；沿用 Harness 历史与持久化。不得从旧按钮状态推断授权，也不得自动重放无结果的有副作用调用。 |

## 12 — Waiting for Answer

证据：[独立计划确认卡](/private/tmp/dsh-agent-audit-evidence.vNWjZg/09-plan-confirmation.png)。

| 项目 | 真实记录 |
|---|---|
| 1. 触发方式 | Write 任务的正文三步计划后，通过 `ask_user` 等待用户确认。 |
| 2. 用户最需要知道 | 当前问题与拟议计划是否对应、确认前是否没有写入、取消 / 跳过分别意味着什么。 |
| 3. 当前界面实际显示 | 独立确认卡，含确认 / 取消选项、自由输入，以及跳过 / 放弃整组操作；Sidebar 显示等待回答。确认前 Git 干净，确认后只修改 README。 |
| 4. 当前界面缺少什么 | 卡片替换 composer 时，模型 / 权限摘要不可见。只验证了本次确认路径，没有验证跳过 / 放弃整组是否会继续执行或其恢复行为。 |
| 5. 用户可执行的操作 | 本次点击确认；卡片还提供取消、自由输入、跳过、放弃整组，但这些分支未逐项执行。 |
| 6. 风险等级 | 高：这属于任务方向确认，不等于覆盖后续工具权限请求。 |
| 7. UI 所属方 | Harness `ask_user` 的提问交互、Conversation composer 与 Tool 提问结果呈现。 |
| 8. 推荐实现层 | **Plugin + Slot** 保持可见的任务 / 权限摘要，清晰区分计划确认与工具授权；不接管提问 / 审批链或改变回答语义。 |

## 未观察或未覆盖的状态与分支

以下不虚构八项界面记录，也不视为测试失败；其状态为未触发 / 未验证。

| 状态或分支 | 本轮覆盖结论 | 必须保留的限制 |
|---|---|---|
| Warning / Partial Success | 未观察到独立 UI 状态；没有专门构造部分成功任务 | `exit_plan_mode` 失败后 fallback 完成任务属于失败后恢复成功，不等于验证部分成功。最终“+3 行”不准确属于报告一致性问题，不是观察到 Warning 状态。 |
| Cancelled 独立标签 | 未观察 | 实际提前终止已验证，但 UI 将 aborted 呈现为失败。 |
| 任务级 Review Changes 页面 | 未观察 | 仅工具级 Diff；不可把 Bash 输出或测试清理用 Git 恢复冒充产品 Change Review / 回滚。 |
| 审批等待时退出 / 重启 | 未触发 | 不能声称 pending approval 能持久恢复，或旧批准能够安全重放。 |
| 崩溃 / 断电 / durable tool call 缺 result | 未触发 | `TOOL_OUTCOME_UNKNOWN` 是源码已证语义，非本次已观察 UI；不得写成故障恢复验收通过。 |
| Plan mode pending 恢复 | 未触发 | 本次可见正文和确认历史，不证明所有 Plan mode 状态断点都可恢复。 |
| 有副作用操作取消、后台任务、取消时队列非空 | 未触发 | `sleep 60` 提前退出不能推广到这些场景；Session cancel 合同保留 pending queue。 |
| 通用技术故障 / 部分回滚失败 | 未构造 | 仅观察到本次具体工具失败。没有产品回滚入口，因此不构造虚假的回滚失败 UI。 |

## 架构证据与扩展约束

下表是当前源码 / 公共类型证据，与上面的真实 UI 观察严格分开。`N/` 表示 `node_modules/@deepseek-ai/`；行号针对本次已安装的源码。

| 证据 | 支持的结论 |
|---|---|
| `N/dsh-api-session-controller/lib/types/client/contract/session.d.ts:103`；`N/dsh-api-session-controller/lib/types/commands.js:442` | cancel 返回接纳请求，不直接证明进程已退出；pending queue 保留，不能擅改为清空全部工作。 |
| `N/dsh-session/lib/types/types.d.ts:161` | durable turn reason 已区分 completed、aborted、blocked、error、max-tokens、interrupted；产品应保留这些差异。 |
| `N/dsh-client-ui-tool/lib/client.js:217` | 工具行区分 running、stopped、error、ok；`interrupted` 映射 stopped，其他 error 进入 error。 |
| `N/dsh-session-checkpoint-policy/README.md:52`；`N/dsh-session/lib/index.js:533` | 未派发取消与结果未知不同；有副作用的 unknown 操作须先核对状态或请用户确认，不盲重试。 |
| `N/dsh-api-session-controller/lib/types/history.js:80` | 历史 page 可不激活 Agent；查看记录不需要另建执行循环。 |
| `N/dsh-api-session-controller/lib/types/client/sessions/service.js:124` | 客户端存在 selection 持久化机制；不代表本次启动自动选中了测试历史。 |
| `N/dsh-client-ui-tool/lib/client.js:452`、`:1462`；`N/dsh-client-ui-chat/lib/client.js:7062` | 单工具 Diff、原始参数和结果呈现已有；不能据此宣称完整 Change Set。 |
| `N/dsh-client-ui-deliverables/lib/types/client/turn-deliverables.d.ts:25` | 成功文件变更工具产生的路径列表不完整覆盖 Bash 或全部 Git 工作树变化。 |
| `N/dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts:99`、`:105`、`:111`、`:141` | 有 header actions / utilities、独立 conversation view、input dock 的公开追加入口；不需要复制整套 UI。 |
| `N/dsh-client-ui-chat/lib/types/client/contract/slots.d.ts`；`N/dsh-client-ui-approval/lib/types/client/contract/slots.d.ts` | Tool details 与 approval detail 有公开 Slot；审批 detail 不等于审批按钮 / 权限规则 hook。 |

修改顺序仍沿用 [Architecture Boundaries](ARCHITECTURE_BOUNDARIES.md) 和 [UI Surface Map](UI_SURFACE_MAP.md)：现有配置 / Theme → 公开 Plugin / Slot → 必要的独立 Desktop 组件 → 有明确理由且另行授权的最小 Patch。对于授权、取消、持久化和未知结果，先保留事实与边界，不能用视觉完成度替代能力成立。

## 后续视觉设计应以这五个真实状态为输入

与总审计的五张主证据保持一致；Idle 等其他截图作为辅助上下文。

1. **Planning / Waiting for Answer**：以 `09-plan-confirmation.png` 为基准，明确正文计划与确认卡不是权限审批或正式 Plan Review，保留当前上下文。
2. **Waiting for Approval**：以 `07-approval-proposed-diff.png` 为基准，集中呈现原因、目标、拟议变化和一次授权范围。
3. **Tool Executing + Stop**：以 `12-sleep-tool-running.png` 为基准，让当前动作与停止入口容易发现。该图来自自然完成的 sleep 20，仅证明运行态。
4. **Review Changes（仅工具级）**：以 `11-tool-diff-and-command.png` 为基准，区分 Edit 替换 Diff 与最终 Git 净变化；本轮受检界面未发现任务级 Changed Files / 回滚，不作为已实现界面出设计图。
5. **Session Restored / Cancelled**：以 `15-restored-cancelled-history.png` 为基准，修正实际取消却显示失败的语义；`13-cancelled-shown-as-failed.png`、`14-session-continues.png` 为取消后继续的辅助证据。
