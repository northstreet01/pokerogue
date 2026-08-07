/**
 * 大厅 UI Handler - 等待对手、就绪确认
 */

import { globalScene } from "#app/global-scene";
import { Button } from "#enums/buttons";
import { UiMode } from "#enums/ui-mode";
import { TextStyle } from "#enums/text-style";
import { LanManager } from "#app/lan/lan-manager";
import type { PlayerInfo } from "#app/lan/lan-message";
import { LobbyCoordinator } from "#app/lan/lobby-phase";
import type { GameStartPayload } from "#app/lan/lan-message";
import { CoopManager } from "#app/lan/coop-manager";
import { UiHandler } from "./ui-handler";
import { addWindow } from "#ui/ui-theme";
import { addTextObject } from "#ui/text";

export class LobbyUiHandler extends UiHandler {
  private container: Phaser.GameObjects.Container | null = null;
  private titleText: Phaser.GameObjects.Text | null = null;
  private hostInfoText: Phaser.GameObjects.Text | null = null;
  private playerListText: Phaser.GameObjects.Text | null = null;
  private readyText: Phaser.GameObjects.Text | null = null;
  private hintText: Phaser.GameObjects.Text | null = null;

  private isReady = false;
  private players: PlayerInfo[] = [];
  private coordinator: LobbyCoordinator = new LobbyCoordinator();

  constructor() {
    super(UiMode.LOBBY);
  }

  override setup(): void {
    this.container = globalScene.add.container(0, 0);
    this.container.setVisible(false);

    const ui = this.getUi();
    const cw = globalScene.scaledCanvas.width;
    const ch = globalScene.scaledCanvas.height;
    const winW = 420;
    const winH = 340;
    const winX = (cw - winW) / 2;
    const winY = (ch - winH) / 2;

    const bg = addWindow(winX, winY, winW, winH).setOrigin(0);
    this.container.add(bg);

    this.titleText = addTextObject(cw / 2, winY + 20, "房间大厅", TextStyle.SUMMARY_HEADER).setOrigin(0.5, 0);
    this.container.add(this.titleText);

    this.hostInfoText = addTextObject(cw / 2, winY + 55, "", TextStyle.WINDOW).setOrigin(0.5, 0);
    this.container.add(this.hostInfoText);

    this.playerListText = addTextObject(cw / 2, winY + 100, "", TextStyle.STATS_VALUE).setOrigin(0.5, 0);
    this.container.add(this.playerListText);

    this.readyText = addTextObject(cw / 2, winY + 200, "按 Z 准备 / 按 Z 取消", TextStyle.WINDOW).setOrigin(0.5, 0);
    this.container.add(this.readyText);

    this.hintText = addTextObject(cw / 2, winY + 250, "", TextStyle.STATS_LABEL).setOrigin(0.5, 0);
    this.container.add(this.hintText);

    const cancelHint = addTextObject(cw / 2, winY + winH - 20, "按 X 取消并返回", TextStyle.STATS_LABEL).setOrigin(0.5, 0);
    this.container.add(cancelHint);

    ui.add(this.container);
  }

  override show(_args: unknown[]): boolean {
    super.show(_args);
    this.container?.setVisible(true);
    this.isReady = false;

    const lanManager = LanManager.getInstance();

    this.coordinator.bindEvents({
      onOpponentJoined: (info: PlayerInfo) => {
        this.players.push(info);
        this.refreshDisplay();
      },
      onOpponentLeft: () => {
        this.players = this.players.filter(p => p.playerId !== lanManager.getMyPlayerId());
        this.isReady = false;
        this.refreshDisplay();
      },
      onOpponentReady: (ready: boolean) => {
        const opp = this.players.find(p => p.playerId !== lanManager.getMyPlayerId());
        if (opp) { opp.ready = ready; }
        this.refreshDisplay();
        if (this.coordinator.checkBothReady(this.isReady, ready) && lanManager.isHost()) {
          this.coordinator.startGame();
        }
      },
      onGameStart: (payload: GameStartPayload) => {
        this.hintText?.setText("游戏开始！");
        // 激活合作模式 + 启动游戏流程
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

    if (lanManager.isHost()) {
      this.hostInfoText?.setText("等待对手连接...");
      this.hintText?.setText("将你的 IP 地址告诉对方");
    } else {
      this.hostInfoText?.setText("已连接到 Host");
      this.hintText?.setText("等待 Host 启动游戏");
    }

    return true;
  }

  override processInput(button: Button): boolean {
    if (!this.active) { return false; }
    switch (button) {
      case Button.SUBMIT: this.toggleReady(); return true;
      case Button.CANCEL: this.leaveLobby(); return true;
      default: return false;
    }
  }

  override clear(): void {
    super.clear();
    this.container?.setVisible(false);
    this.players = [];
    this.isReady = false;
  }

  private toggleReady(): void {
    this.isReady = !this.isReady;
    this.coordinator.setReady(this.isReady);
    this.refreshDisplay();
  }

  private leaveLobby(): void {
    this.coordinator.cleanup();
    globalScene.ui.setMode(UiMode.TITLE);
  }

  private refreshDisplay(): void {
    const lines = this.players.map(p => {
      const status = p.ready ? "✓ 已就绪" : "○ 未就绪";
      return `${p.playerName}  ${status}`;
    });
    this.playerListText?.setText(lines.join("\n"));
    this.readyText?.setText(this.isReady ? "已就绪 (按 Z 取消)" : "未就绪 (按 Z 准备)");
  }
}
