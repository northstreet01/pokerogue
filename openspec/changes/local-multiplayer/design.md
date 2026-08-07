## Context

PokéRogue 是单机回合制肉鸽游戏，核心架构为 Phase 队列驱动的状态机。战斗系统通过 `TurnCommand` 接口序列化玩家操作，由 `PhaseManager` 统一调度执行。当前完全不存在联机基础设施。

本次改造需要在不破坏现有单机模式的前提下，新增局域网联机能力。关键约束：浏览器沙箱环境、无额外服务器依赖、保持肉鸽随机性（RNG 确定性同步）。

## Goals / Non-Goals

**Goals:**
- 两台设备通过局域网（同一 WiFi/交换机）进行联机对战和合作
- Host-Client 模式：一人创建房间（Host），另一人加入（Client），无需第三方服务器
- 双人合作闯关：共享波次进度，各自独立管理队伍，协同对抗 AI
- 环节 PvP 对决：每过 BOSS 关后触发双人对战，胜者获额外奖励
- 断线检测与提示，保证游戏不会因网络问题卡死

**Non-Goals:**
- 不通过互联网联机（仅局域网）
- 不支持超过 2 人同时联机
- 不实现观战模式（第一版范围外）
- 不修改现有单机游戏逻辑
- 不引入外部服务器依赖（纯 P2P 局域网）

## Decisions

### D1: 通信方案 — WebSocket

**选型**：浏览器原生 `WebSocket` API

**备选方案及放弃原因**：
- **WebRTC Data Channel**：理论更优（真正 P2P），但需要 STUN/TURN 信令服务器，局域网下反而增加复杂度。浏览器 WebSocket 在 localhost 延迟 <1ms，完全够用。
- **轮询 HTTP**：延迟高、浪费带宽，不适合回合制对战（虽然回合制可容忍，但体验差）
- **SSE**：单向推送，无法双向通信

**结论**：Host 端启动轻量 WebSocket 服务端（Node.js `ws` 或浏览器内嵌方案），Client 通过 `ws://<host-ip>:9090` 连接。

### D2: Host 服务端运行方式

**选型**：游戏内启动 Node.js 子进程作为 WS 服务端

**备选方案**：
- **浏览器内 WebSocket Server**：浏览器不能作为 WebSocket 服务端（安全限制）
- **SharedWorker**：不支持 WebSocket Server
- **独立 Electron 壳**：改动过大

**结论**：提供一个轻量 Node.js 脚本（`scripts/lan-server.mjs`），Host 玩家启动游戏前先运行此脚本。未来可考虑打包成桌面应用内置服务端。

### D3: 同步策略 — 指令同步 + RNG 种子

**选型**：仅同步 `TurnCommand` 和 RNG 种子，不传输完整游戏状态

**原理**：
- 宝可梦战斗计算完全确定性（伤害公式、命中判定等均基于 RNG）
- Host 在开局时发送 RNG 种子给 Client，双方使用相同种子初始各自的 RNG
- 每回合双方将 `TurnCommand` 发送给对方
- 双方各自在本地执行相同指令序列，依赖相同 RNG 产出相同结果
- 每回合结束后验证状态哈希（HP 总值等），不一致时 Host 判决

**备选方案**：
- **状态全量同步**：每帧/每回合传输完整游戏状态，带宽高、延迟敏感，局域网下虽可行但复杂
- **Host 权威模式**：Client 只渲染、不计算，所有逻辑在 Host 执行 — 对回合制来说不必要

### D4: 合作模式战斗流程

**选型**：双人各自操控己方队伍，与 AI 敌人进行双打对战（2v2）

```
正常遭遇：2 玩家 + 2 敌人 = 双打
训练师对战：2 玩家 vs 训练师（可单打可双打）
BOSS 战：2 玩家 vs BOSS（双打）
```

- 双方各自对己方宝可梦下达指令
- 双方都提交后，回合开始执行
- 使用现有 `TurnStartPhase` 排序逻辑
- 击败敌人后双方各获奖励（经验平分、道具随机分配）

### D5: 环节 PvP 对决流程

**选型**：每张地图/道馆/BOSS 通过后触发

**触发条件**：
- 每 10 波（BOSS 关）结束后
- 通过道馆（GYM）后
- 每张地图通关后

**对决规则**：
- 双方队伍满血恢复
- 1v1 单打（一方全部阵亡即结束）
- 不可使用道具（纯宝可梦对战）
- 胜者获得额外肉鸽奖励（稀有道具、传说宝可梦捕获机会、金钱翻倍）
- 败者无惩罚，继续游戏

### D6: 网络协议设计

所有消息使用 JSON 格式：

```typescript
// 消息结构
interface LanMessage {
  type: string;       // 消息类型
  payload: any;       // 数据体
  seq: number;        // 序列号（用于排序和去重）
  timestamp: number;  // 发送时间戳
}

// 核心消息类型
type MessageType =
  | "HELLO"          // Client 连接握手
  | "HELLO_ACK"      // Host 确认连接
  | "READY"          // 玩家就绪
  | "GAME_START"     // Host 通知游戏开始
  | "RNG_SEED"       // Host 同步 RNG 种子
  | "TURN_COMMAND"   // 发送回合指令 (TurnCommand[] + checksum)
  | "TURN_RESULT"    // 回合执行结果 (校验哈希)
  | "PVP_TRIGGER"    // 触发 PvP 对决
  | "PVP_READY"      // PvP 双方就绪
  | "PVP_COMMAND"    // PvP 回合指令
  | "PVP_RESULT"     // PvP 结果（胜者、奖励）
  | "COOP_REWARD"    // 合作奖励分配
  | "PLAYER_FAINT"   // 玩家宝可梦昏厥通知
  | "HEARTBEAT"      // 心跳
  | "HEARTBEAT_ACK"  // 心跳回复
  | "DISCONNECT"     // 断线通知
  | "ERROR"          // 错误消息
```

## Risks / Trade-offs

- **[R1] 浏览器不能直接做 WebSocket Server** → 提供独立 Node.js 脚本，或打包成桌面应用
- **[R2] 网络延迟导致回合等待** → 每回合超时 60s，超时后自动使用"挣扎"（Struggle）；局域网延迟通常 <5ms，几乎不影响体验
- **[R3] RNG 不同步风险** → 每回合结束后 Host 计算状态哈希比对；不一致时同步完整状态 + RNG 重置
- **[R4] 断线导致游戏卡死** → 心跳 5s 间隔，15s 无响应判定断线；断线后可选"等待重连"或"转为 AI 控制"
- **[R5] 合作模式奖励分配争议** → 道具采用"轮流选择"制（A→B→A→B），经验自动平分，无需额外通信
- **[R6] 双方游戏版本不一致** → 握手时交换版本号，不一致则拒绝连接并提示

## Open Questions

- Q1: Host WebSocket 服务端是否能集成到 Vite 开发服务器中？（调研 `vite-plugin-websocket` 或自定义 Vite 插件）
- Q2: 是否需要支持"局域网搜索"自动发现 Host？（推荐使用 mDNS/Bonjour 广播，也可手动输入 IP）
- Q3: 环节 PvP 的具体触发频率：每 10 波 vs 每 20 波 vs 每张地图？
- Q4: PvP 对决是否允许使用背包道具？（暂定：不允许，纯宝可梦对战）
