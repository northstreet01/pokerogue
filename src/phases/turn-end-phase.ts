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

    // 合作模式：同步敌人 HP —— 交换本回合双方对敌人造成的伤害
    this.syncEnemyDamage();

    this.end();
  }

  /**
   * P2P 敌人HP同步：发送本回合本地宝可梦对敌人造成的伤害，
   * 接收对方宝可梦对敌人造成的伤害，双方保持敌人血量一致。
   */
  private syncEnemyDamage(): void {
    const coop = CoopManager.getInstance();
    const lm = LanManager.getInstance();
    if (!coop.isActive()) return;

    const field = globalScene.getField();

    // 收集我方宝可梦对敌人造成的伤害（敌方位置 HP 变化）
    const enemyHp: Array<{ index: number; hp: number; maxHp: number }> = [];
    for (let i = BattlerIndex.ENEMY; i <= BattlerIndex.ENEMY_2; i++) {
      const enemy = field[i];
      if (enemy) {
        enemyHp.push({ index: i, hp: enemy.hp, maxHp: enemy.getMaxHp() });
      }
    }

    // 发送给队友
    lm.send({ type: "enemy-hp-sync", enemyHp, sender: lm.getRole() });

    // 接收队友的敌人HP
    lm.on("enemy-hp-sync", (data: any) => {
      if (!data || data.sender === lm.getRole()) return;

      console.log("[TURN_END] 收到队友敌人HP同步:", JSON.stringify(data.enemyHp));

      for (const eh of data.enemyHp) {
        const enemy = field[eh.index];
        if (enemy) {
          // 取最低HP（保守策略：谁打的伤害多就用谁的）
          enemy.hp = Math.min(enemy.hp, eh.hp);
          enemy.updateInfo();
        }
      }
    });
  }
}
