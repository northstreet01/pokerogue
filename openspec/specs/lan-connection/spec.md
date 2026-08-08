## ADDED Requirements

### Requirement: P2P 直连架构
系统 SHALL 使用 Socket.io 实现 Host-Client P2P 直连。Host 端 Electron 主进程运行 Socket.io 服务端，Client 端 Electron 主进程通过 Socket.io 客户端连接 Host。传输层为 TCP（WebSocket 帧），端口固定 9090。无需中转服务器。

#### Scenario: Host 创建房间
- **WHEN** 玩家点击「局域网联机」→「创建房间」
- **THEN** Electron 主进程启动 Socket.io 服务端（端口 9090），Host 渲染进程自动以客户端身份连接 localhost:9090，进入大厅

#### Scenario: Client 加入房间
- **WHEN** 玩家点击「局域网联机」→「加入房间」→ 输入 Host IP → 确认
- **THEN** Electron 主进程通过 Socket.io 客户端连接 Host，进入大厅

#### Scenario: 连接失败
- **WHEN** Client 无法连接到 Host（IP 不可达/端口未开）
- **THEN** 5 秒超时后显示「连接失败！请检查 IP 地址」，允许重新输入

### Requirement: 消息路由
系统 SHALL 自动处理消息路由。所有消息附带 `from` 字段标识发送者（"host"/"client"），接收方忽略自己发出的消息。

#### Scenario: Host 广播消息
- **WHEN** Host 发送消息
- **THEN** 消息通过 Socket.io 广播到所有客户端，Host 的渲染进程也收到消息

#### Scenario: Client 发送消息
- **WHEN** Client 发送消息
- **THEN** 消息通过 Socket.io 发送到服务端，服务端转发给 Host 渲染进程

### Requirement: 自动重连
系统 SHALL 在断线时自动尝试重连，最多 5 次。

#### Scenario: 网络抖动
- **WHEN** Client 与 Host 之间短暂断线
- **THEN** Socket.io 自动重连，游戏从中断点继续
