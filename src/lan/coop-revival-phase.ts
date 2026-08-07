/**
 * 合作模式复活 Phase
 * 波次结束后检查是否需要复活队友
 *
 * 规则：一方全灭，另一方存活 → 复活全灭方所有宝可梦至 10% HP + 清除异常状态
 */

import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";
import { CoopManager } from "./coop-manager";

export class CoopRevivalPhase extends Phase {
  public readonly phaseName = "CoopRevivalPhase";

  override start(): void {
    const coopManager = CoopManager.getInstance();

    if (!coopManager.isActive() || !coopManager.needsRevival()) {
      this.end();
      return;
    }

    const state = coopManager.getState();

    if (state.localPlayerAllFainted) {
      // 我方全灭 → 对方存活 → 复活我方
      const playerParty = globalScene.getPlayerParty();
      const revived = coopManager.reviveParty(playerParty);
      if (revived > 0) {
        globalScene.phaseManager.queueMessage(
          `队友将你的 ${revived} 只宝可梦复活了！（恢复至 10% HP）`,
          null,
          true,
        );
      }
    }

    if (state.remotePlayerAllFainted) {
      // 对方全灭 → 我方存活 → 通知我方
      // 实际复活在对方本地执行
      globalScene.phaseManager.queueMessage("你的队友被复活了！（恢复至 10% HP）", null, true);
    }

    // 重置昏厥标记
    coopManager.advanceWave();

    this.end();
  }
}
