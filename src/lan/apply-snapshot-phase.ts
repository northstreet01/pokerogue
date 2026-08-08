/**
 * ApplySnapshotPhase — Client 端应用 Host 下发的 TurnSnapshot
 *
 * Client 收到 TurnSnapshot 后：
 * 1. 直接赋值所有宝可梦的 HP / status / fainted / statStages
 * 2. 更新 UI 显示（HP 条、状态图标、能力等级）
 * 3. 进入下一回合指令选择
 */

import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";
import { LanManager } from "./lan-manager";
import { CoopManager } from "./coop-manager";
import { Status } from "#data/status-effect";
import type { TurnSnapshot } from "./turn-snapshot";
import { stringToStatusEffect } from "./turn-snapshot";

export class ApplySnapshotPhase extends Phase {
  public readonly phaseName = "ApplySnapshotPhase";
  private snapshot: TurnSnapshot | null = null;
  private received = false;

  override start(): void {
    // 仅 Client 执行
    const coop = CoopManager.getInstance();
    if (!coop.isActive()) {
      this.end();
      return;
    }

    const lm = LanManager.getInstance();

    // 先检查缓存的快照（可能在 Phase 启动前就已收到）
    const cached = lm.getLastSnapshot();
    if (cached) {
      this.applySnapshot(cached);
      this.end();
      return;
    }

    const handler = (snapshot: TurnSnapshot) => {
      this.received = true;
      cleanup();
      this.applySnapshot(snapshot);
      this.end();
    };

    lm.on("snapshot", handler);

    // 30s 超时保护
    const timeout = setTimeout(() => {
      if (!this.received) {
        cleanup();
        this.end();
      }
    }, 30000);

    const cleanup = () => {
      clearTimeout(timeout);
      lm.off("snapshot");
    };
  }

  /**
   * 应用 TurnSnapshot 到所有场上宝可梦
   */
  private applySnapshot(snapshot: TurnSnapshot): void {
    const field = globalScene.getField();

    for (const pokeSnapshot of snapshot.pokemon) {
      const pokemon = field[pokeSnapshot.index];
      if (!pokemon) continue;

      // 应用 HP
      pokemon.hp = pokeSnapshot.hp;

      // 应用状态异常
      const statusEffect = stringToStatusEffect(pokeSnapshot.status);
      if (statusEffect === 0) {
        pokemon.status = null;
      } else {
        pokemon.status = new Status(statusEffect);
      }

      // 应用昏厥标记
      if (pokeSnapshot.fainted && pokemon.hp > 0) {
        // 触发 faint 逻辑（但不触发 GameOver — Host 控制这个）
        pokemon.hp = 0;
      }

      // 应用能力等级 [atk, def, spatk, spdef, spd]
      if (pokeSnapshot.statStages && pokeSnapshot.statStages.length === 5) {
        for (let i = 0; i < 5; i++) {
          pokemon.summonData.statStages[i] = pokeSnapshot.statStages[i];
        }
      }
    }

    // 刷新 UI
    globalScene.updateGameInfo();
  }
}
