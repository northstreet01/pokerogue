/**
 * WaitTurnResultPhase — Client 端接收 Host 回合结果并播放动画
 *
 * 复用游戏现有 Phase（DamageAnimPhase / MessagePhase）播放回合结算。
 * 不新建 ReplayPhase —— 直接用游戏内建动画。
 */

import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";
import { LanManager } from "./lan-manager";
import { CoopManager } from "./coop-manager";
import { Status } from "#data/status-effect";
import { StatusEffect } from "#enums/status-effect";
import { HitResult } from "#enums/hit-result";
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

      console.log("[WAIT_RESULT] turn:", result.turn, "events:", result.events.length);

      // 1. 为每个 MOVE 事件推技能名消息 + 扣血/回复动画
      const oldHp = globalScene.getField().map(p => p?.hp ?? 0);

      for (const evt of result.events) {
        if (evt.type === "MOVE") {
          const user = globalScene.getField()[evt.user];
          if (user) {
            globalScene.phaseManager.pushNew("MessagePhase",
              i18next.t("battle:useMove", {
                pokemonNameWithAffix: getPokemonNameWithAffix(user),
                moveName: "", // TODO: Client 本地查 move name
              }));
          }
        }
      }

      // 2. 对比 HP 变化 → 推 DamageAnimPhase
      const field = globalScene.getField();
      for (const ps of result.finalState) {
        const pokemon = field[ps.index];
        if (!pokemon) continue;
        const hpDiff = oldHp[ps.index] - ps.hp;
        if (hpDiff > 0) {
          // 扣血动画
          globalScene.phaseManager.pushNew("DamageAnimPhase",
            ps.index as any, hpDiff, HitResult.EFFECTIVE, false);
        } else if (hpDiff < 0) {
          // 回血：用 PokemonHealPhase
          globalScene.phaseManager.pushNew("PokemonHealPhase",
            ps.index as any, -hpDiff, null, false, true);
        }
        if (ps.fainted && !pokemon.isFainted()) {
          globalScene.phaseManager.pushNew("MessagePhase",
            i18next.t("battle:fainted", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) }));
        }
        // 应用最终状态
        pokemon.hp = ps.hp;
        if (ps.status) {
          const effect = StatusEffect[ps.status as keyof typeof StatusEffect];
          if (effect != null) pokemon.status = new Status(effect);
        } else if (!ps.status && pokemon.status) {
          pokemon.status = null;
        }
        pokemon.updateInfo();
      }

      this.end();
    };

    lm.on("turn-result", handler);
    const pending = lm.getPendingTurnResult?.();
    if (pending) { handler(pending); }
  }
}
