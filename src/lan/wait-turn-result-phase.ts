/**
 * WaitTurnResultPhase — Client 端接收 Host 回合结果
 * 直接应用 finalState（不推额外 Phase 防双重扣血）
 */

import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";
import { LanManager } from "./lan-manager";
import { CoopManager } from "./coop-manager";
import { Status } from "#data/status-effect";
import { StatusEffect } from "#enums/status-effect";
import { getPokemonNameWithAffix } from "#app/messages";
import type { TurnResult } from "./turn-result";
import i18next from "i18next";

export class WaitTurnResultPhase extends Phase {
  public readonly phaseName = "WaitTurnResultPhase";

  override start(): void {
    const coop = CoopManager.getInstance();
    const lm = LanManager.getInstance();
    if (!coop.isActive()) { this.end(); return; }

    const timeout = setTimeout(() => {
      if (!resolved) { console.log("[WAIT_RESULT] 30s超时"); cleanup(); this.end(); }
    }, 30000);

    const cleanup = () => { clearTimeout(timeout); lm.off("turn-result"); };

    let resolved = false;
    const handler = (data: any) => {
      if (resolved) return;
      const result: TurnResult = data.result || data;
      if (!result?.finalState) return;
      resolved = true;
      cleanup();

      console.log("[WAIT_RESULT] turn:", result.turn, "events:", result.events.length,
        "hp:", result.finalState.map(s => `${s.index}=${s.hp}`).join(","));

      const field = globalScene.getField();

      // 1. 显示战斗消息
      for (const evt of result.events) {
        if (evt.type === "MOVE") {
          const user = field[evt.user];
          if (user) {
            globalScene.phaseManager.queueMessage(
              i18next.t("battle:useMove", {
                pokemonNameWithAffix: getPokemonNameWithAffix(user),
                moveName: "",
              }),
              500,
            );
          }
        }
      }

      // 2. 直接应用最终状态（不推额外 Phase，避免双重扣血）
      for (const ps of result.finalState) {
        const pokemon = field[ps.index];
        if (!pokemon) continue;

        const oldHp = pokemon.hp;
        pokemon.hp = Math.max(0, ps.hp);

        // 显示扣血/回血消息
        const diff = oldHp - ps.hp;
        if (diff > 0) {
          globalScene.phaseManager.queueMessage(
            i18next.t("battle:hitResultEffective", { pokemonName: getPokemonNameWithAffix(pokemon) }),
            null,
          );
        }

        // 状态同步
        if (ps.status && !pokemon.status) {
          const effect = StatusEffect[ps.status as keyof typeof StatusEffect];
          if (effect != null) pokemon.status = new Status(effect);
        } else if (!ps.status && pokemon.status) {
          pokemon.status = null;
        }

        // 昏厥
        if (ps.fainted && !pokemon.isFainted()) {
          globalScene.phaseManager.queueMessage(
            i18next.t("battle:fainted", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) }),
            null, true,
          );
        }

        pokemon.updateInfo();
      }

      // 3. 刷新 UI
      globalScene.updateGameInfo();
      this.end();
    };

    lm.on("turn-result", handler);
    const pending = lm.getPendingTurnResult?.();
    if (pending) { handler(pending); }
  }
}
