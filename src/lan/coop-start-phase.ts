/**
 * 合作模式启动 Phase
 * 同步种子 → 激活合作模式 → 推入后续阶段
 *
 * 替代单机 TitlePhase 的游戏启动流程，确保双方使用相同种子。
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

    // 同步 RNG 种子 — 双方必须相同
    globalScene.setSeed(this.seed);
    globalScene.resetSeed();

    // 创建竞技场
    globalScene.newArena(globalScene.gameMode.getStartingBiome());

    // 清 UI → 选初始宝可梦
    globalScene.ui.clearText();
    globalScene.ui.setMode(0);

    // 推 SelectStarterPhase → CoopPartySyncPhase → EncounterPhase
    // (复刻 TitlePhase.end() 的合作模式流程)
    globalScene.phaseManager.pushNew("SelectStarterPhase");
    globalScene.phaseManager.pushNew("CoopPartySyncPhase");
    globalScene.phaseManager.pushNew("EncounterPhase", false);

    this.end();
  }
}
