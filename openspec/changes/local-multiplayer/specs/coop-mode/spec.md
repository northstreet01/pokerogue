## ADDED Requirements

### Requirement: Host 权威模型
系统 SHALL 采用 Host 权威架构。Host 执行全部战斗计算（伤害、命中、特性触发），为唯一逻辑权威。Client 只负责发送己方操作指令和播放 Host 下发的战斗结果。

#### Scenario: Host 执行全部计算
- **WHEN** 战斗回合开始
- **THEN** Host 收集齐双方指令 → TurnStartPhase 执行全部 Phase → 产生 BattleEvent 序列

#### Scenario: Client 不参与计算
- **WHEN** Client 进入战斗
- **THEN** Client 的 PhaseManager 不执行计算逻辑，只播放动画 Phase。HP、状态等值由 Host 每回合下发

### Requirement: 合作模式激活
系统 SHALL 在 Host 点击开始后激活合作模式。

#### Scenario: 合作模式激活
- **WHEN** Host 发送 start 消息
- **THEN** 双方 CoopManager.active = true

### Requirement: 队伍同步
系统 SHALL 在双方完成初始宝可梦选择后，Host 将己方队伍数据发送给 Client，Client 将对方宝可梦加入本地队伍列表用于同屏显示。

#### Scenario: 交换初始队伍
- **WHEN** 双方进入第一个战斗前
- **THEN** Host 发送己方队伍完整数据（speciesId、level、stats、hp 等）给 Client，Client 创建只读副本加入本地 party

#### Scenario: 同屏显示
- **WHEN** 第一个战斗开始
- **THEN** 双方场上各有一只宝可梦，Client 可以看到 Host 宝可梦的 HP 和状态

### Requirement: 回合指令同步
系统 SHALL 由 Host 收集双方指令后统一执行回合。

#### Scenario: Host 收集指令
- **WHEN** 回合开始
- **THEN** Host 为本地宝可梦推 CommandPhase，为 Client 宝可梦推 RemoteCommandPhase（等待 Client 网络消息）
- Client 端推 CommandPhase 用于本地选择，选完后发送给 Host

#### Scenario: 指令超时
- **WHEN** Client 在 60 秒内未提交指令
- **THEN** Host 自动将 Client 宝可梦的指令设为「挣扎」

### Requirement: 回合同步 — 状态快照
系统 SHALL 在 Host 每回合结束后将战场状态快照发送给 Client。

#### Scenario: Host 下发状态快照
- **WHEN** Host 的 TurnEndPhase 完成
- **THEN** Host 打包所有宝可梦的 HP、状态异常、能力等级、昏厥标记为 TurnSnapshot，通过 Socket.io 发给 Client

#### Scenario: Client 应用状态快照
- **WHEN** Client 收到 TurnSnapshot
- **THEN** Client 直接赋值所有宝可梦的 HP / status / fainted / statStages → 触发 UI 刷新 → 进入下一回合

### Requirement: Client 端动画回放
系统 SHALL 在 Client 端播放 Host 下发的战斗事件动画。

#### Scenario: 播放技能动画
- **WHEN** Host 发送 USE_MOVE 事件
- **THEN** Client 创建 ReplayMovePhase：播放技能名称文字 + 宝可梦动画

#### Scenario: 播放伤害动画
- **WHEN** Host 发送 TAKE_DAMAGE 事件
- **THEN** Client 播放扣血数字动画，更新 HP 条

#### Scenario: 播放昏厥动画
- **WHEN** Host 发送 FAINT 事件
- **THEN** Client 播放倒下动画

### Requirement: 昏厥处理与复活
系统 SHALL 在合作模式下处理全灭与复活。

#### Scenario: 一方全灭保留
- **WHEN** 一方所有宝可梦昏厥
- **THEN** 不立即触发 GameOver，发送 faint 通知给队友

#### Scenario: 波次结束复活
- **WHEN** 幸存方击败当前波次所有敌人
- **THEN** 全灭方所有宝可梦复活至 10% HP，清除异常状态

#### Scenario: 双方全灭
- **WHEN** 双方所有宝可梦都昏厥
- **THEN** 触发 GameOver
