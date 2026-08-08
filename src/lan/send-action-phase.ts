/**
 * SendActionPhase — Client 端发送己方指令给 Host
 */

import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";
import { LanManager } from "./lan-manager";
import { CoopManager } from "./coop-manager";
import { BattlerIndex } from "#enums/battler-index";

export class SendActionPhase extends Phase {
  public readonly phaseName = "SendActionPhase";

  override start(): void {
    const lm = LanManager.getInstance();
    if (!CoopManager.getInstance().isActive() || lm.isHost()) { this.end(); return; }

    const battle = globalScene.currentBattle;
    const myIdx = BattlerIndex.PLAYER_2;
    const cmd = battle.turnCommands[myIdx];

    if (cmd) {
      // SelectTargetPhase 写入顶层 cmd.targets，不是 cmd.move.targets
      const targets = cmd.targets ?? cmd.move?.targets ?? [];
      lm.sendAction([{
        index: myIdx,
        command: cmd.command,
        move: { move: cmd.move?.move ?? 0, targets },
        skip: cmd.skip,
      }]);
      console.log("[SEND_ACTION] cmd:", cmd.command, "move:", cmd.move?.move, "targets:", targets);
    }

    this.end();
  }
}
