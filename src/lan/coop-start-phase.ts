/**
 * 合作模式启动 Phase
 * 复用现有 TitlePhase 的游戏初始化流程
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
    // 激活合作模式
    CoopManager.getInstance().start();

    // 用经典模式
    globalScene.gameMode = getGameMode(GameModes.CLASSIC);

    // 设置 RNG 种子
    globalScene.setSeed(this.seed);
    globalScene.resetSeed();

    // 创建竞技场
    globalScene.newArena(globalScene.gameMode.getStartingBiome());

    // 清 UI → 选初始宝可梦
    globalScene.ui.clearText();
    globalScene.ui.setMode(0); // 清除当前 UI mode
    globalScene.phaseManager.pushNew("SelectStarterPhase");

    this.end();
  }
}
