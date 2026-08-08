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

    const coopManager = CoopManager.getInstance();
    const isCoop = coopManager.isActive();
    const localRole = isCoop ? coopManager.getLocalRole() : null;
    const isClient = isCoop && localRole === "client";

    console.log("[TURN_INIT] isCoop:", isCoop, "localRole:", localRole, "field size:", globalScene.getField().filter(p => p?.isActive()).length);

    // 清除上一回合的残留指令（防止重复发送）
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
          // 合作模式：只为本地宝可梦显示指令菜单
          if (isCoop) {
            const isLocal =
              (localRole === "host" && i === BattlerIndex.PLAYER)
              || (localRole === "client" && i === BattlerIndex.PLAYER_2);
            if (isLocal) {
              globalScene.phaseManager.pushNew("CommandPhase", i);
            }
            // 远程宝可梦的指令：Host 通过 RemoteWaitPhase 等待，Client 不处理
          } else {
            globalScene.phaseManager.pushNew("CommandPhase", i);
          }
        } else if (!isClient) {
          // Host: 推 EnemyCommandPhase（正常 AI）
          // Client: 不推 EnemyCommandPhase（Host 处理 AI，通过快照同步结果）
          globalScene.phaseManager.pushNew("EnemyCommandPhase", i - BattlerIndex.ENEMY);
        }
      }
    });

    // 合作模式：Host 等待 Client 指令 + 执行回合 / Client 等待快照
    if (isCoop) {
      if (localRole === "host") {
        // Host: 等待 Client 网络指令 → 开始回合执行
        console.log("[TURN_INIT] Host: 推 RemoteWaitPhase → TurnStartPhase");
        globalScene.phaseManager.pushNew("RemoteWaitPhase");
        globalScene.phaseManager.pushNew("TurnStartPhase");
      } else {
        // Client: 不执行 TurnStartPhase，等待 Host 下发回合结果（事件流 + 快照）
        console.log("[TURN_INIT] Client: 推 ClientEventLoopPhase (不推 TurnStartPhase)");
        globalScene.phaseManager.pushNew("ClientEventLoopPhase");
      }
    } else {
      // 单机模式：直接开始回合
      console.log("[TURN_INIT] 单机模式: 推 TurnStartPhase");
      globalScene.phaseManager.pushNew("TurnStartPhase");
    }
    this.end();
  }
}
