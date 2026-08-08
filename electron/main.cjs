/**
 * Electron 主进程
 * 内嵌 WebSocket 中继 + 静态文件服务
 */

const { app, BrowserWindow } = require("electron");
const { WebSocketServer } = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const WS_PORT = 9090;
const HTTP_PORT = 8000;
const MAX_PLAYERS = 2;

// ========== WebSocket 服务器 ==========

function startWSServer() {
  const wss = new WebSocketServer({ port: WS_PORT });
  const clients = new Map();
  let nextId = 1;

  console.log(`[LAN] WebSocket 服务已启动，端口 ${WS_PORT}`);

  wss.on("connection", (ws) => {
    if (clients.size >= MAX_PLAYERS) {
      ws.send(JSON.stringify({
        type: "ERROR",
        payload: { code: "ROOM_FULL", message: "房间已满" },
        seq: 0, timestamp: Date.now(),
      }));
      ws.close();
      return;
    }

    const clientId = `player_${nextId++}`;
    const client = { ws, id: clientId, name: "", ready: false, connectedAt: Date.now() };
    clients.set(ws, client);
    console.log(`[LAN] 新连接: ${clientId} (${clients.size}/${MAX_PLAYERS})`);

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "HELLO") {
          client.name = msg.payload.playerName || clientId;
          ws.send(JSON.stringify({
            type: "HELLO_ACK",
            payload: { assignedId: client.id, hostName: getHostName(), gameVersion: msg.payload.gameVersion },
            seq: 0, timestamp: Date.now(),
          }));
          // 告诉新玩家：当前在线的人有哪些
          for (const [, c] of clients) {
            if (c !== client) {
              ws.send(JSON.stringify({
                type: "PLAYER_JOINED",
                payload: { playerId: c.id, playerName: c.name, ready: c.ready },
                seq: 0, timestamp: Date.now(),
              }));
            }
          }
          // 告诉老玩家：有新人来了
          broadcast(ws, { type: "PLAYER_JOINED", payload: { playerId: client.id, playerName: client.name, ready: false }, seq: 0, timestamp: Date.now() });
          return;
        }

        if (msg.type === "READY") { client.ready = true; }
        else if (msg.type === "READY_CANCEL") { client.ready = false; }

        // 心跳直接回复
        if (msg.type === "HEARTBEAT") {
          ws.send(JSON.stringify({ type: "HEARTBEAT_ACK", payload: {}, seq: msg.seq, timestamp: Date.now() }));
          return;
        }

        relayMessage(ws, raw.toString());
      } catch {}
    });

    ws.on("close", () => {
      clients.delete(ws);
      broadcast(null, { type: "PLAYER_LEFT", payload: { playerId: client.id }, seq: 0, timestamp: Date.now() });
    });

    ws.on("error", () => {});
  });

  function relayMessage(from, raw) {
    for (const [ws] of clients) {
      if (ws !== from && ws.readyState === ws.OPEN) ws.send(raw);
    }
  }

  function broadcast(exclude, msg) {
    const raw = JSON.stringify(msg);
    for (const [ws] of clients) {
      if (ws !== exclude && ws.readyState === ws.OPEN) ws.send(raw);
    }
  }

  function getHostName() {
    for (const [, c] of clients) {
      if (c.id === "player_1") return c.name || "Host";
    }
    return "Host";
  }
}

// ========== HTTP 静态文件服务器 ==========

const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".json": "application/json", ".ttf": "font/ttf", ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg", ".ico": "image/x-icon", ".wasm": "application/wasm",
};

function startHTTPServer() {
  const root = path.join(__dirname, "..", "dist");
  http.createServer((req, res) => {
    let filePath = path.join(root, req.url === "/" ? "index.html" : req.url.split("?")[0]);
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end("Not Found"); return; }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    });
  }).listen(HTTP_PORT, () => console.log(`[HTTP] 游戏服务已启动: http://localhost:${HTTP_PORT}`));
}

// ========== Electron 窗口 ==========

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 720,
    title: "PokéRogue LAN",
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    autoHideMenuBar: true,
  });

  win.setMenuBarVisibility(false);
  win.loadURL(`http://localhost:${HTTP_PORT}`);
}

app.whenReady().then(() => {
  startWSServer();
  startHTTPServer();
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
