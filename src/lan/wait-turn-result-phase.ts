/**
 * WaitTurnResultPhase — Client 端轮询等待 Host turn-result（30s 超时）
 * 应用 HP/状态、移除昏厥精灵
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
  private startTime = Date.now();

  override start(): void {
    if (!CoopManager.getInstance().isActive()) { this.end(); return; }
    this.poll();
  }

  private poll(): void {
    const data = LanManager.getInstance().getPendingTurnResult?.();
    if (data) {
      const result: TurnResult = data.result || data;
      if (!result?.finalState) { this.end(); return; }

      console.log("[WAIT_RESULT] turn:", result.turn,
        "hp:", result.finalState.map(s => `${s.index}=${s.hp}`).join(","));

      const field = globalScene.getField();

      // 显示出招消息
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

      // 应用状态
      for (const ps of result.finalState) {
        const pokemon = field[ps.index];
        if (!pokemon) continue;
        pokemon.hp = Math.max(0, ps.hp);
        if (ps.status) {
          const e = StatusEffect[ps.status as keyof typeof StatusEffect];
          if (e != null) pokemon.status = new Status(e);
        } else if (!ps.status && pokemon.status) {
          pokemon.status = null;
        }
        if (ps.fainted && !pokemon.isFainted()) {
          globalScene.phaseManager.queueMessage(
            i18next.t("battle:fainted", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) }),
            null, true,
          );
          pokemon.setVisible(false);
        }
        pokemon.updateInfo();
      }

      // 检查波次结束
      const enemiesAlive = field.slice(BattlerIndex.ENEMY).filter(p => p && p.isActive() && !p.isFainted());
      if (enemiesAlive.length === 0) {
        console.log("[WAIT_RESULT] 所有敌人昏厥, 等待 wave-complete");
        // 继续轮询 wave-complete
        this.pollWaveComplete();
        return;
      }

      this.end();
      return;
    }

    if (Date.now() - this.startTime > 30000) { this.end(); return; }
    setTimeout(() => this.poll(), 100);
  }

  private pollWaveComplete(): void {
    const wi = LanManager.getInstance().getPendingWaveComplete();
    if (wi != null) {
      console.log("[WAIT_RESULT] 进入下一波:", wi);
      globalScene.phaseManager.clearPhaseQueue();
      globalScene.phaseManager.pushNew("EncounterPhase", false);
      this.end();
      return;
    }
    if (Date.now() - this.startTime > 60000) { this.end(); return; }
    setTimeout(() => this.pollWaveComplete(), 100);
  }
}
