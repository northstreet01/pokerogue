/**
 * 加入房间界面
 * 输入 Host IP 地址和端口
 */

import { globalScene } from "#app/global-scene";
import { Button } from "#enums/buttons";
import { UiMode } from "#enums/ui-mode";
import { TextStyle } from "#enums/text-style";
import { UiHandler } from "./ui-handler";
import { addTextObject } from "#ui/text";
import { LanManager } from "#app/lan/lan-manager";

export class LanJoinUiHandler extends UiHandler {
  private container: Phaser.GameObjects.Container | null = null;
  private ipText: Phaser.GameObjects.Text | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private ip = "192.168.";
  private port = 9090;
  private editingPort = false;
  private connecting = false;

  constructor() {
    super(UiMode.LAN_JOIN);
  }

  override setup(): void {
    this.container = globalScene.add.container(0, 0);
    this.container.setVisible(false);

    const cx = globalScene.scaledCanvas.width / 2;
    const cy = globalScene.scaledCanvas.height / 2;

    const title = addTextObject(cx, cy - 120, "加入房间", TextStyle.SUMMARY_HEADER);
    title.setOrigin(0.5);
    this.container.add(title);

    const label = addTextObject(cx, cy - 50, "输入 Host IP 地址:", TextStyle.WINDOW);
    label.setOrigin(0.5);
    this.container.add(label);

    this.ipText = addTextObject(cx, cy, `${this.ip}    :${this.port}`, TextStyle.STATS_VALUE);
    this.ipText.setOrigin(0.5);
    this.container.add(this.ipText);

    this.statusText = addTextObject(cx, cy + 60, "", TextStyle.STATS_LABEL);
    this.statusText.setOrigin(0.5);
    this.container.add(this.statusText);

    const hint = addTextObject(cx, cy + 120, "↑↓ 修改数字  ←→ 切换位置  Z 连接  X 返回", TextStyle.STATS_LABEL);
    hint.setOrigin(0.5);
    this.container.add(hint);
  }

  override show(_args: unknown[]): boolean {
    super.show(_args);
    this.connecting = false;
    this.refreshDisplay();
    this.container?.setVisible(true);
    return true;
  }

  override processInput(button: Button): boolean {
    if (!this.active || this.connecting) {
      return false;
    }

    switch (button) {
      case Button.UP:
        this.adjustDigit(1);
        return true;
      case Button.DOWN:
        this.adjustDigit(-1);
        return true;
      case Button.LEFT:
        this.editingPort = !this.editingPort;
        this.refreshDisplay();
        return true;
      case Button.RIGHT:
        this.editingPort = !this.editingPort;
        this.refreshDisplay();
        return true;
      case Button.SUBMIT:
        this.connect();
        return true;
      case Button.CANCEL:
        globalScene.ui.setMode(UiMode.LAN_MENU);
        return true;
      default:
        return false;
    }
  }

  override clear(): void {
    super.clear();
    this.container?.setVisible(false);
  }

  private adjustDigit(delta: number): void {
    if (this.editingPort) {
      this.port = Math.max(1024, Math.min(65535, this.port + delta));
    }
    this.refreshDisplay();
  }

  private refreshDisplay(): void {
    const cursor = this.editingPort ? "  ▶" : "◀  ";
    this.ipText?.setText(`${this.ip}  ${cursor}  :${this.port}`);
  }

  private connect(): void {
    this.connecting = true;
    this.statusText?.setText("连接中...");

    const lanManager = LanManager.getInstance();
    lanManager.joinRoom(this.ip.trim() || "localhost", this.port, "Client");

    // 简单延迟后跳到大厅
    setTimeout(() => {
      if (lanManager.getConnectionState() !== "disconnected") {
        globalScene.ui.setMode(UiMode.LOBBY);
      } else {
        this.statusText?.setText("连接失败！请检查 IP 地址");
        this.connecting = false;
      }
    }, 1500);
  }
}
