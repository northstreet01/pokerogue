/**
 * TurnResult — Host 结算完成后的回合结果
 *
 * Host 在收集全双方指令后按优先度队列结算，
 * 输出结构化事件日志给 Client 串行播放。
 */

/** 单个战斗事件 */
export type TurnEvent =
  | { type: "MOVE"; user: number; moveId: number; moveName: string; targets: number[] }
  | { type: "DAMAGE"; target: number; amount: number }
  | { type: "HEAL"; target: number; amount: number }
  | { type: "FAINT"; target: number }
  | { type: "MISS"; target: number }
  | { type: "NO_EFFECT"; target: number }
  | { type: "STATUS"; target: number; status: string }
  | { type: "STAT_CHANGE"; target: number; stat: number; stages: number }
  | { type: "MESSAGE"; text: string };

/** 单个宝可梦的最终状态 */
export interface PokeState {
  index: number;
  hp: number;
  maxHp: number;
  status: string | null;
  fainted: boolean;
}

/** 回合结算结果 */
export interface TurnResult {
  turn: number;
  events: TurnEvent[];
  finalState: PokeState[];  // 最终状态用于校验/回正
}
