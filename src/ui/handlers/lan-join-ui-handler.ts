/**
 * 加入房间界面 - IP 输入 + 连接
 */

import { globalScene } from "#app/global-scene";
import { Button } from "#enums/buttons";
import { UiMode } from "#enums/ui-mode";
import { TextStyle } from "#enums/text-style";
import { UiHandler } from "./ui-handler";
import { addWindow } from "#ui/ui-theme";
import { addTextObject } from "#ui/text";
import { LanManager } from "#app/lan/lan-manager";

export class LanJoinUiHandler extends UiHandler {
  private container: Phaser.GameObjects.Container | null = null;
  private titleText: Phaser.GameObjects.Text | null = null;
  private ipText: Phaser.GameObjects.Text | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private hintText: Phaser.GameObjects.Text | null = null;
  private ip = "192.168.1.";
  private port = 9090;
  private cursorPosition = 0; // 0=ip末尾块, 1=port
  private connecting = false;

  constructor() {
    super(UiMode.LAN_JOIN);
  }

  override setup(): void {
    this.container = globalScene.add.container(0, 0);
    this.container.setVisible(false);

    const ui = this.getUi();
    const cw = globalScene.scaledCanvas.width;
    const ch = globalScene.scaledCanvas.height;
    const winW = 420;
    const winH = 280;
    const winX = (cw - winW) / 2;
    const winY = (ch - winH) / 2;

    // 窗口背景
    const bg = addWindow(winX, winY, winW, winH).setOrigin(0);
    this.container.add(bg);

    this.titleText = addTextObject(cw / 2, winY + 20, "加入房间", TextStyle.SUMMARY_HEADER).setOrigin(0.5, 0);
    this.container.add(this.titleText);

    const label = addTextObject(cw / 2, winY + 60, "输入 Host 的局域网 IP 地址", TextStyle.WINDOW).setOrigin(0.5, 0);
    this.container.add(label);

    this.ipText = addTextObject(cw / 2, winY + 100, this.formatDisplay(), TextStyle.STATS_VALUE).setOrigin(0.5, 0);
    this.container.add(this.ipText);

    this.statusText = addTextObject(cw / 2, winY + 150, "", TextStyle.STATS_LABEL).setOrigin(0.5, 0);
    this.container.add(this.statusText);

    this.hintText = addTextObject(cw / 2, winY + 220, "↑↓ 修改数字  ←→ 切换位置  Z 连接  X 返回", TextStyle.STATS_LABEL)
      .setOrigin(0.5, 0);
    this.container.add(this.hintText);

    ui.add(this.container);
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
      case Button.UP: this.adjustDigit(1); return true;
      case Button.DOWN: this.adjustDigit(-1); return true;
      case Button.LEFT: this.cursorPosition = (this.cursorPosition + 1) % 2; this.refreshDisplay(); return true;
      case Button.RIGHT: this.cursorPosition = (this.cursorPosition + 1) % 2; this.refreshDisplay(); return true;
      case Button.SUBMIT: this.doConnect(); return true;
      case Button.CANCEL: globalScene.ui.setMode(UiMode.LAN_MENU); return true;
      default: return false;
    }
  }

  override clear(): void {
    super.clear();
    this.container?.setVisible(false);
  }

  private adjustDigit(delta: number): void {
    if (this.cursorPosition === 0) {
      // 改 IP 末尾
      const parts = this.ip.split(".");
      const last = parseInt(parts[parts.length - 1]) || 1;
      parts[parts.length - 1] = String(Math.max(1, Math.min(254, last + delta)));
      this.ip = parts.join(".");
    } else {
      this.port = Math.max(1024, Math.min(65535, this.port + delta));
    }
    this.refreshDisplay();
  }

  private formatDisplay(): string {
    const cursor1 = this.cursorPosition === 0 ? "◀" : " ";
    const cursor2 = this.cursorPosition === 1 ? " ▶" : "  ";
    return `${this.ip} ${cursor1}  :${this.port}${cursor2}`;
  }

  private refreshDisplay(): void {
    this.ipText?.setText(this.formatDisplay());
  }

  private doConnect(): void {
    this.connecting = true;
    this.statusText?.setText("连接中...");

    const lanManager = LanManager.getInstance();
    lanManager.joinRoom(this.ip.trim(), this.port, "Client");

    setTimeout(() => {
      if (lanManager.getConnectionState() !== "disconnected") {
        globalScene.ui.setMode(UiMode.LOBBY);
      } else {
        this.statusText?.setText("连接失败！请检查 IP 和端口");
        this.connecting = false;
      }
    }, 1500);
  }
}
