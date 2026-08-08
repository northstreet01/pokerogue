/**
 * WaitTurnResultPhase — Client 端等待 Host 的回合结算结果
 * 收到后应用最终状态到本地宝可梦
 */

import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";
import { LanManager } from "./lan-manager";
import { CoopManager } from "./coop-manager";
import { Status } from "#data/status-effect";
import { StatusEffect } from "#enums/status-effect";
import type { TurnResult } from "./turn-result";

export class WaitTurnResultPhase extends Phase {
  public readonly phaseName = "WaitTurnResultPhase";

  override start(): void {
    const coop = CoopManager.getInstance();
    const lm = LanManager.getInstance();
    if (!coop.isActive()) { this.end(); return; }

    let resolved = false;
    const handler = (data: any) => {
      if (resolved) return;
      const result: TurnResult = data.result || data;
      if (!result?.finalState) return;
      resolved = true;
      cleanup();

      console.log("[WAIT_RESULT] 收到回合结果, turn:", result.turn);

      const field = globalScene.getField();
      for (const ps of result.finalState) {
        const pokemon = field[ps.index];
        if (!pokemon) continue;
        pokemon.hp = ps.hp;
        if (ps.status) {
          const effect = StatusEffect[ps.status as keyof typeof StatusEffect];
          if (effect != null) {
            pokemon.status = new Status(effect);
            pokemon.updateInfo();
          }
        } else if (!ps.status && pokemon.status) {
          pokemon.status = null;
          pokemon.updateInfo();
        }
        pokemon.updateInfo();
      }

      this.end();
    };

    lm.on("turn-result", handler);

    // 检查缓存
    const pending = lm.getPendingTurnResult?.();
    if (pending) { handler(pending); return; }

    const timeout = setTimeout(() => {
      if (!resolved) { console.log("[WAIT_RESULT] 30s超时"); cleanup(); this.end(); }
    }, 30000);

    const cleanup = () => { clearTimeout(timeout); lm.off("turn-result"); };
  }
}
