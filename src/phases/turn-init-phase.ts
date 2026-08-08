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
    const localRole = isCoop ? CoopManager.getInstance().getLocalRole() : null;

    // 清除上回合残留
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
            const isLocal =
              (localRole === "host" && i === BattlerIndex.PLAYER)
              || (localRole === "client" && i === BattlerIndex.PLAYER_2);
            if (isLocal) {
              globalScene.phaseManager.pushNew("CommandPhase", i);
            }
          } else {
            globalScene.phaseManager.pushNew("CommandPhase", i);
          }
        } else if (!isCoop || localRole === "host") {
          // EnemyCommandPhase 只在 Host 运行（Client 不需要，Host 结算后通过结果同步）
          globalScene.phaseManager.pushNew("EnemyCommandPhase", i - BattlerIndex.ENEMY);
        }
      }
    });

    if (isCoop) {
      if (localRole === "host") {
        // Host: 命令收集阶段
        // CommandPhase(Host) → EnemyCommandPhases → RemoteWaitPhase(等Client) → TurnStartPhase(结算)
        // SendTurnResultPhase 由 TurnStartPhase 内部的 queueTurnEndPhases() 自动推入
        globalScene.phaseManager.pushNew("RemoteWaitPhase");
        globalScene.phaseManager.pushNew("TurnStartPhase");
      } else {
        // Client: 命令选择 → 发送 → 等待Host结算
        // CommandPhase(Client) → SendActionPhase → WaitTurnResultPhase → ApplyTurnResultPhase
        globalScene.phaseManager.pushNew("SendActionPhase");
        globalScene.phaseManager.pushNew("WaitTurnResultPhase");
      }
    } else {
      globalScene.phaseManager.pushNew("TurnStartPhase");
    }

    this.end();
  }
}
