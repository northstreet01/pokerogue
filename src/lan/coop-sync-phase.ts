/**
 * CoopSyncPhase — P2P 出招交换（GBA 对称模型）
 * 发送本地出招 → 轮询等待对方出招 → 填入 turnCommands → 各自独立结算
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
  private startTime = Date.now();

  override start(): void {
    const lm = LanManager.getInstance();
    const battle = globalScene.currentBattle;
    const localRole = CoopManager.getInstance().getLocalRole();

    // 收集并发送本地指令
    const localCmds: any[] = [];
    for (let i = 0; i < globalScene.getField().length; i++) {
      const p = globalScene.getField()[i];
      if (p?.isActive() && p.isPlayer() && battle.turnCommands[i]) {
        const isLocal = (localRole === "host" && i === BattlerIndex.PLAYER)
                     || (localRole === "client" && i === BattlerIndex.PLAYER_2);
        if (isLocal) {
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
    if (localCmds.length > 0) lm.sendAction(localCmds);

    // 轮询等待对方出招
    this.poll();
  }

  private poll(): void {
    const lm = LanManager.getInstance();
    const action = lm.getPendingAction();
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
      // 超时：填 Struggle
      const idx = CoopManager.getInstance().getLocalRole() === "host"
        ? BattlerIndex.PLAYER_2 : BattlerIndex.PLAYER;
      globalScene.currentBattle.turnCommands[idx] = {
        command: Command.FIGHT,
        move: { move: MoveId.STRUGGLE, targets: [], useMode: MoveUseMode.NORMAL },
      };
      this.end();
      return;
    }
    setTimeout(() => this.poll(), 100);
  }
}
