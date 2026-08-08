/**
 * WaitTurnResultPhase — Client 端接收 Host 回合结果
 * 应用 HP/状态、移除昏厥精灵、检测波次结束
 */

import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";
import { LanManager } from "./lan-manager";
import { CoopManager } from "./coop-manager";
import { Status } from "#data/status-effect";
import { StatusEffect } from "#enums/status-effect";
import { getPokemonNameWithAffix } from "#app/messages";
import { BattlerIndex } from "#enums/battler-index";
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

    const cleanup = () => { clearTimeout(timeout); lm.off("turn-result"); lm.off("wave-complete"); };

    // 波次结束：Host 通知 Client 进入下一波
    lm.on("wave-complete", (waveIndex: number) => {
      console.log("[WAIT_RESULT] 波次完成, 下一波:", waveIndex);
      cleanup();
      // 结束当前战斗，进入下一波 EncounterPhase
      globalScene.phaseManager.clearPhaseQueue();
      globalScene.phaseManager.pushNew("EncounterPhase", false);
      this.end();
    });

    let resolved = false;
    const handler = (data: any) => {
      if (resolved) return;
      const result: TurnResult = data.result || data;
      if (!result?.finalState) return;
      resolved = true;

      console.log("[WAIT_RESULT] turn:", result.turn, "hp:", result.finalState.map(s => `${s.index}=${s.hp}`).join(","));

      const field = globalScene.getField();

      // 1. 显示战斗消息
      for (const evt of result.events) {
        if (evt.type === "MOVE") {
          const user = field[evt.user];
          if (user) {
            globalScene.phaseManager.queueMessage(
              i18next.t("battle:useMove", { pokemonNameWithAffix: getPokemonNameWithAffix(user), moveName: "" }),
              500,
            );
          }
        }
      }

      // 2. 应用最终状态
      for (const ps of result.finalState) {
        const pokemon = field[ps.index];
        if (!pokemon) continue;

        pokemon.hp = Math.max(0, ps.hp);

        // 状态同步
        if (ps.status && !pokemon.status) {
          const effect = StatusEffect[ps.status as keyof typeof StatusEffect];
          if (effect != null) pokemon.status = new Status(effect);
        } else if (!ps.status && pokemon.status) {
          pokemon.status = null;
        }

        // 昏厥：移除精灵
        if (ps.fainted && pokemon.isActive()) {
          globalScene.phaseManager.queueMessage(
            i18next.t("battle:fainted", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) }),
            null, true,
          );
          pokemon.leaveField(false);
        }

        pokemon.updateInfo();
      }

      // 3. 检查是否所有敌人都昏厥了
      const allEnemiesFainted = field.slice(BattlerIndex.ENEMY).every(
        p => !p || p.isFainted() || !p.isActive()
      );
      const anyEnemyAlive = field.slice(BattlerIndex.ENEMY).some(
        p => p && p.isActive() && !p.isFainted()
      );

      if (!anyEnemyAlive && allEnemiesFainted) {
        console.log("[WAIT_RESULT] 所有敌人昏厥, 等待 wave-complete");
        cleanup();
        // 不 end() —— 等 wave-complete 消息来推进
        lm.on("wave-complete", (wi: number) => {
          console.log("[WAIT_RESULT] 波次完成, 下一波:", wi);
          lm.off("wave-complete");
          globalScene.phaseManager.clearPhaseQueue();
          globalScene.phaseManager.pushNew("EncounterPhase", false);
          this.end();
        });
        return;
      }

      cleanup();
      this.end();
    };

    lm.on("turn-result", handler);
    const pending = lm.getPendingTurnResult?.();
    if (pending) { handler(pending); }
  }
}
