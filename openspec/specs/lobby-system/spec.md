## ADDED Requirements

### Requirement: 创建房间
系统 SHALL 允许 Host 玩家创建联机房间。

#### Scenario: 创建房间成功
- **WHEN** 玩家在主菜单中选择「局域网联机」→「创建房间」
- **THEN** 系统启动 Socket.io 服务端（端口 9090），显示大厅界面（含玩家列表、对手连接状态）

#### Scenario: Host 退出房间
- **WHEN** Host 在大厅中按 X
- **THEN** 系统关闭 Socket.io 服务端，回到主菜单

### Requirement: 加入房间
系统 SHALL 允许 Client 玩家通过 IP 地址加入已有房间。

#### Scenario: 输入 IP 加入
- **WHEN** 玩家选择「局域网联机」→「加入房间」
- **THEN** 系统显示 IP 输入框，支持键盘输入、Backspace 删除、Tab 切换端口编辑、Ctrl+V 粘贴

#### Scenario: 粘贴 IP
- **WHEN** 玩家在 IP 输入框中按 Ctrl+V
- **THEN** 系统读取剪贴板内容，过滤非数字和点号的字符，填入 IP 框

#### Scenario: 连接中
- **WHEN** 玩家输入 IP 后按 Enter
- **THEN** 系统显示"连接中..."，连接成功自动进入大厅

### Requirement: 大厅状态
系统 SHALL 在大厅界面实时显示双方连接状态。

#### Scenario: 对手连接
- **WHEN** 对方成功连接
- **THEN** 大厅显示「对手已连接 ✓」，Host 看到「按 Enter 开始合作闯关」

#### Scenario: 对手断开
- **WHEN** 对方断开连接
- **THEN** 大厅恢复「等待对手...」状态

### Requirement: 开始游戏
系统 SHALL 由 Host 触发游戏开始。双方回到主菜单，各自选择「新游戏」→「经典模式」→ 选择初始宝可梦。合作模式在后台自动激活。

#### Scenario: Host 启动
- **WHEN** Host 在大厅中按 Enter
- **THEN** 系统发送 start 消息给 Client（含 RNG 种子），双方 CoopManager 激活，关闭大厅，显示「合作模式已激活！请选择 [新游戏] 开始」

#### Scenario: Client 收到启动
- **WHEN** Client 收到 start 消息
- **THEN** CoopManager 激活，关闭大厅，显示提示文字
