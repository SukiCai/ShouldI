# 注册流程 + 分步资料采集 —— 设计文档

> 状态：设计阶段，尚未开始实现。本文档基于和产品负责人对齐过的 7 个决策点（见「已确认的产品决策」）。带 **[建议，待确认]** 标记的部分是我基于现有代码给出的技术方案，还没有明确拍板，doc review 时请重点看这些。

---

## 1. 目标

现有注册只收集手机号 + 密码，一步到位。这次要做两件事：

1. 把「建账号」这一步做得更轻——手机号或邮箱二选一 + 密码（两遍确认），加上必要的验证码校验。
2. 把「资料采集」（显示名、职业身份、公司/组织、工作年限、行业）挪到账号建好、已登录之后的独立页面，全部可跳过，减少注册路径上的输入负担。

同时顺手补两个已经发现的缺口：
- Hermes 侧 `user_models.profile_json` 设计上等着 `role`/`domain`/`years_experience`/`industry` 四个字段，但 `seedHermesUserModel()` 现在永远传空 `{}`（见 [hermes-client.ts:255](apps/api/src/hermes-client.ts#L255)）——这次把真实数据接上。
- 账号层面完全没有存储用户惯用语言，是此前那个「对话中途切英文」bug 的根因之一——这次加一个 `locale` 字段。

## 2. 现状（已核实）

### 2.1 前端注册流程

`apps/mobile/app/sign-up.tsx` 已经是单屏多步结构：本地 `step: 'phone' | 'password'` state，共用 `GenZAuthChrome` 壳（OLED hero 动画、notch sheet、docked CTA、上滑切到 sign-in）。字段组件在 [AuthCredentialFields.tsx](apps/mobile/components/auth/AuthCredentialFields.tsx)：`AuthPhoneField`、`AuthPasswordField`。**当前没有密码确认字段，没有邮箱选项，没有验证码环节。**

### 2.2 后端认证

- `apps/api/src/auth.ts`：`signUp(phoneRaw, password)` 只接受这两个参数，`normalizePhone()` 强制 E.164 格式。
- `apps/api/src/db.ts`：`users` 表 = `id, phone (UNIQUE NOT NULL), password_hash, token_version, created_at`。没有 email、没有 profile 字段、没有验证状态。
- 注册成功后触发两个 best-effort 调用（[index.ts:87-95](apps/api/src/index.ts#L87-L95)）：`provisionHermesUserHome(userId)`（建 per-user HERMES_HOME）、`seedHermesUserModel(userId)`（当前 `profile` 参数永远是 `{}`）。

### 2.3 Hermes 侧的个性化设计（这次要接上的部分）

`user_models` 表（[hermes_state.py:252-259](hermes-agent-private/hermes_state.py#L252-L259)）：`profile_json`（注册资料）、`inferred_json`（对话中自动推断，开放式 field，不归这次管）、`signal_vocab`（触发词表，同样是自动推断）。

`UserModelStore.get_compressed_context()`（[store.py:328-366](hermes-agent-private/plugins/memory/user_model/store.py#L328-L366)）明确会拼这句话塞进系统提示词：
```
User: {role} at {domain}, {years_experience} years ({industry}).
```
四个字段名是现成的，不用我们发明。

---

## 3. 已确认的产品决策

1. 唯一标识改成「手机号或邮箱二选一」，**两者都要验证**（写验证流程进本文档）。
2. Step 2 里除 `displayName` 必填外，`role`/`domain`/`years_experience`/`industry` **各自独立可选**。
3. 跳过 Step 2 → 账号标记「资料不完整」，之后在某个时机（首次进 Profile 页 / 用了 N 次之后）二次提醒去补。
4. Step 2 放在**账号已创建、已登录之后**的独立路由，不塞进注册的事务性步骤里。
5. `role`/`industry` 选项列表要**贴合 ShouldI 实际用户画像**（国际学生、早期职业、PM、移民相关决策），不是泛用 LinkedIn 式选项。
6. 加 `locale` 字段，**从设备系统语言自动默认，不强制用户手动选**。
7. 现有 15 个测试账号不用做迁移/补全。

---

## 4. 整体流程设计

```
┌─ Step 1：建账号（GenZAuthChrome，事务性，不完成不算数）──────────┐
│  1a. 标识符：Phone / Email 切换 tab + 对应输入框                  │
│  1b. 密码 + 确认密码（两遍一致才能继续）                          │
│  1c. 验证码：发到你选的那个标识符，输入 6 位码 → 校验通过才建账号   │
└───────────────────────────────────────────────────────────────┘
                              ↓ 账号已创建 + 已登录
┌─ Step 2：资料采集（新路由 /onboarding/profile，可跳过）──────────┐
│  displayName（必填）                                            │
│  role（预设选项 + Other 手打）                                   │
│  domain 公司/学校（文本，可选）                                  │
│  years_experience（区间选择：0-1 / 1-3 / 3-5 / 5-10 / 10+）      │
│  industry（预设选项 + Other 手打）                                │
│  [Skip for now] / [Save]                                       │
└───────────────────────────────────────────────────────────────┘
                              ↓
                     进入 App（explore 首页）
```

locale 不出现在任何表单里——注册成功那一刻用 `expo-localization` 之类的 API 静默读设备语言，作为 Step 1 提交请求的一部分一起传给后端，用户完全无感知。**[建议，待确认]** 之后如果想让用户手动改，在 Settings 里加一个覆盖项就行，这次不做。

---

## 5. Schema 变更 **[建议，待确认]**

### 5.1 `users` 表

```sql
ALTER TABLE users ADD COLUMN email TEXT;
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
-- phone 从 NOT NULL 改成可空 —— sqlite 不支持直接改列约束，需要建新表迁移
ALTER TABLE users ADD COLUMN phone_verified_at INTEGER;
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
ALTER TABLE users ADD COLUMN locale TEXT;
```
应用层校验：`phone IS NOT NULL OR email IS NOT NULL`（sqlite CHECK 约束配合两个可空唯一列做起来别扭，放应用层校验 + 唯一索引更简单可靠）。

`phone` 从 `NOT NULL` 改可空这一步，sqlite 需要「建新表 → 拷数据 → 换名」的标准迁移三部曲（`ALTER TABLE ... DROP CONSTRAINT` 不存在），会写成一次性 migration，仿照 [db.ts:95-106](apps/api/src/db.ts#L95-L106) 已有的迁移模式（探测列是否存在，条件执行）。

### 5.2 新建 `user_profiles` 表

**[建议，待确认——这是我的技术选型，不是产品决策]** 建议单独一张表，不往 `users` 上加列：认证信息和资料信息分开，以后加字段不用碰认证表，风险面更小。

```sql
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id           TEXT PRIMARY KEY,
  display_name      TEXT,
  role              TEXT,
  domain            TEXT,
  years_experience  TEXT,   -- 存区间字符串（"1-3"），不是数字
  industry          TEXT,
  completed_at      INTEGER,  -- NULL = 还没走过 Step 2 / 跳过了
  updated_at        INTEGER NOT NULL
);
```
`completed_at` 就是「资料是否完整」的判定字段——`displayName` 存在即视为至少走过一次（哪怕其他字段都跳过了，因为 displayName 必填）。

### 5.3 验证码表

```sql
CREATE TABLE IF NOT EXISTS verification_codes (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  channel       TEXT NOT NULL,  -- 'phone' | 'email'
  code_hash     TEXT NOT NULL,  -- 不存明文
  expires_at    INTEGER NOT NULL,
  consumed_at   INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0
);
```
6 位数字码，5-10 分钟过期，失败次数上限（比如 5 次）防暴力破解，这些都是标准做法，doc 里先占位，具体参数实现时定。

---

## 6. 验证码发送 —— 未决的外部依赖 **[需要你决定，不是我能定的]**

现在项目里**没有任何 SMS 或邮件发送能力**，这是新引入的外部依赖，会阻塞「验证」这个需求：

- **短信**：需要选一个 SMS 网关（Twilio / 阿里云短信 / 等），涉及账号注册、计费、国际号码覆盖范围
- **邮件**：需要一个事务邮件服务（Postmark / Resend / SES），涉及发件域名 SPF/DKIM 配置

这两个选型我建议你来定（可能有公司已有的账号/合同关系,或者对成本、覆盖地区有偏好）,定完我再把发送逻辑接进 `verification_codes` 表的校验流程里。**在选型定下来之前，这部分可以先用「开发环境把验证码打印到日志里」的方式跑通其余所有逻辑，不阻塞其他部分的开发。**

---

## 7. 前端设计

### 7.1 复用现有组件，新增部分

- `GenZAuthChrome` 不用改——它本来就是「壳 + 可变 children」的设计，`compact` 模式也已经支持无 hero 的表单场景，Step 2 页面直接复用同一套视觉语言。
- 新增 `AuthEmailField`（参照 `AuthPhoneField` 的写法，输入校验换成 email 格式）。
- 新增一个 identifier 切换 tab（Phone / Email 两个 segment），复用 `AuthFields.controlFocused` 之类的既有 focus 态 token，视觉上和现有 pill 风格保持一致。
- `AuthPasswordField` 复用两次做「密码」+「确认密码」，`onFooterPress` 校验时加一条「两次密码是否一致」。
- 新增验证码输入组件（6 个格子的 OTP 输入，这类组件市面上模式很成熟，找一个现成的 RN OTP input 或手写 6 个 `TextInput` 拼起来都行）。

### 7.2 Step 2 表单

- `years_experience`、`role`、`industry` 的选择题形式：**[建议，待确认]** 参考 `DecideInterviewChoicePrompt` 里已经在用的按钮式选项 UI（`apps/mobile` 里已经有这一整套「选项 chip/按钮」的视觉语言，用在决策访谈的 choicePrompt 里），风格上和 App 里其他"选择题"体验保持一致，不用新发明一套。
- `role`/`industry` 选项列表初稿（**这部分需要你过一遍定稿，我先给一版贴合 ShouldI 用户画像的草案**）：
  - role：在读学生（本科）/ 在读学生（研究生·博士）/ 应届 · 早期职业（0-2年）/ 资深专业人士 / Career switcher / Other
  - industry：Tech / Finance / Consulting / Healthcare / Academia · Research / Other

### 7.3 「资料不完整」提醒

- Profile（`you.tsx`）页面：`completed_at IS NULL` 时，在 `YouProfileHero` 下方插一条可关闭的 banner——「完善资料，让 ShouldI 更懂你」，点击跳 `/onboarding/profile`。
- 二次提醒：**[建议，待确认]** 用现有 `decision_records` 表按 `user_id` 数出已完成决策数，达到某个阈值（比如 3 个）且 `completed_at` 仍为空时，用一次性的 in-app 提示（不是 push）再问一遍，之后不再重复打扰（本地记一个「已经问过第二次」的标记，避免每次打开都弹）。

---

## 8. 后端 API 变更

| 端点 | 变化 |
|---|---|
| `POST /v1/auth/signup` | 请求体从 `{phone, password}` 变成 `{identifier: {type: 'phone'\|'email', value}, password, locale}`；响应新增 `verificationRequired: true` |
| `POST /v1/auth/verify-code`（新增） | `{userId, code}` → 校验通过后 `phone_verified_at`/`email_verified_at` 写入，账号转为可用状态 |
| `POST /v1/auth/resend-code`（新增） | 限流（比如 60 秒一次），重发验证码 |
| `GET /v1/profile`（新增） | 读当前用户的 `user_profiles` 行 |
| `PATCH /v1/profile`（新增） | Step 2 表单提交 / 之后在 Settings 修改都走这个；写入后同步调 `seedHermesUserModel(userId, {role, domain, years_experience, industry})`（这次终于传真实数据了）|

`signIn` 需要同时支持手机号或邮箱作为登录标识（查 `users` 表时 `WHERE phone = ? OR email = ?`）。

---

## 9. 分阶段实施计划（建议顺序）

1. **Schema + 后端基础**：`users` 表迁移（email/verified_at/locale 列）、新建 `user_profiles`、`verification_codes` 表，`auth.ts` 支持双标识符 + 验证码校验逻辑（先接「打日志代替真发送」的验证码通道）
2. **Step 1 前端**：identifier 切换 tab、密码确认、验证码输入页，接通新版 `/v1/auth/signup` + `/v1/auth/verify-code`
3. **Step 2 前端 + 后端**：`/onboarding/profile` 路由、`GET/PATCH /v1/profile`、`seedHermesUserModel` 接上真实 profile
4. **资料不完整提醒**：Profile 页 banner + 二次提醒逻辑
5. **短信/邮件真实发送接入**（依赖你定的服务商选型，可以和 1-4 并行推进，最后接线）

---

## 10. 验收标准

- [ ] 用户可以用手机号或邮箱注册，二选一即可，密码需要两次输入一致
- [ ] 注册后必须完成验证码校验，账号才算激活（`phone_verified_at`/`email_verified_at` 非空）
- [ ] Step 2 全部可跳过；跳过后 `user_profiles.completed_at` 为空
- [ ] 只填 displayName、跳过其他字段，也能正常完成 Step 2
- [ ] role/domain/years_experience/industry 一旦提交，`seedHermesUserModel` 携带真实数据打到 Hermes，`user_models.profile_json` 里能查到
- [ ] 未完成资料的账号，首次进 Profile 页能看到提醒 banner；用满 N 个决策后如果还没补，能收到一次二次提醒，且不重复打扰
- [ ] 视觉上 Step 1/Step 2 都复用 `GenZAuthChrome` 的现有风格（OLED hero、notch sheet、docked CTA），没有另起一套视觉语言
- [ ] 老的 15 个测试账号不受影响，`phone` 列迁移后原有数据完整
