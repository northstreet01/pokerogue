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

// ========== Socket.io Host ==========
ipcMain.handle("lan:host", async () => {
  return new Promise((resolve) => {
    const server = http.createServer();
    io = new Server(server, { cors: { origin: "*" } });

    io.on("connection", (sock) => {
      console.log("[Socket.io] 客户端已连接:", sock.id);

      // 转发消息：收到后广播给所有人（包括发送者自己，因为 Host 也需要收到）
      sock.on("lan-message", (msg) => {
        // 先让 Host 的渲染进程收到
        mainWindow?.webContents.send("lan:message", msg);
        // 再广播给其他客户端
        sock.broadcast.emit("lan-message", msg);
      });

      sock.on("disconnect", () => {
        console.log("[Socket.io] 客户端断开");
        mainWindow?.webContents.send("lan:disconnected");
      });
    });

    server.listen(GAME_PORT, () => {
      console.log(`[Socket.io] 服务端已启动，端口 ${GAME_PORT}`);

      // Host 自己也连上去
      socket = ClientIO(`http://localhost:${GAME_PORT}`);
      socket.on("connect", () => {
        console.log("[Socket.io] Host 已自连");
        mainWindow?.webContents.send("lan:connected");
        resolve({ port: GAME_PORT });
      });
      socket.on("lan-message", (msg) => {
        mainWindow?.webContents.send("lan:message", msg);
      });
    });
  });
});

// ========== Socket.io Client ==========
ipcMain.handle("lan:join", async (_event, host, port) => {
  return new Promise((resolve, reject) => {
    socket = ClientIO(`http://${host}:${port || GAME_PORT}`, {
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      console.log("[Socket.io] 已连接到 Host");
      mainWindow?.webContents.send("lan:connected");
      resolve({ success: true });
    });

    socket.on("lan-message", (msg) => {
      mainWindow?.webContents.send("lan:message", msg);
    });

    socket.on("disconnect", () => {
      mainWindow?.webContents.send("lan:disconnected");
    });

    socket.on("connect_error", (err) => {
      reject(err);
    });
  });
});

// ========== IPC 发送 ==========
ipcMain.on("lan:send", (_event, msg) => {
  // 广播给房间内所有人（除了自己，或者包括自己？Host 需要）
  if (io) {
    io.emit("lan-message", msg); // 广播给所有客户端（包括 Host 自己）
  } else if (socket) {
    socket.emit("lan-message", msg);
  }
});

ipcMain.on("lan:leave", () => {
  if (socket) { socket.disconnect(); socket = null; }
  if (io) { io.close(); io = null; }
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
  mainWindow.loadURL(`http://localhost:${HTTP_PORT}`);
}

app.whenReady().then(() => { startHTTP(); createWindow(); });
app.on("window-all-closed", () => {
  if (socket) socket.disconnect();
  if (io) io.close();
  app.quit();
});
