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
      lm.sendAction([{
        index: myIdx,
        command: cmd.command,
        move: cmd.move ? { move: cmd.move.move, targets: cmd.move.targets } : null,
        skip: cmd.skip,
      }]);
      console.log("[SEND_ACTION] 发送指令:", cmd.command);
    }

    this.end();
  }
}
