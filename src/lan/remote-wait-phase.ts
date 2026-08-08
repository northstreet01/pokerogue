/**
 * RemoteWaitPhase — Host 端轮询等待 Client 指令（30s 超时→挣扎）
 * 不用事件驱动，直接每 100ms 检查 getPendingAction()
 */

import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";
import { LanManager } from "./lan-manager";
import { CoopManager } from "./coop-manager";
import { Command } from "#enums/command";
import { BattlerIndex } from "#enums/battler-index";
import { MoveId } from "#enums/move-id";
import { MoveUseMode } from "#enums/move-use-mode";

export class RemoteWaitPhase extends Phase {
  public readonly phaseName = "RemoteWaitPhase";
  private startTime = Date.now();

  override start(): void {
    if (!CoopManager.getInstance().isActive() || !LanManager.getInstance().isHost()) {
      this.end(); return;
    }
    const remote = globalScene.getField()[BattlerIndex.PLAYER_2];
    if (!remote?.isActive()) { this.end(); return; }
    this.poll();
  }

  private poll(): void {
    const action = LanManager.getInstance().getPendingAction();
    if (action) {
      const battle = globalScene.currentBattle;
      for (const cmd of action) {
        battle.turnCommands[cmd.index] = {
          command: cmd.command ?? Command.FIGHT,
          move: cmd.move
            ? { move: cmd.move.move ?? MoveId.STRUGGLE, targets: cmd.move.targets ?? [], useMode: MoveUseMode.NORMAL }
            : { move: MoveId.STRUGGLE, targets: [], useMode: MoveUseMode.NORMAL },
          targets: cmd.move?.targets ?? [],
          skip: cmd.skip ?? false,
        };
      }
      this.end();
      return;
    }
    if (Date.now() - this.startTime > 30000) {
      globalScene.currentBattle.turnCommands[BattlerIndex.PLAYER_2] = {
        command: Command.FIGHT,
        move: { move: MoveId.STRUGGLE, targets: [], useMode: MoveUseMode.NORMAL },
      };
      this.end();
      return;
    }
    setTimeout(() => this.poll(), 100);
  }
}
