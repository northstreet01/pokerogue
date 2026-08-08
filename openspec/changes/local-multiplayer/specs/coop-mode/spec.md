## ADDED Requirements

### Requirement: Host 权威模型
系统 SHALL 采用 Host 权威架构。Host 执行全部战斗计算（伤害、命中、特性触发、先后手），为唯一逻辑权威。Client 只发送己方指令并播放 Host 下发的回合结果。借鉴 Colyseus UNO Demo 的 `handlePlayCard()` 权威验证链模式。

#### Scenario: Host 为唯一计算源
- **WHEN** 战斗回合开始
- **THEN** Host 收集双方指令 → TurnStartPhase 执行全部 Phase → 产生 TurnResult
- Client 不执行任何计算 Phase

#### Scenario: Client 为渲染终端
- **WHEN** Client 进入战斗
- **THEN** Client 的 PhaseManager 只播放动画 Phase，HP/状态等值由 Host 每回合下发

### Requirement: 合作模式激活
系统 SHALL 在大厅连接完成后由 Host 触发合作模式。

#### Scenario: Host 触发开始
- **WHEN** Host 在大厅中按 Enter
- **THEN** 发送 `{ type: "start", seed }` 给 Client，双方 CoopManager 激活，双方回标题画面

### Requirement: 队伍同步
系统 SHALL 在双方完成初始宝可梦选择后，Host 将己方队伍数据发送给 Client 用于同屏显示。

#### Scenario: 初始队伍交换
- **WHEN** TitlePhase.end() 推送 CoopPartySyncPhase
- **THEN** Host 发送己方队伍完整数据给 Client，Client 将对方宝可梦加入本地 party（只读副本）

#### Scenario: 同屏战斗
- **WHEN** 第一个战斗开始
- **THEN** 双方场上各有一只宝可梦（共两只），玩家只能为己方宝可梦选择指令

### Requirement: 回合指令收集
系统 SHALL 由 Host 收集双方指令后统一执行回合。借鉴 UNO 的 `scheduleTurn()` + `turnDeadline` 模式。

#### Scenario: Host 本地指令
- **WHEN** 回合开始（TurnInitPhase）
- **THEN** Host 为己方宝可梦推 CommandPhase（本地 UI 选择）
- Host 为 Client 宝可梦推 RemoteWaitPhase（等待 Client 网络消息）

#### Scenario: Client 远程指令
- **WHEN** Client 端回合开始
- **THEN** Client 推 CommandPhase 用于本地 UI 选择，选完后通过 `sendAction()` 发给 Host

#### Scenario: 超时处理（UNO `BOT_TURN_DELAY` 模式）
- **WHEN** Client 在 60 秒内未提交指令
- **THEN** Host 自动将 Client 宝可梦设为「挣扎」，回合继续执行

### Requirement: 回合同步 — TurnSnapshot
系统 SHALL 在 Host 每回合执行完毕后将战场状态打包发送给 Client。

#### Scenario: Host 下发 TurnSnapshot
- **WHEN** Host 的 TurnEndPhase 完成
- **THEN** Host 打包 `TurnSnapshot`（所有宝可梦 HP、状态异常、能力等级、昏厥标记、战斗消息文本），通过 Socket.io 发给 Client

#### Scenario: Client 应用 TurnSnapshot
- **WHEN** Client 收到 TurnSnapshot
- **THEN** 直接赋值所有宝可梦的 HP / status / fainted / statStages，触发 UI 刷新，进入下一回合指令选择

### Requirement: TurnSnapshot 数据结构
系统 SHALL 使用以下格式进行回合结果同步。

```typescript
interface TurnSnapshot {
  turn: number;
  pokemon: Array<{
    index: number;           // BattlerIndex 位置 (0-3)
    hp: number;              // 当前 HP
    maxHp: number;           // 最大 HP
    status: string | null;   // 状态异常 (PARALYZED/BURNED/...)
    fainted: boolean;        // 是否昏厥
    statStages: number[];    // [atk, def, spatk, spdef, spd] 能力等级 (-6 ~ +6)
  }>;
  messages: string[];        // 战斗文本序列（"效果拔群！"、"击中要害！"等）
}
```

### Requirement: Ghost 远程玩家渲染（借鉴 Dead Cells "Ghost" 系统）
系统 SHALL 将对方玩家的宝可梦作为 "Ghost" 渲染在己方战场上。

#### Scenario: Ghost 显示
- **WHEN** 合作战斗开始
- **THEN** Host 端显示 Client 宝可梦为只读 Ghost（可见 HP/状态，不可操控），Client 端显示 Host 宝可梦为只读 Ghost

#### Scenario: Ghost HP 同步
- **WHEN** Host 每回合发送 TurnSnapshot
- **THEN** Client 端 Ghost 宝可梦的 HP 条、状态异常图标、能力等级直接跟随快照更新

#### Scenario: Ghost 不可操控
- **WHEN** 玩家选择指令
- **THEN** CommandPhase 不出现 Ghost 宝可梦的菜单，Ghost 宝可梦不响应本地输入

### Requirement: Client 动画回放
系统 SHALL 在 Client 端根据 TurnSnapshot 播放动画。

#### Scenario: 播放技能动画
- **WHEN** TurnSnapshot 包含技能使用信息
- **THEN** Client 创建 ReplayMovePhase：播放技能名称文字 + 宝可梦攻击动画

#### Scenario: 播放扣血动画
- **WHEN** TurnSnapshot 显示 HP 变化
- **THEN** Client 播放扣血数字 + HP 条变化动画

#### Scenario: 播放昏厥动画
- **WHEN** TurnSnapshot 中某宝可梦 fainted = true
- **THEN** Client 播放倒下动画

### Requirement: 昏厥处理与复活
系统 SHALL 在合作模式下不立即 GameOver，等待队友救援。

#### Scenario: 一方全灭保留
- **WHEN** 一方所有宝可梦昏厥
- **THEN** FaintPhase 检测合作模式 → 不触发 GameOver → 发送 `{ type: "faint", allFainted: true }` 给队友

#### Scenario: 波次结束复活
- **WHEN** 幸存方击败当前波次所有敌人（VictoryPhase）
- **THEN** CoopRevivalPhase 将全灭方所有宝可梦复活至 10% HP，清除异常状态

#### Scenario: 双方全灭
- **WHEN** 双方所有宝可梦都昏厥
- **THEN** 触发 GameOver

### Requirement: 存档与进度保持
系统 SHALL 提供两种存档模式：单机存档和合作存档分离。

#### Scenario: 合作模式使用单机解锁数据
- **WHEN** 玩家通过合作模式开始新游戏
- **THEN** 起始宝可梦选择界面显示该玩家已解锁的所有宝可梦（与单机模式共享解锁数据）

#### Scenario: 合作模式独立存档槽（借鉴 Dead Cells "Multiplayer save slots"）
- **WHEN** 合作模式进行存档
- **THEN** 使用独立存档槽（`sessionDataCoop_<slot>`），不覆盖单机存档

#### Scenario: 合作进度写入
- **WHEN** 合作模式中击败敌人、获得道具
- **THEN** Host 端合作存档正常更新（Host 运行完整游戏引擎），Client 端不写存档（Client 是显示终端）

#### Scenario: 宝可梦图鉴跨模式解锁（借鉴 Dead Cells "AdvancedCoop permanent unlock progression"）
- **WHEN** 合作模式中使用或捕获新宝可梦
- **THEN** 图鉴解锁数据写入玩家的永久存档（`data_<username>`），单机模式中也可使用

### Requirement: 断线与代管（UNO `botTurn` 模式）
系统 SHALL 在 Client 断线时由 Host 自动代管。

#### Scenario: Client 断线
- **WHEN** Socket.io 检测到 Client 断开连接
- **THEN** Host 自动代管 Client 宝可梦，每回合默认使用第一个可用技能

#### Scenario: Client 重连
- **WHEN** Client 重新连接
- **THEN** Host 发送当前完整战场状态快照，Client 恢复渲染，控制权交还
