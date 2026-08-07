## ADDED Requirements

### Requirement: 创建房间
系统 SHALL 允许 Host 玩家创建联机房间。

#### Scenario: 创建房间成功
- **WHEN** 玩家在主菜单中选择「局域网联机」→「创建房间」
- **THEN** 系统启动 WebSocket 服务，创建房间，显示房间界面（包含本机 IP、端口、当前玩家列表[Host 自己]）

#### Scenario: 显示 Host 队伍概要
- **WHEN** 房间创建后
- **THEN** 系统在房间界面显示 Host 当前队伍（6 只宝可梦的图标和等级概要）

### Requirement: 加入房间
系统 SHALL 允许 Client 玩家通过 IP 地址加入已有房间。

#### Scenario: 手动输入 IP 加入
- **WHEN** 玩家选择「局域网联机」→「加入房间」
- **THEN** 系统显示 IP 和端口输入框，玩家输入后点击「连接」

#### Scenario: 连接中状态
- **WHEN** 玩家点击「连接」后等待连接建立
- **THEN** 系统显示"连接中..."动画，连接成功自动跳转到房间界面

### Requirement: 房间状态管理
系统 SHALL 在房间界面实时显示双方信息和就绪状态。

#### Scenario: Client 加入后状态更新
- **WHEN** Client 成功连接到 Host 的房间
- **THEN** 双方房间界面更新，显示对方玩家名称和队伍概要

#### Scenario: 双方确认开始
- **WHEN** Host 和 Client 都在房间中
- **THEN** 双方看到「准备开始」按钮，点击后状态变为"已就绪"

#### Scenario: 自动开始
- **WHEN** 双方都已就绪
- **THEN** 系统显示 3 秒倒计时，倒计时结束后 Host 发送 GAME_START 消息，进入游戏

#### Scenario: Client 离开
- **WHEN** Client 在等待阶段断开连接或主动离开
- **THEN** Host 房间界面更新，移除 Client 信息，状态恢复为"等待对手加入..."

### Requirement: 选择联机模式
系统 SHALL 允许 Host 在开始前选择联机模式（合作闯关 / 仅 PvP / 混合模式）。

#### Scenario: 选择合作闯关模式
- **WHEN** Host 在房间中选择「合作闯关」模式
- **THEN** 系统在开始后进入标准的肉鸽流程，双人共同对抗 AI

#### Scenario: 选择混合模式
- **WHEN** Host 选择「混合模式」（合作闯关 + 环节 PvP）
- **THEN** 系统在合作闯关基础上，每通过 BOSS 关后自动触发 PvP 对决
