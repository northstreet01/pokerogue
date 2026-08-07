## ADDED Requirements

### Requirement: PvP 触发条件
系统 SHALL 在指定节点自动触发 PvP 对决。

#### Scenario: BOSS 关后触发
- **WHEN** 双方共同击败第 10、20、30...波 BOSS（每 10 波）
- **THEN** 系统显示"环节对决！"提示，双方队伍满血恢复，进入 PvP 对战准备

#### Scenario: 道馆战后触发
- **WHEN** 双方击败道馆训练师
- **THEN** 系统触发 PvP 对决（道馆额外奖励加成）

#### Scenario: 玩家可选择跳过
- **WHEN** PvP 触发后
- **THEN** 双方看到 10 秒确认窗口，任一方可投票"跳过对决"，若双方都同意则跳过

### Requirement: PvP 对战规则
系统 SHALL 在 PvP 对决中采用纯宝可梦对战规则。

#### Scenario: 满血恢复
- **WHEN** PvP 对决开始
- **THEN** 双方队伍中所有宝可梦 HP、PP、状态异常全部恢复

#### Scenario: 单打规则
- **WHEN** PvP 对战中
- **THEN** 采用 1v1 单打规则，先派遣一只宝可梦，一方全部阵亡即对战结束

#### Scenario: 禁用道具
- **WHEN** PvP 对战进行中
- **THEN** 双方不可使用背包道具（伤药、精灵球等），仅可使用宝可梦技能和替换

#### Scenario: 等级归一化（可选）
- **WHEN** 双方队伍等级差距超过 10 级（设置中开启"PvP 等级平衡"）
- **THEN** 系统将双方宝可梦临时调整至较低方的平均等级

### Requirement: PvP 指令同步
系统 SHALL 在 PvP 回合中同步双方的 TurnCommand。

#### Scenario: 双盲选择
- **WHEN** PvP 回合开始
- **THEN** 双方各自选择技能/替换目标，选择完毕后指令同时发送，收到双方指令后开始执行

#### Scenario: 超时处理
- **WHEN** 一方在 60 秒内未选择
- **THEN** 系统自动为该方选择"使用第一个可用技能攻击对方"

### Requirement: PvP 奖励
系统 SHALL 在 PvP 结束时给予胜者奖励。

#### Scenario: 胜者获得奖励
- **WHEN** PvP 对决结束，一方所有宝可梦昏厥
- **THEN** 胜者获得：① 随机稀有道具一个（传说级/金色道具概率提升）② 额外金钱（等于当前波次 × 100）③ 败者无惩罚

#### Scenario: 连胜奖励
- **WHEN** 同一玩家连续赢得 3 场以上 PvP
- **THEN** 系统触发「连胜加成」：额外获得一只随机传说宝可梦的捕获机会

#### Scenario: 对战结算 UI
- **WHEN** PvP 对决结束
- **THEN** 系统显示结算界面：双方剩余宝可梦、奖励内容、"继续闯关"按钮

### Requirement: PvP 后恢复
系统 SHALL 在 PvP 结束后恢复双方队伍至对决前状态。

#### Scenario: 状态回滚
- **WHEN** PvP 对决结束后进入下一波
- **THEN** 双方队伍恢复到 PvP 前的 HP/PP/状态（仅奖励生效，对战消耗不保留）
