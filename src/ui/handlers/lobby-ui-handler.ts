/**
 * 大厅 UI Handler - 等待对手连接、Host 开始游戏
 */

import { globalScene } from "#app/global-scene";
import { Button } from "#enums/buttons";
import { UiMode } from "#enums/ui-mode";
import { TextStyle } from "#enums/text-style";
import { LanManager } from "#app/lan/lan-manager";
import type { PlayerInfo } from "#app/lan/lan-message";
import { LobbyCoordinator } from "#app/lan/lobby-phase";
import type { GameStartPayload } from "#app/lan/lan-message";
import { UiHandler } from "./ui-handler";
import { addWindow } from "#ui/ui-theme";
import { addTextObject } from "#ui/text";

export class LobbyUiHandler extends UiHandler {
  private container: Phaser.GameObjects.Container | null = null;
  private titleText: Phaser.GameObjects.Text | null = null;
  private playerListText: Phaser.GameObjects.Text | null = null;
  private actionText: Phaser.GameObjects.Text | null = null;
  private hintText: Phaser.GameObjects.Text | null = null;

  private players: PlayerInfo[] = [];
  private opponentConnected = false;
  private coordinator: LobbyCoordinator = new LobbyCoordinator();
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super(UiMode.LOBBY);
  }

  override setup(): void {
    this.container = globalScene.add.container(0, 0);
    this.container.setVisible(false);

    const cw = globalScene.scaledCanvas.width;
    const ch = globalScene.scaledCanvas.height;
    const winW = 420;
    const winH = 300;
    const offY = -ch;
    const winX = (cw - winW) / 2;
    const winY = offY + (ch - winH) / 2;

    const bg = addWindow(winX, winY, winW, winH).setOrigin(0);
    this.container.add(bg);

    this.titleText = addTextObject(cw / 2, winY + 20, "房间大厅", TextStyle.SUMMARY_HEADER).setOrigin(0.5, 0);
    this.container.add(this.titleText);

    this.playerListText = addTextObject(cw / 2, winY + 70, "", TextStyle.STATS_VALUE).setOrigin(0.5, 0);
    this.container.add(this.playerListText);

    this.actionText = addTextObject(cw / 2, winY + 170, "", TextStyle.WINDOW).setOrigin(0.5, 0);
    this.container.add(this.actionText);

    this.hintText = addTextObject(cw / 2, winY + 210, "", TextStyle.STATS_LABEL).setOrigin(0.5, 0);
    this.container.add(this.hintText);

    const cancelHint = addTextObject(cw / 2, winY + winH - 20, "", TextStyle.STATS_LABEL).setOrigin(0.5, 0);
    this.container.add(cancelHint);

    this.getUi().add(this.container);
  }

  override show(_args: unknown[]): boolean {
    super.show(_args);
    this.container?.setVisible(true);
    this.opponentConnected = false;

    const lanManager = LanManager.getInstance();

    this.coordinator.bindEvents({
      onOpponentJoined: (info) => {
        // 防止重复添加
        if (!this.players.find(p => p.playerId === info.playerId)) {
          this.players.push(info);
        }
        this.opponentConnected = true;
        this.refreshDisplay();
      },
      onOpponentLeft: () => {
        this.opponentConnected = false;
        this.refreshDisplay();
      },
      onGameStart: (payload: GameStartPayload) => {
        globalScene.ui.setMode(UiMode.MESSAGE);
        globalScene.phaseManager.pushNew("CoopStartPhase", payload);
      },
      onError: (_code, msg) => {
        this.hintText?.setText(`错误: ${msg}`);
      },
    });

    this.players = [{
      playerId: lanManager.getMyPlayerId(),
      playerName: lanManager.isHost() ? "Host (你)" : "Client (你)",
      role: lanManager.getRole(),
      ready: false,
    }];

    this.refreshDisplay();

    // 启动轮询：每 1 秒主动检查对手连接状态
    this.pollTimer = setInterval(() => {
      const lm = LanManager.getInstance();
      if (lm.isOpponentConnected() && !this.opponentConnected) {
        this.opponentConnected = true;
        this.players.push({
          playerId: "opponent",
          playerName: lm.getOpponentName() || "对手",
          role: lm.isHost() ? "client" : "host",
          ready: false,
        });
        this.refreshDisplay();
      }
    }, 1000);

    return true;
  }

  override processInput(button: Button): boolean {
    if (!this.active) { return false; }
    switch (button) {
      case Button.SUBMIT:
        this.onConfirm();
        return true;
      case Button.CANCEL:
        this.coordinator.cleanup();
        globalScene.ui.setMode(UiMode.TITLE);
        return true;
      default: return false;
    }
  }

  override clear(): void {
    super.clear();
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    this.container?.setVisible(false);
    this.players = [];
  }

  private onConfirm(): void {
    const lanManager = LanManager.getInstance();
    if (lanManager.isHost() && this.opponentConnected) {
      // Host 开始游戏
      this.coordinator.startGame();
    }
  }

  private refreshDisplay(): void {
    const lanManager = LanManager.getInstance();
    const lines = this.players.map(p => `· ${p.playerName}`);
    if (this.opponentConnected) {
      lines.push("对手已连接 ✓");
    } else {
      lines.push("等待对手连接...");
    }
    this.playerListText?.setText(lines.join("\n"));

    if (lanManager.isHost()) {
      this.hintText?.setText(this.opponentConnected ? "按 Z 开始游戏" : "将你的 IP 告诉对方");
      this.actionText?.setText(this.opponentConnected ? "▶ 开始游戏" : "");
    } else {
      this.hintText?.setText("等待 Host 启动游戏...");
      this.actionText?.setText("");
    }
  }
}
