#!/usr/bin/env python3
"""
Parse manually copied 小红书-style Chinese posts about US places.
Reads all .txt files from an input folder → writes seed_posts.json.

Usage:
  python3 scripts/ingest/parse_cn_us_posts.py
  python3 scripts/ingest/parse_cn_us_posts.py --input data/raw_posts --output data/output/seed_posts.json

Stdlib only — no pip install.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Dict, List, Optional

# =========================
# 1. 城市 / 州别名表
# =========================

US_CITY_PATTERNS: Dict[str, List[str]] = {
    # LA metro — broad aliases for 小红书 itinerary posts (maps to 洛杉矶 unless a finer key matches first)
    "洛杉矶": [
        "洛杉矶",
        "LA",
        "L.A.",
        "Los Angeles",
        "LAX",
        "格里菲斯",
        "Griffith Observatory",
        "格里菲斯天文台",
        "Hollywood",
        "好莱坞",
        "盖蒂中心",
        "Getty Center",
        "IN-N-OUT",
        "In-N-Out",
    ],
    "圣莫尼卡": [
        "圣莫尼卡海滩",
        "圣莫尼卡",
        "圣塔莫尼卡",
        "圣莫妮卡",
        "Santa Monica Pier",
        "Santa Monica",
        "第三步行街",
        "Third Street Promenade",
        "雷东多海滩",
        "Redondo Beach",
        "曼哈顿海滩",
        "Manhattan Beach",
    ],
    "比弗利": ["比弗利山庄", "比弗利", "比佛利", "Beverly Hills", "比佛利山庄"],
    "韩国城": ["韩国城", "K-town", "Koreatown", "k-town"],
    "安纳海姆": ["迪士尼冒险", "迪士尼冒险园", "迪士尼乐园", "Disneyland", "加州迪士尼"],
    "西雅图": ["西雅图", "Seattle"],
    "纽约": [
        "纽约",
        "NYC",
        "New York",
        "曼哈顿",
        "Manhattan",
        "布鲁克林",
        "Brooklyn",
        "皇后区",
        "Queens",
    ],
    "旧金山": ["旧金山", "San Francisco", "SF"],
    "圣何塞": ["圣何塞", "San Jose"],
    "波士顿": ["波士顿", "Boston"],
    "芝加哥": ["芝加哥", "Chicago"],
    "拉斯维加斯": ["拉斯维加斯", "Las Vegas", "Vegas"],
    "圣地亚哥": ["圣地亚哥", "San Diego"],
    "尔湾": ["尔湾", "Irvine"],
    "贝尔维尤": ["贝尔维尤", "Bellevue"],
    "雷德蒙德": ["雷德蒙德", "Redmond"],
    "柯克兰": ["柯克兰", "Kirkland"],
    "奥兰治县": ["橙县", "Orange County"],
    "西雅图东区": ["东区", "Eastside"],
}

US_STATE_PATTERNS: Dict[str, List[str]] = {
    "加州": ["加州", "California", "CA"],
    "华盛顿州": ["华盛顿州", "Washington", "WA"],
    "纽约州": ["纽约州", "New York State", "NY"],
    "马萨诸塞州": ["马萨诸塞州", "Massachusetts", "MA"],
    "伊利诺伊州": ["伊利诺伊州", "Illinois", "IL"],
    "内华达州": ["内华达州", "Nevada", "NV"],
}

# =========================
# 2. 规则
# =========================

STORE_PATTERNS = [
    r"(?:店名|店铺|餐厅|咖啡店|名字|店叫|店铺名字|店名在这里)[:：]\s*([^\n]+)",
    r"📍\s*([^\n]+)",
    r"🏠\s*([^\n]+)",
    # 求求了都来吃Crudo这家店
    r"来吃([A-Za-z][A-Za-z0-9\s]{0,40}?)这家",
    # 🦀master HA酱蟹
    r"🦀\s*([A-Za-z][A-Za-z\s]*?)(?:酱蟹|。|\n)",
]

TAG_PATTERN = r"#([\w\u4e00-\u9fff]+)"

CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "咖啡店": ["咖啡", "cafe", "coffee"],
    "餐厅": ["餐厅", "restaurant", "brunch", "晚餐", "意面", "牛排", "火锅", "韩餐", "日料", "寿司"],
    "甜品店": ["甜品", "蛋糕", "dessert", "面包", "bakery"],
    "酒吧": ["酒吧", "bar", "cocktail"],
    "景点": ["景点", "打卡", "view", "观景", "海边", "公园"],
    "商场": ["商场", "mall", "购物中心", "outlet"],
    "超市": ["超市", "grocery", "market"],
}

VIBE_KEYWORDS: Dict[str, List[str]] = {
    "约会": ["约会", "date", "date night", "浪漫"],
    "学习办公": ["学习", "办公", "带电脑", "适合工作", "study", "work remotely"],
    "拍照出片": ["出片", "拍照", "拍照好看", "ins风", "氛围感"],
    "朋友聚会": ["聚会", "朋友", "聚餐", "girls night"],
    "独处放空": ["独处", "放空", "发呆", "安静", "治愈"],
    "周末休闲": ["周末", "weekend", "周末去哪儿"],
}

PRICE_KEYWORDS: Dict[str, List[str]] = {
    "平价": ["平价", "便宜", "性价比", "不贵"],
    "中等": ["人均", "还行", "中等"],
    "偏贵": ["贵", "小贵", "高价", "fine dining"],
}


# =========================
# 3. 基础提取函数
# =========================


def first_match(patterns: Dict[str, List[str]], text: str) -> Optional[str]:
    lowered = text.lower()
    for canonical, aliases in patterns.items():
        for alias in aliases:
            if alias.lower() in lowered:
                return canonical
    return None


def extract_store_name(text: str) -> str:
    for pattern in STORE_PATTERNS:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            candidate = match.group(1).strip()
            candidate = re.sub(r"[|｜].*$", "", candidate).strip()
            return candidate

    fallback_patterns = [
        r"[“\"]([^”\"\n]+(?:Cafe|Coffee|Bakery|Bistro|Kitchen|Restaurant|Bar|Tea|Ramen|BBQ|Pizza|Sushi))",
        r"\b([A-Z][A-Za-z0-9&' .-]{2,}(?:Cafe|Coffee|Bakery|Bistro|Kitchen|Restaurant|Bar|Tea|Ramen|BBQ|Pizza|Sushi))\b",
    ]

    for pattern in fallback_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1).strip()

    return ""


def extract_tags(text: str) -> List[str]:
    tags = re.findall(TAG_PATTERN, text)
    seen = set()
    result: List[str] = []
    for tag in tags:
        if tag not in seen:
            seen.add(tag)
            result.append(tag)
    return result


def infer_category(text: str) -> str:
    lowered = text.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in lowered:
                return category
    return "其他"


def infer_vibes(text: str) -> List[str]:
    lowered = text.lower()
    vibes: List[str] = []
    for vibe, keywords in VIBE_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in lowered:
                vibes.append(vibe)
                break
    return vibes


def infer_price_level(text: str) -> str:
    lowered = text.lower()
    for level, keywords in PRICE_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in lowered:
                return level
    return ""


def infer_signals(
    category: str, vibes: List[str], tags: List[str], text: str
) -> List[str]:
    signals: set[str] = set()

    if category in ["咖啡店", "甜品店"]:
        signals.add("偏生活方式")
    if category in ["餐厅", "酒吧"]:
        signals.add("偏社交消费")
    if "拍照出片" in vibes:
        signals.add("审美导向")
    if "学习办公" in vibes:
        signals.add("效率导向")
    if "约会" in vibes:
        signals.add("关系场景敏感")
    if "独处放空" in vibes:
        signals.add("偏自我恢复")
    if "周末休闲" in vibes:
        signals.add("重视生活体验")

    lowered = text.lower()
    if "brunch" in lowered or "咖啡" in text:
        signals.add("咖啡/早午餐偏好")
    if "探店" in text:
        signals.add("喜欢探索新地点")
    if "环境" in text or "氛围" in text:
        signals.add("重视环境氛围")

    return list(signals)


# =========================
# 4. 单篇解析
# =========================


def parse_us_cn_post(raw_text: str, filename: str = "") -> Dict:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    title = lines[0] if lines else ""
    content = "\n".join(lines)

    city = first_match(US_CITY_PATTERNS, content) or ""
    state = first_match(US_STATE_PATTERNS, content) or ""
    store_name = extract_store_name(content)
    tags = extract_tags(content)
    category = infer_category(content)
    vibes = infer_vibes(content)
    price_level = infer_price_level(content)
    signals = infer_signals(category, vibes, tags, content)

    return {
        "source": "xiaohongshu",
        "language": "zh",
        "region": "usa",
        "filename": filename,
        "title": title,
        "content": content,
        "city_cn": city,
        "state_cn": state,
        "store_name": store_name,
        "category": category,
        "price_level": price_level,
        "vibes": vibes,
        "tags": tags,
        "signals": signals,
    }


# =========================
# 5. 批量读取
# =========================


def load_posts_from_folder(input_folder: str) -> List[Dict]:
    posts: List[Dict] = []

    if not os.path.isdir(input_folder):
        raise FileNotFoundError(f"输入文件夹不存在: {input_folder}")

    for filename in sorted(os.listdir(input_folder)):
        if not filename.endswith(".txt"):
            continue

        path = os.path.join(input_folder, filename)
        if not os.path.isfile(path):
            continue

        with open(path, "r", encoding="utf-8") as f:
            raw_text = f.read()

        if not raw_text.strip():
            continue

        parsed = parse_us_cn_post(raw_text, filename=filename)
        posts.append(parsed)

    return posts


def save_json(data: List[Dict], output_path: str) -> None:
    parent = os.path.dirname(output_path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch-parse CN US-lifestyle .txt posts")
    parser.add_argument(
        "--input",
        "-i",
        default="data/raw_posts",
        help="Folder of .txt files (one post per file)",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="data/output/seed_posts.json",
        help="Output JSON path",
    )
    args = parser.parse_args()

    try:
        posts = load_posts_from_folder(args.input)
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        return 1

    save_json(posts, args.output)
    print(f"Parsed {len(posts)} post(s) → {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
