const API_BASE = "http://127.0.0.1:5099/api";
const WEATHER_REFRESH_MS = 30 * 60 * 1000;

const elements = {
  dateLine: document.querySelector("#dateLine"),
  timeLine: document.querySelector("#timeLine"),
  lunarLine: document.querySelector("#lunarLine"),
  solarTerm: document.querySelector("#solarTerm"),
  temperature: document.querySelector("#temperature"),
  condition: document.querySelector("#condition"),
  humidity: document.querySelector("#humidity"),
  wind: document.querySelector("#wind"),
  weatherStatus: document.querySelector("#weatherStatus"),
  cityForm: document.querySelector("#cityForm"),
  cityInput: document.querySelector("#cityInput"),
  refreshWeatherBtn: document.querySelector("#refreshWeatherBtn"),
  todoForm: document.querySelector("#todoForm"),
  todoInput: document.querySelector("#todoInput"),
  todoList: document.querySelector("#todoList"),
  todoCount: document.querySelector("#todoCount"),
  opacityRange: document.querySelector("#opacityRange"),
  autoStartToggle: document.querySelector("#autoStartToggle"),
  minimizeBtn: document.querySelector("#minimizeBtn"),
  closeBtn: document.querySelector("#closeBtn"),
};

let todos = [];
let weatherTimer = null;
let saveTodoTimer = null;

function pad(value) {
  return String(value).padStart(2, "0");
}

function updateLocalClock() {
  const now = new Date();
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  elements.dateLine.textContent = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${weekdays[now.getDay()]}`;
  elements.timeLine.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

async function requestJson(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeout || 9000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `请求失败：${response.status}`);
    }
    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadTime() {
  try {
    const data = await requestJson("/time", { timeout: 5000 });
    elements.lunarLine.textContent = `${data.lunar.display} 生肖${data.lunar.zodiac}`;
    if (data.lunar.solarTerm) {
      elements.solarTerm.textContent = data.lunar.solarTerm;
      elements.solarTerm.hidden = false;
    } else {
      elements.solarTerm.hidden = true;
    }
  } catch {
    elements.lunarLine.textContent = "农历暂不可用";
    elements.solarTerm.hidden = true;
  }
}

function formatWeatherStatus(weather, cached) {
  const city = weather.admin1 && weather.admin1 !== weather.city ? `${weather.admin1} ${weather.city}` : weather.city;
  const suffix = cached ? "缓存" : weather.source;
  return `${city || "当前位置"} · ${suffix} · ${weather.observedAt || ""}`;
}

async function loadWeather(force = false) {
  const city = elements.cityInput.value.trim();
  const query = new URLSearchParams();
  if (city) query.set("city", city);
  if (force) query.set("refresh", "1");
  elements.weatherStatus.textContent = "天气更新中...";
  try {
    const data = await requestJson(`/weather?${query.toString()}`, { timeout: 12000 });
    const weather = data.weather;
    elements.temperature.textContent = `${Math.round(weather.temperature)}°`;
    elements.condition.textContent = weather.condition || "--";
    elements.humidity.textContent = weather.humidity == null ? "--" : `${weather.humidity}%`;
    elements.wind.textContent = weather.windSpeed == null ? weather.windDirection : `${weather.windDirection} ${weather.windSpeed}km/h`;
    elements.cityInput.value = weather.city || city;
    elements.weatherStatus.textContent = weather.stale ? `离线缓存 · ${weather.error || ""}` : formatWeatherStatus(weather, data.cached);
  } catch (error) {
    elements.temperature.textContent = "--°";
    elements.condition.textContent = "不可用";
    elements.humidity.textContent = "--";
    elements.wind.textContent = "--";
    elements.weatherStatus.textContent = error.message || "天气获取失败";
  }
}

async function loadConfig() {
  try {
    const data = await requestJson("/config", { timeout: 5000 });
    if (data.config.city) elements.cityInput.value = data.config.city;
    if (data.config.opacity) elements.opacityRange.value = data.config.opacity;
  } catch {
    elements.weatherStatus.textContent = "后端启动中...";
  }

  if (window.desktopWidget) {
    const settings = await window.desktopWidget.getSettings();
    elements.opacityRange.value = settings.opacity || elements.opacityRange.value || "0.86";
    elements.autoStartToggle.checked = Boolean(settings.autoStart);
  }
}

async function saveConfig(partial) {
  try {
    await requestJson("/config", {
      method: "PATCH",
      body: JSON.stringify(partial),
      timeout: 5000,
    });
  } catch {
    // Electron 主进程也会保存窗口类配置；后端短暂不可用时不打断交互。
  }
}

async function loadTodos() {
  try {
    const data = await requestJson("/todos", { timeout: 5000 });
    todos = data.todos || [];
  } catch {
    todos = JSON.parse(localStorage.getItem("desktop-widget.todos") || "[]");
  }
  renderTodos();
}

function persistTodosSoon() {
  window.clearTimeout(saveTodoTimer);
  saveTodoTimer = window.setTimeout(saveTodos, 200);
}

async function saveTodos() {
  localStorage.setItem("desktop-widget.todos", JSON.stringify(todos));
  try {
    const data = await requestJson("/todos", {
      method: "PUT",
      body: JSON.stringify({ todos }),
      timeout: 5000,
    });
    todos = data.todos || todos;
    renderTodos();
  } catch {
    // 保留 localStorage 兜底，后端恢复后下一次修改会同步回 JSON 文件。
  }
}

function renderTodos() {
  elements.todoList.innerHTML = "";
  const doneCount = todos.filter((item) => item.done).length;
  elements.todoCount.textContent = `${doneCount}/${todos.length}`;

  for (const item of todos) {
    const li = document.createElement("li");
    li.className = `todo-item${item.done ? " done" : ""}`;
    li.dataset.id = item.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.done;
    checkbox.title = "完成";

    const text = document.createElement("span");
    text.className = "todo-text";
    text.contentEditable = "true";
    text.spellcheck = false;
    text.textContent = item.text;

    const remove = document.createElement("button");
    remove.className = "delete-button";
    remove.type = "button";
    remove.title = "删除";
    remove.textContent = "×";

    li.append(checkbox, text, remove);
    elements.todoList.append(li);
  }
}

function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  todos.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: trimmed,
    done: false,
    updatedAt: new Date().toISOString(),
  });
  elements.todoInput.value = "";
  renderTodos();
  persistTodosSoon();
}

function updateTodo(id, patch) {
  todos = todos.map((item) =>
    item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
  );
  renderTodos();
  persistTodosSoon();
}

function removeTodo(id) {
  todos = todos.filter((item) => item.id !== id);
  renderTodos();
  persistTodosSoon();
}

function bindEvents() {
  elements.cityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const city = elements.cityInput.value.trim();
    saveConfig({ city });
    loadWeather(true);
  });

  elements.refreshWeatherBtn.addEventListener("click", () => loadWeather(true));

  elements.todoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addTodo(elements.todoInput.value);
  });

  elements.todoList.addEventListener("change", (event) => {
    if (event.target.matches('input[type="checkbox"]')) {
      const id = event.target.closest(".todo-item").dataset.id;
      updateTodo(id, { done: event.target.checked });
    }
  });

  elements.todoList.addEventListener("click", (event) => {
    if (event.target.matches(".delete-button")) {
      const id = event.target.closest(".todo-item").dataset.id;
      removeTodo(id);
    }
  });

  elements.todoList.addEventListener(
    "blur",
    (event) => {
      if (event.target.matches(".todo-text")) {
        const id = event.target.closest(".todo-item").dataset.id;
        const text = event.target.textContent.trim();
        if (text) {
          updateTodo(id, { text });
        } else {
          removeTodo(id);
        }
      }
    },
    true,
  );

  elements.todoList.addEventListener("keydown", (event) => {
    if (event.target.matches(".todo-text") && event.key === "Enter") {
      event.preventDefault();
      event.target.blur();
    }
  });

  elements.opacityRange.addEventListener("input", async () => {
    const opacity = Number(elements.opacityRange.value);
    saveConfig({ opacity });
    if (window.desktopWidget) {
      await window.desktopWidget.setOpacity(opacity);
    }
  });

  elements.autoStartToggle.addEventListener("change", async () => {
    const enabled = elements.autoStartToggle.checked;
    saveConfig({ autoStart: enabled });
    if (window.desktopWidget) {
      const result = await window.desktopWidget.setAutoStart(enabled);
      elements.autoStartToggle.checked = Boolean(result.autoStart);
    }
  });

  elements.minimizeBtn.addEventListener("click", () => window.desktopWidget?.minimize());
  elements.closeBtn.addEventListener("click", () => window.desktopWidget?.close());
}

async function init() {
  elements.opacityRange.value = "0.86";
  updateLocalClock();
  window.setInterval(updateLocalClock, 1000);
  bindEvents();
  await loadConfig();
  await Promise.all([loadTime(), loadTodos(), loadWeather(false)]);
  window.setInterval(loadTime, 60 * 1000);
  weatherTimer = window.setInterval(() => loadWeather(false), WEATHER_REFRESH_MS);
}

window.addEventListener("beforeunload", () => {
  if (weatherTimer) window.clearInterval(weatherTimer);
});

init();
