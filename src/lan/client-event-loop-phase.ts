/**
 * ClientEventLoopPhase — Client 端事件循环
 *
 * 等待 Host 发送的回合结果（事件流 + 最终快照）。
 * 收到后：推入 ReplayPhases → 最后 ApplySnapshotPhase 验证。
 *
 * 替代原来的 ApplySnapshotPhase 单独等待。
 */

import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";
import { LanManager } from "./lan-manager";
import { CoopManager } from "./coop-manager";
import type { BattleAnimEvent } from "./battle-anim-event";
import type { TurnSnapshot } from "./turn-snapshot";

export class ClientEventLoopPhase extends Phase {
  public readonly phaseName = "ClientEventLoopPhase";
  private received = false;

  override start(): void {
    const coop = CoopManager.getInstance();
    if (!coop.isActive()) {
      this.end();
      return;
    }

    const lm = LanManager.getInstance();

    // 先检查缓存的回合结果（防竞态：turn-result 可能在 Phase 启动前就已到达）
    const cached = lm.getLastTurnResult();
    if (cached) {
      console.log("[EVENT_LOOP] 使用缓存的回合结果, events:", cached.events.length);
      this.processTurnResult(cached.events, cached.snapshot);
      return;
    }

    const handler = (events: BattleAnimEvent[], snapshot: TurnSnapshot) => {
      if (this.received) return;
      this.received = true;
      cleanup();
      console.log("[EVENT_LOOP] 收到回合结果, events:", events.length, "turn:", snapshot.turn);
      this.processTurnResult(events, snapshot);
    };

    lm.on("turn-result", handler);

    // 30s 超时
    const timeout = setTimeout(() => {
      if (!this.received) {
        console.log("[EVENT_LOOP] 超时, 直接结束");
        cleanup();
        this.end();
      }
    }, 30000);

    const cleanup = () => {
      clearTimeout(timeout);
      lm.off("turn-result");
    };
  }

  /**
   * 处理回合结果：推入 ReplayPhases → 最后 ApplySnapshotPhase
   */
  private processTurnResult(events: BattleAnimEvent[], _snapshot: TurnSnapshot): void {
    for (const event of events) {
      switch (event.type) {
        case "MESSAGE":
          globalScene.phaseManager.pushNew("ReplayMessagePhase", event.text);
          break;
        case "MOVE_USED":
          globalScene.phaseManager.pushNew("ReplayMovePhase", event.userIndex, event.moveName);
          break;
        case "DAMAGE":
          globalScene.phaseManager.pushNew("ReplayDamagePhase", event.targetIndex, event.damage);
          break;
        case "FAINT":
          globalScene.phaseManager.pushNew("ReplayFaintPhase", event.targetIndex);
          break;
        case "HEAL":
          globalScene.phaseManager.pushNew("ReplayDamagePhase", event.targetIndex, -event.amount);
          break;
        case "MISS":
        case "NO_EFFECT":
        case "STATUS":
        case "STAT_CHANGE":
        case "TURN_END":
          // 这些效果通过 MESSAGE 事件已经覆盖（文本显示）
          break;
      }
    }

    // 最后应用快照验证最终状态
    globalScene.phaseManager.pushNew("ApplySnapshotPhase");

    this.end();
  }
}
