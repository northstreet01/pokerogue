/**
 * SendTurnResultPhase — Host 端打包回合事件+最终状态发送给 Client
 */

import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";
import { LanManager } from "./lan-manager";
import { CoopManager } from "./coop-manager";
import type { TurnResult, TurnEvent, PokeState } from "./turn-result";
import { StatusEffect } from "#enums/status-effect";
import { BattlerIndex } from "#enums/battler-index";

export class SendTurnResultPhase extends Phase {
  public readonly phaseName = "SendTurnResultPhase";

  override start(): void {
    const coop = CoopManager.getInstance();
    const lm = LanManager.getInstance();
    if (!coop.isActive() || !lm.isHost()) { this.end(); return; }

    const field = globalScene.getField();
    const battle = globalScene.currentBattle;
    const turn = battle.turn;

    // 收集事件：谁用了什么技能
    const events: TurnEvent[] = [];
    for (let i = 0; i <= BattlerIndex.ENEMY_2; i++) {
      const cmd = battle.turnCommands[i];
      if (cmd && cmd.command === 0 && cmd.move) { // FIGHT
        const user = field[i];
        if (user) {
          events.push({
            type: "MOVE",
            user: i,
            moveId: cmd.move.move,
            moveName: "", // Client 本地查
            targets: cmd.targets ?? cmd.move.targets ?? [],
          });
        }
      }
    }

    // 最终状态
    const finalState: PokeState[] = field.map((p, i) => ({
      index: i,
      hp: p?.hp ?? 0,
      maxHp: p?.getMaxHp?.() ?? 0,
      status: p?.status?.effect != null ? StatusEffect[p.status.effect] : null,
      fainted: p?.isFainted?.() ?? false,
    }));

    const result: TurnResult = { turn, events, finalState };
    lm.send({ type: "turn-result", result });
    console.log("[SEND_RESULT] turn:", turn, "events:", events.length, "finalState:", finalState.map(s => `${s.index}:hp=${s.hp}/${s.maxHp}`).join(", "));

    this.end();
  }
}
