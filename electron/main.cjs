/**
 * Electron 主进程 - Socket.io P2P 联机
 * Host 模式：创建 Socket.io 服务器
 * Client 模式：连接 Host 的 Socket.io 服务器
 */

const { app, BrowserWindow, ipcMain } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const { io: ClientIO } = require("socket.io-client");

const HTTP_PORT = parseInt(process.argv[2] || "8000", 10);
const GAME_PORT = 9090;

let io = null;       // Host 的 Socket.io 服务端
let socket = null;   // Client 的 Socket.io 连接（或 Host 自己也连）
let gameServer = null; // HTTP 服务端引用（用于关闭）
let mainWindow = null;

// ========== HTTP 静态文件 ==========
const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json",
  ".ttf": "font/ttf", ".ogg": "audio/ogg", ".ico": "image/x-icon",
};

function startHTTP() {
  const root = path.join(__dirname, "..", "dist");
  http.createServer((req, res) => {
    let fp = path.join(root, req.url === "/" ? "index.html" : req.url.split("?")[0]);
    fs.readFile(fp, (e, d) => {
      if (e) { res.writeHead(404); res.end(""); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
      res.end(d);
    });
  }).listen(HTTP_PORT, () => console.log(`[HTTP] http://localhost:${HTTP_PORT}`));
}

// ========== 安全 IPC 发送 (防止窗口已销毁) ==========
function safeSend(channel, ...args) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, ...args);
    }
  } catch (_) {
    // 窗口已销毁，忽略
  }
}

// ========== 清理函数 ==========
function cleanupLan() {
  console.log("[LAN] 清理连接...");
  // 1. 先关 Socket.io 服务端（防止 disconnect 事件传播）
  if (io) {
    console.log("[LAN] 关闭 Socket.io 服务端");
    try { io.close(); } catch (e) { console.log("[LAN] io.close error:", e.message); }
    io = null;
  }
  // 2. 再断客户端 socket
  if (socket) {
    console.log("[LAN] 断开 socket 客户端");
    try { socket.removeAllListeners(); socket.disconnect(); } catch (e) { console.log("[LAN] socket disconnect error:", e.message); }
    socket = null;
  }
  // 3. 最后关 HTTP 服务端
  if (gameServer) {
    console.log("[LAN] 关闭 TCP 服务端 (端口 9090)");
    try { gameServer.close(); } catch (e) { console.log("[LAN] gameServer close error:", e.message); }
    gameServer = null;
  }
}

// ========== Socket.io Host ==========
ipcMain.handle("lan:host", async () => {
  console.log("[LAN] 创建 Host 房间...");
  // 先清理旧的（防止端口占用）
  cleanupLan();

  return new Promise((resolve, reject) => {
    gameServer = http.createServer();
    io = new Server(gameServer, { cors: { origin: "*" } });

    io.on("connection", (sock) => {
      console.log("[Socket.io] 客户端已连接:", sock.id);

      sock.on("lan-message", (msg) => {
        console.log("[Socket.io] 收到消息:", msg.type, "from:", msg.from);
        sock.broadcast.emit("lan-message", msg);
      });

      sock.on("disconnect", () => {
        console.log("[Socket.io] 客户端断开:", sock.id);
        safeSend("lan:disconnected");
      });
    });

    gameServer.on("error", (err) => {
      console.error("[Socket.io] 服务端错误:", err.message);
      reject(err);
    });

    gameServer.listen(GAME_PORT, () => {
      console.log(`[Socket.io] 服务端已启动，端口 ${GAME_PORT}`);

      // Host 自己也连上去
      socket = ClientIO(`http://localhost:${GAME_PORT}`);
      socket.on("connect", () => {
        console.log("[Socket.io] Host 已自连");
        safeSend("lan:connected");
        resolve({ port: GAME_PORT });
      });
      socket.on("lan-message", (msg) => {
        safeSend("lan:message", msg);
      });
      socket.on("connect_error", (err) => {
        console.error("[Socket.io] Host 自连失败:", err.message);
        reject(err);
      });
    });
  });
});

// ========== Socket.io Client ==========
ipcMain.handle("lan:join", async (_event, host, port) => {
  console.log(`[LAN] 加入房间: ${host}:${port || GAME_PORT}`);
  // 先清理旧的
  if (socket) {
    try { socket.removeAllListeners(); socket.disconnect(); } catch (_) {}
    socket = null;
  }

  return new Promise((resolve, reject) => {
    socket = ClientIO(`http://${host}:${port || GAME_PORT}`, {
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      console.log("[Socket.io] 已连接到 Host");
      safeSend("lan:connected");
      resolve({ success: true });
    });

    socket.on("lan-message", (msg) => {
      console.log("[Socket.io] 收到消息:", msg.type, "from:", msg.from);
      safeSend("lan:message", msg);
    });

    socket.on("disconnect", () => {
      console.log("[Socket.io] 断开连接");
      safeSend("lan:disconnected");
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket.io] 连接失败:", err.message);
      reject(err);
    });
  });
});

// ========== IPC 发送 ==========
ipcMain.on("lan:send", (_event, msg) => {
  console.log("[IPC] 发送消息:", msg.type, "from:", msg.from);
  if (io) {
    io.emit("lan-message", msg);
  } else if (socket) {
    socket.emit("lan-message", msg);
  }
});

ipcMain.on("lan:leave", () => {
  console.log("[IPC] 离开房间");
  cleanupLan();
});

// ========== 窗口 ==========
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
    autoHideMenuBar: true,
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.on("closed", () => { mainWindow = null; });
  mainWindow.loadURL(`http://localhost:${HTTP_PORT}`);
}

app.whenReady().then(() => { startHTTP(); createWindow(); });
app.on("window-all-closed", () => {
  cleanupLan();
  app.quit();
});
