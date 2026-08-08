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

    let resolved = false;

    const goNextWave = (waveIndex: number) => {
      console.log("[WAIT_RESULT] 进入下一波:", waveIndex);
      resolved = true;
      clearTimeout(timeout);
      lm.off("turn-result");
      lm.off("wave-complete");
      globalScene.phaseManager.clearPhaseQueue();
      globalScene.phaseManager.pushNew("EncounterPhase", false);
      this.end();
    };

    // 检查缓存的 wave-complete（可能在回合结束前就到了）
    const pendingWave = lm.getPendingWaveComplete();
    if (pendingWave != null) { goNextWave(pendingWave); return; }

    lm.on("wave-complete", (wi: number) => {
      if (!resolved) goNextWave(wi);
    });

    const timeout = setTimeout(() => {
      if (!resolved) { console.log("[WAIT_RESULT] 30s超时"); lm.off("turn-result"); lm.off("wave-complete"); this.end(); }
    }, 30000);

    const processResult = (data: any) => {
      if (resolved) return;
      const result: TurnResult = data.result || data;
      if (!result?.finalState) return;

      console.log("[WAIT_RESULT] turn:", result.turn, "hp:", result.finalState.map(s => `${s.index}=${s.hp}`).join(","));

      const field = globalScene.getField();

      // 显示技能使用消息
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

      // 应用最终状态 + 移除昏厥精灵
      let anyFainted = false;
      for (const ps of result.finalState) {
        const pokemon = field[ps.index];
        if (!pokemon) continue;

        pokemon.hp = Math.max(0, ps.hp);

        if (ps.status) {
          const effect = StatusEffect[ps.status as keyof typeof StatusEffect];
          if (effect != null) pokemon.status = new Status(effect);
        } else if (!ps.status && pokemon.status) {
          pokemon.status = null;
        }

        if (ps.fainted && !pokemon.isFainted()) {
          anyFainted = true;
          globalScene.phaseManager.queueMessage(
            i18next.t("battle:fainted", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) }),
            null, true,
          );
          // 强制隐藏 + 标记离场
          pokemon.setVisible(false);
          pokemon.hp = 0;
        }

        pokemon.updateInfo();
      }

      // 检查是否所有敌人都死了
      const enemiesAlive = field.slice(BattlerIndex.ENEMY).filter(p => p && p.isActive() && !p.isFainted());
      if (enemiesAlive.length === 0) {
        console.log("[WAIT_RESULT] 所有敌人昏厥, 等待 wave-complete");
        // 不清理 wave-complete 监听器，等 Host 发 wave-complete
        lm.off("turn-result");
        // wave-complete 监听器已经在 start 中注册，或从缓存获取
        return;
      }

      lm.off("turn-result");
      this.end();
    };

    lm.on("turn-result", processResult);
    const pending = lm.getPendingTurnResult?.();
    if (pending) processResult(pending);
  }
}
