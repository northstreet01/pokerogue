## Context

PokéRogue 单机回合制肉鸽，TypeScript + Phaser 3 + Vite，90+ Phase 类型驱动战斗。改造为 Host 权威双人合作模式。

参考项目：[Colyseus UNO Cards Demo](https://github.com/colyseus/turnbased-cards-demo)——权威服务器、回合超时代打、断线 bot 接管、Schema 状态同步。

## Goals / Non-Goals

**Goals:**
- Host-Client P2P 直连，Socket.io，TCP 端口 9090
- **Host 权威**：Host 执行全部战斗计算，Client 只显示 + 发送操作
- 同屏战斗：双方宝可梦在场，各自只操控己方
- 一方全灭 → 幸存方清波次 → 复活（10% HP）
- 断线自动代管（借鉴 UNO `botTurn` 模式）
- Electron 打包 exe，双击即玩

**Non-Goals:**
- PvP（搁置）
- 互联网联机

## Decisions

### D1: Host 权威模型（借鉴 UNO Demo `handlePlayCard` 验证链）

```
Host (唯一裁判)                    Client (遥控器+电视)
┌──────────────────┐              ┌──────────────────┐
│ PhaseManager     │              │ PhaseManager     │
│ 执行全部 Phase    │──snapshot──→│ 只播 ReplayPhase │
│ 权威验证+计算     │◄──command──│ 君发送动作      │
└──────────────────┘              └──────────────────┘
```

- Host 跑全部 Phase，每回合产生 TurnSnapshot
- Client 发指令 + 收快照 + 播动画，不计算
- 借鉴 UNO：服务端 `handlePlayCard()` 验证链 → Host 的 CoopSyncPhase 验证指令

### D2: 回合同步（借鉴 UNO `scheduleTurn` + `turnDeadline`）

每回合：
```
TurnInitPhase
  ├─ Host: CommandPhase(己方位)
  ├─ Host: RemoteWaitPhase(Client位, 等网络消息)
  └─ EnemyCommandPhase(AI)

双方指令到齐 → TurnStartPhase → 执行全部 Phase
  → TurnEndPhase → 打包 TurnSnapshot → sendSnapshot()
```

- 60s 超时 → 自动挣扎（借鉴 UNO `HUMAN_TURN_TIMEOUT` = 7000ms）
- Client 选完指令立即发送，不等其他 Phase

### D3: TurnSnapshot 格式（借鉴 UNO Schema 增量同步）

```typescript
interface TurnSnapshot {
  turn: number;
  pokemon: Array<{
    index: number; hp: number; maxHp: number;
    status: string | null; fainted: boolean;
    statStages: number[];
  }>;
  messages: string[];
}
```

只用最小字段集（HP、状态、能力等级），不传完整 Pokemon 对象。
借鉴 UNO `StateView` 概念——Client 只能看到公共数据，不能看到 Host 本地计算过程。

### D4: 断线代管（借鉴 UNO `botTurn()` 模式）

- Client 断开 → Host 自动代管，默认第一个可用技能
- Client 重连 → Host 发完整快照，控制权交还
- 借鉴 UNO：玩家离开 → `isBot = true` → `botTurn()` 无缝接替

### D5: Client 动画回放

Client 创建 ReplayPhase 系列，不计算只播动画：
- `ReplayMovePhase` → 技能名 + 攻击动画
- `ReplayDamagePhase` → 扣血数字动画
- `ReplayFaintPhase` → 倒下动画

### D6: 复活机制

- FaintPhase 检测 coop → 不立即 GameOver
- VictoryPhase 后 CoopRevivalPhase 复活全灭方（10% HP）

## Risks

- **[R1] TurnSnapshot 字段不完整**：先最小集（HP、状态、能力等级），逐步补全
- **[R2] ReplayPhase 动画时长不一致** → 固定时长 + 事件驱动
- **[R3] 网络延迟**：局域网 <5ms，回合制可忽略

## Reference Code

```
E:\pokeregue\reference\cards-demo\server\src\rooms\UnoRoom.ts
  handlePlayCard() → line 453 — 权威验证链
  scheduleTurn()   → line 277 — 回合调度 + turnDeadline
  botTurn()        → line 188 — AFK 自动代打
  onJoin()         → line 72  — 玩家加入、bot 替换
  onLeave()        → line 100 — 玩家离开、bot 接管
```
