/**
 * 大厅 UI Handler
 * 处理联机房间的界面：玩家列表、就绪状态、模式选择
 */

import { globalScene } from "#app/global-scene";
import { Button } from "#enums/buttons";
import { UiMode } from "#enums/ui-mode";
import { TextStyle } from "#enums/text-style";
import { LanManager } from "#app/lan/lan-manager";
import type { PlayerInfo } from "#app/lan/lan-message";
import { LobbyCoordinator } from "#app/lan/lobby-phase";
import { UiHandler } from "./ui-handler";
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

    const centerX = globalScene.scaledCanvas.width / 2;
    const centerY = globalScene.scaledCanvas.height / 2;

    // 标题
    this.titleText = addTextObject(centerX, centerY - 160, "局域网联机", TextStyle.SUMMARY_HEADER);
    this.titleText.setOrigin(0.5);
    this.container.add(this.titleText);

    // Host 信息
    this.hostInfoText = addTextObject(centerX, centerY - 100, "", TextStyle.WINDOW);
    this.hostInfoText.setOrigin(0.5);
    this.container.add(this.hostInfoText);

    // 玩家列表
    this.playerListText = addTextObject(centerX, centerY - 20, "", TextStyle.STATS_VALUE);
    this.playerListText.setOrigin(0.5);
    this.container.add(this.playerListText);

    // 就绪状态
    this.readyText = addTextObject(centerX, centerY + 60, "", TextStyle.WINDOW);
    this.readyText.setOrigin(0.5);
    this.container.add(this.readyText);

    // 提示信息
    this.hintText = addTextObject(centerX, centerY + 140, "", TextStyle.STATS_LABEL);
    this.hintText.setOrigin(0.5);
    this.container.add(this.hintText);
  }

  override show(_args: unknown[]): boolean {
    super.show(_args);

    this.container?.setVisible(true);
    this.isReady = false;

    const lanManager = LanManager.getInstance();

    // 绑定事件
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
        const opponent = this.players.find(p => p.playerId !== lanManager.getMyPlayerId());
        if (opponent) {
          opponent.ready = ready;
        }
        this.refreshDisplay();

        // 双方就绪自动开始（Host 侧）
        if (this.coordinator.checkBothReady(this.isReady, ready) && lanManager.isHost()) {
          this.coordinator.startGame();
        }
      },
      onGameStart: () => {
        this.hintText?.setText("游戏开始！");
        // TODO: 启动合作模式
        globalScene.ui.setMode(UiMode.MESSAGE);
      },
      onError: (_code: string, message: string) => {
        this.hintText?.setText(`错误: ${message}`);
      },
    });

    // 添加自己到玩家列表
    this.players = [
      {
        playerId: lanManager.getMyPlayerId(),
        playerName: lanManager.isHost() ? "Host (你)" : "Client (你)",
        role: lanManager.getRole(),
        ready: false,
      },
    ];

    this.refreshDisplay();

    // Host 信息
    if (lanManager.isHost()) {
      this.hintText?.setText("等待对手连接... (请告知对方你的 IP 地址)");
    } else {
      this.hintText?.setText("已连接到 Host，等待开始...");
    }

    return true;
  }

  override processInput(button: Button): boolean {
    if (!this.active) {
      return false;
    }

    switch (button) {
      case Button.SUBMIT:
        this.toggleReady();
        return true;
      case Button.CANCEL:
        this.leaveLobby();
        return true;
      default:
        return false;
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

    this.readyText?.setText(this.isReady ? "已就绪 (按确认键取消)" : "未就绪 (按确认键准备)");
  }
}
