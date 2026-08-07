## Why

PokéRogue 目前是纯单机游戏，缺少与朋友一起游玩的社交体验。宝可梦的核心魅力之一就是与朋友对战和合作。通过局域网联机，两个玩家可以在同一网络下共同闯关或相互对战，大幅提升游戏的可玩性和重复游玩价值，同时保留肉鸽游戏的核心乐趣。

## What Changes

- **新增局域网联机模块**：基于 WebSocket 的局域网通信层，支持 Host-Client 模式（无需额外服务器）
- **新增房间大厅系统**：游戏内创建/加入房间，显示对方就绪状态和队伍概要
- **新增双人合作闯关模式**：两名玩家组队对抗 AI 训练师和野生宝可梦，共享奖励但各自管理队伍
- **新增环节对决模式**：在每通过一个大关卡（BOSS/道馆）后，两名玩家进行 PvP 对战，胜者获得额外奖励
- **新增联机 UI 界面**：大厅界面、对战等待界面、环节对决结算界面
- **修改对战系统**：`EnemyCommandPhase` 可被远程玩家的 `TurnCommand` 替代；支持双人双打（2v2）和单打（1v1）两种对战形式
- **修改游戏流程**：合作模式下双人共享地图进度，但保留各自的队伍、道具和决策权

## Capabilities

### New Capabilities
- `lan-connection`: 局域网 WebSocket 通信层，支持 Host 服务端启动和 Client 连接，消息收发、心跳检测、断线处理
- `lobby-system`: 房间创建/加入/离开，玩家就绪状态管理，双方队伍概要展示
- `coop-mode`: 双人合作闯关模式 — 共享波次进度、各自管理队伍、战斗中可同时或交替操作、击败敌人后共享/分配奖励
- `pvp-battle`: 环节对决模式 — 每过一个 BOSS 大关触发 PvP 对战、双方队伍满血对决、胜者获得额外肉鸽奖励（道具/金钱/稀有宝可梦）

### Modified Capabilities
<!-- 现有是空项目，暂无 spec 需要修改 -->

## Impact

- **网络层**：新增 `src/lan/` 目录（WebSocket 服务端 + 客户端模块），依赖浏览器原生 `WebSocket` API
- **游戏模式**：新增 `GameModes.COOP` 枚举值；新增 `CoopMode` 类扩展 `GameMode`
- **Phase 系统**：新增 `RemotePlayerCommandPhase`、`PvpBattlePhase`、`CoopRewardPhase`；修改 `TurnStartPhase` 支持等待远程指令
- **UI 系统**：新增 `UiMode.LOBBY`、`UiMode.PVP_RESULT` 等；新增对应 UI Handler
- **Battle 系统**：`Battle` 类新增 PvP 标记；`TurnCommand` 序列化后通过 WebSocket 传输
- **外部依赖**：无需额外 npm 包 — 浏览器原生 `WebSocket` 用于客户端；Node.js `ws` 库（或内置 `node:http`）用于服务端
- **无破坏性变更**：所有联机功能为新增，不影响现有单机模式
