/**
 * ReplayMovePhase — Client 端重放技能使用
 * 收到 MOVE_USED 事件后显示 "{Pokemon} 使用了 {Move}!"
 */

import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";
import { getPokemonNameWithAffix } from "#app/messages";
import i18next from "i18next";

export class ReplayMovePhase extends Phase {
  public readonly phaseName = "ReplayMovePhase";
  private userIndex: number;
  private moveName: string;

  constructor(userIndex: number, moveName: string) {
    super();
    this.userIndex = userIndex;
    this.moveName = moveName;
  }

  override start(): void {
    const pokemon = globalScene.getField()[this.userIndex];
    if (pokemon && this.moveName) {
      const pokemonName = getPokemonNameWithAffix(pokemon);
      globalScene.phaseManager.queueMessage(
        i18next.t("battle:useMove", { pokemonNameWithAffix: pokemonName, moveName: this.moveName }),
        500,
      );
    }
    this.end();
  }
}
