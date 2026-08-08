/**
 * RemoteWaitPhase — Host 端等待 Client 指令
 * 收到后填入 turnCommands，30s 超时→挣扎
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

  override start(): void {
    console.log("[RW] start, coop:", CoopManager.getInstance().isActive(), "host:", LanManager.getInstance().isHost());
    if (!CoopManager.getInstance().isActive() || !LanManager.getInstance().isHost()) {
      console.log("[RW] 提前退出");
      this.end(); return;
    }

    const lm = LanManager.getInstance();
    const battle = globalScene.currentBattle;

    const remoteIndex = BattlerIndex.PLAYER_2;
    const field = globalScene.getField();
    console.log("[REMOTE_WAIT] field:", field.map((p, i) => `${i}:${p?.getNameToRender?.() ?? 'null'}(active=${p?.isActive?.()})`).join(", "));
    const remote = field[remoteIndex];
    if (!remote?.isActive()) {
      console.log("[REMOTE_WAIT] 位置1的精灵不活跃, 跳过等待");
      this.end(); return;
    }

    const timeout = setTimeout(() => {
      if (!resolved) {
        console.log("[REMOTE_WAIT] 30s超时→挣扎");
        battle.turnCommands[remoteIndex] = {
          command: Command.FIGHT,
          move: { move: MoveId.STRUGGLE, targets: [], useMode: MoveUseMode.NORMAL },
        };
        cleanup();
        this.end();
      }
    }, 30000);

    const cleanup = () => { clearTimeout(timeout); lm.off("action"); };

    let resolved = false;
    const resolve = (cmds: any[]) => {
      if (resolved || !Array.isArray(cmds)) return;
      resolved = true;
      cleanup();
      for (const cmd of cmds) {
        console.log("[REMOTE_WAIT] 填入 turnCommands[%d]: cmd=%d move=%d targets=%j",
          cmd.index, cmd.command, cmd.move?.move, cmd.move?.targets);
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
    };

    // 监听 + 检查缓存（防竞态）
    lm.on("action", resolve);
    const pending = lm.getPendingAction();
    if (pending) { resolve(pending); return; }
  }
}
