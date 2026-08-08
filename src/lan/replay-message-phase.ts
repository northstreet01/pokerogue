/**
 * ReplayMessagePhase — Client 端重放战斗文字消息
 * 收到 MESSAGE 事件后显示对应文本
 */

import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";

export class ReplayMessagePhase extends Phase {
  public readonly phaseName = "ReplayMessagePhase";
  private text: string;

  constructor(text: string) {
    super();
    this.text = text;
  }

  override start(): void {
    if (this.text) {
      globalScene.phaseManager.queueMessage(this.text, null, false, null, true);
    }
    this.end();
  }
}
