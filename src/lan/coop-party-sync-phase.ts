/**
 * 队伍同步 Phase - 确认双方选完初始宝可梦
 *
 * 独立游戏模型：双方各自拥有独立队伍，不共享宝可梦。
 * 此 Phase 仅确认双方都已选完初始宝可梦，可以开始第一场战斗。
 */

import { Phase } from "#app/phase";
import { LanManager } from "./lan-manager";
import { CoopManager } from "./coop-manager";

export class CoopPartySyncPhase extends Phase {
  public readonly phaseName = "CoopPartySyncPhase";

  override start(): void {
    const lm = LanManager.getInstance();
    const coop = CoopManager.getInstance();

    if (coop.isPartySynced()) { this.end(); return; }

    // 发送确认信号（不含队伍数据 — 队伍是独立的）
    lm.send({ type: "party-sync", party: [], sender: lm.getRole() });

    // 等待对方确认
    lm.on("party-sync", (_party: any[], sender?: string) => {
      if (sender === lm.getRole()) return;

      console.log("[PARTY_SYNC] 对方已选完初始宝可梦");
      coop.setPartySynced();
      this.end();
    });

    // 30s 超时
    setTimeout(() => { this.end(); }, 30000);
  }
}
