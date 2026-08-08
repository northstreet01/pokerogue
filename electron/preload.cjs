/**
 * Electron preload - 暴露安全的 IPC 接口给渲染进程
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lanApi", {
  host: () => ipcRenderer.invoke("lan:host"),
  join: (host, port) => ipcRenderer.invoke("lan:join", host, port),
  send: (msg) => ipcRenderer.send("lan:send", msg),
  leave: () => ipcRenderer.send("lan:leave"),
  onMessage: (cb) => ipcRenderer.on("lan:message", (_e, msg) => cb(msg)),
  onConnected: (cb) => ipcRenderer.on("lan:connected", () => cb()),
  onDisconnected: (cb) => ipcRenderer.on("lan:disconnected", () => cb()),
});
