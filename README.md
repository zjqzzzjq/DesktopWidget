# DesktopWidget

轻量化桌面悬浮小组件，集成实时天气、双显时钟和悬浮待办。前端使用 Electron，后端使用 Python + Flask，本地 JSON 保存配置、天气缓存和待办数据。

## 功能

- 公历实时显示：年月日、星期、时分秒。
- 农历双显：农历日期、生肖、当天节气。
- 实时天气：自动 IP 定位，也可手动切换城市；默认 30 分钟刷新一次。
- 悬浮待办：新增、删除、标记完成、单击文字编辑。
- 桌面特性：窗口置顶、透明背景、自由拖拽、透明度调节、开机自启。
- 本地存储：配置、天气缓存、待办保存在 JSON 文件中。

## 目录

```text
DesktopWidget/
├── backend/
│   ├── main.py
│   ├── lunar.py
│   ├── config.json
│   ├── weather.json
│   ├── todos.json
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── preload.js
│   └── main.js
├── package.json
├── start.bat
└── README.md
```

## 开发运行

Windows 双击 `start.bat`，或在项目根目录执行：

```bash
python -m venv backend/.venv
backend/.venv/Scripts/activate
pip install -r backend/requirements.txt
npm install
npm start
```

macOS/Linux：

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
npm install
npm start
```

Electron 启动后会自动拉起本地 Flask 服务，接口默认监听 `127.0.0.1:5099`。

## 打包

Windows：

```bash
npm run dist:win
```

macOS：

```bash
npm run dist:mac
```

打包产物输出到 `release/`。`pack:backend` 会先用 PyInstaller 生成后端可执行文件，electron-builder 会把后端文件放进应用资源目录。

## 数据文件

开发时直接运行 Python 后端，数据默认保存在 `backend/`：

- `config.json`：城市、透明度、窗口位置、开机自启。
- `weather.json`：天气缓存。
- `todos.json`：待办列表。

通过 Electron 运行时，数据会保存在系统应用数据目录，避免安装目录只读导致无法写入。Windows 通常位于 `%APPDATA%/DesktopWidget`。
