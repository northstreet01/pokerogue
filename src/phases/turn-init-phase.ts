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

    globalScene.eventTarget.dispatchEvent(new TurnInitEvent());
    handleMysteryEncounterBattleStartEffects();
    if (handleMysteryEncounterTurnStartEffects()) { this.end(); return; }

    const isCoop = CoopManager.getInstance().isActive();

    // 清除上一回合残留指令
    if (isCoop) {
      for (let i = 0; i < 4; i++) {
        delete globalScene.currentBattle.turnCommands[i];
        delete globalScene.currentBattle.preTurnCommands[i];
      }
    }

    globalScene.getField().forEach((pokemon, i) => {
      if (pokemon?.isActive()) {
        if (pokemon.isPlayer()) {
          globalScene.currentBattle.addParticipant(pokemon as PlayerPokemon);
        }
        pokemon.resetTurnData();

        if (pokemon.isPlayer()) {
          if (isCoop) {
            // 合作模式：双方各自只为己方宝可梦推 CommandPhase
            const localRole = CoopManager.getInstance().getLocalRole();
            const isLocal =
              (localRole === "host" && i === BattlerIndex.PLAYER)
              || (localRole === "client" && i === BattlerIndex.PLAYER_2);
            if (isLocal) {
              globalScene.phaseManager.pushNew("CommandPhase", i);
            }
          } else {
            globalScene.phaseManager.pushNew("CommandPhase", i);
          }
        } else {
          globalScene.phaseManager.pushNew("EnemyCommandPhase", i - BattlerIndex.ENEMY);
        }
      }
    });

    // 合作模式：双方都跑完整 TurnStartPhase
    // 仅在选招后通过 CoopSyncPhase 交换出招信息
    if (isCoop) {
      globalScene.phaseManager.pushNew("CoopSyncPhase");
    }
    globalScene.phaseManager.pushNew("TurnStartPhase");

    this.end();
  }
}
