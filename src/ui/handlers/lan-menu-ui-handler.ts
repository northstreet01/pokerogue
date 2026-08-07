/**
 * 局域网联机主菜单 - 创建/加入房间选择
 */

import { globalScene } from "#app/global-scene";
import { Button } from "#enums/buttons";
import { UiMode } from "#enums/ui-mode";
import { TextStyle } from "#enums/text-style";
import { UiHandler } from "./ui-handler";
import { addWindow } from "#ui/ui-theme";
import { addTextObject } from "#ui/text";
import { LanManager } from "#app/lan/lan-manager";

export class LanMenuUiHandler extends UiHandler {
  private container: Phaser.GameObjects.Container | null = null;
  private cursorObj: Phaser.GameObjects.Text | null = null;
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private menuCursor = 0;
  private readonly options = ["创建房间 (Host)", "加入房间 (Client)", "返回"];

  constructor() {
    super(UiMode.LAN_MENU);
  }

  override setup(): void {
    this.container = globalScene.add.container(0, 0);
    this.container.setVisible(false);

    const ui = this.getUi();
    const cw = globalScene.scaledCanvas.width;
    const ch = globalScene.scaledCanvas.height;
    const winW = 320;
    const winH = 240;
    const winX = (cw - winW) / 2;
    const winY = (ch - winH) / 2;

    const bg = addWindow(winX, winY, winW, winH).setOrigin(0);
    this.container.add(bg);

    const title = addTextObject(cw / 2, winY + 20, "局域网联机", TextStyle.SUMMARY_HEADER).setOrigin(0.5, 0);
    this.container.add(title);

    this.options.forEach((opt, i) => {
      const txt = addTextObject(cw / 2, winY + 65 + i * 40, opt, TextStyle.WINDOW).setOrigin(0.5, 0);
      this.container!.add(txt);
      this.optionTexts.push(txt);
    });

    this.cursorObj = addTextObject(winX + 30, winY + 65, "▶", TextStyle.STATS_VALUE).setOrigin(0.5, 0);
    this.container.add(this.cursorObj);

    const hint = addTextObject(cw / 2, winY + winH - 20, "↑↓ 选择  Z 确认  X 返回", TextStyle.STATS_LABEL).setOrigin(0.5, 0);
    this.container.add(hint);

    ui.add(this.container);
  }

  override show(_args: unknown[]): boolean {
    super.show(_args);
    this.menuCursor = 0;
    this.updateCursor();
    this.container?.setVisible(true);
    return true;
  }

  override processInput(button: Button): boolean {
    if (!this.active) { return false; }
    switch (button) {
      case Button.UP: this.menuCursor = (this.menuCursor - 1 + this.options.length) % this.options.length; this.updateCursor(); return true;
      case Button.DOWN: this.menuCursor = (this.menuCursor + 1) % this.options.length; this.updateCursor(); return true;
      case Button.SUBMIT: this.select(); return true;
      case Button.CANCEL: globalScene.ui.setMode(UiMode.TITLE); return true;
      default: return false;
    }
  }

  override clear(): void {
    super.clear();
    this.container?.setVisible(false);
  }

  private updateCursor(): void {
    if (this.cursorObj) {
      const winY = (globalScene.scaledCanvas.height - 240) / 2;
      this.cursorObj.setY(winY + 65 + this.menuCursor * 40);
    }
  }

  private select(): void {
    switch (this.menuCursor) {
      case 0: {
        const lm = LanManager.getInstance();
        lm.createRoom("localhost", 9090, "Host");
        globalScene.ui.setMode(UiMode.LOBBY);
        break;
      }
      case 1:
        globalScene.ui.setMode(UiMode.LAN_JOIN);
        break;
      case 2:
        globalScene.ui.setMode(UiMode.TITLE);
        break;
    }
  }
}
