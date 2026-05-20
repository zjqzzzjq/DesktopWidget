const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const DEFAULT_CONFIG = {
  city: "",
  opacity: 0.86,
  autoStart: false,
  weatherRefreshMinutes: 30,
  bounds: { width: 360, height: 540 },
};

let mainWindow = null;
let backendProcess = null;
let backendAttempts = [];
let configPath = "";
let dataDir = "";
let saveBoundsTimer = null;

function readJson(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function mergeConfig(base, incoming) {
  const result = { ...base };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (value && typeof value === "object" && !Array.isArray(value) && typeof result[key] === "object") {
      result[key] = mergeConfig(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function loadConfig() {
  const config = readJson(configPath, DEFAULT_CONFIG);
  return mergeConfig(DEFAULT_CONFIG, config);
}

function saveConfig(partial) {
  const next = mergeConfig(loadConfig(), partial);
  writeJson(configPath, next);
  return next;
}

function backendDirectory() {
  return app.isPackaged ? path.join(process.resourcesPath, "backend") : path.join(app.getAppPath(), "backend");
}

function buildBackendAttempts() {
  const backendDir = backendDirectory();
  const executable = process.platform === "win32" ? "DesktopWidgetBackend.exe" : "DesktopWidgetBackend";
  const packagedExecutable = path.join(backendDir, executable);

  if (fs.existsSync(packagedExecutable)) {
    return [{ command: packagedExecutable, args: [], cwd: backendDir }];
  }

  const script = path.join(backendDir, "main.py");
  if (process.platform === "win32") {
    return windowsPythonCandidates().map((command) => ({ command, args: ["-u", script], cwd: backendDir }));
  }
  return [
    { command: "python3", args: ["-u", script], cwd: backendDir },
    { command: "python", args: ["-u", script], cwd: backendDir },
  ];
}

function windowsPythonCandidates() {
  const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath("home"), "AppData", "Local");
  const roots = [
    path.join(localAppData, "Programs", "Python"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Python"),
  ];
  const candidates = [];

  for (const root of roots) {
    try {
      const versions = fs
        .readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^Python\d+$/i.test(entry.name))
        .map((entry) => entry.name)
        .sort()
        .reverse();
      for (const version of versions) {
        const pythonPath = path.join(root, version, "python.exe");
        if (fs.existsSync(pythonPath)) candidates.push(pythonPath);
      }
    } catch {
      // Missing Python roots are normal on a fresh Windows install.
    }
  }

  candidates.push("py", "python");
  return [...new Set(candidates)];
}

function startBackend() {
  backendAttempts = buildBackendAttempts();
  tryStartBackend(0);
}

function tryStartBackend(index) {
  if (index >= backendAttempts.length) return;
  const attempt = backendAttempts[index];
  const child = spawn(attempt.command, attempt.args, {
    cwd: attempt.cwd,
    env: {
      ...process.env,
      DESKTOP_WIDGET_DATA_DIR: dataDir,
      DESKTOP_WIDGET_PORT: "5099",
      PYTHONIOENCODING: "utf-8",
    },
    windowsHide: true,
    stdio: app.isPackaged ? "ignore" : "inherit",
  });

  let failedBeforeStart = true;
  child.once("spawn", () => {
    failedBeforeStart = false;
    backendProcess = child;
  });
  child.once("error", () => {
    if (failedBeforeStart) tryStartBackend(index + 1);
  });
  child.once("exit", (code) => {
    if (failedBeforeStart || code !== 0) tryStartBackend(index + 1);
    if (backendProcess === child) backendProcess = null;
  });
}

function getWindowBounds(config) {
  const bounds = config.bounds || {};
  return {
    width: Number(bounds.width) || 360,
    height: Number(bounds.height) || 540,
    x: Number.isFinite(bounds.x) ? bounds.x : undefined,
    y: Number.isFinite(bounds.y) ? bounds.y : undefined,
  };
}

function createWindow() {
  const config = loadConfig();
  mainWindow = new BrowserWindow({
    ...getWindowBounds(config),
    minWidth: 320,
    minHeight: 500,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setOpacity(Number(config.opacity) || DEFAULT_CONFIG.opacity);
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  const rememberBounds = () => {
    clearTimeout(saveBoundsTimer);
    saveBoundsTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        saveConfig({ bounds: mainWindow.getBounds() });
      }
    }, 350);
  };

  mainWindow.on("move", rememberBounds);
  mainWindow.on("resize", rememberBounds);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function setAutoStart(enabled) {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    path: process.execPath,
  });
  saveConfig({ autoStart: Boolean(enabled) });
  return app.getLoginItemSettings().openAtLogin;
}

function registerIpc() {
  ipcMain.handle("settings:get", () => {
    const config = loadConfig();
    return { ...config, autoStart: app.getLoginItemSettings().openAtLogin || config.autoStart };
  });

  ipcMain.handle("settings:update", (_event, partial) => saveConfig(partial || {}));

  ipcMain.handle("window:set-opacity", (_event, opacity) => {
    const value = Math.max(0.35, Math.min(1, Number(opacity) || DEFAULT_CONFIG.opacity));
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setOpacity(value);
    return saveConfig({ opacity: value });
  });

  ipcMain.handle("app:set-auto-start", (_event, enabled) => ({ autoStart: setAutoStart(enabled) }));

  ipcMain.handle("window:minimize", () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
  });

  ipcMain.handle("window:close", () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  });
}

app.whenReady().then(() => {
  dataDir = app.getPath("userData");
  configPath = path.join(dataDir, "config.json");
  saveConfig(readJson(configPath, DEFAULT_CONFIG));
  registerIpc();
  startBackend();
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
