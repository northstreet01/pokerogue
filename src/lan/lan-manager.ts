/**
 * Socket.io 联机管理器
 * P2P: Host 运行 Socket.io 服务端，Client 直连
 */

type PlayerRole = "host" | "client";
type EventHandler = (...args: any[]) => void;

export class LanManager {
  private static instance: LanManager | null = null;
  private role: PlayerRole = "host";
  private _connected = false;
  private _opponentConnected = false;
  private listeners: Record<string, EventHandler[]> = {};

  private constructor() {
    window.lanApi?.onConnected(() => {
      this._connected = true;
      this.emit("connected");
    });
    window.lanApi?.onDisconnected(() => {
      this._opponentConnected = false;
      this.emit("disconnected");
    });
    window.lanApi?.onMessage((msg: any) => {
      this.emit("message", msg);
      // 根据消息类型触发特定事件
      if (msg.type === "hello") {
        this._opponentConnected = true;
        this.emit("opponent-joined");
      } else if (msg.type === "start") {
        this.emit("game-start", msg.seed);
      } else if (msg.type === "action") {
        this.emit("action", msg.commands);
      } else if (msg.type === "faint") {
        this.emit("faint", msg.allFainted);
      } else if (msg.type === "party-sync") {
        this.emit("party-sync", msg.party, msg.sender);
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
    this.send({ type: "hello" });
    return true;
  }

  async joinRoom(host: string, port = 9090): Promise<boolean> {
    this.role = "client";
    await window.lanApi?.join(host, port);
    this.send({ type: "hello" });
    return true;
  }

  leaveRoom(): void {
    window.lanApi?.leave();
  }

  // ===== 发送 =====

  send(msg: any): void { window.lanApi?.send(msg); }
  sendStart(seed: string): void { this.send({ type: "start", seed }); }
  sendAction(commands: any[]): void { this.send({ type: "action", commands }); }
  sendFaint(allFainted: boolean): void { this.send({ type: "faint", allFainted }); }
  sendPartySync(party: any[]): void { this.send({ type: "party-sync", party }); }

  // ===== 状态 =====

  getRole(): PlayerRole { return this.role; }
  isHost(): boolean { return this.role === "host"; }
  isConnected(): boolean { return this._connected; }
  isOpponentConnected(): boolean { return this._opponentConnected; }

  // ===== 事件 =====

  on(event: string, cb: EventHandler): void {
    (this.listeners[event] ??= []).push(cb);
  }

  off(event: string): void {
    delete this.listeners[event];
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners[event]?.forEach(cb => cb(...args));
  }
}

export type { PlayerRole };
