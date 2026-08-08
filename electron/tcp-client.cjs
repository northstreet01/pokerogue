/**
 * TCP 客户端 (加入者使用)
 * 连接到 Host 的 TCP 端口，双向收发 JSON 消息
 */

const net = require("net");

class TcpClient {
  constructor(onMessage, onConnect, onDisconnect) {
    this.socket = null;
    this.onMessage = onMessage;
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;
    this.buffer = Buffer.alloc(0);
  }

  connect(host, port) {
    this.socket = net.createConnection({ host, port }, () => {
      console.log(`[TCP] 已连接到 ${host}:${port}`);
      this.onConnect?.();
    });

    this.socket.on("data", (data) => {
      this.buffer = Buffer.concat([this.buffer, data]);
      while (true) {
        const idx = this.buffer.indexOf("\n");
        if (idx === -1) break;
        const line = this.buffer.slice(0, idx).toString().trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (line) {
          try {
            const msg = JSON.parse(line);
            this.onMessage?.(msg);
          } catch (e) {
            console.error("[TCP] 消息解析失败:", line.slice(0, 50));
          }
        }
      }
    });

    this.socket.on("close", () => {
      console.log("[TCP] 连接断开");
      this.onDisconnect?.();
    });

    this.socket.on("error", (err) => {
      console.error("[TCP] 连接错误:", err.message);
      this.onDisconnect?.();
    });
  }

  send(msg) {
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(JSON.stringify(msg) + "\n");
    }
  }

  disconnect() {
    if (this.socket) { this.socket.destroy(); }
  }
}

module.exports = { TcpClient };
