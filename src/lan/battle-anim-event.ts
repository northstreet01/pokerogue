/**
 * 战斗动画事件 — Host 收集 → Client 重放
 *
 * 每个 BattleAnimEvent 代表战斗回合中的一个视觉事件。
 * Host 在回合执行期间收集事件，在 TurnEndPhase 批量发送。
 * Client 接收后逐个推入 ReplayPhase 播放动画。
 */

export type BattleAnimEvent =
  | { type: "MOVE_USED"; userIndex: number; moveId: number; moveName: string; targets: number[] }
  | { type: "DAMAGE"; targetIndex: number; damage: number }
  | { type: "MISS"; targetIndex: number }
  | { type: "NO_EFFECT"; targetIndex: number }
  | { type: "FAINT"; targetIndex: number }
  | { type: "HEAL"; targetIndex: number; amount: number }
  | { type: "STATUS"; targetIndex: number; status: string }
  | { type: "STAT_CHANGE"; targetIndex: number; stat: number; stages: number; message: string }
  | { type: "MESSAGE"; text: string }
  | { type: "TURN_END"; turn: number };

/**
 * Host 发送给 Client 的完整回合结果：
 * - events: 动画事件序列（按回合执行顺序）
 * - snapshot: 最终状态快照（验证用）
 */
export interface TurnResult {
  events: BattleAnimEvent[];
  snapshot: import("./turn-snapshot").TurnSnapshot;
}
