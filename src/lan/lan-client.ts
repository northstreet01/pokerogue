/**
 * WebSocket 客户端模块
 * 负责与局域网联机服务器通信
 */

import type { LanMessage } from "./lan-message";
import { isValidMessage, MessageType } from "./lan-message";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface LanClientEvents {
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onMessage?: (message: LanMessage) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: ConnectionState) => void;
}

export class LanClient {
  private ws: WebSocket | null = null;
  private url: string;
  private events: LanClientEvents;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: LanMessage[] = [];
  private seq = 0;
  private _state: ConnectionState = "disconnected";
  private playerId = "";

  /** 重连配置 */
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000; // 2s
  private reconnectAttempts = 0;

  /** 心跳配置 */
  private heartbeatInterval = 5000; // 5s
  private heartbeatTimeoutMs = 15000; // 15s

  constructor(url: string, events: LanClientEvents = {}) {
    this.url = url;
    this.events = events;
  }

  get state(): ConnectionState {
    return this._state;
  }

  getPlayerId(): string {
    return this.playerId;
  }

  /**
   * 连接到服务器
   */
  connect(playerId: string, playerName: string, gameVersion: string): void {
    if (this.ws) {
      this.disconnect();
    }

    this.playerId = playerId;
    this.setState("connecting");

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.setState("connected");
        this.reconnectAttempts = 0;

        // 发送握手
        this.send(MessageType.HELLO, {
          playerId,
          playerName,
          gameVersion,
        });

        // 启动心跳
        this.startHeartbeat();

        this.events.onConnected?.();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string);
          if (isValidMessage(data)) {
            this.handleMessage(data);
          }
        } catch {
          // 忽略无法解析的消息
        }
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.stopHeartbeat();
        this.setState("disconnected");
        this.ws = null;

        if (event.code !== 1000) {
          // 非正常关闭，尝试重连
          this.tryReconnect();
        } else {
          this.events.onDisconnected?.("正常关闭");
        }
      };

      this.ws.onerror = () => {
        this.events.onError?.("WebSocket 连接错误");
      };
    } catch (err) {
      this.setState("disconnected");
      this.events.onError?.(`连接失败: ${err}`);
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.cancelReconnect();

    if (this.ws) {
      this.ws.close(1000, "玩家主动离开");
      this.ws = null;
    }

    this.setState("disconnected");
  }

  /**
   * 发送消息
   */
  send(type: string, payload: unknown): void {
    const message: LanMessage = {
      type: type as LanMessage["type"],
      payload,
      seq: this.seq++,
      timestamp: Date.now(),
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // 先发送队列中的消息
      while (this.messageQueue.length > 0) {
        const queued = this.messageQueue.shift()!;
        this.ws.send(JSON.stringify(queued));
      }
      this.ws.send(JSON.stringify(message));
    } else {
      // 离线时缓存消息
      this.messageQueue.push(message);
    }
  }

  /**
   * 发送回合指令（便捷方法）
   */
  sendTurnCommand(commands: unknown[], checksum: string): void {
    this.send(MessageType.TURN_COMMAND, {
      playerId: this.playerId,
      commands,
      checksum,
    });
  }

  /**
   * 发送 PvP 指令
   */
  sendPvpCommand(commands: unknown[]): void {
    this.send(MessageType.PVP_COMMAND, {
      playerId: this.playerId,
      commands,
    });
  }

  /**
   * 发送就绪状态
   */
  sendReady(ready: boolean): void {
    this.send(ready ? MessageType.READY : MessageType.READY_CANCEL, {
      playerId: this.playerId,
      ready,
    });
  }

  /**
   * 设置事件回调
   */
  setEvents(events: Partial<LanClientEvents>): void {
    Object.assign(this.events, events);
  }

  private setState(state: ConnectionState): void {
    if (this._state !== state) {
      this._state = state;
      this.events.onStateChange?.(state);
    }
  }

  private handleMessage(message: LanMessage): void {
    // 心跳回复
    if (message.type === MessageType.HEARTBEAT_ACK) {
      this.resetHeartbeatTimeout();
      return;
    }

    // 心跳请求
    if (message.type === MessageType.HEARTBEAT) {
      this.send(MessageType.HEARTBEAT_ACK, { playerId: this.playerId });
      return;
    }

    this.events.onMessage?.(message);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      this.send(MessageType.HEARTBEAT, { playerId: this.playerId });
    }, this.heartbeatInterval);

    this.resetHeartbeatTimeout();
  }

  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }
    this.heartbeatTimeout = setTimeout(() => {
      // 15 秒没有回复，判定断线
      this.events.onDisconnected?.("心跳超时");
      this.disconnect();
    }, this.heartbeatTimeoutMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private tryReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.events.onDisconnected?.("重连失败，已达最大尝试次数");
      return;
    }

    this.setState("reconnecting");
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      // 重新连接（playerId 保持不变，由 LanManager 提供版本信息）
      this.connect(this.playerId, "", "");
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }
}
