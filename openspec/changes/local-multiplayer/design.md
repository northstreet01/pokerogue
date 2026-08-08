## Context

PokéRogue 是单机回合制肉鸽游戏，TypeScript + Phaser 3 + Vite。本次改造新增局域网 P2P 双人合作闯关模式，保留肉鸽核心特性。

## Goals / Non-Goals

**Goals:**
- 两台电脑通过局域网（N2N 虚拟网 / 物理局域网）双人合作闯关
- Host-Client P2P 直连，无中转服务器
- Socket.io 作为网络框架，TCP 传输，端口 9090
- 同屏战斗：双方宝可梦同时在场，各自操控
- 一方全灭后等待队友清完波次复活（10% HP）
- Electron 打包为 exe，双击即玩

**Non-Goals:**
- 不实现 PvP 对战（搁置）
- 不通过互联网联机

## Decisions

### D1: 网络框架 — Socket.io
- 自带房间管理、广播、自动重连
- 底层 WebSocket over TCP
- Host 端 Electron 主进程运行 Socket.io 服务端
- Client 端通过 Socket.io 客户端连接 Host

### D2: 游戏启动流程
- 大厅连接 → Host 按 Enter → 双方回标题 → 各自点「新游戏」→ 经典模式 → 选宝可梦
- CoopManager 在后台激活，TurnInitPhase 检测合作模式
- 避免修改 TitlePhase 的游戏初始化逻辑

### D3: 战斗同步 — 双打模式
- Host 宝可梦位置 PLAYER(0)，Client 宝可梦位置 PLAYER_2(1)
- 每个玩家只看到自己宝可梦的指令菜单
- CoopSyncPhase 在 CommandPhase 之后交换双方指令
- TurnStartPhase 收到双方指令后统一执行

### D4: 队伍同步
- CoopPartySyncPhase 在 TitlePhase.end() 阶段运行
- 双方选完初始宝可梦后交换队伍数据
- 对方宝可梦加入己方 party

### D5: 复活机制
- FaintPhase 检测 coop → 不立即 GameOver → 通知队友
- VictoryPhase 结束后 CoopRevivalPhase 复活全灭方（10% HP）
