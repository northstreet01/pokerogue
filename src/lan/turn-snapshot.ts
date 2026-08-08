/**
 * 回合同步数据结构
 * Host 每回合结束后将战场状态打包为 TurnSnapshot 发送给 Client
 */

import { StatusEffect } from "#enums/status-effect";

/**
 * 单个宝可梦的快照数据
 */
export interface PokemonSnapshot {
  /** BattlerIndex 位置 (PLAYER=0, PLAYER_2=1, ENEMY=2, ENEMY_2=3) */
  index: number;
  /** 当前 HP */
  hp: number;
  /** 最大 HP */
  maxHp: number;
  /** 状态异常 (StatusEffect 枚举值字符串, 如 "PARALYSIS", "BURN", 或 null) */
  status: string | null;
  /** 是否昏厥 */
  fainted: boolean;
  /** 能力等级 [atk, def, spatk, spdef, spd], 范围 -6 ~ +6 */
  statStages: number[];
}

/**
 * 回合快照 — Host 在每回合结束后打包发送给 Client
 */
export interface TurnSnapshot {
  /** 回合编号 */
  turn: number;
  /** 场上所有宝可梦的快照数据 */
  pokemon: PokemonSnapshot[];
}

/**
 * 从 StatusEffect 枚举值转换为字符串（用于网络传输）
 */
export function statusEffectToString(effect: number | null | undefined): string | null {
  if (effect == null || effect === StatusEffect.NONE) return null;
  return StatusEffect[effect] ?? null;
}

/**
 * 从字符串恢复 StatusEffect 枚举值（用于 Client 端应用快照）
 */
export function stringToStatusEffect(str: string | null): StatusEffect {
  if (!str) return StatusEffect.NONE;
  const value = (StatusEffect as any)[str];
  return typeof value === "number" ? value : StatusEffect.NONE;
}
