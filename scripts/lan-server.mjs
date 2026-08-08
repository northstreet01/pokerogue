/**
 * WebSocket 中继服务器
 * 在 Host 端运行，负责转发两个客户端之间的消息
 *
 * 用法: node scripts/lan-server.mjs [port]
 * 默认端口: 9090
 */

import { WebSocketServer } from "ws";

const PORT = parseInt(process.argv[2] || "9090", 10);
const MAX_PLAYERS = 2;

const wss = new WebSocketServer({ port: PORT });

console.log(`[LAN Server] 启动成功，监听端口 ${PORT}`);
console.log(`[LAN Server] 最大玩家数: ${MAX_PLAYERS}`);

/** 客户端映射: ws → client data */
const clients = new Map();
let nextClientId = 1;

wss.on("connection", (ws) => {
  // 检查人数
  if (clients.size >= MAX_PLAYERS) {
    ws.send(
      JSON.stringify({
        type: "ERROR",
        payload: { code: "ROOM_FULL", message: "房间已满" },
        seq: 0,
        timestamp: Date.now(),
      }),
    );
    ws.close();
    return;
  }

  const clientId = `player_${nextClientId++}`;

  const client = {
    ws,
    id: clientId,
    name: "",
    ready: false,
    connectedAt: Date.now(),
  };

  clients.set(ws, client);

  console.log(`[LAN Server] 新连接: ${clientId} (当前 ${clients.size}/${MAX_PLAYERS})`);

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      // 处理握手
      if (msg.type === "HELLO") {
        client.name = msg.payload.playerName || clientId;
        console.log(`[LAN Server] ${client.id} 握手完成: ${client.name}`);

        // 回复 HELLO_ACK
        ws.send(
          JSON.stringify({
            type: "HELLO_ACK",
            payload: {
              assignedId: client.id,
              hostName: getHostName(),
              gameVersion: msg.payload.gameVersion,
            },
            seq: 0,
            timestamp: Date.now(),
          }),
        );

        // 告诉新玩家：当前已有哪些人在线
        for (const [, c] of clients) {
          if (c !== client) {
            ws.send(
              JSON.stringify({
                type: "PLAYER_JOINED",
                payload: { playerId: c.id, playerName: c.name, ready: c.ready },
                seq: 0,
                timestamp: Date.now(),
              }),
            );
          }
        }

        // 通知其他客户端有新玩家加入
        broadcast(ws, {
          type: "PLAYER_JOINED",
          payload: { playerId: client.id, playerName: client.name, ready: false },
          seq: 0,
          timestamp: Date.now(),
        });

        return;
      }

      // 处理就绪状态
      if (msg.type === "READY") {
        client.ready = true;
        console.log(`[LAN Server] ${client.id} 已就绪`);
      } else if (msg.type === "READY_CANCEL") {
        client.ready = false;
      }

      // 处理心跳：服务器直接回复 ACK，不依赖对方
      if (msg.type === "HEARTBEAT") {
        ws.send(JSON.stringify({
          type: "HEARTBEAT_ACK",
          payload: {},
          seq: msg.seq,
          timestamp: Date.now(),
        }));
        return;
      }

      // 转发消息给其他客户端
      relayMessage(ws, raw.toString());
    } catch {
      // 忽略无法解析的消息
    }
  });

  ws.on("close", () => {
    console.log(`[LAN Server] 断开连接: ${client.id}`);
    clients.delete(ws);

    // 通知其他客户端
    broadcast(null, {
      type: "PLAYER_LEFT",
      payload: { playerId: client.id },
      seq: 0,
      timestamp: Date.now(),
    });

    console.log(`[LAN Server] 当前在线: ${clients.size}/${MAX_PLAYERS}`);
  });

  ws.on("error", (err) => {
    console.error(`[LAN Server] ${client.id} 错误:`, err.message);
  });
});

/**
 * 转发消息给其他客户端
 */
function relayMessage(from, raw) {
  for (const [ws] of clients) {
    if (ws !== from && ws.readyState === ws.OPEN) {
      ws.send(raw);
    }
  }
}

/**
 * 广播消息给指定客户端以外的所有人
 */
function broadcast(exclude, msg) {
  const raw = JSON.stringify(msg);
  for (const [ws] of clients) {
    if (ws !== exclude && ws.readyState === ws.OPEN) {
      ws.send(raw);
    }
  }
}

/**
 * 获取 Host 玩家的名称
 */
function getHostName() {
  for (const [, client] of clients) {
    if (client.id === "player_1") {
      return client.name || "Host";
    }
  }
  return "Host";
}

console.log("[LAN Server] 等待客户端连接...");

// 优雅关闭
process.on("SIGINT", () => {
  console.log("\n[LAN Server] 正在关闭...");
  wss.close(() => {
    console.log("[LAN Server] 已关闭");
    process.exit(0);
  });
});
