/**
 * 加入房间界面 - TCP 版，支持粘贴 IP
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
    const winH = 280;
    const offY = -ch;
    const winX = (cw - winW) / 2;
    const winY = offY + (ch - winH) / 2;

    this.container.add(addWindow(winX, winY, winW, winH).setOrigin(0));
    this.container.add(addTextObject(cw / 2, winY + 20, "加入房间", TextStyle.SUMMARY_HEADER).setOrigin(0.5, 0));
    this.container.add(addTextObject(cw / 2, winY + 55, "输入 Host 的虚拟 IP 地址", TextStyle.WINDOW).setOrigin(0.5, 0));

    this.ipText = addTextObject(cw / 2, winY + 105, "", TextStyle.STATS_VALUE).setOrigin(0.5, 0);
    this.container.add(this.ipText);

    this.statusText = addTextObject(cw / 2, winY + 160, "", TextStyle.STATS_LABEL).setOrigin(0.5, 0);
    this.container.add(this.statusText);

    this.container.add(addTextObject(cw / 2, winY + 230, "Ctrl+V 粘贴  TAB 切换  Z 连接  X 返回", TextStyle.STATS_LABEL).setOrigin(0.5, 0));
    this.getUi().add(this.container);
  }

  override show(_args: unknown[]): boolean {
    super.show(_args);
    this.ip = "";
    this.editPort = false;
    this.connecting = false;
    this.refresh();
    this.container?.setVisible(true);
    globalScene.input.keyboard?.on("keydown", this.onKeyDown, this);
    document.addEventListener("paste", this.onPaste);
    return true;
  }

  override processInput(button: Button): boolean {
    if (!this.active || this.connecting) { return false; }
    switch (button) {
      case Button.SUBMIT: this.doConnect(); return true;
      case Button.CANCEL:
        this.cleanup();
        globalScene.ui.setMode(UiMode.LAN_MENU);
        return true;
      default: return false;
    }
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.active || this.connecting) { return; }
    if (event.key === "Backspace") {
      this.editPort ? (this.port = Math.floor(this.port / 10) || 9090) : (this.ip = this.ip.slice(0, -1));
    } else if (event.key === "Tab") { event.preventDefault(); this.editPort = !this.editPort; }
    else if (event.key === "." && !this.editPort) { this.ip += "."; }
    else if (/^[0-9]$/.test(event.key)) {
      this.editPort ? (this.port = Math.min(65535, parseInt(String(this.port) + event.key) || 9090)) : (this.ip.length < 21 && (this.ip += event.key));
    }
    this.refresh();
  };

  private onPaste = async (event: ClipboardEvent): Promise<void> => {
    if (!this.active || this.connecting) { return; }
    event.preventDefault();
    try {
      const text = (await navigator.clipboard.readText()).trim().replace(/[^0-9.]/g, "");
      if (text) { this.editPort ? (this.port = Math.min(65535, parseInt(text) || 9090)) : (this.ip = text.slice(0, 21)); this.refresh(); }
    } catch {}
  };

  private refresh(): void {
    this.ipText?.setText(`${this.ip.padEnd(15, " ")}  ${this.editPort ? "    ◀" : "◀    "}  :${this.port}`);
  }

  private async doConnect(): Promise<void> {
    const finalIp = this.ip.replace(/\.$/, "") || "localhost";
    this.connecting = true;
    this.statusText?.setText(`连接中... ${finalIp}:${this.port}`);
    try {
      await LanManager.getInstance().joinRoom(finalIp, this.port);
      this.cleanup();
      globalScene.ui.setMode(UiMode.LOBBY);
    } catch {
      this.statusText?.setText("连接失败！");
      this.connecting = false;
    }
  }

  private cleanup(): void {
    globalScene.input.keyboard?.off("keydown", this.onKeyDown, this);
    document.removeEventListener("paste", this.onPaste);
  }

  override clear(): void { super.clear(); this.cleanup(); this.container?.setVisible(false); }
}
