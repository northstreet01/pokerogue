/**
 * SendTurnResultPhase — Host 端将回合结算结果发送给 Client
 */

import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";
import { LanManager } from "./lan-manager";
import { CoopManager } from "./coop-manager";
import type { TurnResult, PokeState } from "./turn-result";
import { StatusEffect } from "#enums/status-effect";

export class SendTurnResultPhase extends Phase {
  public readonly phaseName = "SendTurnResultPhase";

  override start(): void {
    const coop = CoopManager.getInstance();
    const lm = LanManager.getInstance();
    if (!coop.isActive() || !lm.isHost()) { this.end(); return; }

    const field = globalScene.getField();
    const turn = globalScene.currentBattle.turn;

    const finalState: PokeState[] = field.map((p, i) => ({
      index: i,
      hp: p?.hp ?? 0,
      maxHp: p?.getMaxHp?.() ?? 0,
      status: p?.status?.effect != null ? StatusEffect[p.status.effect] : null,
      fainted: p?.isFainted?.() ?? false,
    }));

    const result: TurnResult = { turn, events: [], finalState };
    lm.send({ type: "turn-result", result });
    console.log("[SEND_RESULT] 回合结果已发送, turn:", turn);

    this.end();
  }
}
