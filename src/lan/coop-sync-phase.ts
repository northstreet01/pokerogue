/**
 * CoopSyncPhase — 合作模式 P2P 出招同步
 *
 * 独立游戏模型：双方都运行完整回合，此 Phase 仅交换各自宝可梦的出招选择。
 * 收到对方出招后填入 turnCommands[对方位置]，TurnStartPhase 正常执行。
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

    // 发送本地指令给对方
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

    if (localCmds.length > 0) {
      lm.sendAction(localCmds);
      console.log("[COOP_SYNC] 发送本地指令:", JSON.stringify(localCmds));
    }

    // 接收对方指令 → 填入 turnCommands
    const handler = (cmds: any[]) => {
      if (!Array.isArray(cmds)) return;

      console.log("[COOP_SYNC] 收到对方指令:", JSON.stringify(cmds));

      for (const cmd of cmds) {
        battle.turnCommands[cmd.index] = {
          command: cmd.command ?? Command.FIGHT,
          move: cmd.move
            ? { move: cmd.move.move ?? MoveId.STRUGGLE, targets: cmd.move.targets ?? [], useMode: MoveUseMode.NORMAL }
            : { move: MoveId.STRUGGLE, targets: [], useMode: MoveUseMode.NORMAL },
          skip: cmd.skip ?? false,
        };
      }

      cleanup();
      this.end();
    };

    lm.on("action", handler);

    // 60s 超时 → 强行继续（对方可能已断线）
    const timeout = setTimeout(() => {
      console.log("[COOP_SYNC] 超时, 继续执行");
      cleanup();
      this.end();
    }, 60000);

    const cleanup = () => {
      clearTimeout(timeout);
      lm.off("action");
    };
  }
}
