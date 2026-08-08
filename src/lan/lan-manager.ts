/**
 * TCP 联机管理器（Electron IPC 桥接）
 *
 * 使用 window.lanApi 与 Electron 主进程通信，
 * 主进程通过 TCP 与对方直连。
 */

type PlayerRole = "host" | "client";

interface LanApi {
  host(): Promise<{ port: number }>;
  join(host: string, port: number): Promise<{ success: boolean }>;
  send(msg: unknown): void;
  leave(): void;
  onMessage(cb: (msg: any) => void): void;
  onConnected(cb: () => void): void;
  onDisconnected(cb: () => void): void;
}

declare global {
  interface Window { lanApi?: LanApi; }
}

export class LanManager {
  private static instance: LanManager | null = null;

  private role: PlayerRole = "host";
  private _connected = false;
  private _opponentConnected = false;
  private listeners: Record<string, Array<(...args: any[]) => void>> = {};

  private constructor() {
    const api = window.lanApi;
    if (!api) { return; }
    api.onConnected(() => { this._connected = true; this.emit("connected"); });
    api.onDisconnected(() => { this._connected = false; this._opponentConnected = false; this.emit("disconnected"); });
    api.onMessage((msg: any) => {
      console.log("[LanManager] 收到消息:", msg.type, msg);
      if (msg.type === "hello") {
        const wasConnected = this._opponentConnected;
        this._opponentConnected = true;
        console.log("[LanManager] 对手已连接, 触发 opponent-joined");
        this.emit("opponent-joined", msg.name);
        // 只在第一次收到时回复，防止死循环
        if (!wasConnected) {
          this.send({ type: "hello", name: this.role === "host" ? "Host" : "Client" });
        }
      } else if (msg.type === "ready") {
        this.emit("opponent-ready");
      } else if (msg.type === "start") {
        console.log("[LanManager] 收到游戏开始, seed:", msg.seed);
        this.emit("game-start", msg.seed);
      } else if (msg.type === "action") {
        this.emit("action", msg.commands);
      } else if (msg.type === "faint") {
        this.emit("faint", msg.allFainted);
      } else if (msg.type === "party-sync") {
        this.emit("party-sync", msg.party);
      }
    });
  }

  static getInstance(): LanManager {
    if (!LanManager.instance) { LanManager.instance = new LanManager(); }
    return LanManager.instance;
  }

  // ===== 连接 =====

  async createRoom(): Promise<boolean> {
    this.role = "host";
    await window.lanApi?.host();
    return true;
  }

  async joinRoom(host: string, port = 9090): Promise<boolean> {
    this.role = "client";
    await window.lanApi?.join(host, port);
    // 发送打招呼
    this.send({ type: "hello", name: "Client" });
    return true;
  }

  leaveRoom(): void {
    window.lanApi?.leave();
    this._connected = false;
    this._opponentConnected = false;
  }

  // ===== 发送 =====

  send(msg: unknown): void {
    window.lanApi?.send(msg);
  }

  sendReady(): void {
    this.send({ type: "ready" });
  }

  sendStart(seed: string): void {
    this.send({ type: "start", seed });
  }

  sendAction(commands: unknown[]): void {
    this.send({ type: "action", commands });
  }

  sendFaint(allFainted: boolean): void {
    this.send({ type: "faint", allFainted });
  }

  // ===== 状态 =====

  getRole(): PlayerRole { return this.role; }
  isHost(): boolean { return this.role === "host"; }
  isConnected(): boolean { return this._connected; }
  isOpponentConnected(): boolean { return this._opponentConnected; }

  // ===== 事件 =====

  on(event: string, cb: (...args: any[]) => void): void {
    if (!this.listeners[event]) { this.listeners[event] = []; }
    this.listeners[event].push(cb);
  }

  off(event: string): void {
    delete this.listeners[event];
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners[event]?.forEach(cb => cb(...args));
  }
}

export type { PlayerRole };
