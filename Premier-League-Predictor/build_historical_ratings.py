"""Build season-aligned Premier League player and team ratings.

The match workbook labels seasons by their starting year. FIFA/FC editions use
the same year number, so season 2024 uses FC 24 and season 2025 uses FC 25.
Only the season-matched edition is used; the undated current-ratings workbook
is deliberately excluded.
"""
from __future__ import annotations

import argparse
import re
import unicodedata
import zipfile
import zlib
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "datasets"
MATCHES_PATH = DATA_DIR / "premier_league_matches.xlsx"
PLAYERS_OUT = DATA_DIR / "premier_league_player_ratings_by_season.csv"
TEAMS_OUT = DATA_DIR / "premier_league_team_ratings_by_season.csv"
FC24_SOURCE = "https://www.kaggle.com/datasets/stefanoleone992/ea-sports-fc-24-complete-player-dataset"
FC25_SOURCE = "https://www.kaggle.com/datasets/nyagami/ea-sports-fc-25-database-ratings-and-stats"
FC25_SNAPSHOT_DATE = "2024-09-26"

ALIASES = {
    "manutd": "Manchester United",
    "manchesterutd": "Manchester United",
    "manchesterunited": "Manchester United",
    "mancity": "Manchester City",
    "newcastleutd": "Newcastle United",
    "brighton": "Brighton and Hove Albion",
    "brightonhovealbion": "Brighton and Hove Albion",
    "spurs": "Tottenham Hotspur",
    "nottmforest": "Nottingham Forest",
    "wolves": "Wolverhampton Wanderers",
    "westham": "West Ham United",
    "qpr": "Queens Park Rangers",
    "sheffieldutd": "Sheffield United",
}

PLAYER_COLUMNS = [
    "season", "team_name", "player_id", "player_name", "common_name",
    "position", "overall_rating", "pace", "shooting", "passing", "dribbling",
    "defending", "physical", "preferred_foot", "skill_moves", "source_edition",
    "snapshot_date", "source_url",
]


def _key(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode()
    text = re.sub(r"\b(?:afc|fc)\b", "", text.casefold())
    return re.sub(r"[^a-z0-9]", "", text)


def _team_resolver(matches_path: Path):
    matches = pd.read_excel(matches_path, usecols=["season", "homeTeam_name", "awayTeam_name"])
    teams = set(matches.homeTeam_name.dropna()) | set(matches.awayTeam_name.dropna())
    direct = {_key(team): team for team in teams}

    def resolve(value: object) -> str | None:
        key = _key(value)
        if key in ALIASES:
            return ALIASES[key] if ALIASES[key] in teams else None
        return direct.get(key)

    by_season = {}
    for season, group in matches.groupby("season"):
        by_season[int(season)] = set(group.homeTeam_name) | set(group.awayTeam_name)
    return resolve, by_season


def _stable_id(season: int, team: str, player: str) -> int:
    return zlib.crc32(f"{season}|{team}|{player}".encode("utf-8"))


def _clean_players(frame: pd.DataFrame, season: int, edition: str, snapshot_date: str, source_url: str, resolve, allowed_teams: set[str]) -> pd.DataFrame:
    frame = frame.copy()
    frame["team_name"] = frame["raw_team"].map(resolve)
    frame = frame[frame.team_name.isin(allowed_teams)].copy()
    frame["season"] = int(season)
    frame["source_edition"] = edition
    frame["snapshot_date"] = snapshot_date
    frame["source_url"] = source_url
    frame["player_name"] = frame["player_name"].fillna(frame["common_name"]).fillna("Unknown player").astype(str).str.strip()
    frame["common_name"] = frame["common_name"].where(frame["common_name"].notna(), None)
    for column in ["overall_rating", "pace", "shooting", "passing", "dribbling", "defending", "physical", "skill_moves"]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame = frame.dropna(subset=["overall_rating"])
    if frame["player_id"].isna().any():
        frame.loc[frame.player_id.isna(), "player_id"] = frame.loc[frame.player_id.isna()].apply(
            lambda row: _stable_id(season, row.team_name, row.player_name), axis=1
        )
    frame["player_id"] = pd.to_numeric(frame["player_id"], errors="coerce")
    frame = frame.dropna(subset=["player_id"])
    frame["player_id"] = frame["player_id"].astype("int64")
    frame["overall_rating"] = frame["overall_rating"].astype(int)
    frame["skill_moves"] = frame["skill_moves"].fillna(0).astype(int)
    return frame[PLAYER_COLUMNS].drop_duplicates(["season", "team_name", "player_id"], keep="last")


def _load_fc15_to_fc24(archive: Path, resolve, teams_by_season) -> pd.DataFrame:
    required = {
        "fifa_version", "update_as_of", "short_name", "long_name", "player_id",
        "player_positions", "overall", "club_name", "pace", "shooting",
        "passing", "dribbling", "defending", "physic", "preferred_foot",
        "skill_moves",
    }
    with zipfile.ZipFile(archive) as source:
        member = "male_players.csv"
        if member not in source.namelist():
            raise ValueError(f"{archive} does not contain {member}.")
        players = pd.read_csv(source.open(member), low_memory=False)
    missing = required - set(players.columns)
    if missing:
        raise ValueError(f"FC 24 source is missing columns: {sorted(missing)}")

    players["fifa_version"] = pd.to_numeric(players.fifa_version, errors="coerce")
    players["update_as_of"] = pd.to_datetime(players.update_as_of, errors="coerce")
    records = []
    for version in range(15, 25):
        season = 2000 + version
        edition = players[players.fifa_version == version].copy()
        edition = edition.dropna(subset=["update_as_of"])
        if edition.empty:
            raise ValueError(f"FC 24 source has no FIFA/FC {version} snapshot.")
        # Use the latest archived snapshot available before that match season.
        cutoff = pd.Timestamp(year=season, month=8, day=1)
        eligible = edition[edition.update_as_of < cutoff]
        if eligible.empty:
            raise ValueError(f"FC {version} has no rating snapshot before season {season}.")
        snapshot = eligible.update_as_of.max()
        edition = eligible[eligible.update_as_of == snapshot].copy()
        raw = pd.DataFrame({
            "raw_team": edition.club_name,
            "player_id": edition.player_id,
            "player_name": edition.long_name,
            "common_name": edition.short_name,
            "position": edition.player_positions,
            "overall_rating": edition.overall,
            "pace": edition.pace,
            "shooting": edition.shooting,
            "passing": edition.passing,
            "dribbling": edition.dribbling,
            "defending": edition.defending,
            "physical": edition.physic,
            "preferred_foot": edition.preferred_foot,
            "skill_moves": edition.skill_moves,
        })
        edition_name = f"EA Sports FC {version}" if version >= 24 else f"FIFA {version}"
        clean = _clean_players(
            raw, season, edition_name, snapshot.date().isoformat(),
            FC24_SOURCE, resolve, teams_by_season.get(season, set()),
        )
        records.append(clean)
    return pd.concat(records, ignore_index=True)


def _load_fc25(archive: Path, resolve, teams_by_season) -> pd.DataFrame:
    with zipfile.ZipFile(archive) as source:
        member = "male_players.csv"
        if member not in source.namelist():
            raise ValueError(f"{archive} does not contain {member}.")
        players = pd.read_csv(source.open(member), low_memory=False)
    required = {"Name", "OVR", "Team", "Position", "url", "PAC", "SHO", "PAS", "DRI", "DEF", "PHY"}
    missing = required - set(players.columns)
    if missing:
        raise ValueError(f"FC 25 source is missing columns: {sorted(missing)}")
    ids = players.url.astype(str).str.rstrip("/").str.split("/").str[-1]
    ids = pd.to_numeric(ids, errors="coerce")
    raw = pd.DataFrame({
        "raw_team": players.Team,
        "player_id": ids,
        "player_name": players.Name,
        "common_name": players.Name,
        "position": players.Position,
        "overall_rating": players.OVR,
        "pace": players.PAC,
        "shooting": players.SHO,
        "passing": players.PAS,
        "dribbling": players.DRI,
        "defending": players.DEF,
        "physical": players.PHY,
        "preferred_foot": players.get("Preferred foot"),
        "skill_moves": players.get("Skill moves"),
    })
    return _clean_players(
        raw, 2025, "EA Sports FC 25", FC25_SNAPSHOT_DATE,
        FC25_SOURCE, resolve, teams_by_season.get(2025, set()),
    )


def build(archive_fc24: Path, archive_fc25: Path, matches_path: Path = MATCHES_PATH, output_dir: Path = DATA_DIR) -> tuple[pd.DataFrame, pd.DataFrame]:
    resolve, teams_by_season = _team_resolver(matches_path)
    players = pd.concat([
        _load_fc15_to_fc24(archive_fc24, resolve, teams_by_season),
        _load_fc25(archive_fc25, resolve, teams_by_season),
    ], ignore_index=True)
    players = players.sort_values(["season", "team_name", "overall_rating", "player_name"])
    summaries = players.groupby(["season", "team_name"], as_index=False).agg(
        avg_rating=("overall_rating", "mean"),
        max_rating=("overall_rating", "max"),
        rating_players=("player_id", "nunique"),
        source_edition=("source_edition", "first"),
        snapshot_date=("snapshot_date", "first"),
    )

    for season in range(2015, 2026):
        expected = teams_by_season.get(season, set())
        found = set(summaries.loc[summaries.season == season, "team_name"])
        missing = sorted(expected - found)
        if missing:
            raise ValueError(f"Season {season} ratings do not cover match teams: {missing}")

    output_dir.mkdir(parents=True, exist_ok=True)
    players.to_csv(output_dir / PLAYERS_OUT.name, index=False)
    summaries.to_csv(output_dir / TEAMS_OUT.name, index=False, float_format="%.6f")
    return players, summaries


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fc24-archive", required=True, type=Path)
    parser.add_argument("--fc25-archive", required=True, type=Path)
    parser.add_argument("--matches", type=Path, default=MATCHES_PATH)
    parser.add_argument("--output-dir", type=Path, default=DATA_DIR)
    args = parser.parse_args()
    player_rows, team_rows = build(args.fc24_archive, args.fc25_archive, args.matches, args.output_dir)
    print(
        f"Created {len(player_rows):,} player-season ratings across "
        f"{team_rows.season.nunique()} editions and {len(team_rows):,} team-season summaries."
    )