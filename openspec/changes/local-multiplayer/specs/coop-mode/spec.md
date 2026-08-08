## ADDED Requirements

### Requirement: 合作模式激活
系统 SHALL 在 Host 点击开始后激活合作模式。CoopManager 为单例，状态在整个游戏流程中保持。

#### Scenario: 合作模式激活
- **WHEN** Host 发送 start 消息
- **THEN** 双方 CoopManager.active = true，RNG 种子同步

### Requirement: 队伍同步
系统 SHALL 在双方完成初始宝可梦选择后交换队伍数据，使场上同时显示双方的宝可梦。

#### Scenario: 交换初始队伍
- **WHEN** 双方进入第一个战斗前（TitlePhase.end 阶段）
- **THEN** 系统推送 CoopPartySyncPhase：发送己方队伍数据，接收对方队伍数据，将对方宝可梦加入己方队伍列表

#### Scenario: 同屏显示
- **WHEN** 第一个战斗开始
- **THEN** 双方场上各有一只宝可梦（共两只），玩家只能为自己的宝可梦选择指令

### Requirement: 回合同步
系统 SHALL 在合作战斗中等双方都提交指令后才执行回合。

#### Scenario: 发送本地指令
- **WHEN** 玩家为自己的宝可梦选择技能
- **THEN** CommandPhase 正常处理，turnCommands[己方位] 被设置

#### Scenario: 交换指令
- **WHEN** 双方 CommandPhase 全部完成
- **THEN** CoopSyncPhase 发送本地指令给对方，接收对方指令填入 turnCommands[对方位]，双方指令到齐后 TurnStartPhase 执行回合

#### Scenario: 超时处理
- **WHEN** 一方在 60 秒内未提交指令
- **THEN** 该玩家宝可梦自动使用「挣扎」（Struggle），回合继续

### Requirement: 昏厥处理与复活
系统 SHALL 在全灭时不立即 GameOver，而是等待队友清完当前波次后复活。

#### Scenario: 一方全灭
- **WHEN** 一方所有宝可梦昏厥
- **THEN** FaintPhase 检测 CoopManager 激活 → 发送 faint 消息给队友 → 不触发 GameOver

#### Scenario: 波次结束复活
- **WHEN** 幸存方击败当前波次所有敌人
- **THEN** CoopRevivalPhase 将全灭方所有宝可梦复活至 10% HP，清除异常状态

#### Scenario: 双方全灭
- **WHEN** 双方所有宝可梦都昏厥
- **THEN** 触发 GameOver，游戏结束

### Requirement: 经验与奖励分配
系统 SHALL 在合作模式下公平分配战斗奖励。

#### Scenario: 经验平分
- **WHEN** 敌方宝可梦被击败
- **THEN** 双方参战宝可梦各获得一半经验值

#### Scenario: 道具轮流选择
- **WHEN** 战斗结束后掉落多个道具
- **THEN** 按 A→B→B→A 顺序轮流选择
