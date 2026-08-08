/**
 * 合作模式管理器 - TCP 版
 */

import type { PlayerPokemon } from "#app/field/pokemon";
import { LanManager } from "./lan-manager";

export interface CoopState {
  active: boolean;
  waveIndex: number;
  localPlayerAllFainted: boolean;
  remotePlayerAllFainted: boolean;
  itemPickTurn: 0 | 1;
  pvpWinStreak: number;
}

export class CoopManager {
  private static instance: CoopManager | null = null;
  private state: CoopState = {
    active: false, waveIndex: 1,
    localPlayerAllFainted: false, remotePlayerAllFainted: false,
    itemPickTurn: 0, pvpWinStreak: 0,
  };
  private lm = LanManager.getInstance();
  private partySynced = false;
  private _pendingSeed: string | null = null;

  private constructor() {}

  isPartySynced(): boolean { return this.partySynced; }
  setPartySynced(): void { this.partySynced = true; }

  /** 存储待用的合作模式种子（Host 发送给 Client 的同步种子） */
  setPendingSeed(seed: string): void { this._pendingSeed = seed; }

  /** 获取并清除待用种子 */
  getPendingSeed(): string | null { const s = this._pendingSeed; this._pendingSeed = null; return s; }

  static getInstance(): CoopManager {
    if (!CoopManager.instance) { CoopManager.instance = new CoopManager(); }
    return CoopManager.instance;
  }

  static reset(): void { CoopManager.instance = null; }

  start(): void {
    this.state.active = true;
    this.state.waveIndex = 1;
    this.state.localPlayerAllFainted = false;
    this.state.remotePlayerAllFainted = false;
  }

  stop(): void { this.state.active = false; }
  getState(): Readonly<CoopState> { return this.state; }
  isActive(): boolean { return this.state.active; }

  notifyLocalFaint(allFainted: boolean): void {
    this.state.localPlayerAllFainted = allFainted;
    if (allFainted) { this.lm.sendFaint(true); }
  }

  onRemoteFaint(allFainted: boolean): void {
    this.state.remotePlayerAllFainted = allFainted;
  }

  needsRevival(): boolean {
    return this.state.active
      && (this.state.localPlayerAllFainted || this.state.remotePlayerAllFainted)
      && !(this.state.localPlayerAllFainted && this.state.remotePlayerAllFainted);
  }

  reviveParty(party: PlayerPokemon[]): number {
    let count = 0;
    for (const p of party) {
      if (p.isFainted()) {
        p.hp = Math.max(1, Math.floor(p.getMaxHp() * 0.1));
        p.resetStatus();
        count++;
      }
    }
    return count;
  }

  advanceWave(): void {
    this.state.waveIndex++;
    this.state.localPlayerAllFainted = false;
    this.state.remotePlayerAllFainted = false;
  }

  getLocalRole(): "host" | "client" { return this.lm.getRole(); }
}
