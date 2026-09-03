# Agent Vertical Slice Audit

审计日期：2026-09-03（Australia/Sydney）。本轮为真实 macOS Electron Dev 应用审计；不是新功能开发、发行包验收或完整安全认证。

## 1. 判定

**基本 Agent 执行链成立；包含任务级变更审阅与安全回滚的完整 MVP 闭环尚未成立。**

- 已验证：添加隔离 Workspace、创建 Session、真实读取、正文计划及用户确认、只读写入阻止、拒绝审批后不绕过、受控文件修改、工具级 Diff、真实停止前台命令、取消后继续对话、正常退出后的 Session 历史恢复。
- P0：本轮检查的真实界面中未找到任务级 Changed Files、逐文件 Accept / Reject / Revert；公开合同核查也未找到完整任务 Change Set / 文件回滚接口。单工具 Diff 与产物链接不等于这些能力。
- P1：主动取消显示为失败；普通计划请求触发错误的 Plan 工具后才回退到问题卡确认；工具诊断字段与审批信息的呈现不完整；模型摘要行数与实际 Git 行数有一处不一致。
- 不把未执行的崩溃恢复、审批中退出、未知工具结果、队列取消、复杂文件回滚或高级能力测试写成失败或通过。

关联交付：[Capability Gap Matrix](CAPABILITY_GAP_MATRIX.md)、[Interaction State Catalog](INTERACTION_STATE_CATALOG.md)。已有产品文档的历史结论没有改写；本轮结果不回填为旧审计的结果。

## 2. Git 门禁、测试对象与隔离

开始前依次执行 `git status`、`git branch --show-current`、`git rev-parse HEAD`：

| 项目 | 本轮实际值 |
| --- | --- |
| 产品仓库 | `/Users/wei/Documents/GitHub/dsh-desktop` |
| 分支 | `product/agent-vertical-slice` |
| HEAD | `ef99927013e91aa0dbe5f7c0e8cda53edf16e8ac` |
| 初始状态 | `nothing to commit, working tree clean`；与 origin 对应分支同步 |
| 凭证配置后再次门禁 | 同一分支、同一 HEAD，仍干净 |
| App | 本仓库 `node_modules/electron/dist/Electron.app`，以 `npm run dev` 启动 |
| 运行方式 | 真实 Electron / Harness UI；没有另起浏览器代替桌面验证 |
| Harness 依赖 | 当前仓库安装的 `@deepseek-ai/dsh@0.1.2-alpha.4`；没有升级、安装或修改依赖 |

使用 `mktemp -d /tmp/dsh-agent-vertical-slice.XXXXXX` 得到：

```text
/tmp/dsh-agent-vertical-slice.VFBPH4
真实路径：/private/tmp/dsh-agent-vertical-slice.VFBPH4
初始 commit：7c1af0caedc4ce53b1a21e4035f0dabfc3f2ec3f
```

该目录位于产品仓库之外，创建时唯一且未覆盖已有目录。仅创建下列两个文件，再初始化独立 Git 仓库并创建用户要求的初始提交；使用本次沙箱的临时提交身份、禁用该次提交的签名与 hooks，没有改全局 Git 配置。

`README.md` 初始内容：

```markdown
# Agent Vertical Slice Sandbox

This workspace exists only for controlled DSH agent testing.
```

`notes.md` 初始内容：

```markdown
# Notes

No changes have been made by the agent.
```

初始状态干净。截图独立保存于另一个 `mktemp` 目录 `/private/tmp/dsh-agent-audit-evidence.vNWjZg`，没有放进测试 Workspace 或产品仓库。

## 3. 实际模型、Preset 与权限

| 配置 | 真实 UI 观察 |
| --- | --- |
| 提供方 | 模型选择菜单显示 DeepSeek |
| 实际测试模型 | `DeepSeek-V4-Flash` |
| 推理等级 | `High` |
| Agent Preset | `标准模式` |
| 只读 Session | `仅可查看`；对话中另有 `permission preset read-only` 记录 |
| 写入 Session | `工作区内修改`（Workspace Write）；新 Session 的当前默认值 |
| 审批范围 | 此次只观察到 `拒绝`、`允许一次`；实际选择拒绝 |
| 完全权限 | 菜单存在，但从未选择或使用 |

首次启动出现模型提供方接入页，审计暂停；用户亲自在 App 中配置后回复“已配置”，才恢复操作。没有读取、输入、复制、记录或截图 API Key；没有通过环境变量、配置文件、凭证存储或 Harness 日志检查凭证。

模型菜单还可见 Pro 与 Vision-Exp 选项，本轮保留用户已配置并已选中的 Flash，没有切换到它们，也没有据名称编造价格、账单或后端路由。上述型号与等级是 UI 配置证据，不是网络流量或账单审计。

Settings 可进入通用页，可见模型、插件、Agent 预设等入口；模型选择和 Preset 菜单实际展开过。为了凭证安全，没有再打开模型凭证表单，也没有打开“配置文件”或“Session 日志”。

## 4. 逐步实测结果

| 用户步骤 | 实际操作与结果 | 判定 / 边界 |
| --- | --- | --- |
| 1. 隔离 Workspace | 独立临时目录、两份指定文件、初始提交与干净状态均已建立 | 通过；只有沙箱初始提交，不是产品提交 |
| 2. 启动与入口 | `npm run dev` 启动；Harness 主界面、Settings、模型、Preset、权限菜单可操作；原生选择器成功添加沙箱并进入新会话 | 通过；凭证步骤由用户完成 |
| 3. 只读能力 | 原样发送只读任务。5 次工具调用：目录列举、两个 Glob、两个文件读取。结果准确描述两文件和 `.git` 目录；正文给出编号三步计划并询问是否执行 | 通过本样本；完成后 `git status`、`git diff` 均空 |
| 4. 阻止与拒绝 | 原样请求追加 README。首次 Edit 被 read-only sandbox 拒绝；再次以 workspace-write 请求一次性审批。点击拒绝后，Agent 只复读 README 并解释停止 | 通过本样本；等待审批时及拒绝完成后均无文件变化、无长期提权 |
| 5. Workspace Write | 新 Session 中原样发送先计划后确认请求；三步计划与问题卡等待确认；确认前 Git 干净。确认后仅 README 追加指定内容并实际执行 `git diff -- README.md` | 执行通过；正式 Plan 工具误用与审阅能力缺口另列，不能整体标为完整闭环通过 |
| 6. Stop | 首次 sleep 20 自然完成，未点击到 Stop；不计为取消验证。改用无副作用 sleep 60，运行中点击 Stop；独立进程观察证实提前终止。随后同 Session 正常回复新消息 | 真实停止通过；UI 将取消显示为失败，状态区分不通过 |
| 7. Session 恢复 | 正常 Quit，原 dev 命令 exit 0；再次 `npm run dev`。Workspace 与两 Session 保留，可手动选回；计划、确认、工具、最终消息、取消错误及只读权限均可恢复查看 | 正常退出恢复通过；不覆盖崩溃、审批中退出或未知副作用 |
| 8. Change Review / 回滚 | 查看工具级 Diff、Bash Diff、产物入口、会话菜单及 Workspace 右键菜单。未发现任务级 Changed Files 或逐文件 Accept / Reject / Revert | P0 缺口；未执行产品内回滚，不用终端伪造该能力 |
| 9. 状态目录 | 真实标签、审计语义、未覆盖状态分别登记 | 见状态目录；Warning / Partial Success 未观察到独立 UI 状态 |
| 10. Gap Matrix | 按证据、用户影响、代码归属、最小改动层与 MVP 门槛登记 | 见 Gap Matrix；P2 未测能力不伪称不存在 |

### 原生目录选择器的操作限制

通过“前往文件夹”定位沙箱后，“打开”一度不可用，坐标操作还出现 `noWindowsAvailable`。改为列表视图、回到父目录并精确选中目标文件夹后，“打开”可用并成功添加。

这不构成“产品无法添加 Workspace”的证据。代码核查显示 `src/main/index.ts:2455` 附近仅使用 `openDirectory` 原生选择器，没有 `/tmp` 路径限制；未以隐藏接口、应用数据修改或替代浏览器绕过。没有打开选择器中出现的其他私人目录或文件。

### 两条真实 Session

- `检查当前文件并制定修改计划`：只读读取与拒绝写入，两轮。
- `给README添加受控代理测试记录`：计划确认及写入、sleep 20 自然完成、sleep 60 取消、取消后继续消息，共四轮。

名称来自本轮 App；没有读取应用存储以获取内部 ID。重启最初落在“新会话”，从侧边栏手动选择上述 Session 后恢复，不声称自动回到离开前的会话。

## 5. Plan、Tool、Approval 与实际修改

### Plan 与确认

只读任务的三步计划在对话正文，没有出现独立计划卡或待审核 Plan 版本。

写入任务中，Agent 先调用 `exit_plan_mode`，得到 `exit_plan_mode is only available in plan mode`。之后在正文给出三步计划，并通过提问工具显示独立确认卡：确认、取消、自由文本输入、跳过与放弃整组问题。实际选择“确认，开始执行”并提交；确认前未发生写入。自由文本调整入口可见，但没有另外测试修改计划后的执行。

这是“正文计划 + ask_user 确认”成功，不是正式 Plan mode / Plan Review 流程验收。首次工具误用后成功恢复，不等于发生了部分文件修改，也不等于产品已有 Warning / Partial Success 汇总状态。

### 工具信息

- 运行期间显示工具行、运行中、侧边栏进行中、深度求索中与 Stop；完成后默认 Compact 将过程折叠为工具调用计数，可展开。
- Bash 展开后有“已完成”、命令、工作目录短名和输出；“查看”进入轨迹，提供参数、结果、Schema、计时等详情。
- 本轮查看的成功命令卡没有独立、明确的 `exitCode: 0` 字段。模型在自然完成 sleep 20 后所说“退出码 0”不作为 UI 原始工具字段的证据。
- Edit 的展开卡有路径、增删内容、折叠/展开与复制/查看操作；没有逐文件 Accept / Reject / Revert。
- 普通 composer 可见模型和权限；审批或问题卡替换 composer 时，当前模型/权限摘要不在该卡片中同步显示。

### Approval

首次被阻止的工具错误为 `[sandbox: file access denied under read-only mode]`。随后底部出现等待审批卡，理由说明需将当前操作提升至 workspace-write 才能写 README；正文是英文。

审批卡本身主要显示原因和“拒绝 / 允许一次”。关联 Edit 行展开后才看到沙箱内 README 的完整路径和拟议 Diff。该次是文件编辑，不是 Shell 命令审批；不能声称已验证 Shell 审批的命令展示。未观察到永久允许或全局允许选项。

选择拒绝后工具显示 `the user rejected escalating this operation to "workspace-write"`，Agent 复读 README 后明确说明未修改，不再换工具绕过。权限仍为仅可查看。拒绝前后独立 Git 检查均为空。

### 磁盘与模型总结的交叉核对

执行前仅两份基线文件。执行后：

```text
git status --short --untracked-files=all
 M README.md

git diff --numstat
4  0  README.md

git diff --cached --stat
（空）
```

实际 Diff：

```diff
diff --git a/README.md b/README.md
index f6cc672..7b38dfa 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,7 @@
 # Agent Vertical Slice Sandbox

 This workspace exists only for controlled DSH agent testing.
+
+## Controlled Agent Test
+
+This change was requested during the vertical-slice audit.
```

`notes.md` 无变化；没有其他未跟踪文件，没有暂存变化，沙箱 HEAD 仍是初始提交。模型贴出的 Git Diff 与磁盘一致，但总结写“共 +3 行”，与 Git 的 4 行（含空行）不一致。Edit 卡片的 `+7 -3` 是整段替换的工具级差异，与 Git 的净追加统计不是同一口径。

## 6. Stop 的独立证据

没有通过终端启动或终止被测任务；任务由 Electron Agent 执行，停止由 UI 完成。只读观察器仅查询名为 `sleep` 的进程及这些 PID 的 PID、PPID、已运行时长和参数，不读取环境变量，不读取其他进程命令，不写文件。

| 时间（Australia/Sydney） | 事件 |
| --- | --- |
| 22:49:53.181 | 第一轮基线：无 sleep |
| 22:50:11.080 | 首次观察 PID 24881 / PPID 24880，`sleep 20` |
| 22:50:30.955 | PID 消失，观察区间 19.875 秒；未点击到 Stop，计为自然完成 |
| 22:51:18.638 | 第二轮基线：无 sleep |
| 22:51:36.123 | 首次观察 PID 27804 / PPID 27803，`sleep 60` |
| 22:51:45.232 | 记录于 UI Stop 调用之前的时间 |
| 22:51:45.358 | 首次观察 PID 27804 已消失；观察存活 9.235 秒，明显短于 60 秒 |
| 22:52:47.663 | 第二轮观察结束，消失后未再出现 sleep |

Stop 调用前时间至首次观察消失相隔 126ms。这是轮询观测间隔，不是精确取消延迟 SLA，也不是精确进程创建/退出时间。证据支持本次前台命令被真实提前终止。

实际命令为 `sleep 60 && echo "sleep completed"`，参数含 `timeoutMs: 90000`。取消后工具结果为 `Error: tool call aborted`，没有完成后的 echo 输出。UI 用红色失败样式而非明确的 Cancelled；下一条无工具消息正常得到“会话可以继续。”。

只验证此单一前台命令，不推广为所有子进程、后台任务、队列或外部副作用均可撤销。现有 Harness `cancel()` 合同保留队列，取消也不等于文件回滚。

## 7. 恢复与 Change Review 边界

正常 Quit 后 dev 命令 exit 0；重启的 Harness 使用新 loopback 端口，两个 Session 均可从保留的 Workspace 找回。写入 Session 中三步正文计划、1/1 已回答、写入工具、Diff 输出、最终消息和取消错误恢复；只读 Session 的计划、拒绝说明和只读权限恢复。查看历史时没有发送新请求，UI 没有开始新 Run。

取消错误在恢复后依然显示为失败，说明历史被保留，但不代表取消语义呈现正确。没有制造崩溃或改写应用数据，未验证 `TOOL_OUTCOME_UNKNOWN`、未持久化消息、审批中的重启、队列自动继续或 exactly-once 副作用。

产物 README 链接实际点击后 Electron 未出现内嵌审阅界面。源码表明该入口通过 Harness `openWorkspacePath` 交给 macOS 默认应用打开；没有扩大 Computer Use 去检查外部应用，因此不宣称外部打开成功。产物入口不能当作 Changed Files 面板。

已查看：对话与轨迹、展开的 Edit Diff、Bash Diff、产物链接、Session 菜单（重命名、分叉、标未读、归档、删除）以及 Workspace 右键菜单。未找到任务级变更清单、接受、拒绝或恢复前态操作；没有执行产品内回滚。

**产品能力记录截至此处已经完成。后续若恢复 README，只能记为测试清理用 Git 恢复。**

### 测试清理

已执行，且明确归类为**测试清理用 Git 恢复**：先再次核对沙箱只有 README 的指定追加，再在 `/private/tmp/dsh-agent-vertical-slice.VFBPH4` 执行：

```sh
git restore --source=7c1af0caedc4ce53b1a21e4035f0dabfc3f2ec3f --worktree -- README.md
```

恢复命令 exit 0；随后 `git status --short --untracked-files=all` 为空，`git diff --exit-code` 无输出且 exit 0，两个文件内容与初始文本一致，HEAD 仍为初始 commit。没有删除沙箱、截图或 App 中的测试 Session。此结果不计为产品内回滚通过。

## 8. 建议的第一项产品代码改动

建议先授权一个小而可验证的改动：**纯只读 Product Adapter 状态映射与公开 Slot 呈现，准确区分 Completed / Cancelled / Failed / Unknown。** 本次已有“进程确实被 Stop 终止，但 UI 显示失败”的确定证据，适合建立首个精确映射与恢复契约测试。

必须以已有 turn outcome / user cancellation reason 为依据，保留原始错误；不能把所有 `TOOL_ABORTED` 都当作用户主动取消，不能新建 Runtime、取消数据库或独立杀进程逻辑。优先 Plugin / Slot，Theme 只能改善视觉，无法修复状态语义。

这项小改动不解除 P0。MVP 发布前仍必须另行锁定任务变更归属、修改前态、并发冲突、逐文件接受/拒绝与部分回滚失败合同，再实现最小安全 Change Review；不能先放上无真实语义的 Accept / Revert 按钮。

## 9. 视觉设计必须依据的五个真实状态

以下是本轮已保存并重新打开核对的原始 Electron 截图。它们位于临时证据目录，链接仅在本机该目录仍存在时有效，不是已归档到 Git 的发布资产。没有凭证页面截图。

1. **Planning / 等待确认**：正文三步计划、误用 Plan 工具后的错误、实际问题卡。设计需区分计划版本与用户确认，不把提问卡假称正式 Plan Review。

![Planning 与确认卡](/private/tmp/dsh-agent-audit-evidence.vNWjZg/09-plan-confirmation.png)

2. **Waiting for Approval**：一次性权限请求与关联的拟议文件 Diff；审批理由与路径/影响目前分散。

![审批与拟议 Diff](/private/tmp/dsh-agent-audit-evidence.vNWjZg/07-approval-proposed-diff.png)

3. **Tool Executing**：运行中的真实 sleep 命令、运行状态与 Stop。该截图来自第一轮自然完成的 sleep 20，仅作运行状态证据，不作取消成功证据。

![Tool Executing](/private/tmp/dsh-agent-audit-evidence.vNWjZg/12-sleep-tool-running.png)

4. **Review Changes（仅工具级）**：Edit 替换 Diff 与真实 Git Diff 并存；没有任务级接受/拒绝/回滚操作。

![工具级 Diff 与命令输出](/private/tmp/dsh-agent-audit-evidence.vNWjZg/11-tool-diff-and-command.png)

5. **Session Restored / Cancelled**：重启后的取消错误和后续消息均在，但取消仍被标为失败。

![恢复后的取消与继续消息](/private/tmp/dsh-agent-audit-evidence.vNWjZg/15-restored-cancelled-history.png)

其他本轮支持截图：`01-main-idle.png`、`02-settings-general.png`、`03-readonly-running.png`、`04-readonly-plan-completed.png`、`05-readonly-tool-detail.png`、`06-waiting-approval.png`、`08-permission-denied.png`、`10-write-completed.png`、`13-cancelled-shown-as-failed.png`、`14-session-continues.png`，均在同一证据目录。首次 `01-idle.png` 是窗口未置前时的缩略图，已拒绝为审计证据，没有用于结论。

## 10. 最终自动化检查与仓库交付

本轮 UI 检查后正常退出第二次 Dev App，避免开发 watcher 干扰最终构建。下列检查在三份审计文档主体完成后实际执行，没有沿用 Prompt 01 的历史绿灯，也没有修改代码来使测试通过。

| 检查 | 本轮结果 |
| --- | --- |
| `npm test` | **通过，exit 0**；80 个测试文件、676 项测试全部通过；23:02:11 开始，Vitest 总耗时 7.08 秒；未重试 |
| `npm run typecheck` | **通过，exit 0**；`tsc --noEmit -p tsconfig.node.json` |
| `npm run build` | **通过，exit 0**；market TypeScript 与 Electron main / preload 构建成功；保留既有 renderer config 提示 |
| `git status` | 仅三份获准新增的 Markdown 为 untracked；没有 tracked 或 staged 变化 |
| `git diff --check` | **通过，exit 0**；另逐份对新增文件做 no-index 空白检查，以覆盖未跟踪文件 |

测试终端中的 pnpm Git package / no-matching-version / Windows rename 错误字样来自既有测试的模拟失败样本（`test/pnpm-runner.test.js:18-33,198,257`），并非本轮真实依赖安装失败。未执行安装命令。完整测试使用经批准的本地进程 / 套接字权限运行，没有改测试或权限实现。

启动日志中观察到既有 `renderer config is missing` 提示；首轮普通 dev 终端还有一条 macOS `TSM AdjustCapsLockLEDForKeyTransitionHandling` 消息。没有因此修改配置、运行日志认证诊断或扩大到凭证检查。

本轮允许的仓库交付仅为：

- `docs/product/AGENT_VERTICAL_SLICE_AUDIT.md`
- `docs/product/CAPABILITY_GAP_MATRIX.md`
- `docs/product/INTERACTION_STATE_CATALOG.md`

最终分支仍为 `product/agent-vertical-slice`，HEAD 仍为 `ef99927013e91aa0dbe5f7c0e8cda53edf16e8ac`。`git diff --stat` 与 `git diff --cached --stat` 均为空；这表示已跟踪内容未改，不表示没有新增文档。三份 Markdown 保持未跟踪、未暂存。`out/` 构建输出由现有规则忽略；market 构建没有产生已跟踪差异。

没有提交、推送、创建 PR、切换分支、安装依赖、使用 sudo、修改源码/Runtime/安全/权限/凭证/更新逻辑或已有产品文档。Dev App 已正常退出；临时 Workspace 和截图保留，截图不是 Git 中的永久证据资产。
