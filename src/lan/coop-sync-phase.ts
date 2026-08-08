/**
 * 合作同步 Phase
 * 在 CommandPhase 之后、TurnStartPhase 之前运行
 * 把本地选的指令发给对方，同时等待对方指令
 */

import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";
import { LanManager } from "./lan-manager";
import { CoopManager } from "./coop-manager";
import { Command } from "#enums/command";
import { BattlerIndex } from "#enums/battler-index";
import { MoveId } from "#enums/move-id";
import { MoveUseMode } from "#enums/move-use-mode";

export class CoopSyncPhase extends Phase {
  public readonly phaseName = "CoopSyncPhase";

  override start(): void {
    const lm = LanManager.getInstance();
    const battle = globalScene.currentBattle;
    const localRole = CoopManager.getInstance().getLocalRole();

    // 收集本地玩家的指令
    const localCommands: any[] = [];
    const field = globalScene.getField();
    for (let i = 0; i < field.length; i++) {
      const p = field[i];
      if (p?.isActive() && p.isPlayer()) {
        const isLocal =
          (localRole === "host" && i === BattlerIndex.PLAYER)
          || (localRole === "client" && i === BattlerIndex.PLAYER_2);
        if (isLocal && battle.turnCommands[i]) {
          localCommands.push({
            index: i,
            command: battle.turnCommands[i].command,
            move: battle.turnCommands[i].move
              ? { move: battle.turnCommands[i].move!.move, targets: battle.turnCommands[i].move!.targets }
              : null,
            skip: battle.turnCommands[i].skip,
          });
        }
      }
    }

    // 发送本地指令
    lm.sendAction(localCommands);

    // 等待对方指令
    const handler = (remoteCommands: any[]) => {
      if (!Array.isArray(remoteCommands)) return;
      for (const cmd of remoteCommands) {
        battle.turnCommands[cmd.index] = {
          command: cmd.command ?? Command.FIGHT,
          move: cmd.move
            ? { move: cmd.move.move ?? MoveId.STRUGGLE, targets: cmd.move.targets ?? [], useMode: MoveUseMode.NORMAL }
            : { move: MoveId.STRUGGLE, targets: [], useMode: MoveUseMode.NORMAL },
          skip: cmd.skip ?? false,
        };
      }
      lm.off("action");
      this.end();
    };

    lm.on("action", handler);

    // 60s 超时
    setTimeout(() => {
      lm.off("action");
      this.end();
    }, 60000);
  }
}
