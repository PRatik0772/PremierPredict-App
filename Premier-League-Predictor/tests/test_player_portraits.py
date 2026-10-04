import hashlib
import json
from pathlib import Path

from PIL import Image

from fetch_player_portraits import indexes, match_player, name_keys

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "artifacts/premierpredict-dashboard"


def test_conservative_player_matching():
    assert name_keys("Martin Ødegaard")[0] == "martin odegaard"
    rows = [
        {"code": 1, "first_name": "Bruno", "second_name": "Fernandes"},
        {"code": 2, "first_name": "Gedson", "second_name": "Fernandes"},
    ]
    exact, short = indexes(rows)
    assert match_player({"name": "Bruno Miguel Fernandes", "commonName": "Bruno Fernandes"}, exact, short)["code"] == 1
    assert match_player({"name": "Fernandes", "commonName": "Fernandes"}, exact, short) is None
    exact, short = indexes(rows + [{"code": 3, "first_name": "Bruno", "second_name": "Fernandes"}])
    assert match_player({"name": "Bruno Fernandes"}, exact, short) is None


def test_verified_portrait_assets_and_explicit_gaps():
    manifest = json.loads((APP / "src/data/player-portraits.json").read_text())
    data = json.loads((APP / "public/data/premierpredict.json").read_text())
    players = {str(p["id"]): p for squad in data["playersByClub"].values() for p in squad}
    assert set(manifest["portraits"]).isdisjoint(manifest["missing"])
    assert set(manifest["portraits"]) | set(manifest["missing"]) == set(players)
    assert manifest["totalPlayers"] == len(players)
    assert len(manifest["portraits"]) > 300
    for name in ("Bukayo Saka", "Bruno Fernandes", "Erling Haaland"):
        assert any(p["name"] == name for p in manifest["portraits"].values())
    for player_id, portrait in manifest["portraits"].items():
        assert portrait["name"] == players[player_id]["name"]
        assert portrait["sourceUrl"].endswith(f'/p{portrait["code"]}.png')
        assert portrait["sourceUrl"].startswith("https://resources.premierleague.com/")
        path = APP / "public" / portrait["path"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == portrait["sha256"]
        with Image.open(path) as image:
            assert image.format == "WEBP"
            assert 40 <= min(image.size) <= max(image.size) <= 250