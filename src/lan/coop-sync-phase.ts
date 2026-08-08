/**
 * 合作同步 Phase - Socket.io 版
 * 本地指令选完后 → 发送给队友 → 接收队友指令 → 继续
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

    // 收集本地指令
    const localCmds: any[] = [];
    for (let i = 0; i < globalScene.getField().length; i++) {
      const p = globalScene.getField()[i];
      if (p?.isActive() && p.isPlayer()) {
        const isLocal =
          (localRole === "host" && i === BattlerIndex.PLAYER)
          || (localRole === "client" && i === BattlerIndex.PLAYER_2);
        if (isLocal && battle.turnCommands[i]) {
          localCmds.push({
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

    lm.sendAction(localCmds);

    // 等待队友指令
    const handler = (cmds: any[]) => {
      if (!Array.isArray(cmds)) return;
      for (const cmd of cmds) {
        battle.turnCommands[cmd.index] = {
          command: cmd.command ?? Command.FIGHT,
          move: cmd.move
            ? { move: cmd.move.move ?? MoveId.STRUGGLE, targets: cmd.move.targets ?? [], useMode: MoveUseMode.NORMAL }
            : { move: MoveId.STRUGGLE, targets: [], useMode: MoveUseMode.NORMAL },
          skip: cmd.skip ?? false,
        };
      }
      this.end();
    };

    lm.on("action", handler);

    // 60s 超时 → 自动挣扎
    const tid = setTimeout(() => { this.end(); }, 60000);
    const origEnd = this.end.bind(this);
    this.end = () => { clearTimeout(tid); origEnd(); };
  }
}
