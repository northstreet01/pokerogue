/**
 * 局域网联机管理器（单例）
 * 管理 Host/Client 角色、连接状态、消息路由、心跳
 */

import { version } from "#package.json";
import type { TurnCommand } from "#app/battle";
import { LanClient } from "./lan-client";
import type { ConnectionState, LanClientEvents } from "./lan-client";
import type {
  GameStartPayload,
  HelloPayload,
  LanMessage,
  PlayerInfo,
  PlayerRole,
  PvpResultPayload,
  PvpSkipVotePayload,
} from "./lan-message";
import { createMessage, MessageType } from "./lan-message";

export type { PlayerRole, ConnectionState };

export interface LanManagerEvents {
  /** 对手就绪状态变化 */
  onOpponentReady?: (ready: boolean) => void;
  /** 对手加入房间 */
  onOpponentJoined?: (info: PlayerInfo) => void;
  /** 对手离开 */
  onOpponentLeft?: () => void;
  /** 游戏开始 */
  onGameStart?: (payload: GameStartPayload) => void;
  /** 收到回合指令 */
  onTurnCommand?: (playerId: string, commands: TurnCommand[], checksum: string) => void;
  /** PvP 触发 */
  onPvpTrigger?: (reason: string, waveIndex: number) => void;
  /** 收到 PvP 指令 */
  onPvpCommand?: (playerId: string, commands: TurnCommand[]) => void;
  /** PvP 结果 */
  onPvpResult?: (result: PvpResultPayload) => void;
  /** PvP 跳过投票 */
  onPvpSkipVote?: (playerId: string, skip: boolean) => void;
  /** 连接状态变化 */
  onConnectionChange?: (state: ConnectionState) => void;
  /** 错误 */
  onError?: (code: string, message: string) => void;
}

export class LanManager {
  private static instance: LanManager | null = null;

  private client: LanClient;
  private role: PlayerRole = "host";
  private events: LanManagerEvents = {};
  private myPlayerId = "";
  private myPlayerName = "";
  private opponentId = "";
  private opponentName = "";
  private opponentReady = false;
  private amReady = false;
  private gameMode: "coop" | "pvp" | "mixed" = "mixed";
  private gameVersion: string;

  /** 已处理的消息序列号（防重） */
  private processedSeqs = new Set<number>();
  /** 最大保留的序列号数量 */
  private maxSeqHistory = 1000;

  private constructor() {
    this.gameVersion = version || "1.0.0";

    const clientEvents: LanClientEvents = {
      onConnected: () => this.handleConnected(),
      onDisconnected: (reason) => this.handleDisconnected(reason),
      onMessage: (msg) => this.handleMessage(msg),
      onError: (error) => this.handleError(error),
      onStateChange: (state) => this.events.onConnectionChange?.(state),
    };

    this.client = new LanClient("", clientEvents);
  }

  /** 获取单例 */
  static getInstance(): LanManager {
    if (!LanManager.instance) {
      LanManager.instance = new LanManager();
    }
    return LanManager.instance;
  }

  /** 重置单例（用于测试或重新开始） */
  static reset(): void {
    LanManager.instance?.destroy();
    LanManager.instance = null;
  }

  // ========== 公共属性 ==========

  getRole(): PlayerRole {
    return this.role;
  }

  getConnectionState(): ConnectionState {
    return this.client.state;
  }

  getMyPlayerId(): string {
    return this.myPlayerId;
  }

  getOpponentName(): string {
    return this.opponentName;
  }

  getOpponentReady(): boolean {
    return this.opponentReady;
  }

  isHost(): boolean {
    return this.role === "host";
  }

  getGameMode(): "coop" | "pvp" | "mixed" {
    return this.gameMode;
  }

  // ========== 公共方法 ==========

  /**
   * 创建房间（Host 端）
   * 前提：已在本机启动 lan-server.mjs
   */
  createRoom(serverIp: string, port: number, playerName: string): void {
    this.role = "host";
    this.myPlayerName = playerName;
    this.myPlayerId = `host_${Date.now()}`;

    const wsUrl = `ws://${serverIp}:${port}`;
    this.client = new LanClient(wsUrl);
    this.client.connect(this.myPlayerId, playerName, this.gameVersion);
  }

  /**
   * 加入房间（Client 端）
   */
  joinRoom(hostIp: string, port: number, playerName: string): void {
    this.role = "client";
    this.myPlayerName = playerName;
    this.myPlayerId = `client_${Date.now()}`;

    const wsUrl = `ws://${hostIp}:${port}`;
    this.client = new LanClient(wsUrl);
    this.client.connect(this.myPlayerId, playerName, this.gameVersion);
  }

  /**
   * 离开房间
   */
  leaveRoom(): void {
    this.client.disconnect();
    this.resetState();
  }

  /**
   * 设置就绪状态
   */
  setReady(ready: boolean): void {
    this.amReady = ready;
    this.client.sendReady(ready);
  }

  /**
   * 设置游戏模式
   */
  setGameMode(mode: "coop" | "pvp" | "mixed"): void {
    this.gameMode = mode;
    this.client.send(MessageType.MODE_SELECT, { mode });
  }

  /**
   * 启动游戏（Host 端调用）
   */
  startGame(rngSeed: string): void {
    const payload: GameStartPayload = {
      rngSeed,
      mode: this.gameMode,
      hostParty: null, // 由调用方在发送前填入
      clientParty: null,
    };
    this.client.send(MessageType.GAME_START, payload);
    // Host 自己也要触发游戏开始
    this.events.onGameStart?.(payload);
  }

  /**
   * 发送回合指令
   */
  sendTurnCommand(commands: TurnCommand[], checksum: string): void {
    this.client.sendTurnCommand(commands, checksum);
  }

  /**
   * 发送 PvP 指令
   */
  sendPvpCommand(commands: TurnCommand[]): void {
    this.client.sendPvpCommand(commands);
  }

  /**
   * 投票跳过 PvP
   */
  voteSkipPvp(skip: boolean): void {
    const payload: PvpSkipVotePayload = {
      playerId: this.myPlayerId,
      skip,
    };
    this.client.send(MessageType.PVP_SKIP_VOTE, payload);
  }

  /**
   * 发送 PvP 结果（Host 端）
   */
  sendPvpResult(result: PvpResultPayload): void {
    this.client.send(MessageType.PVP_RESULT, result);
  }

  /**
   * 通知队友昏厥
   */
  notifyFaint(allFainted: boolean): void {
    this.client.send(MessageType.PLAYER_FAINT, {
      playerId: this.myPlayerId,
      allFainted,
    });
  }

  /**
   * 分享宝可梦给队友
   */
  rescueTeammate(pokemonData: unknown): void {
    this.client.send(MessageType.PLAYER_RESCUE, {
      fromPlayerId: this.myPlayerId,
      toPlayerId: this.opponentId,
      pokemonData,
    });
  }

  /**
   * 同步 RNG 种子
   */
  syncRngSeed(seed: string): void {
    this.client.send(MessageType.RNG_SEED, { seed });
  }

  /**
   * 发送回合同步数据
   */
  sendTurnSync(turnNumber: number, stateHash: string, results: unknown): void {
    const msg = createMessage(MessageType.TURN_SYNC, { turnNumber, stateHash, results }, 0);
    this.client.send(MessageType.TURN_SYNC, msg.payload);
  }

  // ========== 事件 ==========

  setEvents(events: Partial<LanManagerEvents>): void {
    Object.assign(this.events, events);
  }

  // ========== 内部方法 ==========

  private handleConnected(): void {
    // HELLO 在 LanClient.connect() 中自动发送
  }

  private handleDisconnected(reason: string): void {
    this.events.onOpponentLeft?.();
    console.log(`[LanManager] 断开连接: ${reason}`);
  }

  private handleError(error: string): void {
    console.error(`[LanManager] 错误: ${error}`);
    this.events.onError?.("NETWORK_ERROR", error);
  }

  private handleMessage(message: LanMessage): void {
    // 防重处理
    if (this.processedSeqs.has(message.seq)) {
      return;
    }
    this.processedSeqs.add(message.seq);
    if (this.processedSeqs.size > this.maxSeqHistory) {
      // 清理旧的序列号
      const values = [...this.processedSeqs];
      this.processedSeqs = new Set(values.slice(values.length - this.maxSeqHistory / 2));
    }

    switch (message.type) {
      case MessageType.HELLO_ACK:
        this.handleHelloAck(message.payload as any);
        break;
      // 服务器级事件（非 MessageType 枚举）
      case "PLAYER_JOINED" as MessageType:
        this.handlePlayerJoined(message.payload as any);
        break;
      case "PLAYER_LEFT" as MessageType:
        this.handlePlayerLeft();
        break;
      case MessageType.READY:
      case MessageType.READY_CANCEL:
        this.handleReadyChange(message.payload as any);
        break;
      case MessageType.MODE_SELECT:
        this.handleModeSelect(message.payload as any);
        break;
      case MessageType.GAME_START:
        this.events.onGameStart?.(message.payload as GameStartPayload);
        break;
      case MessageType.TURN_COMMAND:
        this.handleTurnCommand(message.payload as any);
        break;
      case MessageType.PVP_TRIGGER:
        this.events.onPvpTrigger?.(
          (message.payload as any).reason,
          (message.payload as any).waveIndex,
        );
        break;
      case MessageType.PVP_COMMAND:
        this.events.onPvpCommand?.(
          (message.payload as any).playerId,
          (message.payload as any).commands,
        );
        break;
      case MessageType.PVP_RESULT:
        this.events.onPvpResult?.(message.payload as PvpResultPayload);
        break;
      case MessageType.PVP_SKIP_VOTE:
        this.events.onPvpSkipVote?.(
          (message.payload as any).playerId,
          (message.payload as any).skip,
        );
        break;
      case MessageType.ERROR:
        this.events.onError?.(
          (message.payload as any).code,
          (message.payload as any).message,
        );
        break;
      default:
        break;
    }
  }

  private handleHelloAck(payload: { assignedId: string; hostName: string; gameVersion: string }): void {
    this.myPlayerId = payload.assignedId;
    this.client.setPlayerId(payload.assignedId); // 同步 LanClient 的 ID

    if (payload.gameVersion !== this.gameVersion) {
      this.events.onError?.("VERSION_MISMATCH", `版本不一致! Host: ${payload.gameVersion}, 你: ${this.gameVersion}`);
      return;
    }

    console.log(`[LanManager] 已连接到 ${payload.hostName}`);
  }

  private handlePlayerJoined(payload: { playerId: string; playerName: string }): void {
    this.opponentId = payload.playerId;
    this.opponentName = payload.playerName;

    const info: PlayerInfo = {
      playerId: payload.playerId,
      playerName: payload.playerName,
      role: this.isHost() ? "client" : "host",
      ready: false,
    };

    this.events.onOpponentJoined?.(info);
  }

  private handlePlayerLeft(): void {
    this.opponentId = "";
    this.opponentName = "";
    this.opponentReady = false;
    this.events.onOpponentLeft?.();
  }

  private handleReadyChange(payload: { playerId: string; ready: boolean }): void {
    if (payload.playerId !== this.myPlayerId) {
      this.opponentReady = payload.ready;
      this.events.onOpponentReady?.(payload.ready);
    }
  }

  private handleModeSelect(payload: { mode: "coop" | "pvp" | "mixed" }): void {
    this.gameMode = payload.mode;
  }

  private handleTurnCommand(payload: { playerId: string; commands: TurnCommand[]; checksum: string }): void {
    if (payload.playerId !== this.myPlayerId) {
      this.events.onTurnCommand?.(payload.playerId, payload.commands, payload.checksum);
    }
  }

  private resetState(): void {
    this.opponentId = "";
    this.opponentName = "";
    this.opponentReady = false;
    this.amReady = false;
    this.processedSeqs.clear();
  }

  private destroy(): void {
    this.client.disconnect();
    this.resetState();
  }
}
