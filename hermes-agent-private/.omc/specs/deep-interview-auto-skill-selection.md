# Deep Interview Spec: Hermes Agent Auto Skill Selection

## Metadata
- Interview ID: hermes-auto-skill-2026-0513
- Rounds: 8
- Final Ambiguity Score: 14%
- Type: brownfield
- Generated: 2026-05-13
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.92 | 35% | 0.322 |
| Constraint Clarity | 0.82 | 25% | 0.205 |
| Success Criteria | 0.80 | 25% | 0.200 |
| Context Clarity (brownfield) | 0.88 | 15% | 0.132 |
| **Total Clarity** | | | **0.859** |
| **Ambiguity** | | | **14%** |

## Goal

让 Hermes agent 根据用户的职业背景和当前聊天内容，自动以**静默注入**的方式选择并激活合适的职业角色 skill（personas）和主题 skill，使 agent 在回答问题时能够代入用户的职业背景、使用恰当的术语和思维框架，同时主动发现并提示相关 skill。

核心原则：**聊天导向，而非任务执行导向** — skills 的目的是让 agent 更像"同行专家"，而不是执行特定工作流。

## Constraints

- **多用户架构**：不需要每用户一个 agent，Hermes Gateway 已通过 `user_id` 实现多用户隔离
- **用户背景来源**：从 UserModel SQLite（plugin memory layer）读取，不依赖 USER.md（USER.md 是全局单文件，不适合多用户 app 场景）
- **系统提示冻结约束**：Hermes 系统提示在会话开始时冻结，静态 persona 必须在会话初始化时注入；动态主题 skill 通过 per-turn context block 实现
- **MVP 优先**：第一阶段用简单关键词匹配选择动态 skill，验证可行后再升级到 LLM 分类
- **Skill 来源**：从 [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) 的 `agents/personas/` 目录搬运并按 Hermes SKILL.md 格式调整，不从零编写
- **现有架构不破坏**：手动 `/skill-name` 命令和现有 28 个任务 skill 的调用路径保持不变

## Non-Goals

- 不替换现有手动 `/skill-name` 命令触发机制
- 不修改 USER.md 的结构（保留为单用户场景的可选配置）
- 不引入独立的 embedding 服务或向量数据库（MVP 阶段）
- 不改变现有 28 个任务 skill 的内容
- 不为不同用户创建独立的 agent 实例

## Acceptance Criteria

- [ ] **静态 Persona 注入**：会话开始时，从 UserModel SQLite 读取用户职业（role）和信号词（signal_terms），自动选择对应的职业角色 skill，注入到系统提示中。前端工程师问 React 问题时，agent 回答使用前端视角和术语，无需额外解释基础概念。
- [ ] **动态主题 Skill 注入**：每次用户发消息时，分析消息内容（关键词匹配），选择 0-2 个最相关的主题 skill，以 per-turn context block 方式附加在用户消息前。
- [ ] **关键词学习更新**：对话中出现新的技术关键词（如 "Zustand"、"GraphQL"），通过现有 UserModel 的 `on_session_end` 钩子更新用户的 signal_terms，下次会话生效。
- [ ] **主动 Skill 发现提示**：agent 在回答后，若检测到相关的、当前未激活的 skill，主动以一行提示告知用户（如"另外，你可能需要 /performance-optimization skill 来处理这个场景"）。
- [ ] **多用户隔离**：不同 user_id 的用户使用不同的 PersonaSkill，互不影响。
- [ ] **无感知**：用户看不到 skill 选择过程，只感受到回答质量的提升。
- [ ] **降级安全**：UserModel 数据不存在时（新用户），系统正常工作，不注入任何 persona。

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| "自动触发"指什么 | 是全自动还是提示用户选择？ | 静默注入，用户无感知 |
| USER.md 是否需要 | USER.md 是单文件，适合多用户吗？ | 跳过 USER.md，使用 UserModel SQLite |
| 每用户需要独立 agent？ | Gateway 能否隔离多用户？ | 不需要，Gateway 已有 user_id 隔离 |
| "多 skill 并发"的含义 | 是同时执行多个 skill 工作流吗？ | 不是，是静态 persona + 动态主题 两层注入 |
| skill 内容来源 | 是否有现成的聊天导向职业 skill？ | 是，alirezarezvani/claude-skills 有现成 personas |
| 成功标准 | 用户如何感知改进？ | 更深的专业建议 + 主动提示相关 skill |

## Technical Context

### 现有代码库集成点

**文件** | **作用** | **修改点**
--- | --- | ---
`agent/prompt_builder.py` | 构建系统提示（含 skill 索引） | 在会话初始化时读取 UserModel，注入 persona skill 内容块
`plugins/memory/user_model/provider.py` | UserModel SQLite 提供者 | 读取 `role`, `signal_terms` 用于 persona 选择；`on_session_end` 钩子更新新关键词
`gateway/run.py` | 消息路由，含 user_id 传递 | 在 per-turn 消息处理前插入动态 skill context block
`agent/skill_commands.py` | Skill 发现和索引 | 新增 persona skill 分类，不影响现有路由
`tools/skills_hub.py` | agentskills.io 集成 | 可复用来发现 openclaw 上的 persona skills

### UserModel 现有数据结构（SQLite）
```
user_id, role, domain, experience_level, communication_style, signal_terms (JSON array)
```
所有字段均为异步 LLM 推断结果，会话结束时写入，冷却期 1 小时。

### Skill 注入机制（两层）

**层 1 — 静态 Persona（会话初始化时）：**
```
UserModel.role = "frontend_engineer"
→ 加载 ~/.hermes/skills/personas/frontend-engineer/SKILL.md
→ 注入到 system prompt 的 [user_background] 块
```

**层 2 — 动态主题（per-turn context block）：**
```
用户消息: "帮我优化这个 useEffect 依赖数组"
→ 关键词匹配: ["useEffect", "dependency"] → software-development skill
→ 在用户消息前追加:
  [context: software-development skill 相关内容片段]
  [user message]
```

### Persona Skill 来源
- 主要：[alirezarezvani/claude-skills/agents/personas/](https://github.com/alirezarezvani/claude-skills/tree/main/agents/personas)
  - Content Strategist, Product Manager, DevOps Engineer, Finance Lead, Senior Data Engineer
  - 按 Hermes SKILL.md YAML frontmatter 格式调整
- 参考：[openclaw/skills](https://github.com/openclaw/skills) 的 persona 类别

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| User | core domain | user_id, role, experience_level, signal_terms | has one UserProfile |
| UserProfile | supporting | role, domain, signal_terms, communication_style | stored in UserModel SQLite |
| PersonaSkill | core domain | name, content, job_roles[] | injected into SystemPrompt at session start |
| TopicSkill | core domain | name, keywords[], content_excerpt | injected per-turn based on ConversationContext |
| SkillSelector | supporting | persona_map, keyword_index | maps UserProfile→PersonaSkill, message→TopicSkill |
| PerTurnContext | supporting | selected_skills[], message_prefix | prepended to user message each turn |
| SystemPrompt | supporting | frozen_at_session_start, persona_block | contains PersonaSkill content |
| SignalTerms | supporting | terms[], user_id | updated by UserModel on_session_end |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 4 | 4 | - | - | N/A |
| 2 | 5 | 1 | 0 | 4 | 80% |
| 3 | 6 | 1 | 0 | 5 | 83% |
| 4 | 8 | 2 | 0 | 6 | 75% |
| 5 | 8 | 0 | 2 | 6 | 100% |
| 6 | 7 | 0 | 0 | 7 | 100% |
| 7 | 8 | 1 | 0 | 7 | 87% |
| 8 | 8 | 0 | 0 | 8 | 100% |

## Implementation Plan (Simple-First)

### Phase 1: Persona Skill 库搭建
1. 从 `alirezarezvani/claude-skills/agents/personas/` 下载 5+ 职业角色文件
2. 转换为 Hermes SKILL.md 格式，存入 `~/.hermes/skills/personas/`
3. 在 `skill_commands.py` 中新增 `persona` 分类标记

### Phase 2: 静态 Persona 注入
1. 在 `prompt_builder.py` 的会话初始化阶段，读取 UserModel SQLite 的 `role` 字段
2. 建立 role → persona skill 映射表（简单字典）
3. 加载对应 SKILL.md 内容，注入 system prompt

### Phase 3: 动态主题 Skill 注入
1. 在 `gateway/run.py` 的 per-turn 处理中，对用户消息做关键词匹配
2. 与现有 28 个 skill 的 description 关键词比对
3. 选择得分最高的 1-2 个 skill，截取关键内容块
4. 以 context block 格式追加在用户消息前

### Phase 4: 关键词学习 + Skill 发现提示
1. 扩展 UserModel `on_session_end` 钩子，提取本次对话新出现的技术词汇
2. 追加到 `signal_terms`，供下次会话使用
3. 在 agent 系统提示中添加"主动提示相关 skill"规则（1 行 prompt 修改）

## Interview Transcript

<details>
<summary>Full Q&A (8 rounds)</summary>

### Round 1
**Q:** 当你说「自动触发 skill」时，你期望的是哪种行为模式？
**A:** 静默注入 — agent 在后台把相关 skill 的提示词/知识注入到对话上下文里，用户感知不到，但回答风格和深度变化
**Ambiguity:** 70% (Goal: 0.35, Constraints: 0.20, Criteria: 0.20, Context: 0.55)

### Round 2
**Q:** 「多个 skills 同时发力」具体指的是哪种场景？
**A:** 分层注入 — 用户背景信息永远在线（常驻内容），专题 skills 动态注入（对话相关时）
**Ambiguity:** 57% (Goal: 0.55, Constraints: 0.35, Criteria: 0.25, Context: 0.60)

### Round 3
**Q:** 如果这个功能做好了，你怎么判断它工作正确？
**A:** 更深的专业建议（知道用户是专家，跳过基础解释）+ 主动识别还有哪些 skill 可用
**Ambiguity:** 44% (Goal: 0.65, Constraints: 0.40, Criteria: 0.55, Context: 0.65)

### Round 4 [Contrarian Mode]
**Q:** 用户背景信息从哪里来？（发现 USER.md 已存在但是单文件全局设计）
**A:** 有额外的 memory layer，想先理解现有机制再决定
**Ambiguity:** 38% → 探索代码库，发现 UserModel SQLite 层和 USER.md 分离设计

### Round 5
**Q:** 系统提示冻结约束 — 静态 vs 动态，你希望哪种架构？
**A:** 两层方案 — 会话开始注入静态背景 skills，per-turn 动态补充主题 skill
**Ambiguity:** 30% (Goal: 0.80, Constraints: 0.60, Criteria: 0.60, Context: 0.80)

### Round 6 [Simplifier Mode]
**Q:** 「前端工程师 skill」指的是哪类 skill 内容？现有 28 个是任务导向的
**A:** 聊天导向的职业角色 skill — 帮 agent 理解职业背景、术语、思维框架，而非执行工作流。GitHub 有现成的吗？
**Ambiguity:** 26% → 找到 alirezarezvani/claude-skills 的 personas 目录

### Round 7
**Q:** 当系统决定注入哪个 skill 时，如何匹配？
**A:** 同意先简单后智能。另：app 用户注册有职业信息，plugin memory layer 有推断数据，是否需要每用户一个 agent？
**Ambiguity:** 22% → 解释 Gateway 多用户隔离，不需要每用户一个 agent

### Round 8
**Q:** App 用户职业信息如何传给 agent？想先实现哪些能力？
**A:** Plugin memory layer 已包含（UserModel SQLite），无需额外传递。全部 4 个能力都要。
**Ambiguity:** 14% ✓

</details>

---

Sources:
- [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills)
- [openclaw/skills - ai-persona-os](https://github.com/openclaw/skills/blob/main/skills/jeffjhunter/ai-persona-os/SKILL.md)
- [acnlabs/OpenPersona](https://github.com/acnlabs/OpenPersona)
