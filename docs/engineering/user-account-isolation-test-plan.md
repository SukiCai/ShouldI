# 用户账号级隔离 —— Edge Case 测试计划

> 承接 [user-account-isolation-plan.md](user-account-isolation-plan.md)（Phase 1-8 实现 + 主路径验证已完成）。本文档只覆盖**尚未系统测过的边界情况**——不重复主路径已经验证过的内容（比如"两个账号物理隔离"已经在 Phase 8 证明过，这里不再重测基础款，只测边界）。

## 怎么用这份清单
- 每条用例：**目的 / 步骤 / 预期结果 / 关联文件**。步骤尽量给出可以直接跑的 curl/docker 命令。
- 优先级：**P0**（不测会有真实生产风险，应最先测）、**P1**（该测但不是最紧急）、**P2**（好奇心驱动，出问题影响面小）。
- 测完一条就在前面打勾并记录实际结果（尤其是跟预期不符的情况），不要只跑不记。
- 建议每类测完就清理测试数据（`docker exec shouldi-hermes-1 rm -rf /opt/data/users/<testUserId>`），避免污染下一类测试。

---

## 执行总结（全部 30 条按 G→A→B→C→D→E→F→H 顺序跑完）

### 真实 bug：2 个（已修复）——都在 G 组，安全类

1. **会话越权（严重）**：`POST /v1/harmence/interview/turn` 和 `GET /v1/harmence/interview/sessions/:id` 完全没做归属校验——任何登录用户换个 `sessionId` 就能续写/读取别人的私密对话；`GET` 接口甚至不需要任何 token。顺带发现 `GET /v1/harmence/interview/sessions`（列表接口）会把**所有用户**的会话预览一起返回。**修复**：`handleInterviewTurn` 加了 `session.userId !== callerUserId` 校验（[harmence-interview.ts](../../apps/api/src/harmence-interview.ts)），三个 GET/POST 路由改成按登录用户过滤/校验（[index.ts](../../apps/api/src/index.ts)），新增 `listSessionRowsForUser`（[db.ts](../../apps/api/src/db.ts)）。
2. **决策记录越权（严重）**：`DecisionRecord` 这个类型压根没有 `userId` 字段——`/v1/decisions`、`/v1/decisions/:id`、`/lens`、`/replay`、`/prediction`、`/outcome`、`/reflection` 全系列接口没有任何归属校验。**修复**：给 `DecisionRecordSchema` 加 `userId` 字段（[contracts](../../packages/contracts/src/index.ts)），`decision_records` 表加 `user_id` 列 + 迁移逻辑，`index.ts` 七个路由全部加上 `getDecisionRecord(id, userId)` 归属校验。`GET /v1/metrics/pmf` 是有意的全局聚合指标，保留不做用户过滤（`listAllDecisionRecordRows`）。

修复后重新跑了原始越权路径，全部正确变成 404；同时验证了合法拥有者的正常访问没有被误伤。

### 真实 bug：1 个（已修复）

3. **C1 数据丢失（已修复）**：同一个 ShouldI 会话遭遇并发的两个 `turn` 请求时，先到的那条用户消息会被静默覆盖丢弃（API 仍返回 200 成功）。根因：`handleInterviewTurn` 的 get→`await hermesChatCompletion(...)`→save 这段临界区中间有一个真实的异步间隙，两个并发请求的"读"都读到同一个旧状态，后写的直接覆盖先写的。对比 Explore 投票接口（C2，9/9 并发票全部正确计入）——因为那条路径的 read-modify-write 之间没有 `await`，JS 单线程天然帮它做了序列化，不需要额外加锁。**结论：不是"要不要加锁"的问题，是"这条路径的临界区中间有没有 await 缝隙"的问题。**

**修复**：新增按 `sessionId` 分片的 async mutex `withSessionLock`（[harmence-interview.ts](../../apps/api/src/harmence-interview.ts)，promise-chaining 实现，跟 `internal_rpc.py` 里的 per-user `asyncio.Lock` 是同一思路）。`handleInterviewTurn` 拆成一个瘦的加锁分发层 + 原来的全部逻辑搬进 `runInterviewTurn`；只有已存在的 `sessionId` 才需要排队，全新会话（`sessionId` 还没生成）天然不会有人跟它抢。锁用完自动清理 map 条目，不会无限增长。

**验证**：原始复现场景（2 路并发同 session）重跑，两条消息都正确保存；加测 3 路并发同 session 也全部保存；另外确认不同 `sessionId` 之间完全不互相阻塞（并行执行，不是排队）。

### 真实 bug：2 个（原本记录为"已知限制/未确定复现"，追问后也修了）

4. **JWT 改密码不失效旧 token（已修复）**：token 是无状态签名，只编码 `sub`+过期时间，`verifyAuthHeader` 不检查密码是否变过——改密码不会让泄漏出去的旧 token 失效，用户以为"改密码=踢掉别人"，实际不成立。**修复**：`users` 表加 `token_version` 列（[db.ts](../../apps/api/src/db.ts)），签发 token 时把它编码进 JWT 的 `tv` claim（[auth.ts](../../apps/api/src/auth.ts)），`verifyAuthHeader` 校验时比对 `tv` 跟数据库当前值是否一致，不一致直接拒绝；`changePassword` 成功后调用新增的 `incrementTokenVersion()`，让所有旧 token 立即失效。**验证**：改密码前的 token 之后在 `/v1/me` 里正确显示 `anonymous:true`，打需要鉴权的接口正确 401；改密码后重新登录拿到的新 token 正常可用。
5. **F4 user_model 并发推断覆盖写（已修复）**：`update_inferred`/`update_signal_vocab` 虽然是"读-合并-写"而不是盲写，但读和写之间没有跨调用的锁——两个并发的推断（现在每轮对话都是独立子进程）都读到同一个旧状态，各自合并出不同结果，后写的整个覆盖掉先写的。**修复**：把 `get_model` 拆出一个复用连接的 `_get_model_with_conn`，`update_inferred`/`update_signal_vocab` 现在用同一个 SQLite 连接显式 `BEGIN IMMEDIATE` 包住"读→合并→写"整个过程（[store.py](../../hermes-agent-private/plugins/memory/user_model/store.py)）——`BEGIN IMMEDIATE` 会立刻拿到 SQLite 的写锁，WAL 模式下同一时间只能有一个写者，跨进程也生效（这正好对上现在"每轮对话一个独立子进程"的真实部署形态，进程内的锁机制帮不上这里）。**验证**：写了一个受控的双线程测试直接调用 `update_inferred`，两组不同的 trait 数据都完整保留，连跑 5 次全部稳定通过。**过程中的插曲**：第一次重建镜像后测试仍然失败，排查发现是我自己 `docker compose restart` 用错了——那个命令只重启现有容器，不会切换到刚构建好的新镜像，得用 `docker compose up -d` 才会真正重建容器换新镜像；换对命令后修复立刻生效。

### 已确认可靠的部分
- **降级链路（A 组全过）**：内部 RPC 挂掉、子进程超时、两条路径同时挂，`apps/api` 都能正确 fallthrough 或优雅降级，不会崩溃/挂起，且失败检测很快（连接被拒绝时几乎瞬间返回，不是干等超时）。
- **内部 RPC 健壮性（B 组全过）**：`userId` 恶意输入（路径穿越、shell 注入、超长）全部被正则挡住且无副作用；同用户并发请求被 per-user 锁正确序列化；不同用户并发请求互不阻塞（总耗时接近单次请求耗时，不是相加）；未 provision 用户直接发请求能正确懒加载建号；并发 provision 竞态无重复/冲突。
- **认证边界（D 组全过）**：并发重复注册只有一个成功；匿名用户对话正确路由到共享 `anonymous-local` home。

### 仍然记录在案、不修的部分
- **技能隔离（E 组）**：路径穿越写入被模型判断 + 代码校验双重拦截；有意思的发现是"同名覆盖共享技能"目前完全靠模型自己的判断拒绝，代码层面没有硬性限制——技术上是可以被覆盖的，只是这次模型自己判断不该这么做。
- **H2 属主谜团已破案，结论是"我自己的锅"**：之前几次报告里说的 `root:root` 文件属主问题，追出来是因为我自己在测 A3/A4 的时候图省事用 `docker exec -d`（默认 root 身份）重启 `internal_rpc.py`，而不是走完整的 `docker compose restart`（会正确走 entrypoint.sh 的 `gosu hermes` 降权）。真实生产环境的容器永远是通过 entrypoint 正常启动的，不会有这个问题，不需要改代码。
- **H3 磁盘容量**：`models_dev_cache.json` 每账号 3.5MB 且内容完全相同（静态缓存文件），`state.db` 随对话量增长。1000 用户级别光是这个静态文件就要重复占用 ~3.5GB，是个具体的、可量化的优化空间（可以考虑共享/软链接），不紧急但值得记录。

---

## A. 降级 / 容错（P0 —— 这是 Phase 6/7 决策"永久保留旧路径"的核心承诺，从没被真实测过）

- [x] **A1. 内部 RPC 服务整个挂掉，对话应无感切回旧路径**
  步骤：`docker exec shouldi-hermes-1 pkill -f internal_rpc.py`（不重启容器，只杀这一个后台进程），确认 `curl :8643/health` 变成连接拒绝；然后正常走 `apps/api` 发一轮真实对话。
  预期：请求依然成功（走 8642 的 `api_server`），响应时间可能变化但功能不受影响；`apps/api` 日志/`hermesChatCompletion` 内部应能看到探活失败后 fallthrough。
  关联：[hermes-client.ts](../../apps/api/src/hermes-client.ts) 的 `probeInternalRpc()` + fallback 逻辑。

- [x] **A2. 内部 RPC 存活但子进程真的跑挂**（不是超时，是异常退出/被杀）
  步骤：构造一个会让 `internal_turn_runner.py` 崩溃的请求（比如极长的 `userId` 绕过校验、或者手动 kill 掉子进程 PID）。
  预期：`internal_rpc.py` 捕获到非 JSON / 非零 exit，返回 502，`hermesChatCompletion()` 自动 fallthrough 到旧路径，最终用户依然拿到正常响应。

- [x] **A3. 内部 RPC 响应超时**（比正常慢很多，但没真的挂）
  步骤：临时把 `SHOULDI_INTERNAL_RPC_TURN_TIMEOUT_S` 调很小（比如 2 秒）重启容器，发一个正常轮次。
  预期：超时后返回 504，`hermesChatCompletion()` fallthrough，不应该让整个请求卡死到 `apps/api` 自己的超时（180s）。

- [x] **A4. 两条路径同时挂**
  步骤：`internal_rpc.py` 杀掉 + 用错误的 `HERMES_API_KEY` 或直接把 8642 也堵住（比如临时改 `hermesApiBaseUrl` 指向不存在的端口）。
  预期：`apps/api` 应该返回明确的错误（`unreachable`），而不是挂起或 500 崩溃；`/v1/harmence/interview/turn` 走 `fallbackFinal()`/scripted probe 兜底逻辑（如果 `hermesIntegrated` 检测正确降级）。

---

## B. 内部 RPC 服务健壮性（P0/P1）

- [x] **B1. `userId` 恶意/异常输入**（P0，安全相关）
  步骤：直接打 `/v1/provision`、`/v1/turn`，`userId` 分别传：`../../../etc`、`; rm -rf /`、空字符串、超长字符串（200+ 字符）、包含 `/` 的路径片段。
  预期：全部应该被 `_safe_user_id()` 的正则 `[A-Za-z0-9_-]{1,128}` 拒绝，返回 400，**不应该**在文件系统上产生任何意外路径或副作用。
  关联：[internal_rpc.py](../../hermes-agent-private/gateway/internal_rpc.py) 的 `_safe_user_id`。

- [x] **B2. 同一用户并发多轮请求**（P0，验证 per-user Lock 真的在排队而不是乱序处理）
  步骤：同一个 `userId`、同一个 `sessionId`，几乎同时发两个 `/v1/turn` 请求（用 `&` 并行 curl 或写个小脚本）。
  预期：两个请求应该被 `_get_user_lock()` 串行化，不应该出现两个子进程同时写同一个 `state.db` 导致锁冲突/数据错乱；最终两条消息都应该出现在会话历史里，顺序合理。

- [x] **B3. 不同用户并发请求应该互不阻塞**（P1，性能/隔离双重验证）
  步骤：两个不同真实账号同时各发一个 `/v1/turn`，掐表看总耗时。
  预期：耗时应该接近"单个请求耗时"而不是"两个请求耗时相加"——证明不同用户的锁是分开的，没有全局串行瓶颈。

- [x] **B4. 对一个从未 provision 过的 `userId` 直接发 `/v1/turn`**（P1，验证懒加载 provision 路径，跟 signup 时的 eager provision 是两条不同代码路径）
  步骤：跳过 `/v1/auth/signup`，直接编一个新 UUID 当 `userId`，直接打 `/v1/turn`。
  预期：`handle_turn()` 里 `if not (home / "config.yaml").exists(): await asyncio.to_thread(_provision_home, ...)` 应该自动建好 home 再继续，最终请求成功；事后检查这个临时账号的 `config.yaml` 应该跟正常 signup 流程建出来的一样（`external_dirs`、`memory.provider` 都对）。

- [x] **B5. `/v1/provision` 并发调用同一个全新 `userId`**（P1，竞态条件）
  步骤：同一个从没出现过的 `userId`，几乎同时发两个 `/v1/provision` 请求。
  预期：`_provision_home()` 里的 `mkdir(parents=True, exist_ok=True)` 和 `if not config_path.exists()` 检查应该让两次调用都不报错、不产生冲突文件；`user_models` 表的种子行不应该重复插入报错（`seed_from_registration` 是 upsert 语义，应该没问题，但要实测确认 SQLite 锁竞争不会让其中一次直接 500）。

- [x] **B6. `/v1/turn` 请求体缺字段 / 格式错误**（P2）
  步骤：分别测：`messages` 是空数组、`messages` 缺失、`messages` 里最后一条不是 `user` role、请求体不是合法 JSON。
  预期：应该分别返回清晰的 400（`missing messages`/`empty_user_message`/`invalid_json`），不应该 500 或让子进程带着空输入跑起来浪费一次真实 LLM 调用。

---

## C. Session/决策数据持久化（Phase 3，P1 —— 之前只验证过单次重启，没测并发和大数据量）

- [x] **C1. 同一 ShouldI session 并发两次 `/v1/harmence/interview/turn`**
  步骤：同一个 `sessionId`，几乎同时发两个 turn 请求（模拟用户手抖点两次 / 前端重复提交）。
  预期：`harmence-interview.ts` 里 session 的 get→mutate→persist 这套逻辑目前**没有**显式的并发锁——需要实测会不会出现"后写覆盖先写"的丢消息情况，如果真的丢了，这是一个需要修的真实并发 bug，不是"预期内行为"。

- [x] **C2. Explore 卡片并发投票**
  步骤：同一张卡片，两个不同请求几乎同时 `POST /v1/explore/:id/vote`（不同 `optionId`）。
  预期：`applyExploreVote()` 是纯函数式的 read-modify-write（先 `getExploreCardRow` 再 `saveExploreCardRow`），并发场景下有丢票风险——实测确认，如果确实丢票，记录为已知问题。

- [x] **C3. 超长会话历史**
  步骤：同一个 session 连续跑 30+ 轮真实对话（可以用简短问答加速），检查 `sessions` 表里这一行 JSON blob 的大小、读写耗时是否随轮次增长明显变慢。
  预期：SQLite JSON blob 存储没有分页/流式处理，轮次很多之后每次 `saveSessionRow` 都要整体重写这个 blob——用真实数据测出大概的性能拐点在哪，供以后参考。

- [x] **C4. `decision_dna_history` 无限增长**
  步骤：给同一用户连续跑 20+ 次会触发 `addDecisionDnaUpdate` 的操作（比如反复提交 reflection）。
  预期：`listDecisionDnaHistory` 目前没有 `LIMIT`，全量返回——确认这条路径在数据量大了之后的响应体大小/耗时，评估要不要加分页。

---

## D. 认证与注册（P1）

- [x] **D1. 同一手机号并发重复注册**
  步骤：同一个 `phone`，几乎同时发两个 `/v1/auth/signup`。
  预期：SQLite 的 `UNIQUE` 约束应该让第二个失败并返回 `PHONE_TAKEN`（409），不应该出现两个 `userId` 共用一个手机号，也不应该两次都成功。

- [x] **D2. 注册成功但 provision 失败**（网络抖动模拟）
  步骤：signup 请求打进去的瞬间手动 `docker exec shouldi-hermes-1 pkill -f internal_rpc.py`，让 `provisionHermesUserHome()` 大概率失败。
  预期：signup 本身应该仍然成功（`provisionHermesUserHome` 是 `void` fire-and-forget，不应该让 signup 失败）；之后该用户第一次真实对话时，`/v1/turn` 的懒加载 provision 应该能自愈（对应 B4 的验证），确认这个自愈路径真的兜得住。

- [x] **D3. 修改密码后旧 token 是否还有效**
  步骤：登录拿 token A，改密码，再用 token A 打一个需要鉴权的接口。
  预期：JWT 是无状态签名 token，30 天有效期内**不会**因为改密码就失效（这是当前设计的已知限制，不是 bug）——需要明确记录下来，如果这不符合安全预期，是个需要讨论的产品决策而不是 bug。

- [x] **D4. 未登录（匿名）用户跑一轮真实对话**
  步骤：不带 `Authorization` header 直接打 `/v1/harmence/interview/turn`。
  预期：应该正常工作，`viewerUserId` 落到 `'anonymous-local'`，最终应该路由到内部 RPC 的共享匿名 home（`/opt/data/users/anonymous-local/`）——这个共享 home 目前**从没被专门 provision 过**，测的时候顺便确认它是不是靠懒加载自动建出来的，建出来之后是否跟真实账号的 home 结构一致。

---

## E. 技能隔离与共享（Phase 5，P1）

- [x] **E1. 用户自建技能与共享 Expert Skill 同名**
  步骤：让某账号显式创建一个叫 `salary-negotiation` 的私有技能（跟共享技能同名），内容完全不同。
  预期：`cli-config.yaml.example` 的注释写着"Local skills take precedence when names collide"——需要真实验证：这个账号后续问薪资谈判相关问题时，用的是自己新建的版本还是共享版本？这决定了"共享技能能不能被用户覆盖"这件事的真实行为，值得明确记录。

- [x] **E2. `skill_manage` 尝试写到共享目录之外的地方**
  步骤：故意 prompt 让 agent 尝试把技能写到 `/opt/hermes/shared-skills/` 或用 `../` 路径穿越。
  预期：`skill_manager_tool.py` 应该有路径校验拒绝，确认这个校验对 per-user home 的路径也生效（不只是原来单一共享 home 场景下测过）。

- [x] **E3. 共享技能内容更新后，已 provision 的老账号能不能感知到**
  步骤：改一下 `/opt/hermes/shared-skills/salary-negotiation/SKILL.md` 的内容（需要重新构建镜像），一个"老"账号（config.yaml 早就生成过）再问相关问题。
  预期：因为 `external_dirs` 是运行时读取文件系统而不是启动时拷贝快照，老账号应该能立刻用上新内容——确认这一点，这决定了以后更新 Expert Skills 内容需不需要重新 provision 所有用户（预期不需要）。

---

## F. `user_model` 推断（刚修完，P1 —— 边界条件基本没测过）

- [x] **F1. 冷启动窗口边界**
  步骤：账号刚注册（`updated_at` 是几分钟前），跑 3+ 轮真实对话触发条件，确认 1 小时内确实不推断；再等到刚好过 1 小时（或人工回拨 `updated_at` 到 59 分钟前 vs 61 分钟前两组）分别测。
  预期：边界前不推断，边界后推断，确认 `COOLDOWN_HOURS * 3600` 的比较逻辑没有 off-by-one。

- [x] **F2. `MIN_TURNS` 边界**
  步骤：分别测 2 轮（不该触发）、3 轮（该触发）真实用户对话。
  预期：`_count_user_turns(messages) < MIN_TURNS` 应该在 2 轮时拦截、3 轮时放行。

- [x] **F3. Task A / Task B 其中一个失败**
  步骤：不太好人为构造，可以看真实跑的时候 `UserModelInferrer.run()` 里 `as_completed(futures)` 那段的容错——只要有一个 task 抛异常，另一个应该照常写入。
  预期：`inferred_json` 或 `signal_vocab` 应该至少有一个字段被更新，不应该因为一个 task 失败就整体不写。

- [x] **F4. 并发多个子进程同时触发同一用户的推断**
  步骤：同一账号，两轮对话几乎同时触发 `shutdown_memory_provider`（跟 B2 场景类似，但这次关注的是 `user_models` 这一行的更新会不会互相覆盖）。
  预期：`update_inferred`/`update_signal_vocab` 都是基于 `UPDATE ... WHERE user_id = ?` 的整列覆盖式写入，不是增量 merge——并发场景下后写可能覆盖先写的部分结果，实测确认影响面。

---

## G. 跨账号安全（P0 —— 这类问题一旦真实存在就是数据泄漏级别的严重问题）

- [x] **G1. 用账号 A 的 token，构造账号 B 的 `sessionId` 去访问**
  步骤：账号 B 跑一轮对话拿到 `sessionId`，账号 A 用自己的 token 但把请求体里的 `sessionId` 换成账号 B 的那个，打 `/v1/harmence/interview/turn`。
  预期：需要确认 `handleInterviewTurn` 有没有校验"这个 sessionId 对应的 session.userId 是不是等于当前登录用户"——如果没有，这是一个真实的越权访问漏洞，账号 A 能看到/续写账号 B 的私密对话。**这条如果测出问题，是 P0 立即修复级别。**

- [x] **G2. 匿名用户的会话，登录后还能不能访问**
  步骤：不登录跑一轮对话拿 `sessionId`，然后登录（拿到 token），带 token 用同一个 `sessionId` 继续对话。
  预期：明确一下这属于设计内行为还是需要阻止的行为——如果 `session.userId` 一开始是 `undefined`，`if (userId && !session.userId) session.userId = userId;` 这行逻辑会让它"认领"到登录账号名下，需要确认这是不是预期的产品行为（比如"游客转正"）。

- [x] **G3. 决策记录 / DNA 接口越权访问**
  步骤：`GET /v1/decisions/:id`、`GET /v1/decisions/:id/lens` 这些接口传别人的 `decisionRecordId`。
  预期：这几个接口目前看代码是**没有 userId 归属校验**的（只按 `id` 查）——需要确认这是有意为之（这些记录本来就设计成半公开）还是遗漏的越权点。

---

## H. 基础设施 / 容器（P2）

- [x] **H1. `docker compose up -d hermes` 重建期间，正在进行中的对话会怎样**
  步骤：发起一个会跑比较久的真实对话（多轮工具调用），中途执行容器重建。
  预期：确认是直接连接中断报错，还是有优雅关闭窗口；这个行为决定了以后做真正的滚动发布时要不要加额外的 drain 逻辑。

- [x] **H2. `root:root` 文件属主问题复现条件排查**
  步骤：从一个全新 provision 的账号开始，只用真实 HTTP 请求路径（不要手动 `docker exec`），跑几轮真实对话，全程用 `ls -la` 跟踪每个新文件的属主，找出究竟是哪一步产生了 `root` 属主的文件。
  预期：目标是把 Phase 6-8 报告里"疑似 docker compose build/up 过程遗留"这个猜测坐实或推翻，找到真正的根因。

- [x] **H3. 磁盘用量增长速度评估**
  步骤：连续 provision 10-20 个测试账号（脚本化），每个账号跑几轮真实对话，测完统计 `/opt/data/users/` 总大小和单账号平均大小（`models_dev_cache.json` 之前看到有 3.5MB，这个文件每个账号都会有一份，需要确认它是不是可以共享/精简的）。
  预期：估算出"每 1000 个用户大概占多少磁盘"，为后续容量规划提供数据；如果 `models_dev_cache.json` 这类大文件是每账号完全重复的静态内容，可能是一个值得优化的点。

---

## 建议执行顺序

1. **先做 G 类（安全）**——如果 G1 真的有越权漏洞，这比其他任何 edge case 都紧急，应该第一个测。
2. **再做 A 类（降级）**——这是"永久保留旧路径"这个架构决策的核心承诺，必须验证它真的能兜底。
3. **然后 B、C 类（健壮性/并发）**——这些容易在真实多用户场景下暴露。
4. **D、E、F 类**——功能性边界，重要但没有 G/A 类紧急。
5. **H 类最后**——运维/容量类，不影响正确性判断。
