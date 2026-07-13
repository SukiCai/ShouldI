# ShouldI Decision Framework Library（How）（中文版）

## 目标

这份文档是 ShouldI 的“决策推理操作系统”。

底层模型可以更换，  
但框架质量必须稳定、可验证、可迭代、可复利。

---

## 1) Framework 对象规范

每个框架条目必须包含：
- 适用领域（domain）
- 适用场景（use case）
- 决策原型（decision archetype）
- 关键追问
- 必要输入
- 比较/评分方法
- 常见失败模式与偏差风险
- 输出模板
- 置信度与不确定性提示

---

## 2) 首期覆盖领域

- Career
- Money / Investing
- Entrepreneurship
- Relationships
- Health（非临床生活决策）
- Life Planning

---

## 3) Career 框架

### 3.1 BATNA（谈判替代方案）
适用：offer 谈判、跳槽谈判、角色边界谈判。

输出：
- 底线阈值
- 杠杆评估
- 谈判情景图

### 3.2 Regret Minimization（后悔最小化）
适用：不可逆或高身份相关决策。

输出：
- 短期后悔矩阵
- 长期后悔矩阵
- 非对称建议

### 3.3 Opportunity Cost Mapping（机会成本映射）
适用：多路径职业选择。

输出：
- A/B/C 权衡表
- 延迟成本
- 可逆性评分

---

## 4) Money / Investing 框架

### 4.1 Expected Value（期望值）
适用：概率型结果决策。

输出：
- 期望收益 / 期望损失
- 波动与方差提示
- EV 调整后建议

### 4.2 Risk Budgeting（风险预算）
适用：有明确回撤边界的用户。

输出：
- 最大可承受回撤
- 仓位边界
- 集中度风险提醒

### 4.3 Scenario Stress Test（情景压力测试）
适用：宏观不确定场景。

输出：
- base / bear / bull 三情景
- 触发点
- 应对动作

---

## 5) Entrepreneurship 框架

### 5.1 Asymmetric Bet Filter（非对称下注筛选）
适用：创业/加入创业公司决策。

输出：
- 上行非对称性
- 下行可生存性
- 学习价值评估

### 5.2 Founder-Role Fit（角色匹配）
适用：join vs start。

输出：
- 能力-角色匹配
- 动机持续性
- 执行差距图

---

## 6) Relationship 框架（非临床）

### 6.1 Values & Needs Alignment（价值与需求对齐）
适用：亲密关系/长期合作决策。

输出：
- 对齐项
- 冲突向量
- 必谈判项

### 6.2 Communication Pattern Audit（沟通模式审计）
适用：冲突反复出现。

输出：
- 触发器地图
- 反应循环
- 降级冲突选项

---

## 7) 通用元框架（Universal Meta-Frameworks）

### 7.1 Reversibility（可逆性）
决策是否可逆？

可逆：倾向快速行动 + 快速反馈。  
不可逆：倾向更深尽调与慢决策。

### 7.2 Time Horizon Split（时间维度拆分）
至少评估：
- 1 个月
- 1 年
- 5 年

### 7.3 Confidence Calibration（置信校准）
必答三问：
- 我到底有多确定？
- 什么证据会推翻我？
- 我缺了什么关键信息？

---

## 8) Behavioral Overlay（行为偏差覆盖层）

每次框架运行，都要检查：
- 损失厌恶
- 确认偏差
- 计划谬误
- 过度自信
- 现状偏差
- 沉没成本牵引

目的：
在输出建议前，插入“反偏差追问”。

---

## 9) 框架质量门槛

框架成立的必要条件：
- 能提升不确定场景下的清晰度
- 能输出可行动结果
- 假设显式化
- 权衡显式化
- 支持后续结果复盘

---

## 10) 迭代流程（Framework Compounding）

1. 框架上线  
2. 收集决策结果  
3. 做校准分析  
4. 提交框架更新建议  
5. 版本升级与变更记录

这条迭代链路是 ShouldI 长期能力复利的核心之一。
