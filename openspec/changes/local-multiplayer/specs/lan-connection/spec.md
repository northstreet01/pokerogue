## ADDED Requirements

### Requirement: Host 启动 WebSocket 服务
系统 SHALL 在 Host 端启动 WebSocket 服务，监听局域网指定端口（默认 9090），等待 Client 连接。

#### Scenario: Host 成功启动服务
- **WHEN** 玩家点击「创建房间」并选择「启动联机」
- **THEN** 系统在后台启动 WebSocket 服务，显示本机局域网 IP 和端口号，状态变为"等待对手加入..."

#### Scenario: Host 端口被占用
- **WHEN** 默认端口 9090 已被占用
- **THEN** 系统自动尝试 9091-9095 端口，并在 UI 显示实际使用的端口号

#### Scenario: Host 点击取消
- **WHEN** Client 还未连接时 Host 点击「取消」
- **THEN** 系统关闭 WebSocket 服务，回到主菜单

### Requirement: Client 连接到 Host
系统 SHALL 允许 Client 通过输入 Host 的 IP 地址和端口号加入房间。

#### Scenario: Client 成功连接
- **WHEN** 玩家点击「加入房间」，输入正确的局域网 IP 和端口，点击「连接」
- **THEN** 系统建立 WebSocket 连接，发送 HELLO 消息，收到 HELLO_ACK 后进入房间

#### Scenario: Client 连接失败
- **WHEN** 输入的 IP 不可达或端口未开放
- **THEN** 系统在 5 秒超时后显示「无法连接到 Host，请检查 IP 地址和端口」，允许重试

#### Scenario: 版本不匹配
- **WHEN** Client 和 Host 的游戏版本不一致
- **THEN** 系统拒绝连接并显示双方版本号，提示「游戏版本不一致，请更新后再试」

### Requirement: 消息收发与序列化
系统 SHALL 支持 JSON 格式消息的可靠收发，包含序列号用于排序和去重。

#### Scenario: 正常消息收发
- **WHEN** 一方发送消息
- **THEN** 消息包含 type、payload、seq（递增序列号）、timestamp 字段，对方收到后按 seq 排序处理

#### Scenario: 重复消息去重
- **WHEN** 收到已处理过的序列号消息
- **THEN** 系统忽略该消息，不重复处理

### Requirement: 心跳检测与断线处理
系统 SHALL 每 5 秒发送心跳消息，15 秒未收到回复判定断线。

#### Scenario: 心跳正常
- **WHEN** Host 和 Client 连接正常
- **THEN** 每 5 秒自动发送 HEARTBEAT 消息，对方回复 HEARTBEAT_ACK

#### Scenario: 断线检测
- **WHEN** 一方超过 15 秒未收到任何消息
- **THEN** 系统判定断线，显示「对手已断开连接」，提供「等待重连（30s）」和「转为单人模式」两个选项

#### Scenario: 重连成功
- **WHEN** 断线后 30 秒内对方重新连接
- **THEN** 系统恢复对战状态，从断点继续；若在合作模式中，对方队伍由 AI 临时接管期间的操作无效

### Requirement: 局域网自动发现（可选）
系统 MAY 支持通过 mDNS 广播在局域网内自动发现 Host 房间。

#### Scenario: 自动发现房间
- **WHEN** Client 进入房间列表
- **THEN** 系统搜索局域网内广播的 Host 房间，显示房间列表（含 Host 名称、延迟）

#### Scenario: Host 广播房间信息
- **WHEN** Host 成功启动 WebSocket 服务
- **THEN** 系统通过 mDNS 广播房间信息（Host 名称、端口、玩家数量）
