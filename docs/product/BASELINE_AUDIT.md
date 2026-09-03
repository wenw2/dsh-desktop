# Baseline Audit

审计日期：2026-09-03（Australia/Sydney）。对象：当前工作树的源码与 lockfile，不是发行包、签名、公证或完整 Agent 端到端认证。

## 1. 结论

**桌面开发基线可启动，但自动测试未全绿，不能声明基线全部通过。**

| 检查面 | 实际结果 |
| --- | --- |
| 初始 Git 门禁 | `product/foundation`；工作区干净；允许继续 |
| 依赖安装 | 原命令权限重试后成功；19 个既有 patch 全部应用 |
| 自动测试 | 权限重跑：80 个文件，79 通过、1 失败；669 个用例，668 通过、1 失败 |
| 类型检查 | `npm run typecheck` exit 0 |
| 构建 | `npm run build` exit 0；存在 renderer config 警告 |
| 真实桌面冒烟 | Electron / Harness 主界面、原生目录选择器打开与取消、Settings / 模型配置入口已验证 |
| 模型与 Agent 工作闭环 | 未执行；没有输入凭证、创建 Workspace/Session 或发送模型请求 |
| 收尾 | 正常退出本次 Dev 应用；进程命令 exit 0；两个观察端口均已释放 |

在所有基线命令和实机验证结束后、创建文档前，再次执行 Git 检查，仍是原分支、原 commit、干净工作区。没有为了通过测试修改代码。

## 2. 环境与前置条件

| 项目 | 实际值 / 依据 |
| --- | --- |
| 操作系统 | macOS 26.6.2，Build 25G83 |
| 内核 / 架构 | Darwin 25.6.0 / arm64 |
| Node（开发命令） | v24.15.0 |
| npm | 11.12.1 |
| Python（测试调用） | 3.9.6 |
| 分支 | `product/foundation` |
| HEAD | `7cb9e046e8ec58864d95c3ce30541e369fdc833e` |
| 根 package | `dsh-desktop@0.1.1`；不将 Git tag 名当作本次 package 版本 |
| Harness | `@deepseek-ai/dsh@0.1.2-alpha.4`，由仓库内 tarball 安装 |
| Electron / electron-vite / electron-builder | 43.4.0 / 5.0.0 / 26.15.3 |
| Vite / Vitest / TypeScript | 7.3.6 / 4.1.11 / 5.9.3 |
| 随包 node / pnpm 依赖 | 24.9.0 / 10.34.5；不代表 macOS UtilityProcess 使用外部 Node 执行 |
| lockfile | v3；1,164 个 package entries；root dependencies 与 package.json 一致 |

开发指南要求 Node 22 或以上及 npm；实际锁定 Electron 要求 Node `>=22.12.0`，electron-vite/Vite 要求 `^20.19.0 || >=22.12.0`。当前 Node 满足这些要求。根 package 没有 `engines` 或 `packageManager` 声明，也没有声明 npm 的最低版本；不虚构最低值。

未发现阻断本次安装/检查的缺失系统依赖。没有安装系统或全局软件、使用 sudo、升级依赖或更换工具链。首次 `node_modules` 不存在；`npm ci` 创建它是本次明确要求的安装步骤。

## 3. 实际命令与结果

所有命令在仓库根目录运行，另有说明的除外。下表保留失败与重试，不能只保留成功轮次。

### Git 与版本检查

| 命令 | 结果 |
| --- | --- |
| `git status`（第一个操作） | exit 0；On branch product/foundation；working tree clean |
| `git branch --show-current`（第二个操作） | exit 0；product/foundation |
| `git rev-parse HEAD` | exit 0；上述完整 commit |
| `node -v` / `npm -v` | 均成功；v24.15.0 / 11.12.1 |
| `uname -srm` / `sw_vers` | 均成功；上述系统与架构 |
| `python3 --version` | 成功；Python 3.9.6 |
| `date '+%Y-%m-%dT%H:%M:%S%z'` | 成功；记录到 2026-09-03T17:53:58+1000（构建后检查时刻，不是完整耗时） |

### 安装、测试、类型和构建

| 实际命令 | 环境 / 次数 | 实际结果 |
| --- | --- | --- |
| `npm ci` | 沙箱内首次 | exit 1：`Exit handler never called!`；同时报告不能写 `/Users/wei/.npm/_logs`。未据此认定源码安装缺陷 |
| `npm ci` | 申请权限后，同命令重试 | exit 0；added 1027 packages，audited 1033 packages；npm 报 found 0 vulnerabilities；19 个 patch 均应用成功；既有品牌 postinstall 与 Electron 安装完成 |
| `npm test` | 沙箱内首次 | exit 1；76/80 文件通过；644/669 用例通过、25 失败；7 个未处理错误。包含 socket `listen EPERM`、相关超时、一个 watcher 超时及发布说明断言失败 |
| `npm test` | 申请权限后，同命令重跑 | exit 1；79/80 文件通过；668/669 用例通过、1 失败；输出未报告 unhandled errors。剩余失败见第 5 节 |
| `npm test -- test/feishu-release-notes.test.ts -t 'builds a prerelease prompt with previous tag and prerelease notices'` | 只读定位，执行两次 | 两次均 exit 1；1 failed / 6 skipped；同一 previous-tag 错误。Vitest 整轮 Duration 分别 312ms / 293ms |
| `npm run typecheck` | 现有脚本 | exit 0；`tsc --noEmit -p tsconfig.node.json` |
| `npm run build` | 现有脚本 | exit 0；`build:market` 后构建 Main / Preload；197 / 7 modules；输出见下 |
| `npm run dev` | 申请权限后启动真实 Electron | Main / Preload 构建成功，`starting electron app...`；真实 UI 已操作。最终通过正常退出结束，命令 exit 0 |

构建输出：`out/main/index.js` 756.27 kB；`out/preload/index.cjs` 46.45 kB；`out/preload/windows-menu.cjs` 12.59 kB。这些是日志报告的构建大小，不是发行包大小。

`npm ci` 按既有 postinstall 使用 patch-package 并复制已有品牌资产到依赖输出；**没有手工编辑 node_modules，也没有修改品牌源文件或补丁**。未运行 `npm install`、`npm update`、`npm audit fix` 或任何 packaging / release 命令。

### 补充只读诊断

| 命令 / 检查 | 结果与边界 |
| --- | --- |
| `pgrep -fl 'dsh-desktop\|electron-vite'` | 沙箱内 exit 3，无法取得进程列表；权限重试 exit 1，无匹配实例（启动前） |
| `lsof -nP -iTCP:55775 -sTCP:LISTEN` | 运行期间确认 Harness 的 Electron UtilityProcess 监听 `127.0.0.1:55775` |
| `lsof -nP -iTCP:43128 -sTCP:LISTEN` | 运行期间确认主进程监听 `*:43128`，与现有 Dev 手机桥接配置一致 |
| 上述两个 `lsof` 命令（退出后再次执行） | 均无输出、无监听者；exit 1 表示无匹配，不是退出失败 |
| `git rev-parse '0.7.2^{commit}' 'v0.7.2^{commit}' 'v0.7.1^{commit}'` | 前两个均解析为 `11481ac3827d75f98c8ceca3771f63cbfa2a49f0`；v0.7.1 为 `abf8779deb3f6fffca74db9f7f31f89b99f8d32b` |
| `git tag --merged 0.7.2 --sort=-creatordate` | 排序开头为 v0.7.2、0.7.2、v0.7.1 |
| `git rev-list --count v0.7.2..0.7.2` | exit 0；输出 0 |
| `git status`、`git branch --show-current`、`git rev-parse HEAD`、`git diff --stat`、`git diff --check`（基线结束、写文档前） | 分支/commit 未变；工作区干净；diff 无输出、无空白错误 |

另实际使用 `rg --files` / `rg -n`、`cat` / `sed`、`tar -tzf` / `tar -xOf`、只读 `node -e` JSON/路径检查读取代码与依赖合同；未通过解压覆盖仓库文件。读取范围包括 README、两份工程文档、package.json/lockfile、Vite/Vitest/TS 配置、patches、src/main/preload/shared、packages、相关 test 与发布文案脚本。祖先目录和仓库没有检索到适用的 AGENTS.md / CLAUDE.md / CONTEXT.md / ADR 指令文件；本次遵循用户在会话提供的 Agent Instructions。

lockfile 检查实际读取全部 JSON，并提取版本、engines、本地 dependency 存在性和 resolved 路径：本地 file dependencies 均存在；226 个 file-resolved entries 中没有绝对本机 file 路径。仓库有 242 个 dsh tarballs、9 个 vendor tarballs、19 个 patches。未验证所有 tarball 能从上游源码逐字节重建。

## 4. 真实桌面验证记录

通过原生 UI 自动化操作本次运行的 `node_modules/electron/dist/Electron.app`。未通过另起普通浏览器代替 Electron 验证。

| 要求 | 实际观察 / 操作 | 判定 |
| --- | --- | --- |
| Electron 窗口启动 | 真实原生窗口出现，Accessibility 与截图均能读取 | 通过 |
| Harness 成功加载 | Web 内容标题 DeepSeek Harness，URL 为 `127.0.0.1:55775/`，出现首次提供方接入页 | 通过 |
| 启动错误 | 未出现启动失败/插件恢复页；有一条 macOS 输入法系统消息，见第 6 节 | 无阻断启动错误；不能写成“零警告” |
| 进入主界面 | 点击“稍后配置”，出现 Sidebar、Workspace、Session、composer；截图确认实际渲染 | 通过；未输入凭证 |
| 原生 Workspace 选择器 | Sidebar“添加工作区”打开 macOS `选择工作区目录` / open-panel；点击“取消”返回主界面 | 打开与取消通过；未选择目录，未验证成功添加/持久化；hero 第二入口未单独实测 |
| Session 入口 | 存在“新建会话”“搜索会话”“暂无会话” | 入口存在；未创建/运行/恢复 Session |
| Settings 与模型入口 | 打开 Settings；见通用设置、模型、插件、Agent 预设、市场；点击模型进入提供方配置页 | 可进入；未填写、保存或揭示任何凭证，未测试模型连通性 |
| Dev 数据隔离 | 启动前 Dev/Prod 路径均不存在；启动后 Dev、launch-root、harness 路径存在，Prod 仍不存在；与 configureAppIdentity 源码一致 | 本次 Dev/Prod 路径隔离已验证；未启动正式安装包 |
| 未处理异常 | 检查本次 npm dev 终端的新增输出 | 观察期间未见 JavaScript uncaught exception / unhandled rejection；没有读取完整 Harness 日志 |
| 退出 | 正常 Quit；UI 返回 App quit；npm dev exit 0；两个监听端口释放 | 本次正常退出通过，不等于崩溃恢复测试 |

实际检查的路径仅做存在性判断，没有读取内容：

- `/Users/wei/Library/Application Support/dsh-desktop-dev`
- 其 `launch-root` / `harness` 子目录
- `/Users/wei/Library/Application Support/dsh-desktop`

本次启动会按现有逻辑创建 Dev 数据与缓存；这些留在原位置，**没有删除或重置**。首次提供方页面只选择“稍后配置”；未修改权限/Theme/更新/Safe Mode，未打开手机入口、配对或启用 tunnel。

## 5. 唯一稳定复现的测试失败

失败位置：`test/feishu-release-notes.test.ts:175–191`，用例 `builds a prerelease prompt with previous tag and prerelease notices`。

```text
Expected: Previous tag: v0.7.1
Actual:   Previous tag: v0.7.2
          Current tag: 0.7.2
          Verified range: v0.7.2..0.7.2
```

确定的原因链：

1. 测试调用发布文案脚本的 `build-prompt --tag 0.7.2 --prerelease`，未设置隔离 Git fixture 的 cwd，却固定期望 v0.7.1。
2. `.github/scripts/feishu_release_notes.py:164–195` 的 `find_previous_tag()` 按 tag 创建时间排序，只排除 `tag == release_tag`，未排除解析到同一提交的别名。
3. 本地 `0.7.2` 与 `v0.7.2` 指向同一提交，v0.7.2 排在前面，因而被选为 previous。
4. 得到零提交区间，所以生成的证据块没有 commit details / diff statistics / code diff。

只读诊断检验了三类假设：同提交别名未排除（确认）、用例依赖真实 refs（确认）、显式 previous 参数未传递（排除；该调用没有此参数）。通过既有定向测试重复复现，没有添加调试代码、fixture 或改动 Git refs。

影响：阻塞完整测试绿灯，并可能令历史 prerelease 文案重建使用空证据；未发现 App 运行代码调用此发布文案脚本，因此不是本次 Electron/Harness 启动故障。

**没有修复，也没有把断言改为接受 v0.7.2。** 没有删除/更改本地 tags 或 fetch 新 refs。

## 6. 警告与环境限制

- 安装出现 6 类 deprecated 提示：node-domexception@1.0.0、rimraf@2.6.3、inflight@1.0.6、lodash.isequal@4.5.0、glob@7.2.3、boolean@3.2.0。记录为依赖维护风险；未因此升级。
- npm audit 在本次安装报告 0 vulnerabilities，仅是当时该检查的输出，不是完整安全认证。
- build/dev 均提示 `(!) renderer config is missing`。与当前 Vite 仅定义 Main / Preload、Web UI 由 Harness 提供的架构一致；不能为了消除提示擅自增加第二个 renderer 项目。
- Dev 终端实际出现 `error messaging the mach port for IMKCFRunLoopWakeUpReliable`。应用仍可渲染和操作；未深入复现输入法条件，不将其当作已修复，也不把它混同为 JavaScript 未处理异常。
- 沙箱首次测试的网络监听 EPERM 与超时在权限重跑后消失。首次 watcher 超时也未在重跑中出现；没有进一步证明它究竟是沙箱影响还是时序波动。
- 测试 stdout 中的 Windows EPERM rename、pnpm blocked/retry 消息来自既有负面测试场景；不要把这些模拟路径当作本机 Windows 故障或真实安装失败。
- 实际 Harness 日志可能含启动认证 token，本次未读取它、未运行 `scripts/verify-harness-auth.mjs`，未检查环境或凭证内容。因此不宣称完成全部 Runtime 日志与认证审计。

## 7. 当前风险与产品阻塞项

| 优先级 | 风险 / 缺口 | 处理建议，均未实施 |
| --- | --- | --- |
| P0 | 完整测试有稳定失败 | 单独修复同提交 tag 边界并隔离用例，重新跑核心命令；不能掩盖失败 |
| P0 | Discuss 不能直接依赖 Plan Mode 获得只读保证 | 先验证既有 Harness 权限/沙箱的实际强制能力；本阶段不改安全系统 |
| P0 | 未找到完整 Change Set / accept / rollback 合同 | 明确变更归属、前态保存、冲突与恢复范围，再验收完整闭环 |
| P0 | Session durability 不等于 exactly-once 副作用 | 保留 TOOL_OUTCOME_UNKNOWN，不自动重放未知的写操作 |
| P1 | 19 个补丁跨 UI、解析器和 Runtime，许多测试只是字符串契约 | 逐项兼容台账与真实 affected-flow 验证；不要扩大 Runtime patch 面 |
| P1 | 工程文档与当前代码/打包元数据不完全一致 | 在本次新增文档指出差异；旧文档不在授权修改范围 |
| P1 | Dev worktree 共用固定数据目录；启动含维护写入 | 后续 profile / recovery 测试先确认现有 Dev 数据，不把 Safe Mode 当空白数据环境 |
| P1 | 手机桥接默认 LAN 监听；部分 IPC 没有统一 sender/frame 校验 | 精确记录现状，不用“全 loopback / 全 IPC 校验”概括；安全实现本轮冻结 |
| P1 | Task/Run 产品模型、审批断线后的产品呈现、产物完整性未实现/未全面验证 | 先做只读 Adapter contract，再决定 UI；缺失状态显式显示 |

已识别的文档漂移：

- `docs/development.md` 仍写 Harness 0.1.1-rc.2，当前为 0.1.2-alpha.4。
- `docs/harness-0.1.2-alpha.4-upgrade.md` 写 245 个 dsh tarballs；实际为 242。它与 vendored README 对上游 commit 的记载也不一致，不能据此认定已验证可重复上游构建。
- 旧升级说明的 76 files / 569 tests 是历史结果；本次是 80 files / 669 tests，且有一项失败。
- 旧升级说明把 chat patch 概述为路径渲染，而当前路径识别改动实际在 deliverables patch。
- architecture.md 对 IPC sender/mainFrame 校验的概述比实际 handler 范围宽；具体见 [ARCHITECTURE_BOUNDARIES.md](ARCHITECTURE_BOUNDARIES.md)。

本次审计与文档交付本身没有需要用户输入凭证的阻塞；以上是后续代码施工与 MVP 发布门槛。

## 8. 建议的第一项最小代码改动

先另行授权一个仅涉及发布文案脚本及其测试的小改动：复用现有 `buildTagFixtureRepo()` 隔离失败用例，覆盖同一提交的 `0.7.2` / `v0.7.2`；在 `find_previous_tag()` 的候选选择中排除当前提交的别名，验证非空正确证据区间。不要以删除 tag、放宽断言或升级依赖修饰结果。此建议不涉及客户端更新系统；**本轮没有执行**。

之后首项产品代码才是无副作用的 Product Adapter 类型/只读 projection 契约：连接 Workspace / Session / Turn / Tool Action，保留 unknown / unsupported，验证重放与重连；不做首页、Work Panel、Runtime、Shell IPC 或权限重写。

## 9. 交付与最终 Git 核验

最终 Git 检查确认，新增且未跟踪的文件恰为：

- `docs/product/PRODUCT_BRIEF.md`
- `docs/product/MVP_VERTICAL_SLICE.md`
- `docs/product/ARCHITECTURE_BOUNDARIES.md`
- `docs/product/UI_SURFACE_MAP.md`
- `docs/product/BASELINE_AUDIT.md`

实际执行 `git status`、`git status --short --untracked-files=all`、`git branch --show-current`、`git rev-parse HEAD`、`git diff --stat`、`git diff --check`、`git diff --cached --stat`：

- 分支仍为 `product/foundation`，HEAD 仍为本文记录的原 commit。
- 上述五个文件均为 `??`；没有其他非忽略的新文件，没有已跟踪文件修改，没有暂存内容。
- tracked / staged diff 均为空；`git diff --check` 没有空白错误。默认 `git diff` 不包含未跟踪文件，不能据此声称没有新增文档。
- 只读文档检查核对了新增文件集合、相对链接、明确源码引用与 19/19 补丁覆盖。检查发现一处命令中的管道符需要 Markdown 表格转义，已仅修正文档呈现。
- 没有切换分支、创建提交、推送或创建 PR；没有改代码、CSS、品牌源文件、package.json、lockfile 或 patches。

`node_modules/` 和 `out/` 是既有安装/构建命令生成的忽略目录，不计作产品源码修改。Dev 数据创建已在第 4 节单独记录。代码检查结果来自文档生成前的未修改基线；新增 Markdown 后不将文档检查冒充重新执行全部应用测试。

## Post-baseline remediation

修复日期：2026-09-03（Australia/Sydney）。这是后续单独授权的 previous-tag 修复，**不改变上文原始审计时 668 passed / 1 failed 的历史结果**。

### 起点与根因

- 开始前依次运行 `git status`、`git branch --show-current`、`git rev-parse HEAD`：工作区干净，分支 `product/foundation`，HEAD 为 `0f9e76d5d98b069ddb0fd53ce3ee427ab0a7f9b1`。
- 本轮确认 Node v24.15.0、npm 11.12.1、Python 3.9.6、Git 2.50.1（Apple Git-155）；复用已安装依赖，没有重新安装或升级。
- 原失败用例的 CLI 目标是 `0.7.2`，而不是 `v0.7.2`。只读 `git for-each-ref` 确认二者是不同的 annotated tag 对象，但都解引用到 `11481ac3827d75f98c8ceca3771f63cbfa2a49f0`；较晚创建的 `v0.7.2` 被原选择器优先选中。
- `find_previous_tag()` 只排除完全同名的 tag，未排除同提交别名；原用例未指定 fixture cwd，又把前序 tag 固定为 `v0.7.1`。实现缺陷与测试对真实仓库 refs 的依赖共同导致失败。

### 确认的语义与最小修复

依据 `.github/scripts/feishu_release_notes.py` 的候选规则、现有通道测试，以及 `.github/workflows/release.yml` 的正式发布 / `publish-prerelease` 调用：

- previous tag 必须指向目标 ref 的**严格祖先提交**，符合当前发布通道的候选格式；目标 tag 本身及同提交的其他 tag 均不能作为前序边界。目标不存在时继续使用 HEAD。
- 正式版保持仅选择 `vX.Y.Z`；预发布保持现有可选 `v` 与版本后缀的 regex。保留创建时间降序及既有 version-refname 排序 fallback；不是新增“全仓库最大旧 SemVer”或“图距离最近 tag”的规则。
- 实现只在两处 `git tag --merged ref` 查询各增加 `--no-contains ref`，另加一行说明，共新增 5 行。Git 的可达性过滤同时处理 lightweight / annotated tags，无版本号硬编码、无新依赖。
- 无有效前序 tag 时仍返回空字符串；CLI 继续显示 `Unavailable`，使用既有单 ref 证据回退。没有把净 code diff 必须非空变成新策略，合法的 empty commit / revert 仍可有空净差异。
- `github_release_notes.py` 共享此采证函数，因此一并运行其现有测试；未修改 workflow、客户端更新逻辑或任何 Harness patch。

### 回归覆盖

保留原失败用例的全部断言，复用临时 Git fixture，增加同提交 `0.7.2` / `v0.7.2`，并断言正确范围与 fixture 中的实际 commit / diff 内容。先只改测试，确认同一错误仍然变红，再修复实现并确认转绿。

新增 7 个参数化展开后的用例：

- lightweight / annotated 两种 tag：正式版、预发布均排除当前提交所有别名，包括名称不同的版本 tag；目标尚未建立时的 HEAD fallback 也排除该提交上的 tags。
- 4 种无有效前序情形：没有 tags、根提交仅有当前版本别名、历史只有非版本 tag、正式发布之前只有 prerelease tag。均保持 `Unavailable` 与原证据回退。
- 有效前序候选继续按创建时间选择，不意外变成按版本数值取最大值。

原有正常顺序、正式 / 预发布区分和未创建目标 tag 的测试保留。前序选择回归均在独立临时仓库运行，fixture 固定提交/标签日期，建库时屏蔽全局/系统 Git 配置，并由既有 `afterEach` 清理；没有更改真实仓库 tags。

复核发现新增的范围断言固定 LF，已改为兼容 LF / CRLF 的完整 metadata 行匹配，保留精确范围要求；随后重新依次运行目标文件、完整测试、typecheck、build。本轮实际运行环境为 macOS，没有宣称 Windows CI 已验证。

### 本轮实际验证

| 实际命令 / 阶段 | 真实结果 |
| --- | --- |
| `npm test -- test/feishu-release-notes.test.ts -t 'builds a prerelease prompt with previous tag and prerelease notices'`（未修改实现、原测试） | exit 1；1 failed / 6 skipped；Expected v0.7.1，Actual v0.7.2 |
| 同一命令（只隔离 fixture 并加强断言，尚未修复实现） | exit 1；1 failed / 6 skipped；相同错误，证明回归能检出缺陷 |
| 同一命令（5 行实现修复后） | exit 0；1 passed / 6 skipped；skipped 来自 `-t` 筛选，没有删除或跳过任何用例 |
| `npm test -- test/feishu-release-notes.test.ts test/github-release-notes.test.ts`（全部回归补齐后） | exit 0；2 files / 18 tests 全部通过；Duration 4.50s |
| `python3 .github/scripts/feishu_release_notes.py build-prompt --tag 0.7.2 --prerelease`（真实仓库，只显示筛选后的 metadata） | exit 0；Previous tag v0.7.1；Current tag 0.7.2；Verified range v0.7.1..0.7.2 |
| `npm test -- test/feishu-release-notes.test.ts`（换行兼容调整后的最终目标测试） | exit 0；1 file / 14 tests 全部通过；Duration 4.34s |
| `npm test`（获准使用本地端口监听权限，换行调整前后各一次） | 两次均 exit 0；**80 files / 676 tests 全部通过**；Duration 分别 5.71s / 5.62s；均未报告 unhandled errors |
| `npm run typecheck`（换行调整前后各一次） | 两次均 exit 0 |
| `npm run build`（换行调整前后各一次） | 两次均 exit 0；197 / 7 modules；保留既有 `(!) renderer config is missing` 警告 |
| `git status`、`git diff`（首轮验证后、本节首次追加前） | 仅发布说明脚本与对应测试两个文件未暂存修改；实现新增 5 行，原断言保留；无其他源码修改 |
| 最终 `git status`、`git diff`、`git diff --check`、分支 / HEAD 核验与只读文档检查 | 仅本节文档、发布说明脚本、对应测试三个文件修改；无暂存和未跟踪文件；分支 / HEAD 未变；无空白错误；上文原审计内容逐字节保留 |

完整测试中的 pnpm / Windows EPERM 输出仍来自既有负面测试，不是此次测试失败。本轮不运行发布、推送、签名、通知或真实 Agent 流程；测试和构建成功不代表已验证线上发布。

最终结果：**修复后的自动测试基线已恢复全绿**。变更范围仅发布说明选择器、对应回归测试及本节追加记录。行为变化仅为不再使用目标提交上的 tag 形成自比较区间；共享该函数的 GitHub 发布说明采证也获得同样修正。没有切换/创建分支，没有提交、推送或创建 PR。
