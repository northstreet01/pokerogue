/**
 * 合作模式启动 Phase
 */

import { Phase } from "#app/phase";
import { getGameMode } from "#app/game-mode";
import { globalScene } from "#app/global-scene";
import { GameModes } from "#enums/game-modes";
import { CoopManager } from "./coop-manager";

export class CoopStartPhase extends Phase {
  public readonly phaseName = "CoopStartPhase";
  private seed: string;

  constructor(seed: string) {
    super();
    this.seed = seed;
  }

  override start(): void {
    CoopManager.getInstance().start();

    globalScene.gameMode = getGameMode(GameModes.CLASSIC);
    globalScene.setSeed(this.seed);
    globalScene.resetSeed();
    globalScene.newArena(globalScene.gameMode.getStartingBiome());
    globalScene.phaseManager.pushNew("SelectStarterPhase");

    this.end();
  }
}
