/**
 * 远程玩家指令 Phase - TCP 版
 * 从网络接收对手的回合指令
 */

import { globalScene } from "#app/global-scene";
import { FieldPhase } from "#phases/field-phase";
import { Command } from "#enums/command";
import { BattlerIndex } from "#enums/battler-index";
import { MoveId } from "#enums/move-id";
import { MoveUseMode } from "#enums/move-use-mode";
import { LanManager } from "./lan-manager";

export class RemotePlayerCommandPhase extends FieldPhase {
  public readonly phaseName = "RemotePlayerCommandPhase";
  protected fieldIndex: number;
  private resolved = false;

  constructor(fieldIndex: number) {
    super();
    this.fieldIndex = fieldIndex;
  }

  override start(): void {
    super.start();

    const lm = LanManager.getInstance();

    const handler = (commands: unknown[]) => {
      if (this.resolved) { return; }
      this.resolved = true;

      const battle = globalScene.currentBattle;
      const cmd = commands[0] as any;
      if (cmd) {
        battle.turnCommands[this.fieldIndex] = {
          command: cmd.command ?? Command.FIGHT,
          move: cmd.move ?? { move: MoveId.STRUGGLE, targets: [], useMode: MoveUseMode.NORMAL },
          skip: false,
        };
      } else {
        battle.turnCommands[this.fieldIndex] = {
          command: Command.FIGHT,
          move: { move: MoveId.STRUGGLE, targets: [], useMode: MoveUseMode.NORMAL },
          skip: false,
        };
      }
      this.end();
    };

    lm.on("action", handler);

    // 60秒超时 → 自动挣扎
    setTimeout(() => {
      if (!this.resolved) {
        this.resolved = true;
        globalScene.currentBattle.turnCommands[this.fieldIndex] = {
          command: Command.FIGHT,
          move: { move: MoveId.STRUGGLE, targets: [], useMode: MoveUseMode.NORMAL },
          skip: false,
        };
        this.end();
      }
    }, 60000);
  }
}
