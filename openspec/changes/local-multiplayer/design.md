## Context

PokéRogue 单机回合制肉鸽，TypeScript + Phaser 3 + Vite。90+ Phase 类型驱动战斗，逻辑与渲染交织。改造为 Host 权威双人合作模式。

## Goals / Non-Goals

**Goals:**
- Host-Client P2P 直连，Socket.io，TCP 端口 9090
- **Host 权威**：Host 执行全部战斗计算，Client 只显示 + 发送操作
- 同屏战斗：双方宝可梦在场，各自只操控己方
- 一方全灭 → 幸存方清波次 → 复活全灭方（10% HP）
- Electron 打包 exe，双击即玩

**Non-Goals:**
- PvP（搁置）
- 互联网联机

## Decisions

### D1: Host 权威模型（核心架构）

```
Host (完整游戏引擎)                Client (显示终端 + 遥控器)
┌──────────────────┐              ┌──────────────────┐
│ PhaseManager     │              │ PhaseManager     │ ← 不执行计算
│ 执行全部 Phase    │              │ 只播放动画 Phase  │
│ (计算、判定的唯一 │────event──►│                  │
│  权威来源)        │◄──command──│ 捕获玩家输入      │
│                  │              │ 接收状态快照      │
└──────────────────┘              └──────────────────┘
```

- **Host**：唯一跑全部 Phase 的实例。收齐双方指令 → 执行回合 → 产生 BattleEvent[] → 发给 Client
- **Client**：发己方指令给 Host，收 Host 下发的 BattleEvent[]，播放动画，不参与计算

### D2: 同步单元 — 回合为单位

每回合流程：
1. Host 推 CommandPhase（己方位）+ RemoteCommandPhase（Client 位）
2. Client 只推 CommandPhase（己方位）→ 选完发送给 Host
3. Host 收齐双方指令 → TurnStartPhase 执行全部 Phase
4. TurnEndPhase 后 Host 打包 stateSnapshot 发给 Client
5. Client 收到后应用快照、播放变化动画

### D3: 状态快照格式

Host 每回合结束后发送给 Client：

```typescript
interface TurnSnapshot {
  turn: number;
  pokemon: Array<{
    index: number;        // field position
    hp: number;
    status: string | null;
    fainted: boolean;
    statStages: number[]; // atk,def,spatk,spdef,spd
  }>;
  messages: string[];     // 战斗文本（"效果拔群！"等）
  arena: { weather: string | null; terrain: string | null };
}
```

Client 收到后直接赋值 → 触发渲染更新。不计算，只赋值。

### D4: Client 端动画

Client 端创建 ReplayPhase 系列，不执行计算，只播动画：
- `ReplayMovePhase` — 播放"使用了 X 技能"文字 + MoveAnim
- `ReplayDamagePhase` — 播放扣血数字动画
- `ReplayFaintPhase` — 播放倒下动画

这些 Phase 从 TurnSnapshot 读取数据，不访问战斗引擎。

### D5: 队伍同步（不变）

- CoopPartySyncPhase：选完宝可梦后 Host 发己方队伍给 Client，Client 加入 party 显示用
- Client 的 Pokemon 对象是只读副本，HP 等值由 Host 每回合下发

### D6: 复活机制（不变）

- FaintPhase 检测 coop → 不立即 GameOver → 通知队友
- VictoryPhase 结束后 CoopRevivalPhase 复活全灭方（10% HP）

## Risks

- **[R1] 动画同步**：Client 端 ReplayPhase 需要与 Host 端一致，否则动画时长不同步 → 用固定时长 + 回调驱动
- **[R2] 状态快照覆盖不全**：部分状态（特性计数器等）可能漏传 → 先用最小快照（HP、状态、能力等级），逐步补全
- **[R3] 网络延迟**：局域网 <5ms，回合制可忽略

## Open Questions

- Q1: Client 端的 ReplayPhase 是否能复用现有 Phase（用标志位跳过计算）？
- Q2: 状态快照是否需要包含敌方宝可梦数据？（敌方由 Host 本地 AI 控制，不需要发给 Client 选择）
