/**
 * ReplayFaintPhase — Client 端重放昏厥动画
 * 收到 FAINT 事件后显示 "{Pokemon} 倒下了！" 并刷新 HP
 */

import { globalScene } from "#app/global-scene";
import { getPokemonNameWithAffix } from "#app/messages";
import { Phase } from "#app/phase";
import i18next from "i18next";

export class ReplayFaintPhase extends Phase {
  public readonly phaseName = "ReplayFaintPhase";
  private targetIndex: number;

  constructor(targetIndex: number) {
    super();
    this.targetIndex = targetIndex;
  }

  override start(): void {
    const pokemon = globalScene.getField()[this.targetIndex];
    if (pokemon) {
      pokemon.hp = 0;
      pokemon.updateInfo();
      globalScene.phaseManager.queueMessage(
        i18next.t("battle:fainted", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) }),
        null,
        true,
      );
    }
    this.end();
  }
}
