/**
 * 局域网联机主菜单
 * 选项：创建房间 (Host) / 加入房间 (Client) / 返回
 */

import { globalScene } from "#app/global-scene";
import { Button } from "#enums/buttons";
import { UiMode } from "#enums/ui-mode";
import { TextStyle } from "#enums/text-style";
import { UiHandler } from "./ui-handler";
import { addTextObject } from "#ui/text";
import { LanManager } from "#app/lan/lan-manager";

enum LanMenuOption {
  CREATE,
  JOIN,
  BACK,
}

export class LanMenuUiHandler extends UiHandler {
  private container: Phaser.GameObjects.Container | null = null;
  private cursorObj: Phaser.GameObjects.Text | null = null;
  private options: string[] = ["创建房间 (Host)", "加入房间 (Client)", "返回"];
  private menuCursor = 0;

  constructor() {
    super(UiMode.LAN_MENU);
  }

  override setup(): void {
    this.container = globalScene.add.container(0, 0);
    this.container.setVisible(false);

    const cx = globalScene.scaledCanvas.width / 2;
    const cy = globalScene.scaledCanvas.height / 2;

    const title = addTextObject(cx, cy - 120, "局域网联机", TextStyle.SUMMARY_HEADER);
    title.setOrigin(0.5);
    this.container.add(title);

    // 选项文字
    const optsContainer = globalScene.add.container(0, 0);
    this.options.forEach((opt, i) => {
      const txt = addTextObject(cx, cy - 30 + i * 40, opt, TextStyle.WINDOW);
      txt.setOrigin(0.5);
      optsContainer.add(txt);
    });
    this.container.add(optsContainer);

    // 光标
    this.cursorObj = addTextObject(cx - 120, cy - 30, "▶", TextStyle.STATS_VALUE);
    this.cursorObj.setOrigin(0.5);
    this.container.add(this.cursorObj);

    const hint = addTextObject(cx, cy + 120, "↑↓ 选择  Z 确认  X 返回", TextStyle.STATS_LABEL);
    hint.setOrigin(0.5);
    this.container.add(hint);
  }

  override show(_args: unknown[]): boolean {
    super.show(_args);
    this.menuCursor = 0;
    this.updateCursor();
    this.container?.setVisible(true);
    return true;
  }

  override processInput(button: Button): boolean {
    if (!this.active) {
      return false;
    }

    switch (button) {
      case Button.UP:
        this.menuCursor = (this.menuCursor - 1 + this.options.length) % this.options.length;
        this.updateCursor();
        return true;
      case Button.DOWN:
        this.menuCursor = (this.menuCursor + 1) % this.options.length;
        this.updateCursor();
        return true;
      case Button.SUBMIT:
        this.selectOption();
        return true;
      case Button.CANCEL:
        globalScene.ui.setMode(UiMode.TITLE);
        return true;
      default:
        return false;
    }
  }

  override clear(): void {
    super.clear();
    this.container?.setVisible(false);
  }

  private updateCursor(): void {
    if (this.cursorObj) {
      this.cursorObj.y = globalScene.scaledCanvas.height / 2 - 30 + this.menuCursor * 40;
    }
  }

  private selectOption(): void {
    switch (this.menuCursor) {
      case LanMenuOption.CREATE: {
        const lanManager = LanManager.getInstance();
        // Host: 提示用户启动 lan-server 脚本，然后自动连接
        lanManager.createRoom("localhost", 9090, "Host");
        globalScene.ui.setMode(UiMode.LOBBY);
        break;
      }
      case LanMenuOption.JOIN:
        globalScene.ui.setMode(UiMode.LAN_JOIN);
        break;
      case LanMenuOption.BACK:
        globalScene.ui.setMode(UiMode.TITLE);
        break;
    }
  }
}
