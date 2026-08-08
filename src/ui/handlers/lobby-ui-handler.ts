/**
 * 大厅 UI - 连接 → 开始合作
 * Host 按 Enter 直接推 CoopStartPhase，双方同步种子跳入选初始宝可梦
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
  private gameStarted = false; // 防止重复触发

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
    console.log("[LOBBY] show() 被调用");
    this.container?.setVisible(true);
    this.opponentHere = false;
    this.gameStarted = false;
    const lm = LanManager.getInstance();

    lm.off("opponent-joined");
    lm.off("game-start");
    lm.on("opponent-joined", () => {
      console.log("[LOBBY] opponent-joined 事件");
      this.opponentHere = true; this.refresh();
    });
    lm.on("disconnected", () => {
      console.log("[LOBBY] disconnected 事件");
      this.opponentHere = false; this.refresh();
    });

    // Client 收到 Host 的 start 消息 → 直接推 CoopStartPhase 开始游戏
    lm.on("game-start", (seed: string) => {
      console.log("[LOBBY] game-start 事件, seed:", seed);
      if (!this.gameStarted) {
        this.gameStarted = true;
        this.startCoopGame(seed);
      }
    });

    if (lm.isOpponentConnected()) {
      console.log("[LOBBY] 对手已连接");
      this.opponentHere = true;
    }
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
      this.hintText?.setText("按 Enter 开始合作闯关！");
    } else if (!lm.isHost()) {
      this.hintText?.setText("等待 Host 启动...");
    } else {
      this.hintText?.setText("");
    }
  }

  override processInput(button: Button): boolean {
    if (!this.active) return false;
    console.log("[LOBBY] processInput:", button);
    switch (button) {
      case Button.SUBMIT: {
        const lm = LanManager.getInstance();
        console.log("[LOBBY] SUBMIT - isHost:", lm.isHost(), "opponentHere:", this.opponentHere);
        if (lm.isHost() && this.opponentHere && !this.gameStarted) {
          this.gameStarted = true;
          const seed = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
          console.log("[LOBBY] Host 启动游戏, seed:", seed);
          lm.sendStart(seed);
          this.startCoopGame(seed);
        }
        return true;
      }
      case Button.CANCEL:
        console.log("[LOBBY] CANCEL - 离开房间");
        LanManager.getInstance().leaveRoom();
        this.closeLobby();
        return true;
      default: return false;
    }
  }

  /**
   * 直接推 CoopStartPhase 启动合作游戏
   * 注意：closeLobby() 会触发 UiMode.TITLE → TitlePhase，会打断 CoopStartPhase
   * 所以先清 UI，再推 Phase
   */
  private startCoopGame(seed: string): void {
    console.log("[LOBBY] startCoopGame, seed:", seed);

    // 隐藏大厅 UI
    this.container?.setVisible(false);
    this.active = false;

    // 清空当前 Phase 队列
    globalScene.phaseManager.clearPhaseQueue();

    // 推 CoopStartPhase 启动合作游戏（CoopStartPhase 内部会清 UI）
    console.log("[LOBBY] 推 CoopStartPhase");
    globalScene.phaseManager.pushNew("CoopStartPhase", seed);
  }

  private closeLobby(): void {
    this.container?.setVisible(false);
    this.active = false;
    globalScene.ui.setMode(UiMode.TITLE);
  }

  override clear(): void {
    console.log("[LOBBY] clear()");
    super.clear();
    this.container?.setVisible(false);
  }
}
