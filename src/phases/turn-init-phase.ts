import { globalScene } from "#app/global-scene";
import { BattlerIndex } from "#enums/battler-index";
import { TurnInitEvent } from "#events/battle-scene";
import type { PlayerPokemon } from "#field/pokemon";
import { CoopManager } from "#app/lan/coop-manager";
import {
  handleMysteryEncounterBattleStartEffects,
  handleMysteryEncounterTurnStartEffects,
} from "#mystery-encounters/encounter-phase-utils";
import { FieldPhase } from "#phases/field-phase";
import i18next from "i18next";

export class TurnInitPhase extends FieldPhase {
  public readonly phaseName = "TurnInitPhase";
  start() {
    super.start();

    globalScene.getPlayerField().forEach(p => {
      if (p.isOnField() && !p.isAllowedInBattle()) {
        globalScene.phaseManager.queueMessage(
          i18next.t("challenges:illegalEvolution", { pokemon: p.name }), null, true,
        );
        const allowedPokemon = globalScene.getPokemonAllowedInBattle();
        if (allowedPokemon.length === 0) {
          globalScene.phaseManager.clearPhaseQueue();
          globalScene.phaseManager.unshiftNew("GameOverPhase");
        } else if (
          allowedPokemon.length >= globalScene.currentBattle.getBattlerCount()
          || (globalScene.currentBattle.double && !allowedPokemon[0].isActive(true))
        ) {
          p.switchOut();
        } else {
          p.leaveField();
        }
        if (allowedPokemon.length === 1 && globalScene.currentBattle.double) {
          globalScene.phaseManager.unshiftNew("ToggleDoublePositionPhase", true);
        }
      }
    });

    // 合作模式：首次回合前同步队伍数据
    const coopManager = CoopManager.getInstance();
    if (coopManager.isActive() && !coopManager.isPartySynced()) {
      globalScene.phaseManager.unshiftNew("CoopPartySyncPhase");
    }

    globalScene.eventTarget.dispatchEvent(new TurnInitEvent());
    handleMysteryEncounterBattleStartEffects();
    if (handleMysteryEncounterTurnStartEffects()) { this.end(); return; }

    const coopManager = CoopManager.getInstance();
    const isCoop = coopManager.isActive();
    const localRole = isCoop ? coopManager.getLocalRole() : null;

    globalScene.getField().forEach((pokemon, i) => {
      if (pokemon?.isActive()) {
        if (pokemon.isPlayer()) {
          globalScene.currentBattle.addParticipant(pokemon as PlayerPokemon);
        }
        pokemon.resetTurnData();

        if (pokemon.isPlayer()) {
          // 合作模式：只为本地宝可梦显示指令菜单
          if (isCoop) {
            const isLocal =
              (localRole === "host" && i === BattlerIndex.PLAYER)
              || (localRole === "client" && i === BattlerIndex.PLAYER_2);
            if (isLocal) {
              globalScene.phaseManager.pushNew("CommandPhase", i);
            }
            // 远程宝可梦的指令由 CoopSyncPhase 从网络接收
          } else {
            globalScene.phaseManager.pushNew("CommandPhase", i);
          }
        } else {
          globalScene.phaseManager.pushNew("EnemyCommandPhase", i - BattlerIndex.ENEMY);
        }
      }
    });

    // 合作模式：指令同步（发送本地指令 + 等待远程指令）
    if (isCoop) {
      globalScene.phaseManager.pushNew("CoopSyncPhase");
    }

    globalScene.phaseManager.pushNew("TurnStartPhase");
    this.end();
  }
}
