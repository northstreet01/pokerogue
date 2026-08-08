/**
 * 大厅 UI - 连接 → 开始合作
 * 关闭大厅后回到标题，玩家手动点「新游戏」→ 合作模式自动生效
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

  constructor() { super(UiMode.LOBBY); }

  override setup(): void {
    this.container = globalScene.add.container(0, 0);
    this.container.setVisible(false);
    const cw = globalScene.scaledCanvas.width;
    const ch = globalScene.scaledCanvas.height;
    const winW = 380; const winH = 240;
    const offY = -ch;
    const winX = (cw - winW) / 2;
    const winY = offY + (ch - winH) / 2;

    this.container.add(addWindow(winX, winY, winW, winH).setOrigin(0));
    this.container.add(addTextObject(cw / 2, winY + 20, "房间大厅", TextStyle.SUMMARY_HEADER).setOrigin(0.5, 0));
    this.infoText = addTextObject(cw / 2, winY + 65, "", TextStyle.STATS_VALUE).setOrigin(0.5, 0);
    this.container.add(this.infoText);
    this.hintText = addTextObject(cw / 2, winY + 150, "", TextStyle.WINDOW).setOrigin(0.5, 0);
    this.container.add(this.hintText);
    this.container.add(addTextObject(cw / 2, winY + winH - 20, "Enter 确认  X 返回", TextStyle.STATS_LABEL).setOrigin(0.5, 0));
    this.getUi().add(this.container);
  }

  override show(_args: unknown[]): boolean {
    super.show(_args);
    this.container?.setVisible(true);
    this.opponentHere = false;
    const lm = LanManager.getInstance();

    lm.on("opponent-joined", () => { this.opponentHere = true; this.refresh(); });
    lm.on("disconnected", () => { this.opponentHere = false; this.refresh(); });
    lm.on("game-start", (_seed: string) => {
      CoopManager.getInstance().start();
      this.closeLobby();
      globalScene.ui.showText("合作模式已激活！请选择 [新游戏] 开始", null, 0, 5);
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
    if (lm.isHost() && this.opponentHere) {
      this.hintText?.setText("按 Enter → 回到标题\n双方各自选择 [新游戏] 开始");
    } else if (!lm.isHost()) {
      this.hintText?.setText("等待 Host 启动...");
    } else {
      this.hintText?.setText("");
    }
  }

  override processInput(button: Button): boolean {
    if (!this.active) return false;
    switch (button) {
      case Button.SUBMIT: {
        const lm = LanManager.getInstance();
        if (lm.isHost() && this.opponentHere) {
          const seed = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
          lm.sendStart(seed);
          CoopManager.getInstance().start();
          this.closeLobby();
          globalScene.ui.showText("合作模式已激活！请选择 [新游戏] 开始", null, 0, 5);
        }
        return true;
      }
      case Button.CANCEL:
        LanManager.getInstance().leaveRoom();
        this.closeLobby();
        return true;
      default: return false;
    }
  }

  private closeLobby(): void {
    globalScene.ui.setMode(UiMode.TITLE);
  }

  override clear(): void { super.clear(); this.container?.setVisible(false); }
}
