from __future__ import annotations

import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

from lunar import lunar_payload


APP_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("DESKTOP_WIDGET_DATA_DIR", APP_DIR)).resolve()
CONFIG_PATH = DATA_DIR / "config.json"
WEATHER_PATH = DATA_DIR / "weather.json"
TODOS_PATH = DATA_DIR / "todos.json"

DEFAULT_CONFIG = {
    "city": "",
    "opacity": 0.86,
    "autoStart": False,
    "weatherRefreshMinutes": 30,
    "bounds": {"width": 360, "height": 540},
}

WEATHER_CODE_TEXT = {
    0: "晴",
    1: "大部晴朗",
    2: "多云",
    3: "阴",
    45: "雾",
    48: "雾凇",
    51: "小毛毛雨",
    53: "毛毛雨",
    55: "强毛毛雨",
    56: "冻毛毛雨",
    57: "强冻毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    66: "冻雨",
    67: "强冻雨",
    71: "小雪",
    73: "中雪",
    75: "大雪",
    77: "雪粒",
    80: "阵雨",
    81: "强阵雨",
    82: "暴雨",
    85: "阵雪",
    86: "强阵雪",
    95: "雷暴",
    96: "雷暴伴小冰雹",
    99: "雷暴伴强冰雹",
}

WIND_DIRECTIONS = ["北风", "东北风", "东风", "东南风", "南风", "西南风", "西风", "西北风"]

app = Flask(__name__)
CORS(app)


def ensure_data_files() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not CONFIG_PATH.exists():
        seed = read_json(APP_DIR / "config.json", DEFAULT_CONFIG)
        write_json(CONFIG_PATH, {**DEFAULT_CONFIG, **seed})
    if not WEATHER_PATH.exists():
        write_json(WEATHER_PATH, {"updatedAt": "", "city": "", "data": None})
    if not TODOS_PATH.exists():
        write_json(TODOS_PATH, [])


def read_json(path: Path, default: Any) -> Any:
    try:
        if path.exists():
            with path.open("r", encoding="utf-8") as file:
                return json.load(file)
    except (OSError, json.JSONDecodeError):
        return default
    return default


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(f"{path.suffix}.tmp")
    with tmp_path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
    tmp_path.replace(path)


def load_config() -> dict:
    config = read_json(CONFIG_PATH, DEFAULT_CONFIG)
    return merge_dict(DEFAULT_CONFIG, config if isinstance(config, dict) else {})


def save_config(partial: dict) -> dict:
    current = load_config()
    next_config = merge_dict(current, partial)
    write_json(CONFIG_PATH, next_config)
    return next_config


def merge_dict(base: dict, incoming: dict) -> dict:
    result = {**base}
    for key, value in incoming.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = merge_dict(result[key], value)
        else:
            result[key] = value
    return result


def json_error(message: str, status: int = 400):
    return jsonify({"ok": False, "error": message}), status


def weekday_cn(now: datetime) -> str:
    return ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"][now.weekday()]


def detect_city() -> str:
    services = [
        ("https://ipapi.co/json/", lambda data: data.get("city") or data.get("region")),
        ("http://ip-api.com/json/?lang=zh-CN", lambda data: data.get("city")),
    ]
    for url, picker in services:
        try:
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            city = picker(response.json())
            if city:
                return city
        except requests.RequestException:
            continue
    return "北京"


def cache_is_fresh(cache: dict, city: str, refresh_minutes: int) -> bool:
    if not cache.get("data") or cache.get("city") != city:
        return False
    try:
        updated_at = datetime.fromisoformat(cache.get("updatedAt", ""))
    except ValueError:
        return False
    return (datetime.now() - updated_at).total_seconds() < refresh_minutes * 60


def geocode_city(city: str) -> dict:
    response = requests.get(
        "https://geocoding-api.open-meteo.com/v1/search",
        params={"name": city, "count": 1, "language": "zh", "format": "json"},
        timeout=8,
    )
    response.raise_for_status()
    results = response.json().get("results") or []
    if not results:
        raise ValueError(f"未找到城市：{city}")
    result = results[0]
    return {
        "name": result.get("name") or city,
        "latitude": result["latitude"],
        "longitude": result["longitude"],
        "country": result.get("country", ""),
        "admin1": result.get("admin1", ""),
    }


def wind_direction(degrees: float | int | None) -> str:
    if degrees is None:
        return "--"
    index = int((float(degrees) + 22.5) / 45) % 8
    return WIND_DIRECTIONS[index]


def fetch_weather(city: str) -> dict:
    location = geocode_city(city)
    response = requests.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            "current": "temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m",
            "timezone": "auto",
        },
        timeout=8,
    )
    response.raise_for_status()
    current = response.json().get("current", {})
    code = int(current.get("weather_code", 0))
    return {
        "city": location["name"],
        "country": location["country"],
        "admin1": location["admin1"],
        "temperature": current.get("temperature_2m"),
        "humidity": current.get("relative_humidity_2m"),
        "condition": WEATHER_CODE_TEXT.get(code, "未知"),
        "weatherCode": code,
        "windDirection": wind_direction(current.get("wind_direction_10m")),
        "windSpeed": current.get("wind_speed_10m"),
        "isDay": bool(current.get("is_day", 1)),
        "source": "Open-Meteo",
        "observedAt": current.get("time") or datetime.now().isoformat(timespec="minutes"),
    }


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "service": "DesktopWidgetBackend", "time": int(time.time())})


@app.get("/api/time")
def current_time():
    now = datetime.now()
    return jsonify(
        {
            "ok": True,
            "gregorian": now.isoformat(timespec="seconds"),
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M:%S"),
            "weekday": weekday_cn(now),
            "lunar": lunar_payload(now.date()),
        }
    )


@app.get("/api/config")
def get_config():
    return jsonify({"ok": True, "config": load_config()})


@app.patch("/api/config")
def patch_config():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return json_error("配置必须是 JSON 对象")
    return jsonify({"ok": True, "config": save_config(data)})


@app.get("/api/weather")
def get_weather():
    config = load_config()
    requested_city = (request.args.get("city") or config.get("city") or "").strip()
    force = request.args.get("refresh") == "1"
    city = requested_city or detect_city()
    refresh_minutes = int(config.get("weatherRefreshMinutes") or 30)
    cache = read_json(WEATHER_PATH, {"updatedAt": "", "city": "", "data": None})

    if not force and isinstance(cache, dict) and cache_is_fresh(cache, city, refresh_minutes):
        return jsonify({"ok": True, "weather": cache["data"], "cached": True})

    try:
        weather = fetch_weather(city)
        cache = {"updatedAt": datetime.now().isoformat(timespec="seconds"), "city": city, "data": weather}
        write_json(WEATHER_PATH, cache)
        if requested_city:
            save_config({"city": requested_city})
        return jsonify({"ok": True, "weather": weather, "cached": False})
    except (requests.RequestException, ValueError, KeyError) as exc:
        if isinstance(cache, dict) and cache.get("data"):
            cached_weather = dict(cache["data"])
            cached_weather["stale"] = True
            cached_weather["error"] = str(exc)
            return jsonify({"ok": True, "weather": cached_weather, "cached": True})
        return json_error(f"天气获取失败：{exc}", 502)


@app.get("/api/todos")
def get_todos():
    todos = read_json(TODOS_PATH, [])
    return jsonify({"ok": True, "todos": todos if isinstance(todos, list) else []})


@app.put("/api/todos")
def put_todos():
    data = request.get_json(silent=True) or {}
    todos = data.get("todos")
    if not isinstance(todos, list):
        return json_error("todos 必须是数组")
    normalized = []
    for item in todos:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text", "")).strip()
        if not text:
            continue
        normalized.append(
            {
                "id": str(item.get("id") or int(time.time() * 1000)),
                "text": text[:200],
                "done": bool(item.get("done", False)),
                "updatedAt": item.get("updatedAt") or datetime.now().isoformat(timespec="seconds"),
            }
        )
    write_json(TODOS_PATH, normalized)
    return jsonify({"ok": True, "todos": normalized})


if __name__ == "__main__":
    ensure_data_files()
    port = int(os.environ.get("DESKTOP_WIDGET_PORT", "5099"))
    app.run(host="127.0.0.1", port=port, debug=False)
