/**
 * ReplayDamagePhase — Client 端重放扣血动画
 * 收到 DAMAGE 事件后更新 HP 条
 */

import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";

export class ReplayDamagePhase extends Phase {
  public readonly phaseName = "ReplayDamagePhase";
  private targetIndex: number;
  private damage: number;

  constructor(targetIndex: number, damage: number) {
    super();
    this.targetIndex = targetIndex;
    this.damage = damage;
  }

  override start(): void {
    const pokemon = globalScene.getField()[this.targetIndex];
    if (pokemon && this.damage > 0) {
      // 扣血并刷新 HP 条
      pokemon.hp = Math.max(0, pokemon.hp - this.damage);
      pokemon.updateInfo();
    }
    this.end();
  }
}
