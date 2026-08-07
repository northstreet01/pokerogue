/**
 * 局域网联机消息协议定义
 */

/** 消息类型枚举 */
export const MessageType = {
  // 连接握手
  HELLO: "HELLO",
  HELLO_ACK: "HELLO_ACK",
  // 房间管理
  READY: "READY",
  READY_CANCEL: "READY_CANCEL",
  GAME_START: "GAME_START",
  MODE_SELECT: "MODE_SELECT",
  // RNG 同步
  RNG_SEED: "RNG_SEED",
  // 回合指令
  TURN_COMMAND: "TURN_COMMAND",
  TURN_SYNC: "TURN_SYNC",
  // PvP
  PVP_TRIGGER: "PVP_TRIGGER",
  PVP_READY: "PVP_READY",
  PVP_COMMAND: "PVP_COMMAND",
  PVP_RESULT: "PVP_RESULT",
  PVP_SKIP_VOTE: "PVP_SKIP_VOTE",
  // 合作模式
  COOP_REWARD: "COOP_REWARD",
  PLAYER_FAINT: "PLAYER_FAINT",
  PLAYER_RESCUE: "PLAYER_RESCUE",
  // 连接管理
  HEARTBEAT: "HEARTBEAT",
  HEARTBEAT_ACK: "HEARTBEAT_ACK",
  DISCONNECT: "DISCONNECT",
  RECONNECT: "RECONNECT",
  ERROR: "ERROR",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

/** 玩家角色 */
export type PlayerRole = "host" | "client";

/** 玩家信息 */
export interface PlayerInfo {
  playerId: string;
  playerName: string;
  role: PlayerRole;
  ready: boolean;
}

/** 基础消息结构 */
export interface LanMessage {
  type: MessageType;
  payload: unknown;
  seq: number;
  timestamp: number;
}

/** 握手消息 */
export interface HelloPayload {
  playerId: string;
  playerName: string;
  gameVersion: string;
}

/** 握手确认消息 */
export interface HelloAckPayload {
  assignedId: string;
  hostName: string;
  gameVersion: string;
}

/** 就绪状态 */
export interface ReadyPayload {
  playerId: string;
  ready: boolean;
}

/** 游戏启动 */
export interface GameStartPayload {
  rngSeed: string;
  mode: "coop" | "pvp" | "mixed";
  hostParty: unknown; // 序列化的队伍数据
  clientParty: unknown;
}

/** RNG 种子同步 */
export interface RngSeedPayload {
  seed: string;
}

/** 回合指令 */
export interface TurnCommandPayload {
  playerId: string;
  commands: unknown[]; // TurnCommand[]
  checksum: string;
}

/** 回合同步（Host 验证后广播结果） */
export interface TurnSyncPayload {
  turnNumber: number;
  stateHash: string;
  results: unknown; // 回合执行结果
}

/** PvP 触发 */
export interface PvpTriggerPayload {
  reason: "boss_wave" | "gym_battle" | "biome_end";
  waveIndex: number;
}

/** PvP 就绪 */
export interface PvpReadyPayload {
  playerId: string;
  ready: boolean;
}

/** PvP 跳过投票 */
export interface PvpSkipVotePayload {
  playerId: string;
  skip: boolean;
}

/** PvP 对战结果 */
export interface PvpResultPayload {
  winnerId: string;
  winnerRemaining: number; // 胜者剩余宝可梦数量
  reward: {
    item?: string;
    money: number;
    legendaryChance?: boolean;
  };
}

/** 合作奖励 */
export interface CoopRewardPayload {
  items: string[];
  expDistribution: Record<string, number>; // playerId -> exp amount
}

/** 玩家昏厥 */
export interface PlayerFaintPayload {
  playerId: string;
  allFainted: boolean;
}

/** 同伴救援 */
export interface PlayerRescuePayload {
  fromPlayerId: string;
  toPlayerId: string;
  pokemonData: unknown;
}

/** 错误消息 */
export interface ErrorPayload {
  code: string;
  message: string;
}

/** 心跳 */
export interface HeartbeatPayload {
  playerId: string;
}

/**
 * 创建消息
 */
export function createMessage(type: MessageType, payload: unknown, seq: number): LanMessage {
  return {
    type,
    payload,
    seq,
    timestamp: Date.now(),
  };
}

/**
 * 验证消息结构
 */
export function isValidMessage(data: unknown): data is LanMessage {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const msg = data as Record<string, unknown>;
  return typeof msg.type === "string" && "payload" in msg && typeof msg.seq === "number" && typeof msg.timestamp === "number";
}
