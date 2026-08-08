## 1. 网络基础设施

- [ ] 1.1 创建 `electron/main.cjs` — Electron 主进程，Socket.io 服务端/客户端 + HTTP 静态文件
- [ ] 1.2 创建 `electron/preload.cjs` — IPC 桥接（lanApi: host/join/send/onMessage）
- [ ] 1.3 创建 `src/lan/lan-manager.ts` — 联机管理器单例，Socket.io 事件驱动
- [ ] 1.4 创建 `src/lan/coop-manager.ts` — 合作模式状态管理

## 2. 大厅系统

- [ ] 2.1 新增 UiMode.LAN_MENU、LAN_JOIN、LOBBY 枚举值
- [ ] 2.2 创建 LanMenuUiHandler：创建/加入/返回
- [ ] 2.3 创建 LanJoinUiHandler：IP 输入（支持粘贴、Tab 切换端口）
- [ ] 2.4 创建 LobbyUiHandler：连接状态、Host 按 Enter 开始
- [ ] 2.5 在 TitlePhase 添加「局域网联机」入口

## 3. 合作战斗

- [ ] 3.1 创建 CoopPartySyncPhase：选完宝可梦后交换队伍数据
- [ ] 3.2 创建 CoopSyncPhase：回合指令交换（发送本地 + 接收远程）
- [ ] 3.3 修改 TurnInitPhase：合作模式只给本地宝可梦出指令菜单
- [ ] 3.4 修改 FaintPhase：合作模式不立即 GameOver
- [ ] 3.5 创建 CoopRevivalPhase：波次结束后复活全灭方（10% HP）
- [ ] 3.6 修改 VictoryPhase：推 CoopRevivalPhase

## 4. UI 与体验

- [ ] 4.1 LAN UI 窗口居中 + 取消按钮
- [ ] 4.2 断线提示与自动重连
- [ ] 4.3 合作模式激活提示文字

## 5. Electron 打包

- [ ] 5.1 Electron 主进程集成 Socket.io + HTTP
- [ ] 5.2 双击 exe 即玩，无需额外终端
