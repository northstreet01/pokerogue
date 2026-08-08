## 1. 网络层（已完成 ✅）

- [x] 1.1 `electron/main.cjs` — Socket.io 服务端/客户端 + HTTP
- [x] 1.2 `electron/preload.cjs` — IPC 桥接
- [x] 1.3 `src/lan/lan-manager.ts` — 联机管理器
- [x] 1.4 `src/lan/coop-manager.ts` — 合作模式状态

## 2. 大厅系统（已完成 ✅）

- [x] 2.1 UiMode.LAN_MENU、LAN_JOIN、LOBBY
- [x] 2.2 LanMenuUiHandler、LanJoinUiHandler、LobbyUiHandler
- [x] 2.3 TitlePhase「局域网联机」入口

## 3. Host 权威战斗（待实施 🔴）

- [ ] 3.1 创建 TurnSnapshot 接口（`src/lan/turn-snapshot.ts`）
- [ ] 3.2 创建 `src/lan/remote-wait-phase.ts` — Host 端等待 Client 指令（60s 超时 → Struggle）
- [ ] 3.3 修改 TurnInitPhase：Host 模式推 CommandPhase(己方) + RemoteWaitPhase(Client位)
- [ ] 3.4 修改 Host 端 TurnEndPhase：打包 TurnSnapshot → `sendSnapshot()`
- [ ] 3.5 Client 端 CommandPhase 选完后自动 `sendAction()` 发给 Host
- [ ] 3.6 Client 端收 TurnSnapshot → 应用 HP/status/statStages → 刷新 UI

## 4. Client 动画回放（待实施 🔴）

- [ ] 4.1 创建 `src/lan/replay-move-phase.ts` — 不计算，只播技能动画
- [ ] 4.2 创建 `src/lan/replay-damage-phase.ts` — 不计算，只播扣血动画
- [ ] 4.3 Client TurnInitPhase 合作模式不推 CommandPhase，等待 Host 快照后推 ReplayPhase

## 5. 队伍同步（待修复 🔴）

- [ ] 5.1 修复 CoopPartySyncPhase：消息回弹过滤、正确时机
- [ ] 5.2 Client 创建对方宝可梦只读副本，HP 由 Host 每回合下发

## 6. 复活与断线（待实施 🔴）

- [ ] 6.1 FaintPhase 合作模式不 GameOver → 发 faint 通知
- [ ] 6.2 CoopRevivalPhase 复活全灭方（10% HP）
- [ ] 6.3 Client 断线 → Host 自动代管（默认第一个可用技能）
- [ ] 6.4 Client 重连 → Host 发送完整战场快照

## 7. Electron 打包（待实施 🔴）

- [ ] 7.1 Electron 主进程完整集成
- [ ] 7.2 双击 exe 即玩
