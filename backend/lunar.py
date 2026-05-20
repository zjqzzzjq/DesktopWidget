from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta


LUNAR_INFO = [
    0x04BD8,
    0x04AE0,
    0x0A570,
    0x054D5,
    0x0D260,
    0x0D950,
    0x16554,
    0x056A0,
    0x09AD0,
    0x055D2,
    0x04AE0,
    0x0A5B6,
    0x0A4D0,
    0x0D250,
    0x1D255,
    0x0B540,
    0x0D6A0,
    0x0ADA2,
    0x095B0,
    0x14977,
    0x04970,
    0x0A4B0,
    0x0B4B5,
    0x06A50,
    0x06D40,
    0x1AB54,
    0x02B60,
    0x09570,
    0x052F2,
    0x04970,
    0x06566,
    0x0D4A0,
    0x0EA50,
    0x06E95,
    0x05AD0,
    0x02B60,
    0x186E3,
    0x092E0,
    0x1C8D7,
    0x0C950,
    0x0D4A0,
    0x1D8A6,
    0x0B550,
    0x056A0,
    0x1A5B4,
    0x025D0,
    0x092D0,
    0x0D2B2,
    0x0A950,
    0x0B557,
    0x06CA0,
    0x0B550,
    0x15355,
    0x04DA0,
    0x0A5D0,
    0x14573,
    0x052D0,
    0x0A9A8,
    0x0E950,
    0x06AA0,
    0x0AEA6,
    0x0AB50,
    0x04B60,
    0x0AAE4,
    0x0A570,
    0x05260,
    0x0F263,
    0x0D950,
    0x05B57,
    0x056A0,
    0x096D0,
    0x04DD5,
    0x04AD0,
    0x0A4D0,
    0x0D4D4,
    0x0D250,
    0x0D558,
    0x0B540,
    0x0B6A0,
    0x195A6,
    0x095B0,
    0x049B0,
    0x0A974,
    0x0A4B0,
    0x0B27A,
    0x06A50,
    0x06D40,
    0x0AF46,
    0x0AB60,
    0x09570,
    0x04AF5,
    0x04970,
    0x064B0,
    0x074A3,
    0x0EA50,
    0x06B58,
    0x05AC0,
    0x0AB60,
    0x096D5,
    0x092E0,
    0x0C960,
    0x0D954,
    0x0D4A0,
    0x0DA50,
    0x07552,
    0x056A0,
    0x0ABB7,
    0x025D0,
    0x092D0,
    0x0CAB5,
    0x0A950,
    0x0B4A0,
    0x0BAA4,
    0x0AD50,
    0x055D9,
    0x04BA0,
    0x0A5B0,
    0x15176,
    0x052B0,
    0x0A930,
    0x07954,
    0x06AA0,
    0x0AD50,
    0x05B52,
    0x04B60,
    0x0A6E6,
    0x0A4E0,
    0x0D260,
    0x0EA65,
    0x0D530,
    0x05AA0,
    0x076A3,
    0x096D0,
    0x04BD7,
    0x04AD0,
    0x0A4D0,
    0x1D0B6,
    0x0D250,
    0x0D520,
    0x0DD45,
    0x0B5A0,
    0x056D0,
    0x055B2,
    0x049B0,
    0x0A577,
    0x0A4B0,
    0x0AA50,
    0x1B255,
    0x06D20,
    0x0ADA0,
    0x14B63,
    0x09370,
    0x049F8,
    0x04970,
    0x064B0,
    0x168A6,
    0x0EA50,
    0x06B20,
    0x1A6C4,
    0x0AAE0,
    0x0A2E0,
    0x0D2E3,
    0x0C960,
    0x0D557,
    0x0D4A0,
    0x0DA50,
    0x05D55,
    0x056A0,
    0x0A6D0,
    0x055D4,
    0x052D0,
    0x0A9B8,
    0x0A950,
    0x0B4A0,
    0x0B6A6,
    0x0AD50,
    0x055A0,
    0x0ABA4,
    0x0A5B0,
    0x052B0,
    0x0B273,
    0x06930,
    0x07337,
    0x06AA0,
    0x0AD50,
    0x14B55,
    0x04B60,
    0x0A570,
    0x054E4,
    0x0D160,
    0x0E968,
    0x0D520,
    0x0DAA0,
    0x16AA6,
    0x056D0,
    0x04AE0,
    0x0A9D4,
    0x0A2D0,
    0x0D150,
    0x0F252,
    0x0D520,
]

GAN = "甲乙丙丁戊己庚辛壬癸"
ZHI = "子丑寅卯辰巳午未申酉戌亥"
ZODIAC = "鼠牛虎兔龙蛇马羊猴鸡狗猪"
MONTH_NAMES = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"]
DAY_PREFIX = ["初", "十", "廿", "三"]
DAY_NAMES = ["十", "一", "二", "三", "四", "五", "六", "七", "八", "九"]

SOLAR_TERM_NAMES = [
    "小寒",
    "大寒",
    "立春",
    "雨水",
    "惊蛰",
    "春分",
    "清明",
    "谷雨",
    "立夏",
    "小满",
    "芒种",
    "夏至",
    "小暑",
    "大暑",
    "立秋",
    "处暑",
    "白露",
    "秋分",
    "寒露",
    "霜降",
    "立冬",
    "小雪",
    "大雪",
    "冬至",
]
SOLAR_TERM_INFO = [
    0,
    21208,
    42467,
    63836,
    85337,
    107014,
    128867,
    150921,
    173149,
    195551,
    218072,
    240693,
    263343,
    285989,
    308563,
    331033,
    353350,
    375494,
    397447,
    419210,
    440795,
    462224,
    483532,
    504758,
]


@dataclass(frozen=True)
class LunarDate:
    year: int
    month: int
    day: int
    is_leap: bool

    @property
    def year_name(self) -> str:
        return f"{GAN[(self.year - 4) % 10]}{ZHI[(self.year - 4) % 12]}年"

    @property
    def zodiac(self) -> str:
        return ZODIAC[(self.year - 4) % 12]

    @property
    def month_name(self) -> str:
        prefix = "闰" if self.is_leap else ""
        return f"{prefix}{MONTH_NAMES[self.month - 1]}月"

    @property
    def day_name(self) -> str:
        if self.day == 10:
            return "初十"
        if self.day == 20:
            return "二十"
        if self.day == 30:
            return "三十"
        return f"{DAY_PREFIX[self.day // 10]}{DAY_NAMES[self.day % 10]}"

    @property
    def display(self) -> str:
        return f"{self.year_name} {self.month_name}{self.day_name}"


def leap_month(year: int) -> int:
    return LUNAR_INFO[year - 1900] & 0xF


def leap_days(year: int) -> int:
    if leap_month(year):
        return 30 if (LUNAR_INFO[year - 1900] & 0x10000) else 29
    return 0


def month_days(year: int, month: int) -> int:
    return 30 if (LUNAR_INFO[year - 1900] & (0x10000 >> month)) else 29


def year_days(year: int) -> int:
    days = 348
    marker = 0x8000
    while marker > 0x8:
        if LUNAR_INFO[year - 1900] & marker:
            days += 1
        marker >>= 1
    return days + leap_days(year)


def solar_to_lunar(day: date | None = None) -> LunarDate:
    current = day or date.today()
    if current < date(1900, 1, 31) or current > date(2100, 12, 31):
        raise ValueError("lunar conversion supports dates from 1900-01-31 to 2100-12-31")

    offset = (current - date(1900, 1, 31)).days
    year = 1900
    while year < 2101:
        days = year_days(year)
        if offset < days:
            break
        offset -= days
        year += 1

    leap = leap_month(year)
    is_leap = False
    month = 1
    while month <= 12:
        days = leap_days(year) if is_leap else month_days(year, month)
        if offset < days:
            break
        offset -= days

        if leap == month and not is_leap:
            is_leap = True
        else:
            if is_leap:
                is_leap = False
            month += 1

    return LunarDate(year=year, month=month, day=offset + 1, is_leap=is_leap)


def solar_term_for(day: date | None = None) -> str:
    current = day or date.today()
    if current.year < 1900 or current.year > 2100:
        return ""

    base = datetime(1900, 1, 6, 2, 5)
    year_delta_ms = 31556925974.7 * (current.year - 1900)
    for index, name in enumerate(SOLAR_TERM_NAMES):
        term_date = (base + timedelta(milliseconds=year_delta_ms, minutes=SOLAR_TERM_INFO[index])).date()
        if term_date == current:
            return name
    return ""


def lunar_payload(day: date | None = None) -> dict:
    current = day or date.today()
    lunar = solar_to_lunar(current)
    return {
        "year": lunar.year,
        "month": lunar.month,
        "day": lunar.day,
        "isLeap": lunar.is_leap,
        "yearName": lunar.year_name,
        "zodiac": lunar.zodiac,
        "monthName": lunar.month_name,
        "dayName": lunar.day_name,
        "display": lunar.display,
        "solarTerm": solar_term_for(current),
    }
