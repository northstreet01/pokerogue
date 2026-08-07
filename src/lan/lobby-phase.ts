/**
 * 大厅协调器
 * 纯逻辑层，不依赖 Phase 系统。由 LobbyUiHandler 驱动。
 */

import { LanManager } from "./lan-manager";
import type { GameStartPayload, PlayerInfo } from "./lan-message";

export type LobbyEventCallback = {
  /** 对手加入 */
  onOpponentJoined?: (info: PlayerInfo) => void;
  /** 对手离开 */
  onOpponentLeft?: () => void;
  /** 对手就绪状态变化 */
  onOpponentReady?: (ready: boolean) => void;
  /** 游戏开始 */
  onGameStart?: (payload: GameStartPayload) => void;
  /** 错误 */
  onError?: (code: string, message: string) => void;
};

export class LobbyCoordinator {
  private lanManager: LanManager;

  constructor() {
    this.lanManager = LanManager.getInstance();
  }

  /** 绑定事件 */
  bindEvents(callbacks: LobbyEventCallback): void {
    const events: Record<string, unknown> = {};
    if (callbacks.onOpponentJoined) { events.onOpponentJoined = callbacks.onOpponentJoined; }
    if (callbacks.onOpponentLeft) { events.onOpponentLeft = callbacks.onOpponentLeft; }
    if (callbacks.onOpponentReady) { events.onOpponentReady = callbacks.onOpponentReady; }
    if (callbacks.onGameStart) { events.onGameStart = callbacks.onGameStart; }
    if (callbacks.onError) { events.onError = callbacks.onError; }
    this.lanManager.setEvents(events as any);
  }

  /** 清理 */
  cleanup(): void {
    this.lanManager.leaveRoom();
  }

  /** 设置就绪 */
  setReady(ready: boolean): void {
    this.lanManager.setReady(ready);
  }

  /** 开始游戏（Host 调用） */
  startGame(): void {
    if (!this.lanManager.isHost()) {
      return;
    }
    const rngSeed = this.generateRngSeed();
    this.lanManager.startGame(rngSeed);
  }

  /** 生成随机种子 */
  generateRngSeed(): string {
    const chars = "0123456789abcdef";
    let seed = "";
    for (let i = 0; i < 32; i++) {
      seed += chars[Math.floor(Math.random() * chars.length)];
    }
    return seed;
  }

  /** 检查双方是否就绪 */
  checkBothReady(myReady: boolean, opponentReady: boolean): boolean {
    return myReady && opponentReady;
  }
}
