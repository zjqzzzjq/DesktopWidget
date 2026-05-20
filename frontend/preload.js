const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopWidget", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (settings) => ipcRenderer.invoke("settings:update", settings),
  setOpacity: (opacity) => ipcRenderer.invoke("window:set-opacity", opacity),
  setAutoStart: (enabled) => ipcRenderer.invoke("app:set-auto-start", enabled),
  minimize: () => ipcRenderer.invoke("window:minimize"),
  close: () => ipcRenderer.invoke("window:close"),
});
