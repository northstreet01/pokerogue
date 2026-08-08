import { applyAbAttrs } from "#abilities/apply-ab-attrs";
import { globalScene } from "#app/global-scene";
import { getPokemonNameWithAffix } from "#app/messages";
import { CoopManager } from "#app/lan/coop-manager";
import { LanManager } from "#app/lan/lan-manager";
import { TerrainType } from "#data/terrain";
import { BattlerTagLapseType } from "#enums/battler-tag-lapse-type";
import { BattlerIndex } from "#enums/battler-index";
import { WeatherType } from "#enums/weather-type";
import { TurnEndEvent } from "#events/battle-scene";
import type { Pokemon } from "#field/pokemon";
import {
  EnemyStatusEffectHealChanceModifier,
  EnemyTurnHealModifier,
  TurnHealModifier,
  TurnHeldItemTransferModifier,
  TurnStatusEffectModifier,
} from "#modifiers/modifier";
import { FieldPhase } from "#phases/field-phase";
import i18next from "i18next";

export class TurnEndPhase extends FieldPhase {
  public readonly phaseName = "TurnEndPhase";
  public upcomingInterlude = false;

  start() {
    super.start();

    globalScene.currentBattle.incrementTurn();
    globalScene.eventTarget.dispatchEvent(new TurnEndEvent(globalScene.currentBattle.turn));
    globalScene.phaseManager.dynamicQueueManager.clearLastTurnOrder();

    globalScene.phaseManager.hideAbilityBar();

    const handlePokemon = (pokemon: Pokemon) => {
      if (!pokemon.switchOutStatus) {
        pokemon.lapseTags(BattlerTagLapseType.TURN_END);

        globalScene.applyModifiers(TurnHealModifier, pokemon.isPlayer(), pokemon);

        if (globalScene.arena.terrain?.terrainType === TerrainType.GRASSY && pokemon.isGrounded()) {
          globalScene.phaseManager.unshiftNew(
            "PokemonHealPhase",
            pokemon.getBattlerIndex(),
            Math.max(pokemon.getMaxHp() >> 4, 1),
            i18next.t("battle:turnEndHpRestore", {
              pokemonName: getPokemonNameWithAffix(pokemon),
            }),
            true,
          );
        }

        if (!pokemon.isPlayer()) {
          globalScene.applyModifiers(EnemyTurnHealModifier, false, pokemon);
          globalScene.applyModifier(EnemyStatusEffectHealChanceModifier, false, pokemon);
        }

        applyAbAttrs("PostTurnAbAttr", { pokemon });
      }

      globalScene.applyModifiers(TurnStatusEffectModifier, pokemon.isPlayer(), pokemon);
      globalScene.applyModifiers(TurnHeldItemTransferModifier, pokemon.isPlayer(), pokemon);

      pokemon.tempSummonData.turnCount++;
      pokemon.tempSummonData.waveTurnCount++;
    };

    if (!this.upcomingInterlude) {
      this.executeForAll(handlePokemon);

      globalScene.arena.lapseTags();
    }

    if (globalScene.arena.weather && !globalScene.arena.weather.lapse()) {
      globalScene.arena.trySetWeather(WeatherType.NONE);
      globalScene.arena.triggerWeatherBasedFormChangesToNormal();
    }

    if (globalScene.arena.terrain && !globalScene.arena.terrain.lapse()) {
      globalScene.arena.trySetTerrain(TerrainType.NONE);
    }

    // 合作模式：同步敌人 HP
    this.syncEnemyDamage();

    this.end();
  }

  /**
   * P2P 敌人HP同步：交换双方宝可梦对敌人造成的本轮伤害，取最低 HP。
   * 注意：单次监听，收到后立即清理，防止每回合累积。
   */
  private syncEnemyDamage(): void {
    const coop = CoopManager.getInstance();
    const lm = LanManager.getInstance();
    if (!coop.isActive()) return;

    const field = globalScene.getField();

    // 收集本方看到的敌人 HP
    const enemyHp: Array<{ index: number; hp: number }> = [];
    for (let i = BattlerIndex.ENEMY; i <= BattlerIndex.ENEMY_2; i++) {
      const enemy = field[i];
      if (enemy?.isActive()) {
        enemyHp.push({ index: i, hp: enemy.hp });
      }
    }

    // 一次性监听：收到对方敌人的 HP 后合并（取最低值）
    let synced = false;
    const handler = (data: any) => {
      if (synced || !data || data.sender === lm.getRole()) return;
      synced = true;
      clearTimeout(tid);
      lm.off("enemy-hp-sync");

      console.log("[TURN_END] 合并敌人HP:", JSON.stringify(data.enemyHp));
      for (const eh of data.enemyHp) {
        const enemy = field[eh.index];
        if (enemy) {
          enemy.hp = Math.min(enemy.hp, eh.hp);
          enemy.updateInfo();
        }
      }
    };
    lm.on("enemy-hp-sync", handler);

    // 超时清理（防止 listener 泄漏）
    const tid = setTimeout(() => {
      if (!synced) { lm.off("enemy-hp-sync"); }
    }, 5000);

    // 发送给队友
    lm.send({ type: "enemy-hp-sync", enemyHp, sender: lm.getRole() });
  }
}
