## 1. 网络基础设施

- [ ] 1.1 创建 `scripts/lan-server.mjs` — 轻量 WebSocket 服务端脚本（使用 `ws` 库），支持启动、端口配置、客户端连接管理
- [ ] 1.2 创建 `src/lan/lan-message.ts` — 消息类型定义和序列化/反序列化工具（`LanMessage` 接口，`MessageType` 联合类型）
- [ ] 1.3 创建 `src/lan/lan-client.ts` — 客户端 WebSocket 连接模块（连接、断开、重连、消息队列、心跳机制）
- [ ] 1.4 创建 `src/lan/lan-manager.ts` — 联机管理器单例（Host/Client 角色管理、消息路由、断线处理）
- [ ] 1.5 实现心跳检测：每 5 秒 HEARTBEAT，15 秒超时断线判定，30 秒重连窗口

## 2. 大厅系统

- [ ] 2.1 创建 `src/ui/handlers/lobby-ui-handler.ts` — 大厅 UI Handler（房间状态、双方队伍概要、就绪按钮）
- [ ] 2.2 新增 `UiMode.LOBBY` 枚举值，注册 `LobbyUiHandler` 到 UI 系统
- [ ] 2.3 创建 `src/lan/lobby-phase.ts` — 大厅 Phase（管理房间生命周期、玩家加入/离开事件）
- [ ] 2.4 实现 Host「创建房间」流程：启动 WS 服务 → 显示 IP/端口 → 等待连接
- [ ] 2.5 实现 Client「加入房间」流程：输入 IP → 连接 → 版本验证 → 进入房间
- [ ] 2.6 实现双方就绪检测：双方点击「准备」→ 3 秒倒计时 → 自动开始
- [ ] 2.7 实现联机模式选择 UI：合作闯关 / 纯 PvP / 混合模式

## 3. 合作闯关模式

- [ ] 3.1 新增 `GameModes.COOP` 枚举值，创建 `CoopMode` 类扩展 `GameMode`
- [ ] 3.2 创建 `src/lan/remote-player-command-phase.ts` — 替代 `EnemyCommandPhase`，等待远程玩家 TurnCommand
- [ ] 3.3 修改 `TurnStartPhase`：合作模式下收集本地 + 远程双方的 TurnCommand 后再执行
- [ ] 3.4 实现 RNG 种子同步：Host 发送种子 → 双方各自初始化相同 RNG → 确定性计算
- [ ] 3.5 实现合作战斗 UI：显示队友场上宝可梦信息（HP、状态），标记"等待对方选择..."
- [ ] 3.6 实现合作奖励分配逻辑：经验平分、道具轮流选择（A→B→B→A）
- [ ] 3.7 实现一方全灭后的同伴救援机制：存活方可选择分享一只宝可梦给队友
- [ ] 3.8 实现合作模式下的独立队伍管理：双方在波次间隙各自操作背包和队伍

## 4. 环节 PvP 对决

- [ ] 4.1 创建 `src/lan/pvp-phase.ts` — PvP 触发 Phase（BOSS 战后检测、满血恢复、状态快照保存）
- [ ] 4.2 创建 `src/lan/pvp-battle-phase.ts` — PvP 对战 Phase（双盲指令选择、双方指令到达后执行）
- [ ] 4.3 创建 `src/lan/pvp-reward-phase.ts` — PvP 奖励 Phase（胜者奖励计算、连胜加成、结算 UI）
- [ ] 4.4 实现 PvP 对战规则：1v1 单打、禁用背包道具、满血恢复、可选等级归一化
- [ ] 4.5 创建 `src/ui/handlers/pvp-result-ui-handler.ts` — PvP 结算界面（双方剩余宝可梦、奖励展示、继续按钮）
- [ ] 4.6 实现 PvP 后状态回滚：恢复双方至对决前的 HP/PP/状态
- [ ] 4.7 实现跳过投票机制：PvP 触发后 10 秒内双方可投票跳过

## 5. UI 与用户体验

- [ ] 5.1 在主菜单新增「局域网联机」入口按钮
- [ ] 5.2 创建房间 UI（包含玩家列表、队伍概要、模式选择、开始按钮）
- [ ] 5.3 创建 PvP 触发过渡动画（"环节对决！" 弹窗特效）
- [ ] 5.4 实现断线提示 UI（模态弹窗：等待重连 / 转为单人模式）
- [ ] 5.5 实现合作模式中队友状态的常驻 HUD（小窗口显示队友宝可梦状态）

## 6. 集成与测试

- [ ] 6.1 将联机模块注册到游戏主流程（`battle-scene.ts` 中初始化 `LanManager`）
- [ ] 6.2 添加 `VITE_ENABLE_LAN` 环境变量开关（开发阶段可控）
- [ ] 6.3 编写 `lan-message.test.ts` — 消息序列化/反序列化单元测试
- [ ] 6.4 编写 `lan-manager.test.ts` — 联机管理器逻辑测试
- [ ] 6.5 编写 `coop-mode.test.ts` — 合作模式核心流程测试
- [ ] 6.6 编写 `pvp-battle.test.ts` — PvP 对战流程测试
- [ ] 6.7 手动集成测试：两台设备局域网联机合作闯关 + 环节 PvP 完整流程
