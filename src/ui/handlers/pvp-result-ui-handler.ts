/**
 * PvP 对决结算 UI Handler
 */

import { globalScene } from "#app/global-scene";
import { Button } from "#enums/buttons";
import { UiMode } from "#enums/ui-mode";
import { TextStyle } from "#enums/text-style";
import { UiHandler } from "./ui-handler";
import { addTextObject } from "#ui/text";

export class PvpResultUiHandler extends UiHandler {
  private container: Phaser.GameObjects.Container | null = null;
  private resultText: Phaser.GameObjects.Text | null = null;
  private rewardText: Phaser.GameObjects.Text | null = null;
  private continueText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(UiMode.PVP_RESULT);
  }

  override setup(): void {
    this.container = globalScene.add.container(0, 0);
    this.container.setVisible(false);

    const centerX = globalScene.scaledCanvas.width / 2;
    const centerY = globalScene.scaledCanvas.height / 2;

    this.resultText = addTextObject(centerX, centerY - 100, "", TextStyle.SUMMARY_HEADER);
    this.resultText.setOrigin(0.5);
    this.container.add(this.resultText);

    this.rewardText = addTextObject(centerX, centerY, "", TextStyle.STATS_VALUE);
    this.rewardText.setOrigin(0.5);
    this.container.add(this.rewardText);

    this.continueText = addTextObject(centerX, centerY + 100, "按确认键继续闯关", TextStyle.STATS_LABEL);
    this.continueText.setOrigin(0.5);
    this.container.add(this.continueText);
  }

  override show(args: unknown[]): boolean {
    super.show(args);
    this.container?.setVisible(true);
    if (args.length >= 1) {
      this.resultText?.setText(String(args[0]));
    }
    if (args.length >= 2) {
      this.rewardText?.setText(String(args[1]));
    }
    return true;
  }

  override processInput(button: Button): boolean {
    if (!this.active) {
      return false;
    }
    if (button === Button.SUBMIT || button === Button.CANCEL) {
      globalScene.ui.setMode(UiMode.MESSAGE);
      return true;
    }
    return false;
  }

  override clear(): void {
    super.clear();
    this.container?.setVisible(false);
  }
}
