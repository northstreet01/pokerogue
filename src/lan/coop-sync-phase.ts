/**
 * CoopSyncPhase — 合作模式 P2P 出招同步
 *
 * 独立游戏模型：双方都运行完整回合。此 Phase 交换各自宝可梦的出招选择。
 * 先注册监听再发送（防竞态），同时检查缓存防止消息在监听前到达。
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
  private resolved = false;

  override start(): void {
    const lm = LanManager.getInstance();
    const battle = globalScene.currentBattle;
    const localRole = CoopManager.getInstance().getLocalRole();

    const resolve = (cmds: any[]) => {
      if (this.resolved || !Array.isArray(cmds)) return;
      this.resolved = true;
      cleanup();

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

      this.end();
    };

    // 1. 先注册监听（防止竞态：对方消息先到）
    lm.on("action", resolve);

    const cleanup = () => {
      clearTimeout(timeout);
      lm.off("action");
    };

    // 2. 检查缓存（对方消息在监听注册前就到了）
    const pending = lm.getPendingAction();
    if (pending) {
      console.log("[COOP_SYNC] 使用缓存的对方指令");
      resolve(pending);
      return;
    }

    // 3. 收集并发送本地指令
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

    // 4. 超时兜底（60s）
    const timeout = setTimeout(() => {
      console.log("[COOP_SYNC] 超时");
      this.resolved = true;
      cleanup();
      this.end();
    }, 60000);
  }
}
