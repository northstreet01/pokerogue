/**
 * 合作模式回合初始化 Phase
 * 替换 TurnInitPhase：远程玩家的宝可梦使用 RemotePlayerCommandPhase
 */

import { globalScene } from "#app/global-scene";
import { BattlerIndex } from "#enums/battler-index";
import {
  handleMysteryEncounterBattleStartEffects,
  handleMysteryEncounterTurnStartEffects,
} from "#mystery-encounters/encounter-phase-utils";
import { FieldPhase } from "#phases/field-phase";
import { CoopManager } from "./coop-manager";

export class CoopTurnInitPhase extends FieldPhase {
  public readonly phaseName = "CoopTurnInitPhase";

  override start(): void {
    super.start();

    // 处理挑战模式下非法进化
    globalScene.getPlayerField().forEach(p => {
      if (p.isOnField() && !p.isAllowedInBattle()) {
        // 简化处理：直接强制切换
        p.switchOut();
      }
    });

    handleMysteryEncounterBattleStartEffects();

    if (handleMysteryEncounterTurnStartEffects()) {
      this.end();
      return;
    }

    const coopManager = CoopManager.getInstance();
    const localRole = coopManager.getLocalRole();
    // 远程玩家 = 对方
    const remoteRole = localRole === "host" ? "client" : "host";

    globalScene.getField().forEach((pokemon, i) => {
      if (pokemon?.isActive()) {
        pokemon.resetTurnData();

        if (pokemon.isPlayer()) {
          // 合作模式下，所有玩家方的宝可梦都需要指令
          // fieldIndex 0 = Host 的宝可梦, fieldIndex 1 = Client 的宝可梦
          const isRemotePlayerPokemon =
            (localRole === "host" && i === BattlerIndex.PLAYER_2)
            || (localRole === "client" && i === BattlerIndex.PLAYER);

          if (isRemotePlayerPokemon) {
            // 远程玩家的宝可梦：等待网络指令
            globalScene.phaseManager.pushNew("RemotePlayerCommandPhase", i);
          } else {
            // 本地玩家的宝可梦：正常输入
            globalScene.phaseManager.pushNew("CommandPhase", i);
          }
        } else {
          // 敌方：AI 控制
          globalScene.phaseManager.pushNew("EnemyCommandPhase", i - BattlerIndex.ENEMY);
        }
      }
    });

    globalScene.phaseManager.pushNew("TurnStartPhase");
    this.end();
  }
}
