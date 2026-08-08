/**
 * Electron 主进程 - TCP 联机 + HTTP 静态文件服务
 */

const { app, BrowserWindow, ipcMain } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { TcpServer, TCP_PORT } = require("./tcp-server.cjs");
const { TcpClient } = require("./tcp-client.cjs");

const HTTP_PORT = 8000;

let tcpConnection = null;

// ========== IPC 桥接：渲染进程 ↔ TCP ==========

// Host: 创建房间
ipcMain.handle("lan:host", async () => {
  return new Promise((resolve) => {
    tcpConnection = new TcpServer(
      (msg) => { getMainWindow()?.webContents.send("lan:message", msg); },
      () => { getMainWindow()?.webContents.send("lan:connected"); },
      () => { getMainWindow()?.webContents.send("lan:disconnected"); },
    );
    tcpConnection.start();
    resolve({ port: TCP_PORT });
  });
});

// Client: 加入房间
ipcMain.handle("lan:join", async (_event, host, port) => {
  return new Promise((resolve, reject) => {
    tcpConnection = new TcpClient(
      (msg) => { getMainWindow()?.webContents.send("lan:message", msg); },
      () => {
        getMainWindow()?.webContents.send("lan:connected");
        resolve({ success: true });
      },
      () => { getMainWindow()?.webContents.send("lan:disconnected"); },
    );
    tcpConnection.connect(host, port);
    // 5秒超时
    setTimeout(() => { if (!tcpConnection.socket?.readyState) reject(new Error("连接超时")); }, 5000);
  });
});

// 发送消息到对方
ipcMain.on("lan:send", (_event, msg) => {
  tcpConnection?.send(msg);
});

// 离开房间
ipcMain.on("lan:leave", () => {
  if (tcpConnection) {
    tcpConnection.stop?.() || tcpConnection.disconnect?.();
    tcpConnection = null;
  }
});

// ========== HTTP 服务器 ==========

const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".json": "application/json", ".ttf": "font/ttf", ".ogg": "audio/ogg",
};

function startHTTPServer() {
  const root = path.join(__dirname, "..", "dist");
  http.createServer((req, res) => {
    let filePath = path.join(root, req.url === "/" ? "index.html" : req.url.split("?")[0]);
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end(""); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    });
  }).listen(HTTP_PORT, () => console.log(`[HTTP] http://localhost:${HTTP_PORT}`));
}

// ========== 窗口 ==========

let mainWindow = null;

function getMainWindow() { return mainWindow; }

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 720,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, "preload.cjs") },
    autoHideMenuBar: true,
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(`http://localhost:${HTTP_PORT}`);
}

// ========== 启动 ==========

app.whenReady().then(() => {
  startHTTPServer();
  createWindow();
});

app.on("window-all-closed", () => {
  if (tcpConnection) { tcpConnection.stop?.() || tcpConnection.disconnect?.(); }
  app.quit();
});
