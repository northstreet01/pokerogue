/**
 * TCP 服务端 (Host 使用)
 * 监听固定端口，接受一个客户端连接，双向转发 JSON 消息
 */

const net = require("net");

const TCP_PORT = 9090;

class TcpServer {
  constructor(onMessage, onConnect, onDisconnect) {
    this.server = null;
    this.clientSocket = null;
    this.onMessage = onMessage;
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;
    this.buffer = Buffer.alloc(0);
  }

  start() {
    this.server = net.createServer((socket) => {
      if (this.clientSocket) {
        socket.write(JSON.stringify({ type: "error", msg: "房间已满" }) + "\n");
        socket.end();
        return;
      }
      this.clientSocket = socket;
      console.log(`[TCP] 客户端已连接: ${socket.remoteAddress}:${socket.remotePort}`);
      this.onConnect?.();

      socket.on("data", (data) => {
        this.buffer = Buffer.concat([this.buffer, data]);
        // 按换行符分割消息
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

      socket.on("close", () => {
        console.log("[TCP] 客户端断开");
        this.clientSocket = null;
        this.onDisconnect?.();
      });

      socket.on("error", (err) => {
        console.error("[TCP] 连接错误:", err.message);
        this.clientSocket = null;
        this.onDisconnect?.();
      });
    });

    this.server.listen(TCP_PORT, () => {
      console.log(`[TCP] 服务端已启动，端口 ${TCP_PORT}`);
    });
  }

  send(msg) {
    if (this.clientSocket && !this.clientSocket.destroyed) {
      this.clientSocket.write(JSON.stringify(msg) + "\n");
    }
  }

  stop() {
    if (this.clientSocket) { this.clientSocket.destroy(); }
    if (this.server) { this.server.close(); }
  }
}

module.exports = { TcpServer, TCP_PORT };
