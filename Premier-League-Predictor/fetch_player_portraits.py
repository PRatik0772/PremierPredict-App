"""Cache official PL/FPL portraits after conservative cross-provider name matching.

EA player IDs are NOT FPL image codes. Never derive an FPL image URL from an EA
ID, or match by surname alone. Photos are presentation assets, not model inputs.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import requests
from PIL import Image

APP = Path(__file__).resolve().parent.parent / "artifacts/premierpredict-dashboard"
MANIFEST = APP / "src/data/player-portraits.json"
PHOTO_DIR = APP / "public/players"
API = "https://fantasy.premierleague.com/api/bootstrap-static/"
CSV_SOURCES = [
    f"https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data/{season}/players_raw.csv"
    for season in ("2025-26", "2024-25")
]


def name_keys(name):
    name = name.translate(str.maketrans({"ø": "o", "Ø": "O", "ł": "l", "Ł": "L"}))
    tokens = "".join(
        char.lower() if char.isalnum() else " "
        for char in unicodedata.normalize("NFKD", name)
        if not unicodedata.combining(char)
    ).split()
    return " ".join(tokens), (tokens[0], tokens[-1]) if len(tokens) > 1 else None


def indexes(rows):
    exact, short = {}, {}
    for row in rows:
        code = int(row["code"])
        name = f'{row["first_name"]} {row["second_name"]}'.strip()
        full, pair = name_keys(name)
        exact.setdefault(full, {})[code] = name
        if pair:
            short.setdefault(pair, {})[code] = name
    return exact, short


def match_player(player, exact, short):
    names = [player["name"], player.get("commonName") or player["name"]]
    candidates = {}
    for name in names:
        candidates.update(exact.get(name_keys(name)[0], {}))
    method = "full-name"
    if not candidates:
        method = "first-and-last-name"
        for name in names:
            candidates.update(short.get(name_keys(name)[1], {}))
    if len(candidates) != 1:
        return None
    code, matched = next(iter(candidates.items()))
    return {"code": code, "matchedName": matched, "matchMethod": method}


def download(player, match):
    url = f'https://resources.premierleague.com/premierleague/photos/players/250x250/p{match["code"]}.png'
    target = PHOTO_DIR / f'{player["id"]}.webp'
    try:
        for attempt in range(2):
            response = requests.get(url, timeout=25)
            if response.status_code not in (429, 500, 502, 503, 504):
                break
            time.sleep(2 * (attempt + 1))
        response.raise_for_status()
        if not response.headers.get("content-type", "").startswith("image/"):
            raise ValueError("Source did not return an image")
        with Image.open(io.BytesIO(response.content)) as image:
            if min(image.size) < 40:
                raise ValueError("Source image is too small")
            image = image.convert("RGBA")
            image.thumbnail((250, 250))
            image.save(target, "WEBP", quality=85, method=6)
        return str(player["id"]), {
            **match, "name": player["name"], "path": f'players/{target.name}',
            "sourceUrl": url, "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        }, None
    except (requests.RequestException, OSError, ValueError) as error:
        return str(player["id"]), None, str(error)


def main():
    payload = json.loads((APP / "public/data/premierpredict.json").read_text())
    players = [player for squad in payload["playersByClub"].values() for player in squad]
    response = requests.get(API, timeout=30)
    response.raise_for_status()
    rows = response.json()["elements"]
    for source in CSV_SOURCES:
        response = requests.get(source, timeout=30)
        response.raise_for_status()
        rows.extend(csv.DictReader(io.StringIO(response.text)))
    exact, short = indexes(rows)
    jobs, missing = [], {}
    for player in players:
        match = match_player(player, exact, short)
        if match:
            jobs.append((player, match))
        else:
            missing[str(player["id"])] = {"name": player["name"], "reason": "No unambiguous FPL name match"}
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    portraits = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        for player_id, portrait, error in pool.map(lambda job: download(*job), jobs):
            if portrait:
                portraits[player_id] = portrait
            else:
                player = next(p for p in players if str(p["id"]) == player_id)
                missing[player_id] = {"name": player["name"], "reason": error}
    if not portraits:
        raise RuntimeError("No verified portraits downloaded; refusing to publish an empty manifest.")
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps({
        "version": 1, "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "provider": "Premier League / Fantasy Premier League",
        "identitySources": [API, *CSV_SOURCES],
        "totalPlayers": len(players), "portraits": portraits, "missing": missing,
        "notice": "Display photos may be more recent than the ratings snapshot. Photo rights remain with their owners.",
    }, indent=2, ensure_ascii=False) + "\n")
    print(f"Official portraits cached: {len(portraits)}/{len(players)}; explicit unavailable fallbacks: {len(missing)}")


if __name__ == "__main__":
    main()