/**
 * 合作模式管理器
 * 处理双人合作闯关的核心逻辑：队伍管理、复活、奖励分配
 */

import type { PlayerPokemon } from "#app/field/pokemon";
import { LanManager } from "./lan-manager";

/**
 * 合作模式状态
 */
export interface CoopState {
  /** 合作是否激活 */
  active: boolean;
  /** 当前波次 */
  waveIndex: number;
  /** 我方玩家是否全灭 */
  localPlayerAllFainted: boolean;
  /** 对方玩家是否全灭 */
  remotePlayerAllFainted: boolean;
  /** 道具选择轮次 (0=我方先选, 1=对方先选) */
  itemPickTurn: 0 | 1;
  /** PvP 连胜计数 */
  pvpWinStreak: number;
}

export class CoopManager {
  private static instance: CoopManager | null = null;

  private state: CoopState = {
    active: false,
    waveIndex: 1,
    localPlayerAllFainted: false,
    remotePlayerAllFainted: false,
    itemPickTurn: 0,
    pvpWinStreak: 0,
  };

  private lanManager: LanManager;

  private constructor() {
    this.lanManager = LanManager.getInstance();
  }

  static getInstance(): CoopManager {
    if (!CoopManager.instance) {
      CoopManager.instance = new CoopManager();
    }
    return CoopManager.instance;
  }

  static reset(): void {
    CoopManager.instance = null;
  }

  /** 启动合作模式 */
  start(rngSeed: string): void {
    this.state.active = true;
    this.state.waveIndex = 1;
    this.state.localPlayerAllFainted = false;
    this.state.remotePlayerAllFainted = false;
    this.state.itemPickTurn = 0;

    // 同步 RNG 种子
    this.lanManager.syncRngSeed(rngSeed);
  }

  /** 停止合作模式 */
  stop(): void {
    this.state.active = false;
  }

  getState(): Readonly<CoopState> {
    return this.state;
  }

  isActive(): boolean {
    return this.state.active;
  }

  /** 通知队友我的队伍全灭了 */
  notifyLocalFaint(allFainted: boolean): void {
    this.state.localPlayerAllFainted = allFainted;
    if (allFainted) {
      this.lanManager.notifyFaint(true);
    }
  }

  /** 收到远程玩家昏厥通知 */
  onRemoteFaint(allFainted: boolean): void {
    this.state.remotePlayerAllFainted = allFainted;
  }

  /**
   * 检查是否需要复活
   * 条件：一方全灭，另一方存活，当前波次结束
   */
  needsRevival(): boolean {
    return (
      this.state.active
      && (this.state.localPlayerAllFainted || this.state.remotePlayerAllFainted)
      && !(this.state.localPlayerAllFainted && this.state.remotePlayerAllFainted) // 不全灭
    );
  }

  /**
   * 复活全灭方的所有宝可梦至 10% HP
   * @param faintedParty 全灭方的队伍
   * @returns 被复活的宝可梦数量
   */
  reviveParty(faintedParty: PlayerPokemon[]): number {
    let revivedCount = 0;
    for (const pokemon of faintedParty) {
      if (pokemon.isFainted()) {
        // 复活至 10% HP
        const maxHp = pokemon.getMaxHp();
        const reviveHp = Math.max(1, Math.floor(maxHp * 0.1));
        pokemon.hp = reviveHp;
        pokemon.resetStatus(); // 清除状态异常
        revivedCount++;
      }
    }
    return revivedCount;
  }

  /**
   * 道具轮流选择：返回哪方先选
   * A→B→B→A 轮流
   */
  getItemPickOrder(): "local" | "remote" {
    const order = this.state.itemPickTurn === 0 ? "local" : "remote";
    this.state.itemPickTurn = this.state.itemPickTurn === 0 ? 1 : 0;
    return order;
  }

  /** 推进波次 */
  advanceWave(): void {
    this.state.waveIndex++;
    this.state.localPlayerAllFainted = false;
    this.state.remotePlayerAllFainted = false;
  }

  /** 获取 PvP 连胜 */
  getPvpWinStreak(): number {
    return this.state.pvpWinStreak;
  }

  /** PvP 胜 */
  pvpWin(): void {
    this.state.pvpWinStreak++;
  }

  /** PvP 负 */
  pvpLose(): void {
    this.state.pvpWinStreak = 0;
  }

  /** 是否在合作模式中 */
  isCoopBattle(): boolean {
    return this.state.active;
  }

  /** 获取本地玩家的角色 */
  getLocalRole(): "host" | "client" {
    return this.lanManager.getRole();
  }
}
