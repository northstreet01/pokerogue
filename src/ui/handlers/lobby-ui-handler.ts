/**
 * 大厅 UI - 连接 → 开始合作闯关
 */

import { globalScene } from "#app/global-scene";
import { Button } from "#enums/buttons";
import { UiMode } from "#enums/ui-mode";
import { TextStyle } from "#enums/text-style";
import { LanManager } from "#app/lan/lan-manager";
import { CoopManager } from "#app/lan/coop-manager";
import { UiHandler } from "./ui-handler";
import { addWindow } from "#ui/ui-theme";
import { addTextObject } from "#ui/text";

export class LobbyUiHandler extends UiHandler {
  private container: Phaser.GameObjects.Container | null = null;
  private infoText: Phaser.GameObjects.Text | null = null;
  private hintText: Phaser.GameObjects.Text | null = null;
  private opponentHere = false;
  private gameStarting = false;

  constructor() { super(UiMode.LOBBY); }

  override setup(): void {
    this.container = globalScene.add.container(0, 0);
    this.container.setVisible(false);
    const cw = globalScene.scaledCanvas.width;
    const ch = globalScene.scaledCanvas.height;
    const winW = 360; const winH = 220;
    const offY = -ch;
    const winX = (cw - winW) / 2;
    const winY = offY + (ch - winH) / 2;

    this.container.add(addWindow(winX, winY, winW, winH).setOrigin(0));
    this.container.add(addTextObject(cw / 2, winY + 20, "房间大厅", TextStyle.SUMMARY_HEADER).setOrigin(0.5, 0));
    this.infoText = addTextObject(cw / 2, winY + 65, "", TextStyle.STATS_VALUE).setOrigin(0.5, 0);
    this.container.add(this.infoText);
    this.hintText = addTextObject(cw / 2, winY + 140, "", TextStyle.WINDOW).setOrigin(0.5, 0);
    this.container.add(this.hintText);
    this.container.add(addTextObject(cw / 2, winY + winH - 20, "Enter 确认  X 返回", TextStyle.STATS_LABEL).setOrigin(0.5, 0));
    this.getUi().add(this.container);
  }

  override show(_args: unknown[]): boolean {
    super.show(_args);
    this.container?.setVisible(true);
    this.opponentHere = false;
    this.gameStarting = false;
    const lm = LanManager.getInstance();

    lm.on("opponent-joined", () => { this.opponentHere = true; this.refresh(); });
    lm.on("disconnected", () => { this.opponentHere = false; this.refresh(); });
    lm.on("game-start", (seed: string) => {
      if (this.gameStarting) return;
      this.gameStarting = true;
      CoopManager.getInstance().start();
      // Client：收到 Host 信号 → 启动合作游戏
      globalScene.phaseManager.pushNew("CoopStartPhase", seed);
    });

    if (lm.isOpponentConnected()) this.opponentHere = true;
    this.refresh();
    return true;
  }

  private refresh(): void {
    const lm = LanManager.getInstance();
    this.infoText?.setText([
      lm.isHost() ? "· Host (你)" : "· Client (你)",
      this.opponentHere ? "· 对手已连接 ✓" : "· 等待对手...",
    ].join("\n"));
    this.hintText?.setText(
      lm.isHost() && this.opponentHere ? "按 Enter 开始合作闯关" :
      !lm.isHost() ? "等待 Host 启动..." : ""
    );
  }

  override processInput(button: Button): boolean {
    if (!this.active) return false;
    switch (button) {
      case Button.SUBMIT: {
        const lm = LanManager.getInstance();
        if (lm.isHost() && this.opponentHere && !this.gameStarting) {
          this.gameStarting = true;
          const seed = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
          lm.sendStart(seed);
          CoopManager.getInstance().start();
          // Host：启动合作游戏
          globalScene.phaseManager.pushNew("CoopStartPhase", seed);
        }
        return true;
      }
      case Button.CANCEL:
        LanManager.getInstance().leaveRoom();
        globalScene.phaseManager.pushNew("TitlePhase");
        return true;
      default: return false;
    }
  }

  override clear(): void { super.clear(); this.container?.setVisible(false); }
}
