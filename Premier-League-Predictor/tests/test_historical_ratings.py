import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parents[1]))
from model_pipeline import DATA_PATH, PLAYER_RATINGS_PATH, RATINGS_PATH, load_matches


def test_ratings_cover_each_match_team_and_are_preseason_snapshots():
    matches = load_matches(DATA_PATH)
    ratings = pd.read_csv(RATINGS_PATH)
    players = pd.read_csv(PLAYER_RATINGS_PATH)
    assert sorted(ratings.season.unique()) == list(range(2015, 2026))
    assert sorted(players.season.unique()) == list(range(2015, 2026))
    assert not players.duplicated(["season", "team_name", "player_id"]).any()

    for season in range(2015, 2026):
        expected_teams = set(matches.loc[matches.season == season, "homeTeam_name"]) | set(
            matches.loc[matches.season == season, "awayTeam_name"]
        )
        season_rows = ratings[ratings.season == season]
        assert set(season_rows.team_name) == expected_teams
        assert len(season_rows) == 20
        snapshot = pd.to_datetime(season_rows.snapshot_date)
        assert snapshot.nunique() == 1
        assert snapshot.iloc[0] < pd.Timestamp(year=season, month=8, day=1)

    assert set(ratings.loc[ratings.season == 2025, "source_edition"]) == {"EA Sports FC 25"}