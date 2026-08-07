/**
 * 远程玩家指令 Phase
 * 等待联机对手的 TurnCommand，替代 EnemyCommandPhase
 */

import { globalScene } from "#app/global-scene";
import { FieldPhase } from "#phases/field-phase";
import { Command } from "#enums/command";
import { BattlerIndex } from "#enums/battler-index";
import { MoveId } from "#enums/move-id";
import { MoveUseMode } from "#enums/move-use-mode";
import { LanManager } from "./lan-manager";
import type { TurnCommand } from "#app/battle";

export class RemotePlayerCommandPhase extends FieldPhase {
  public readonly phaseName = "RemotePlayerCommandPhase";

  protected fieldIndex: number;
  private receivedCommands: TurnCommand[] | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(fieldIndex: number) {
    super();
    this.fieldIndex = fieldIndex;
  }

  override start(): void {
    super.start();

    const lanManager = LanManager.getInstance();
    const battle = globalScene.currentBattle;

    // 注册接收指令的回调
    const onCommand = (playerId: string, commands: TurnCommand[], _checksum: string) => {
      // 只处理对手的指令（非自己的 playerId）
      if (playerId !== lanManager.getMyPlayerId()) {
        this.receivedCommands = commands;
        // 清除超时
        if (this.timeoutTimer) {
          clearTimeout(this.timeoutTimer);
          this.timeoutTimer = null;
        }
        this.executeCommands();
      }
    };

    lanManager.setEvents({ onTurnCommand: onCommand });

    // 设置 60 秒超时（超时后自动使用 Struggle）
    this.timeoutTimer = setTimeout(() => {
      if (this.receivedCommands === null) {
        // 超时：自动挣扎
        battle.turnCommands[this.fieldIndex + BattlerIndex.ENEMY] = {
          command: Command.FIGHT,
          move: { move: MoveId.STRUGGLE, targets: [], useMode: MoveUseMode.NORMAL },
          skip: false,
        };
        this.end();
      }
    }, 60000);

    // 如果已经有缓存的指令，直接执行
    if (this.receivedCommands) {
      this.executeCommands();
    }
  }

  private executeCommands(): void {
    if (!this.receivedCommands || this.receivedCommands.length === 0) {
      return;
    }

    const battle = globalScene.currentBattle;

    // 取第一个指令（远程玩家只有一个场上的宝可梦）
    // 实际上可能有多个指令（对应多个场上位置）
    for (let i = 0; i < this.receivedCommands.length; i++) {
      const cmd = this.receivedCommands[i];
      const battlerIndex = this.fieldIndex + BattlerIndex.ENEMY + i;
      if (battlerIndex <= BattlerIndex.ENEMY_2) {
        battle.turnCommands[battlerIndex] = cmd;
      }
    }

    this.end();
  }

  override end(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    super.end();
  }
}
