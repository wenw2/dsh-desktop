# Capability Gap Matrix

审计基线：分支 `product/agent-vertical-slice`，HEAD `ef99927013e91aa0dbe5f7c0e8cda53edf16e8ac`。本文件记录本轮真实 Electron 验证后的能力差距；不修改此前产品文档的历史结论，不构成代码实施授权。

## 1. 判定与证据边界

**任务执行与正常 Session 恢复已成立；完整的“修改 → 任务级审查 → 安全回滚”闭环尚未成立。** 最高 MVP 阻塞不是 Agent 能否写文件，而是用户没有已验证的产品内变更审查和回滚路径。

- **P0：阻塞完整 MVP 闭环。** 用户不能完成本轮明确要求的关键控制或恢复动作。
- **P1：已能完成任务，但信息或交互明显不足。** 不把呈现错配夸大为底层执行失败。
- **P2：后续增强或待单独验收项。** 未测试不等于不存在；不把背景中提及的能力列成已确认缺陷。
- UI 事实来自主审计员本轮 Electron 界面操作；文件事实来自隔离 Workspace 的 Git 检查。代码仅说明所有权、数据合同和可能原因，不能替代运行证据。
- `N/` 表示仓库内 `node_modules/@deepseek-ai/`。下文行号对应本轮已安装源码；不得直接修改 `node_modules`。
- 完整步骤、隔离目录、Git 结果及最终验证见 [AGENT_VERTICAL_SLICE_AUDIT.md](AGENT_VERTICAL_SLICE_AUDIT.md)；状态触发与界面表现见 [INTERACTION_STATE_CATALOG.md](INTERACTION_STATE_CATALOG.md)。

### 本轮已经通过的能力，不列为 Gap

| 能力 | 本轮事实 | 结论边界 |
| --- | --- | --- |
| Read Only 读取 | 真实选择只读权限；读取 README.md、notes.md，说明与文件一致；Git 干净 | 不推断所有工具或任意路径组合都已覆盖 |
| 阻止与拒绝 | 只读写入先被 sandbox 拒绝；随后请求一次性 workspace-write；点击拒绝后仅复读 README，Git 仍干净，未绕过 | 本轮该路径安全通过；没有测试审批期间断线/退出 |
| 计划确认后写入 | 正文三步计划与 ask_user 确认卡出现；确认前 Git 干净；确认后仅 README 净增 4 行，旧内容保留，无暂存或新 commit | 是可操作的对话确认，不是已证完整 Product Plan 对象 |
| Stop 执行效果 | 界面 Stop 提前终止实际 sleep 60；之后同一 Session 可继续消息 | 底层停止通过；“失败”呈现另列 P1-01 |
| 正常 Session 恢复 | 正常 Quit 后重新 npm run dev；Workspace 与两个 Session 均存在；手动选回后计划正文、确认记录、工具结果、最终消息、取消错误可见，Read Only 权限保留 | 启动落在新会话，不是自动续开；不等于 crash、未知结果、待审批恢复已通过 |

### 本轮临时截图索引

截图目录：`/private/tmp/dsh-agent-audit-evidence.vNWjZg`。以下仅引用本轮文件名；截图是本机临时 QA 证据，**不是仓库随附或可发布资产**，临时目录消失后应按步骤重新采集。不得从截图或其他渠道补取凭证。

| 文件名 | 支持的事实 |
| --- | --- |
| `04-readonly-plan-completed.png` | 只读读取后的正文计划与结果 |
| `06-waiting-approval.png` | 等待审批、reason 与批准/拒绝入口 |
| `07-approval-proposed-diff.png` | 展开工具后的绝对路径与拟议 diff |
| `08-permission-denied.png` | 用户拒绝后的会话结果 |
| `09-plan-confirmation.png` | 三步正文计划与确认/取消/自由输入卡 |
| `10-write-completed.png` | 写入后的最终说明与产物入口 |
| `11-tool-diff-and-command.png` | 工具局部 diff、Bash git diff 命令与输出 |
| `12-sleep-tool-running.png` | 20 秒 sleep 的运行态；该次自然完成，**不是 Stop 成功证据** |
| `13-cancelled-shown-as-failed.png` | 后续 sleep 60 经 Stop 后仍显示失败 / tool call aborted；TOOL_ABORTED 是另行核实的源码错误码 |
| `15-restored-cancelled-history.png` | 正常重启后取消错误历史仍可查看 |

截图不能单独证明 Git 干净、子进程退出或缺少全部可能入口；这些结论分别依赖文件/进程核验与本轮明确检查的 UI 范围。

## 2. P0 — 完整 MVP 闭环阻塞

| ID / Gap | 真实证据 | 用户影响 | 当前代码所有权 / 合同 | 推荐实现层 | 阻塞 MVP | 建议最小修复与验收 |
| --- | --- | --- | --- | --- | --- | --- |
| **P0-01 任务级 Change Review 未形成** | 主界面、单工具、产物与 Session 菜单中未发现任务级 Changed Files、逐文件 Accept/Reject；只有可展开的 Edit 局部 diff 与 Bash git diff 输出。`10-write-completed.png`、`11-tool-diff-and-command.png`。真实净变化是 README `+4/-0`，Edit 卡为整段替换 `+7/-3`。 | 用户需要自行汇总调用才能知道任务最终改了什么；调用差分不能代表整个工作树、任务归属或最终验收。 | Harness `dsh-client-ui-tool` / `dsh-client-ui-chat`；`N/dsh-client-ui-tool/lib/types/client/tool/models/diff-card-model.d.ts:27-36` 只描述 root write/edit 等调用 diff，`lib/client.js:1462-1467` 负责单调用 DiffBlock。尚无已核实的完整 Change Set / Accept/Reject 公共合同。 | **纯 Product Adapter + Client Plugin / 公开 View 或 Slot** 先做只读任务变更摘要；需要新文件事实获取时另行设计窄、只读 Desktop 能力并独立审查。Theme 不能补齐数据合同。 | **是**：缺少本轮要求的任务级审查路径 | 先约定 Task/Run 与变更的边界：基线、路径、当前状态、来源与未知归属，不把预存改动归给 Agent。第一版可只覆盖明确支持的工作区和工具；给出最终净 diff、逐文件审查结果，未支持情况显式显示。必须用多次修改同一文件、用户并发修改、预存改动验证，不把文件链接当作 Changed Files。 |
| **P0-02 产品内安全回滚未验证存在** | 上述受检 UI 中未发现 Revert、Reject-to-restore 或其他回滚入口；不能从终端执行恢复来证明产品具有回滚能力。 | 用户不能从产品完成“结果不接受 → 恢复”的闭环；离开产品手动 Git 清理不是可用的产品恢复路径。 | Harness 现有文件工具负责执行；已证的客户端 diff 合同只读展示。现有 Desktop 目录选择、外部打开入口不提供变更归属和回滚合同。 | **先定义 Product Adapter 的变更归属/版本合同，再经明确授权设计受限的产品动作**；执行仍沿用唯一 Harness Runtime 与既有审批边界。禁止新增通用 renderer fs/shell 后门，不为此重写 Runtime。 | **是**：本轮要求“可恢复”的关键缺口 | 将最小范围锁定为有修改前/后证据的单文件回滚：预览、用户明确确认、当前版本匹配才恢复，遇到后续用户修改或归属不明必须拒绝覆盖。禁止默认 whole-worktree restore。验收需覆盖成功恢复、版本冲突、失败不损坏、重启后的事实一致性；明确区分“审查拒绝”和“实际回滚”。 |

P0-01 与 P0-02 有依赖关系：没有可信的变更归属和版本事实，不能先做一个看似可用的 Revert 按钮。本轮“未发现”的范围限于已检查界面，加上静态合同未找到对应公共能力；不是对未安装插件或所有上游可能性的全称判断。

## 3. P1 — 可操作但体验不足

| ID / Gap | 真实证据 | 用户影响 | 当前代码所有权 / 合同 | 推荐实现层 | 阻塞 MVP | 建议最小修复与验收 |
| --- | --- | --- | --- | --- | --- | --- |
| **P1-01 真实取消被呈现为失败** | Stop 已提前终止 sleep 60，之后可继续；界面却显示“失败 / tool call aborted”，重启后仍保留该表现。`13-cancelled-shown-as-failed.png`、`15-restored-cancelled-history.png`。 | 用户无法直接判断是自己成功停止，还是工具发生故障；可能不必要地重试。 | Harness Tool UI：`N/dsh-client-ui-tool/lib/client.js:213-232` 仅将 `error.code === "interrupted"` 映射 stopped，其余 isError 为 error；Bash 前台中止在 `N/dsh-tool-bash/lib/index.js:429-436` 抛 TOOL_ABORTED。`N/dsh-session/lib/types/types.d.ts:143-192` 已区分 aborted 及 user/parent/hook/disposed 等原因。该代码解释与本次观察一致，但不代替进程实测。 | **纯状态 Adapter + additive Client Plugin / 公开 Slot**；保留原工具详情。若以后要求直接改既有工具行，先论证 keyed renderer 接管范围，再判断小型 UI Patch；不改取消执行机制。 | 否：本次实际停止有效；但应在 MVP 对外呈现前修正 | 首先映射 Completed / Cancelled / Failed / Unknown，并显示真实原因。只有 durable `turn/end` 为 aborted 且原因 user 时才写“用户已取消”；单独 TOOL_ABORTED 不足以推断发起者。保留原始错误可展开查看；测试取消、真实失败、进程退出、历史恢复，不能把运行结束一律标成功。 |
| **P1-02 计划确认可用，但规划模式与交互不一致** | Write 任务先错误调用 exit_plan_mode，因不处于 Plan mode 失败；之后正文三步计划、ask_user 确认/取消/自由输入卡成功完成确认。确认前 Git 干净，确认后才写。`09-plan-confirmation.png`。 | 一个简单的“先计划后确认”需要理解工具错误与模式差异；正文计划、问题卡和 Plan mode 容易被理解成同一个状态。 | Harness `dsh-plan-mode`、`dsh-client-ui-plan`、Conversation / ask_user。`N/dsh-plan-mode/README.md:12,32,183` 明确 Plan 为文字 guidance，不是权限边界；`N/dsh-client-ui-plan/lib/client.js:29-45` 读取 active/pending projection。 | **Client Plugin / Slot 的只读模式与计划呈现**；必要的提示/部署配置调整须另行授权。不要用视觉确认代替具体工具审批。 | 否：本次确认门实际有效 | 明确区分“正文修改计划待确认”和“Plan mode 开启”；在现有公开投影上呈现当前模式、计划及下一步。使用当前可用确认链，保留调整/取消；不得声称已有统一持久 Product Plan。验收覆盖普通模式确认与真正 Plan mode 两条路径，不因工具错误直接开始写入。 |
| **P1-03 Diff 计数与最终总结的语义不一致** | README Git 净差分为 `+4/-0`；Edit 卡显示 `+7/-3`（整段替换，数学上净增 4，并非必然计算错误）；最终文字说“+3 行”，但附带的 diff 正确。`10-write-completed.png`、`11-tool-diff-and-command.png`，以及隔离 Git 核验。 | 用户可能把局部替换行数当作任务最终变更，或相信自然语言的错误计数；影响验收信任。 | Tool Diff UI 与 Harness 生成的 assistant 消息；`N/dsh-client-ui-tool/lib/types/client/tool/models/diff-card-model.d.ts:27-36` 为单调用差分，不是 Git 净变化。 | **Adapter + Client Plugin / Slot** 明确指标口径；Theme 仅可改视觉层级，不能修正事实。 | 否：实际内容正确；任务级归属缺口另见 P0-01 | 给单调用卡标明“本次替换”，任务摘要标明“最终 Git 净变化”；受支持范围用确定性差分事实展示计数，不从模型文字反推。保留模型原消息，不改历史或伪造其已纠正；至少测试多次 edit 与整段替换。 |
| **P1-04 命令详情的信息完整性不足** | 可见 Bash git diff 命令、输出、已完成状态和 cwd 短名；本次没有看到结构化 exitCode=0 字段。不能把模型声称的退出码当作工具展示。`11-tool-diff-and-command.png`。 | 用户难以独立确认执行位置与命令完成状态的精确信息；失败排查需要更多动作。 | Harness Tool UI / TerminalBlock。`N/dsh-client-ui-tool/lib/types/client/tool/models/terminal-card-model.d.ts:19-40,70-79` 支持 command/cwd/output/exitCode/signal/running，但错误、后台、persistent 等会回退 generic；`lib/client.js:1442-1454` 为详情呈现。 | **已有详情入口优先，必要时 tool/details 公开 Slot / Client Plugin**；不要生成不存在的 exitCode。 | 否：本次执行结果已由 Git 独立验证 | 在详情中明确展示已提供的完整 cwd、退出码/终止信号、输出与状态；数据缺失显示“未提供”，不要填 0。使用成功、非零退出、取消和 generic fallback 样本验收。 |
| **P1-05 Approval 关键信息分散且语言不一致** | 审批正文为英文 reason，显示 workspace-write 范围与 README 文件名；必须展开工具行才看到绝对路径与拟议 diff。可见仅“允许一次 / 拒绝”，未看到长期批准选项。用户拒绝后未写入。`06-waiting-approval.png`、`07-approval-proposed-diff.png`、`08-permission-denied.png`。 | 用户需要拼接多个区域才能理解具体改动及范围；英文 reason 增加中文用户的判断成本。 | Harness Approval composer 与关联 tool detail。`N/dsh-client-ui-approval/lib/types/client/contract/slots.d.ts:31-43` 的 reason/callId 为可选、决定仅 allowed-once/rejected；`lib/client.js:63-95,271-283` 呈现 reason/detail/按钮并接管 composer。 | **Theme/Locale 的已支持部分 → `conversation.approval.detail` Slot / Client Plugin**；保留原审批 waterfall、按钮含义和一次性授权范围。 | 否：本次拒绝边界通过 | 审批详情集中显示已知工具、完整目标路径、请求范围、拟议影响及 diff，缺失信息明确说明；原始 reason 保留，不用未经验证的摘要代替。不要擅加长期授权，不抢占 composer chain。验收拒绝后无写入、一次允许仅一次、窄窗/键盘信息可达；后两者本轮未测。 |

## 4. P2 — 后续增强与单独验收项

这些是用户给出的后续方向或本轮覆盖边界，**不是已经证实“不存在”的缺陷**。

| ID / 项目 | 本轮证据与边界 | 用户影响 / 当前代码所有权 | 推荐实现层 | 阻塞 MVP | 下一项最小验证或改进 |
| --- | --- | --- | --- | --- | --- |
| P2-01 Browser / Computer Control | 本轮未执行相关 Agent 能力；用于 QA 的 Computer Use 属外部测试控制，不证明产品自身具有此能力 | 未来跨应用任务的扩展方向；本轮未核实对应 Runtime/工具合同 | 经 Harness 的既有工具/Plugin/MCP 合同另行评估；不新增 Runtime | 否 | 先定义窄场景与权限/停止验收，确认已装能力，再决定是否实现；不在真实项目上试写 |
| P2-02 Automations | 本轮未测试；不能据主界面缺少相关操作断言产品没有调度能力 | 后台计划任务的持续性、通知与失败处理尚未知；当前所有权未核实 | Harness 现有合同优先，Desktop 仅必要产品呈现 | 否 | 单独验证创建、暂停、取消、重启和失败通知，未核实前不作能力承诺 |
| P2-03 多 Agent | 标准 Preset 描述提及子 Agent；本轮未运行多 Agent | 不能将“未测试”写成“没有”；并发权限、状态聚合与取消边界未验 | 唯一 Harness 的子 Agent 合同 + Client Plugin / Slot 呈现 | 否 | 先做两个无副作用子任务的来源、状态与父任务取消验证；不新建第二个调度层 |
| P2-04 手机端 | UI 可见手机入口；本轮未打开、配对或测试 | 已有入口不等于完整端到端验证；连接及远程权限仍未知 | 现有 Desktop bridge 与 Harness 合同；不改变配对、权限或安全策略 | 否 | 另行授权窄范围配对/断线验收，不能为截图或探索自行启用公网链路 |
| P2-05 高级 Deliverables / 内嵌预览 | README 产物入口可点；Electron 中未出现新预览。静态链为产物 `openFile` → `remote.session.openWorkspacePath` → 系统默认应用；外部应用是否实际打开不在本次 Computer Use 范围，未验 | 用户可能期待内嵌审查；当前入口是外部打开，不能当 Change Review 或 Revert。Harness Deliverables、Chat、API Session 和 native-command 共同拥有此链 | **Client Plugin / 公开 View 或 Slot** 可另行提供受限只读预览；现有打开动作可明确“在默认应用中打开” | 否；P0 审查/回滚另计 | 先明确按钮行为并单独验证外部打开反馈；若做内嵌预览，限定文件类型、大小、只读和信任边界，不将可点击路径自动标为本任务产物 |
| P2-06 自动续开与更强恢复场景 | 正常重启需要手动选择旧 Session，手动恢复已通过；crash、审批中断、结果未知、队列取消未测试 | 自动续开是体验增强；更强恢复的风险尚不能量化。Harness Session / persistence 拥有执行历史，Desktop 拥有进程生命周期 | 既有恢复合同 + Client Plugin / Slot 的导航/状态呈现；不新增 Session 日志库 | 否，按本轮已验证的正常关闭恢复范围 | 先单独验收未覆盖场景；自动续开应区分“打开历史”与“继续执行”，不得重放审批或自动恢复未知副作用 |

产物静态链的精确引用：`N/dsh-client-ui-deliverables/lib/client.js:291-299`、`N/dsh-client-ui-chat/lib/client.js:8124-8127`、`N/dsh-api-session-controller/lib/index.js:2669,2799-2804`、`N/dsh-native-command/lib/index.js:16-20,127-135`。macOS 默认调用无 Shell 的 `execFile("open", [path])`，不是 Electron 内嵌预览，也不是本仓库 `shell.openPath` 的 Finder IPC 路径。

## 5. 建议实施顺序与验收门槛

1. **第一项小型产品代码任务：修正真实取消状态的纯 Adapter 与公开 Slot 呈现（P1-01）。** 已有状态合同、可复现事实和低副作用实现路径；先用契约测试固定 Completed/Cancelled/Failed/Unknown 及恢复显示，再呈现。不要把所有 TOOL_ABORTED 都标“用户取消”。这是第一工程小改，**不解除 P0、不代表完整闭环已成立**。
2. **最高发布优先级：锁定 P0-01/P0-02 的最小 Change Review 与安全回滚合同。** 对“本任务改动”“用户已有改动”“后续并发改动”分别定义归属，先保证不能误覆盖，再授权 UI 与动作实现。只有该门槛通过，才能对外声称具备本轮要求的完整闭环。
3. **随后修正 P1 的计划、审批和命令详情。** 优先使当前事实易读，不用新概念遮住缺失数据；保留单次审批语义与既有工具结果。
4. **P2 按独立场景验收后再排开发。** “未测”不得升级为“不存在”，也不得升级为“已支持”。

通用实现顺序维持：已消费 Theme Token / 已有配置 → Client Plugin / 公开 Slot → 必要独立 Desktop 组件 → 有充分范围、替代性与兼容测试说明的 Patch。当前没有依据授权修改 Runtime、权限、凭证、安全、更新逻辑；本轮只记录，不实施上述修复。
