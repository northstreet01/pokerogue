/**
 * RemoteWaitPhase — Host 端等待 Client 网络指令
 *
 * Host 的本地 CommandPhase 完成后，推入此 Phase 等待 Client 发送 action 消息。
 * 借鉴 UNO 的 `scheduleTurn()` + `turnDeadline` 模式。
 * 60s 超时 → 自动设置远程宝可梦为「挣扎」。
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
  private timedOut = false;

  override start(): void {
    // 仅 Host 执行
    if (!CoopManager.getInstance().isActive() || !LanManager.getInstance().isHost()) {
      console.log("[REMOTE_WAIT] 跳过 (非 Host 或 coop 未激活)");
      this.end();
      return;
    }

    const lm = LanManager.getInstance();
    const battle = globalScene.currentBattle;

    // 检查远程宝可梦是否需要指令
    const remoteIndex = BattlerIndex.PLAYER_2; // Client 的宝可梦位置
    const remotePokemon = globalScene.getField()[remoteIndex];

    console.log("[REMOTE_WAIT] remoteIndex:", remoteIndex, "active:", remotePokemon?.isActive());

    // 如果远程宝可梦不在场上或已昏厥，无需等待，直接结束
    if (!remotePokemon?.isActive()) {
      console.log("[REMOTE_WAIT] 远程宝可梦不活跃，跳过等待");
      this.end();
      return;
    }

    console.log("[REMOTE_WAIT] 等待 Client 指令...");

    // 接收 Client 指令
    const handler = (cmds: any[]) => {
      if (this.timedOut) return;
      console.log("[REMOTE_WAIT] 收到 Client 指令:", JSON.stringify(cmds));

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

      cleanup();
      this.end();
    };

    lm.on("action", handler);

    // 60s 超时 → 挣扎 (借鉴 UNO BOT_TURN_DELAY 模式)
    const timeout = setTimeout(() => {
      this.timedOut = true;

      if (remotePokemon.isActive() && !battle.turnCommands[remoteIndex]) {
        battle.turnCommands[remoteIndex] = {
          command: Command.FIGHT,
          move: { move: MoveId.STRUGGLE, targets: [], useMode: MoveUseMode.NORMAL },
          skip: false,
        };
      }

      cleanup();
      this.end();
    }, 60000);

    const cleanup = () => {
      clearTimeout(timeout);
      lm.off("action");
    };
  }
}
