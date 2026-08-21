# 用户账号级隔离 —— 执行清单（Phase 5-8）

> Phase 1（设计）、Phase 2（真实登录）、Phase 3（内存 Map → SQLite）、Phase 4（`X-Hermes-Session-Key` 传导 + `user_model` 注册 seeding）已完成。本文档只覆盖剩余的 Phase 5-8，按依赖顺序排列——**必须按顺序做，Phase 7 依赖 Phase 5 先落地，否则新用户会立刻丢失所有 Expert Skill 行为**。

---

## Phase 5 — 共享 Expert Skills 目录

### 目标
把"ShouldI 精选的 Expert Skills"（`salary-negotiation`、`smart_talk`、`career-coop` 等，对应 `harmence-experts.ts` 专家目录里的 `skillName`）跟"agent 自己在对话里现学现写的 skill"彻底分开：前者所有用户共享，后者每个用户私有。

### 已核实的现状（重要，决定了要做什么）
- Hermes 加载 skill 时用的是 `get_all_skills_dirs()` = `[HERMES_HOME/skills]` + `skills.external_dirs`（[skill_utils.py:273](hermes-agent-private/agent/skill_utils.py#L273)）。**`HERMES_HOME/skills` 永远排第一，`external_dirs` 默认是空 `[]`**。
- 镜像构建时 `docker/hermes/Dockerfile` 把整个 `hermes-agent-private/skills/`（含 `salary-negotiation`、`smart_talk` 等全部 Expert Skills）烤进了镜像的 `/opt/hermes/skills/`，**但这个路径从没被 `get_all_skills_dirs()` 引用过**。
- 容器启动脚本 [docker/hermes/entrypoint.sh](docker/hermes/entrypoint.sh#L7-L27) 的 `bootstrap_data_dir()` 只是 `mkdir -p ${HERMES_HOME}/skills`（建一个空目录），**不会**把镜像里的 Expert Skills 复制进去。
- 现在 `~/.hermes/skills/` 里之所以能看到 `salary-negotiation`/`smart_talk` 等目录，是**之前某次手动 `cp` 进去的**，不是任何自动化机制的结果。

### 结论
**这是一个真实存在、还没暴露的定时炸弹**：一旦 Phase 7 给每个用户建独立的 `HERMES_HOME`，新账号的 `skills/` 目录会是全空的——`entrypoint.sh` 目前的逻辑不会把 Expert Skills 放进去，新用户的 Hermes 会立刻失去所有专家技能。Phase 5 必须在 Phase 7 之前修好。

### 执行步骤（已完成）
- [x] 决定共享清单：`salary-negotiation`、`smart_talk`、`intl-job-search`、`grad-school-advisor`、`intl-student-advisor`、`pm-career-expert`、`stay-or-return`（[harmence-experts.ts](apps/api/src/harmence-experts.ts) 全部 7 个 `skillName` 精确匹配），跟 `apple`/`gaming`/`devops`/`mcp`/`github` 等通用技能分开
- [x] 精选子集单独 `COPY` 到 `/opt/hermes/shared-skills/`（[docker/hermes/Dockerfile](docker/hermes/Dockerfile)），不复用整个 `skills/`，避免暴露无关技能
- [x] [docker/hermes/entrypoint.sh](docker/hermes/entrypoint.sh) 的 `bootstrap_data_dir()` 新增：首次创建 `config.yaml` 时用 `ruamel.yaml`（round-trip，保留注释）把 `skills.external_dirs` 指向 `/opt/hermes/shared-skills`
- [x] **顺带修了一个更根本的 bug**：`docker/hermes/Dockerfile` 原本压根没有 `COPY cli-config.yaml.example .env.example`，导致 `bootstrap_data_dir()` 的这两步从建这个精简镜像开始就从未真正跑起来过（`if [ -f ... ]` 静默跳过）；已修
- [x] 本地验证：容器内建一个完全独立的 `/tmp/test-fresh-home`（不碰生产 `~/.hermes`），空 `skills/`，走同样的 patch 逻辑，Python 直接解析确认 `data['skills']['external_dirs'] == ['/opt/hermes/shared-skills']`（不只是肉眼看文本，是结构化解析验证）
- [x] 真实验证：用这个全空 `skills/` 的测试 home，真实问了一句"H-1B 期间谈薪水"，回答里出现 skill 文件里的具体数字（"Level III → IV wage jump ... 33% relative"）——不是通用回答，是 skill 内容确实被激活
- [x] `skill_manager_tool.py` 写入路径本来就是 `HERMES_HOME/skills`（[skill_manager_tool.py:109](hermes-agent-private/tools/skill_manager_tool.py#L109)），`external_dirs` 官方语义就是只读，代码没改也不需要改

### 验收标准（已满足）
全新、空 `skills/` 目录的 home，不做任何手动复制，也能正常使用全部 Expert Skills；agent 自学的新技能只出现在该账号自己的 `HERMES_HOME/skills/` 里，不会污染共享目录。

### 遗留的小尾巴（不阻塞 Phase 7，但建议之后清理）
生产环境 `~/.hermes/config.yaml` 的 `external_dirs` 还是空的——因为它是老文件，`bootstrap_data_dir()` 只在 `config.yaml` 不存在时才跑。现在生产之所以还能用 `salary-negotiation` 等技能，是因为 `~/.hermes/skills/` 里还留着之前手动复制的那份。等 Phase 7 真正给每个新用户建独立 home 时，新建的 home 会自动走 `external_dirs`（已验证），但这个"祖传"的共享 home 本身没有清理必要，除非之后想彻底去掉手动复制的那份、统一走 `external_dirs`。

---

## Phase 6 — 内部 RPC/exec 服务

### 目标
新建一个内部服务，负责按需拉起/管理"每用户一个独立 `HERMES_HOME`"的 Hermes 子进程，`apps/api` 不直接碰 Docker socket。

### 已决策
- **服务跑在哪**：在现有 `shouldi-hermes-1` 容器内部新增一个常驻 HTTP 服务（不单独起 sidecar 容器）——复用容器里已经装好的 `hermes` CLI 和 Python 环境，改动最小
- **每用户 HERMES_HOME 的物理路径规则**：`/opt/data/users/<shouldi-userId>/`，每个用户的 `config.yaml` 都带上 Phase 5 的 `external_dirs` 共享技能配置
- **新用户 provisioning 时机**：注册时立即创建——跟 Phase 4 的 `POST /v1/user-model/seed` 同一模式，`apps/api` 的 `/v1/auth/signup` 成功后再顺手调一个新的 provision 端点，第一次对话时 `HERMES_HOME` 已经就绪，不用现建、不用处理并发首次请求的竞态
- **匿名用户**：共享一个默认 `HERMES_HOME`（`/opt/data/users/anonymous-local/` 或等价路径），跟真实账号走同一条 per-turn subprocess 路径，不单独维护一套逻辑
- **旧的常驻 `api_server` 路径**：永久保留，作为 per-turn 服务不可用时的降级 fallback（不是 Phase 7 验证通过就删掉）

### 执行步骤（已完成）
- [x] 新增 [hermes-agent-private/gateway/internal_rpc.py](hermes-agent-private/gateway/internal_rpc.py)：aiohttp 常驻服务，`GET /health`、`POST /v1/provision { userId }`、`POST /v1/turn { userId, sessionId?, messages }`。`userId` 做了严格白名单校验（只允许 `[A-Za-z0-9_-]`，因为它直接拼进文件系统路径）
- [x] provision 逻辑：创建 `/opt/data/users/<userId>/{cron,sessions,logs,memories,skills,workspace,home}`，复制 `cli-config.yaml.example` 并用 Phase 5 同款 `ruamel.yaml` patch 写入 `external_dirs`，复制 `docker/SOUL.md`，**复制平台自己的 `.env`**（API key 属于 ShouldI 平台，不属于终端用户，所有 per-user home 共享同一份，不是每个用户单独管理凭证）
- [x] 每轮对话真正 spawn 一个新 OS 子进程（[internal_turn_runner.py](hermes-agent-private/gateway/internal_turn_runner.py)），子进程的 env 里单独设置 `HERMES_HOME` 指向该用户路径——这是必须真子进程、不能只是"同进程换个变量"的根本原因：`HERMES_HOME` 是进程级全局变量，不是 contextvar-safe
- [x] 加了按 `userId` 的 `asyncio.Lock`（同一用户的并发请求排队，不同用户互不阻塞）+ 180s 超时 kill
- [x] `GET /health` 端点已加；[compose.yaml](compose.yaml) 把新端口 `8643` 只绑定到 `127.0.0.1`（不像 `8642` 那样开放，因为这是内部服务，只该 `apps/api` 能打）
- [x] [docker/hermes/entrypoint.sh](docker/hermes/entrypoint.sh) 在 `exec hermes "$@"` 之前用 `&` 后台启动这个服务——特意放后台而不是让它成为容器的前台进程，这样它崩溃不会拖累整个容器（呼应"旧路径永久保留做 fallback"的决策）
- [x] 真实 curl 独立测试通过，细节见下方"真实验证"

### 真实验证（含一次真实踩坑）
- **provision**：`POST /v1/provision` 后 `docker exec` 进容器确认 `config.yaml`/`SOUL.md`/`.env`/各子目录都生成了，`external_dirs` 正确指向 `/opt/hermes/shared-skills`
- **单轮真实对话 + 技能激活**：问了一句 H-1B 期间怎么谈薪水，回答里出现了 skill 文件里的具体框架（DOL OEWS 阈值、wage level 边界）——证明 per-user home 下 Phase 5 的共享技能确实能用
- **踩坑并修复：跨子进程续聊一开始是失败的**。第一版实现直接照抄 `api_server.py`'s `_create_agent()` 的参数表，把 `session_id` 传给 `AIAgent()` 构造函数，再调用类似 CLI 单轮模式用的 `agent.chat(message)`——第二轮问"我刚才跟你说了什么"，回答是"这是我们的第一条消息"，完全没记住上一轮。追进 `api_server.py` 源码才发现：**传 `session_id` 给 `AIAgent()` 本身不会自动加载历史**，`api_server.py` 真正的做法是显式调用 `SessionDB.get_messages_as_conversation(session_id)` 把历史取出来，再传给 `agent.run_conversation(user_message, conversation_history=history, task_id=session_id)`——`run_conversation` 才是真正支持外部注入历史的方法，`chat()` 不是。改用这个模式后重测：两轮对话分别是两个完全独立的子进程，第二个子进程正确记得第一轮里"我最喜欢的颜色是 teal"这件事
- 全程 `shouldi-hermes-1`（8642）、`apps/api`（8787）健康未受影响；测试数据（`/opt/data/users/phase6-test-user-1`）已清理

### 遗留说明
- 匿名用户共享 home 目前还没有专门 provision 过（只是设计上走同一路径，`ANON_USER_ID = "anonymous-local"` 常量已经写好，真正建这个 home 留给 Phase 7 接入时顺手做，或者现在单独调一次 `/v1/provision {"userId":"anonymous-local"}` 也行）
- `internal_rpc.py` 里的 `_patch_external_dirs` 和 `entrypoint.sh` 里的 ruamel.yaml patch 逻辑是两份手写的重复代码（一份 Python 一份内嵌在 shell 里的 Python heredoc）——因为一个要在纯 shell 的 bootstrap 阶段跑、一个要在常驻 Python 服务里跑，暂时没有共用的加载路径；如果之后要改这段逻辑，两处都要改

---

## Phase 7 — apps/api 切到 per-turn subprocess

### 目标
把 `apps/api` 调 Hermes 的方式，从"打常驻 `api_server`（所有用户共用一个进程）"换成"每轮对话都走 Phase 6 的服务，用该用户自己独立的 `HERMES_HOME`"。

### 执行步骤（已完成）
- [x] [hermes-client.ts](apps/api/src/hermes-client.ts) 里没有新增独立客户端模块，而是直接改造 `hermesChatCompletion()` 本身：`sessionKey` 存在且 `probeInternalRpc()` 探活成功时优先走内部 RPC 的 `POST /v1/turn`；任何失败（超时、子进程崩、响应解析不出来）都静默 fall through 到原来的 `api_server` 逻辑。**没有改动 `harmence-interview.ts` 的 8 个调用点一行代码**——它们从 Phase 4 起就已经带 `sessionKey: viewerUserId(session)`，路由决策完全封装在 `hermesChatCompletion()` 内部，调用方无感知
- [x] `/v1/auth/signup` 成功后新增 `void provisionHermesUserHome(result.userId)`，跟已有的 `seedHermesUserModel()` 并列（[index.ts](apps/api/src/index.ts)）
- [x] 降级逻辑就是上面说的"内部 RPC 任何失败都 fall through"——不是"健康检查失败才降级"这么简单的开关，而是每次请求都优先尝试、失败就退，颗粒度更细，单次请求级别的故障也能自动兜底
- [x] 真实端到端验证：见下方

### 真实验证（含一次真实踩坑）
- 注册两个全新账号，`provisionHermesUserHome` 在 signup 时就把 `/opt/data/users/<userId>/` 建好了（无需等首轮对话）
- 两个账号各自跑了多轮真实 `/v1/harmence/interview/turn` 对话，`docker logs` 里能看到 `internal_rpc.py` 收到的 `POST /v1/turn` 请求，且**两个账号各自的 `state.db` 文件都被写入更新**——不是共享的生产 `~/.hermes/state.db`，是各自独立路径下的文件，这就是"两次请求分别拉起两个独立 Hermes 子进程、用两个不同 HERMES_HOME"的直接证据
- **踩坑并修复：第二个账号的一轮对话触发了真实的 502**。追查发现根因是 `AIAgent`/`run_conversation` 内部把重试/限流警告（比如这次真实撞到的 OpenRouter 402 额度不足）直接 `print()` 到 stdout，不是 stderr；而 `internal_rpc.py` 是把子进程的整个 stdout 当一个 JSON 值去解析的——警告文字排在最终 JSON 那一行前面，直接把 `json.loads()` 炸了（`Expecting value: line 1 column 1`）。修复：[internal_turn_runner.py](hermes-agent-private/gateway/internal_turn_runner.py) 用 `contextlib.redirect_stdout` 把 `AIAgent` 构造 + `run_conversation()` 期间的所有 stdout 输出临时接管到内存缓冲区，转发进真正的 stderr（`internal_rpc.py` 出错时会打进日志，方便排查），只有脚本自己最后那一行 `print(json.dumps(...))` 才会真正落到 stdout。重新构建、重测，两个账号各自又跑了两轮，全部干净 200，没有再复现
- 顺带处理了一个自己调试造成的小尾巴：手动 `docker exec`（默认以 root 身份跑）触碰过账号 D 的 `state.db`，导致这个文件 owner 变成了 `root:root`，跟正常由 `hermes` 用户运行的服务写出来的文件不一致——已经 `chown` 修正回 `hermes:hermes`；正常线上路径（`internal_rpc.py` 由 entrypoint 以 `hermes` 用户常驻运行）不会有这个问题，纯粹是我这次手工复现 bug 时留下的痕迹
- 全程 `shouldi-hermes-1`（8642 上的旧 api_server）、`apps/api` 健康未受影响；测试账号的 `/opt/data/users/` 目录已清理（SQLite 里的两个测试 `users` 行沿用本 session 一贯做法，不做特意清理）

### 验收标准（已满足）
真实登录两个账号，各自跑一轮对话，`apps/api` 日志/追踪能看到两次请求分别拉起了两个独立的 Hermes 子进程，用了两个不同的 `HERMES_HOME` 路径。

### 验收标准
真实登录两个账号，各自跑一轮对话，`apps/api` 日志/追踪能看到两次请求分别拉起了两个独立的 Hermes 子进程，用了两个不同的 `HERMES_HOME` 路径。

---

## Phase 8 — 跨账号最终验证

### 目标
在 Phase 7 落地"物理隔离的 `HERMES_HOME`"之后，做一轮比 Phase 4 那次更彻底的双账号验证。

### 执行步骤（已完成）
- [x] 两个全新真实账号，各自跑了多轮真实对话
- [x] 磁盘上两个账号的 `HERMES_HOME` 完全独立性 —— 见下方"真实验证"
- [x] Phase 5 的共享 Expert Skills 两个账号都正常可用 —— 见下方
- [x] `session_search` 工具跨账号隔离 —— 见下方，双向验证过
- [x] 延迟对比 —— 见下方

### 真实验证（含两次真实踩坑）

**踩坑 1（阻塞性，已修复）：`user_model` 种子写错了数据库。** 用两个新账号跑对话后去查各自 `state.db` 的 `user_models` 表，发现是空的；查生产共享 home 的 `state.db` 却能查到这两个账号——说明 Phase 4 的 `seedHermesUserModel()` 调的是旧共享 `api_server` 的 `/v1/user-model/seed`，永远写向共享 home，而 Phase 7 之后真实对话走的是各自独立的 per-user home，两边压根不是同一个数据库文件。修复：在 [internal_rpc.py](hermes-agent-private/gateway/internal_rpc.py) 的 `_provision_home()` 里，直接用 `UserModelStore(hermes_home=<该用户目录>)` 在 provision 阶段就把 `user_models` 行种到**正确**的数据库里。重新构建、重新 provision 两个账号后确认两边 `state.db` 里都各自出现了对应的一行。

**踩坑 2（非阻塞，发现但未修复，记录为已知缺口）：`on_session_end()`（真正触发 `user_model` 后台推断的方法）在整个代码库里被定义了两处（`MemoryProvider` 基类 + `user_model/provider.py` 的实现），但**从未被任何地方实际调用过**——全仓库 grep 零匹配。这意味着无论用哪种架构（常驻进程还是 per-turn 子进程），`inferred_json`/`signal_vocab` 这两个字段**目前都不会被真正填充**，这是 `user_model` 插件自身遗留的未完成功能，跟本次 Phase 4-8 的隔离改动无关，也不是这次引入的问题。跑了两轮真实、信号很明显的专业背景对话（"6 年经验的后端工程师，喜欢早起深度工作"、"材料科学博士生，导师微观管理"），等待了完整的异步窗口后复查，两个账号的 `inferred_json`/`signal_vocab` 依然是空数组——符合"这个钩子从没被接上"的判断。**这是一个独立于本次隔离工作之外的新发现，需要单独决定要不要修、什么时候修，不在本次 Phase 8 范围内处理。**

其余验证：
- **磁盘隔离**：两个账号的 home 目录结构完全平行独立（各自的 `.env`、`SOUL.md`、`config.yaml`、`state.db`+WAL、`sessions/`、`skills/`），互相 `grep` 对方的 userId 全部零匹配
- **共享技能**：账号 E 问薪资谈判、账号 F 问"要不要因为导师微观管理换实验室"，两边回答都带着对应 Expert Skill 的鲜明风格（诊断式提问框架、"Nature 调查显示 1/4 博士生后悔选导师"这类具体引用）——证明两个完全独立的 home 都能通过 `external_dirs` 用上同一套共享技能
- **`skill_manage` 隔离**：让账号 E 显式创建一个私有技能 `phase8-secret-marker`，磁盘上确认只出现在 E 自己的 `skills/` 目录，F 的 `skills/` 和共享 `shared-skills/` 目录都没有；反向问账号 F"你有没有 `phase8-secret-marker` 这个技能"，F 如实列出自己能用的 7 个共享技能，明确说没有这个
- **`session_search` 隔离**：账号 E 的对话里出现过"founding engineer"这个短语，让账号 F 用 `session_search` 搜这个词——零匹配；反向让账号 E 搜只在 F 对话里出现过的"qualifying exam"——同样零匹配。双向确认物理分离的 `state.db` 文件天然阻断了这个之前识别出的潜在跨账号数据泄漏风险点
- **延迟对比**：同一个简单问题（"12+30 等于几"），per-turn 子进程路径 4.696s，旧的常驻 `api_server` 路径 4.806s——基本持平，子进程冷启动（import `run_agent.py` 等）没有带来有意义的额外延迟，两条路径的耗时都被真实 LLM 推理本身主导

**过程中还遇到一次真实的外部阻塞**：测试中途撞上 OpenRouter API key 额度不足（HTTP 402，请求需要 128000 tokens 但余额只够 117656），导致所有依赖真实模型调用的验证项当场失败。这是账号额度问题，不是代码/架构问题——已请用户充值后继续，充值后所有请求恢复正常。

测试数据（两个测试账号的 `/opt/data/users/` 目录）已清理；全程生产 `api_server`（8642）、`apps/api`（8787）健康未受影响。

### 验收标准（已满足）
双账号并发对话互不干扰、互不可见，只有 Phase 5 圈定的 Expert Skills 是两边都能用的公共部分，其余全部物理隔离。

### 追加：`on_session_end()` 死代码问题已解决（Phase 8 收尾，非原计划范围）

原本记录为"遗留事项"，用户明确要求解决。定位 + 修复过程中一共挖出 **4 个独立的真实 bug**，缺一个都不会真正触发推断：

1. **调用点确实缺失**：`on_session_end()` 只有两个入口——`AIAgent.shutdown_memory_provider(messages)`（真正会话结束时调，文档写"NOT called per-turn"）和 `AIAgent.commit_memory_session(messages)`（session_id 轮转时的轻量版）。全仓库搜索确认两个方法从未被 CLI、旧 `api_server.py`、任何 gateway 平台调用过——通用缺口，不是这次隔离改动引入的。**修复**：per-turn 子进程模型下"这个子进程即将退出"就是唯一自然的会话边界，在 [internal_turn_runner.py](hermes-agent-private/gateway/internal_turn_runner.py) 的 `run_conversation()` 返回后加一行 `agent.shutdown_memory_provider(messages=result["messages"])`。旧的 `api_server.py` 每次请求也是新建一次性 `AIAgent` 实例（同样的"一轮=一个实例"模式），按用户要求同步修了 [api_server.py](hermes-agent-private/gateway/platforms/api_server.py) 的 `_run_agent()`。`UserModelInferrer` 自带节流（`MIN_TURNS=3`、`COOLDOWN_HOURS=1`），所以每轮都调用这个方法本身是安全、低成本的。
2. **表都不存在**：`UserModelStore` 从不建表，只有 `SessionDB` 的 schema 初始化才会 `CREATE TABLE IF NOT EXISTS user_models`。Phase 8 的 provision 逻辑直接 `UserModelStore(...).seed_from_registration(...)`，但全新 per-user `state.db` 上从没有任何东西实例化过 `SessionDB`，报 `no such table: user_models`。**修复**：`_provision_home()` 里先 `SessionDB(db_path=home/"state.db")` 触发建表，再种 `user_models` 行。
3. **插件压根没启用**：per-user home 的 `config.yaml`（复制自 `cli-config.yaml.example`）完全没有 `memory.provider: user_model` 这一行——只有生产共享 home 的 `config.yaml`（之前手动改过）有。没配置就等于 `MemoryManager.providers` 是空列表，`on_session_end()` 循环零次，不报错、不留日志，表现就是"看起来什么都没发生"。**修复**：`internal_rpc.py` 的 provision patch 和 `entrypoint.sh` 的 bootstrap patch 都加上 `memory.provider = "user_model"`。
4. **（非 bug，产品行为）冷启动窗口**：`UserModelInferrer.run()` 的 cooldown 检查是 `time.time() - user_model.updated_at < 1小时`，而 `seed_from_registration()` 在注册时就把 `updated_at` 设成了当时的时间——意味着**每个新用户注册后的第一个小时内，无论聊多少轮都不会触发推断**。这是 cooldown 复用同一个时间戳字段的自然结果，不是这次改动引入的缺陷，先如实记录，要不要改成"首次种子行不计入 cooldown 起点"是一个可以之后单独讨论的产品/工程小决策。

**真实验证**：全新账号，人工把 `updated_at` 回拨 2 小时绕过冷启动窗口后，跑 3 轮带真实职业信号的对话（"ER 护士"、"刚搬到 Austin"、"还在适应夜班"），`shutdown_memory_provider()` 触发的推断真实跑通，`inferred_json` 里出现了 `role: ER Nurse`、`industry: Healthcare`、`communication_style: informative, direct`，`signal_vocab` 里学到了 5 个新的触发短语（"I work as a"、"I just moved to" 等）——内容都跟对话原文对得上，不是幻觉。

### 遗留事项（仍未处理，非阻塞）
- 账号 D（Phase 7 测试）遗留的 `root:root` 文件属主问题在 Phase 8 的新账号身上也复现过（部分文件是 `root` 属主而不是 `hermes`），没有阻塞任何实际读写——怀疑是多次 `docker compose build/up` 重建容器过程中的某个环节留下的，值得后续单独排查根因，但目前不影响功能
- 新用户注册后 1 小时内的 `user_model` 冷启动窗口是否要调整，留待后续单独讨论
