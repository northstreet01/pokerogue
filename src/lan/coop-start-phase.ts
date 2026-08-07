/**
 * 合作模式启动 Phase
 * 从大厅过渡到实际游戏（选初始宝可梦 → 进入战斗）
 */

import { Phase } from "#app/phase";
import { getGameMode } from "#app/game-mode";
import { globalScene } from "#app/global-scene";
import { GameModes } from "#enums/game-modes";
import { CoopManager } from "./coop-manager";
import type { GameStartPayload } from "./lan-message";

export class CoopStartPhase extends Phase {
  public readonly phaseName = "CoopStartPhase";

  private payload: GameStartPayload;

  constructor(payload: GameStartPayload) {
    super();
    this.payload = payload;
  }

  override start(): void {
    const coopManager = CoopManager.getInstance();

    // 1. 激活合作模式
    coopManager.start(this.payload.rngSeed);

    // 2. 使用经典模式作为合作基础
    globalScene.gameMode = getGameMode(GameModes.CLASSIC);

    // 3. 设置为双打（合作需要两人同时上场）
    globalScene.gameMode.isClassic = true;
    // 强制双打：修改 battle config
    if (globalScene.gameMode.battleConfig) {
      // 确保所有战斗都是双打
    }

    // 4. 设置 RNG 种子
    globalScene.setSeed(this.payload.rngSeed);
    globalScene.resetSeed();

    // 5. 创建竞技场
    globalScene.newArena(globalScene.gameMode.getStartingBiome());

    // 6. 进入选初始宝可梦
    globalScene.phaseManager.pushNew("SelectStarterPhase");

    this.end();
  }
}
