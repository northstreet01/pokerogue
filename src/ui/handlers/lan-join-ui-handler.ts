/**
 * 加入房间界面 - 自由输入 IP 地址
 */

import { globalScene } from "#app/global-scene";
import { Button } from "#enums/buttons";
import { UiMode } from "#enums/ui-mode";
import { TextStyle } from "#enums/text-style";
import { UiHandler } from "./ui-handler";
import { addWindow } from "#ui/ui-theme";
import { addTextObject } from "#ui/text";
import { LanManager } from "#app/lan/lan-manager";

// 用键盘输入模拟数字键映射
const KEY_DIGITS: Record<string, string> = {
  ZERO: "0", ONE: "1", TWO: "2", THREE: "3", FOUR: "4",
  FIVE: "5", SIX: "6", SEVEN: "7", EIGHT: "8", NINE: "9",
};

export class LanJoinUiHandler extends UiHandler {
  private container: Phaser.GameObjects.Container | null = null;
  private ipText: Phaser.GameObjects.Text | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;

  private ip = "";
  private port = 9090;
  private editPort = false;
  private connecting = false;

  constructor() {
    super(UiMode.LAN_JOIN);
  }

  override setup(): void {
    this.container = globalScene.add.container(0, 0);
    this.container.setVisible(false);

    const cw = globalScene.scaledCanvas.width;
    const ch = globalScene.scaledCanvas.height;
    const winW = 460;
    const winH = 300;
    const offY = -ch;
    const winX = (cw - winW) / 2;
    const winY = offY + (ch - winH) / 2;

    const bg = addWindow(winX, winY, winW, winH).setOrigin(0);
    this.container.add(bg);

    const title = addTextObject(cw / 2, winY + 20, "加入房间", TextStyle.SUMMARY_HEADER).setOrigin(0.5, 0);
    this.container.add(title);

    const label = addTextObject(cw / 2, winY + 60, "输入 Host 的 IP 地址和端口", TextStyle.WINDOW).setOrigin(0.5, 0);
    this.container.add(label);

    this.ipText = addTextObject(cw / 2, winY + 110, "", TextStyle.STATS_VALUE).setOrigin(0.5, 0);
    this.container.add(this.ipText);

    this.statusText = addTextObject(cw / 2, winY + 170, "", TextStyle.STATS_LABEL).setOrigin(0.5, 0);
    this.container.add(this.statusText);

    const hints = addTextObject(cw / 2, winY + 240, "键盘输入 IP  TAB 切换位置  Z 连接  X 返回  BACKSPACE 删除", TextStyle.STATS_LABEL).setOrigin(0.5, 0);
    this.container.add(hints);

    this.getUi().add(this.container);
  }

  override show(_args: unknown[]): boolean {
    super.show(_args);
    this.ip = "";
    this.port = 9090;
    this.editPort = false;
    this.connecting = false;
    this.refreshDisplay();
    this.container?.setVisible(true);
    // 监听键盘输入
    globalScene.input.keyboard?.on("keydown", this.onKeyDown, this);
    return true;
  }

  override processInput(button: Button): boolean {
    if (!this.active || this.connecting) { return false; }
    switch (button) {
      case Button.SUBMIT: this.doConnect(); return true;
      case Button.CANCEL:
        globalScene.input.keyboard?.off("keydown", this.onKeyDown, this);
        globalScene.ui.setMode(UiMode.LAN_MENU);
        return true;
      default: return false;
    }
  }

  override clear(): void {
    super.clear();
    globalScene.input.keyboard?.off("keydown", this.onKeyDown, this);
    this.container?.setVisible(false);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.active || this.connecting) { return; }

    // Backspace 删除
    if (event.key === "Backspace") {
      if (this.editPort) {
        this.port = Math.floor(this.port / 10) || 9090;
      } else {
        this.ip = this.ip.slice(0, -1);
      }
      this.refreshDisplay();
      return;
    }

    // Tab 切换编辑位置
    if (event.key === "Tab") {
      event.preventDefault();
      this.editPort = !this.editPort;
      this.refreshDisplay();
      return;
    }

    // 点号
    if (event.key === "." && !this.editPort) {
      this.ip += ".";
      this.refreshDisplay();
      return;
    }

    // 数字
    if (/^[0-9]$/.test(event.key)) {
      if (this.editPort) {
        this.port = parseInt(String(this.port) + event.key) || 9090;
        if (this.port > 65535) { this.port = 65535; }
      } else {
        if (this.ip.length < 21) {
          this.ip += event.key;
        }
      }
      this.refreshDisplay();
    }
  };

  private formatDisplay(): string {
    const padIp = this.ip.padEnd(15, " ");
    const cursor = this.editPort ? "     ◀" : "◀     ";
    return `${padIp}  ${cursor}  :${this.port}`;
  }

  private refreshDisplay(): void {
    this.ipText?.setText(this.formatDisplay());
  }

  private doConnect(): void {
    const finalIp = this.ip.replace(/\.$/, "") || "localhost";
    this.connecting = true;
    this.statusText?.setText(`连接中... ${finalIp}:${this.port}`);

    const lanManager = LanManager.getInstance();
    lanManager.joinRoom(finalIp, this.port, "Client");

    setTimeout(() => {
      if (lanManager.getConnectionState() !== "disconnected") {
        globalScene.input.keyboard?.off("keydown", this.onKeyDown, this);
        globalScene.ui.setMode(UiMode.LOBBY);
      } else {
        this.statusText?.setText("连接失败！请检查 IP 和端口");
        this.connecting = false;
      }
    }, 2000);
  }
}
