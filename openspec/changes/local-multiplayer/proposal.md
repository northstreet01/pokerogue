## Why

PokéRogue 目前是纯单机游戏。通过局域网 P2P 联机，两个玩家可以共同闯关，一方全灭后另一方清场可复活队友（10% HP），保留肉鸽核心乐趣。

## What Changes

- **新增 Socket.io P2P 网络层**：Electron 主进程运行 Socket.io 服务端/客户端，固定端口 9090
- **新增大厅系统**：创建/加入房间，IP 输入支持粘贴，连接状态实时显示
- **新增双人合作闯关模式**：同屏战斗，各自操控己方宝可梦，回合同步
- **新增复活机制**：一方全灭 → 幸存方清完波次 → 复活全灭方（10% HP）
- **新增 Electron 打包**：双击 exe 即玩

## Capabilities

### New Capabilities
- `lan-connection`: Socket.io P2P 网络层，消息路由，自动重连
- `lobby-system`: 房间创建/加入，IP 输入，连接状态，游戏启动
- `coop-mode`: 队伍同步、同屏战斗、回合同步、复活、奖励分配

## Impact

- **网络层**：新增 `electron/main.cjs`（Socket.io 服务端/客户端 + HTTP 静态文件）
- **渲染进程**：新增 `src/lan/` 目录（LanManager、CoopManager、CoopSyncPhase 等）
- **Phase 系统**：修改 TurnInitPhase、VictoryPhase、FaintPhase 接入合作模式
- **UI 系统**：新增 LAN_MENU、LAN_JOIN、LOBBY、PVP_RESULT
- **外部依赖**：socket.io、socket.io-client、electron
