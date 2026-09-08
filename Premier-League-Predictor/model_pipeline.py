"""Reproducible implementation of the public PremierPredict feature contract.

The public project builds 39 predictors from match history, previous-season
standings and player ratings.  This module reproduces that contract locally.
The public notebook used Snowflake for historical standings; the checked-in
history workbook is byte-identical to the public repository and is used here
as the offline equivalent.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "datasets"
DATA_PATH = DATA_DIR / "premier_league_matches.xlsx"
HISTORY_PATH = DATA_DIR / "history_points_table.xlsx"
RATINGS_PATH = DATA_DIR / "premier_league_player_ratings.xlsx"
REPOSITORY_URL = "https://github.com/BishalBhujel/Premier-League-Predictor"
SOURCE_COMMIT = "ca8c1808992d346f5163c18f8db72670fdbc76e8"

FEATURE_COLUMNS = [
    "season", "matchWeek",
    "home_previous_position", "home_previous_points", "home_previous_wins",
    "home_previous_draws", "home_previous_losses", "home_previous_goals_for",
    "home_previous_goals_against", "home_previous_goal_difference",
    "away_previous_position", "away_previous_points", "away_previous_wins",
    "away_previous_draws", "away_previous_losses", "away_previous_goals_for",
    "away_previous_goals_against", "away_previous_goal_difference",
    "home_form_points", "away_form_points", "form_points_diff",
    "home_avg_rating", "home_max_rating", "away_avg_rating", "away_max_rating",
    "home_rating_available", "away_rating_available", "previous_points_diff",
    "previous_position_diff", "previous_goal_diff_diff", "home_home_win_rate",
    "away_away_win_rate", "home_away_win_rate_diff", "home_recent_goals_scored",
    "home_recent_goals_conceded", "away_recent_goals_scored",
    "away_recent_goals_conceded", "recent_goals_scored_diff",
    "recent_goals_conceded_diff",
]
MODEL_FEATURE_COLUMNS = [c for c in FEATURE_COLUMNS if c not in {"season", "matchWeek"}]


@dataclass
class ModelBundle:
    matches: pd.DataFrame
    features: pd.DataFrame
    target: pd.Series
    train_features: pd.DataFrame
    test_features: pd.DataFrame
    train_target: pd.Series
    test_target: pd.Series
    models: dict[str, Any]
    metrics: pd.DataFrame
    reports: dict[str, dict[str, dict[str, float]]]
    confusion_matrices: dict[str, np.ndarray]
    classes: list[str]
    latest_season: int
    teams: list[str]
    latest_states: dict[str, dict[str, Any]]
    provenance: dict[str, Any]


def load_matches(path: Path = DATA_PATH) -> pd.DataFrame:
    df = pd.read_excel(path).copy()
    required = {"season", "matchWeek", "kickoff", "homeTeam_id", "awayTeam_id",
                "homeTeam_name", "awayTeam_name", "homeTeam_score", "awayTeam_score"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Match dataset is missing columns: {sorted(missing)}")
    for col in ["season", "matchWeek", "homeTeam_id", "awayTeam_id",
                "homeTeam_score", "awayTeam_score"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["kickoff"] = pd.to_datetime(df["kickoff"], errors="coerce")
    df = df.dropna(subset=list(required)).sort_values(["season", "kickoff"]).reset_index(drop=True)
    df["season"] = df["season"].astype(int)
    df["matchWeek"] = df["matchWeek"].astype(int)
    df["result"] = np.select(
        [df.homeTeam_score > df.awayTeam_score, df.homeTeam_score < df.awayTeam_score],
        ["H", "A"], default="D")
    return df


def _history() -> pd.DataFrame:
    """Load the original project's historical standings from Snowflake."""
    from snowflake_connector import snowflake_connector_init

    con = snowflake_connector_init()
    try:
        x = con.cursor().execute(
            "SELECT SEASON, TEAM_ID, POSITION, POINTS, WON, DRAWN, LOST, "
            "GOALS_FOR, GOALS_AGAINST "
            "FROM HISTORICAL_TEAM_PERFORMANCE ORDER BY SEASON, POSITION"
        ).fetch_pandas_all()
    finally:
        con.close()
    x = x.rename(columns={
        "SEASON": "previous_season", "TEAM_ID": "team_id",
        "POSITION": "previous_position", "POINTS": "previous_points",
        "WON": "previous_wins", "DRAWN": "previous_draws",
        "LOST": "previous_losses", "GOALS_FOR": "previous_goals_for",
        "GOALS_AGAINST": "previous_goals_against",
    })
    x["season"] = x["previous_season"] + 1
    x["previous_goal_difference"] = x.previous_goals_for - x.previous_goals_against
    return x[["season", "team_id", "previous_position", "previous_points",
              "previous_wins", "previous_draws", "previous_losses",
              "previous_goals_for", "previous_goals_against",
              "previous_goal_difference"]]


def _ratings() -> pd.DataFrame:
    x = pd.read_excel(RATINGS_PATH)
    mapping = {"Man Utd": "Manchester United", "Newcastle Utd": "Newcastle United",
               "Spurs": "Tottenham Hotspur", "West Ham": "West Ham United",
               "Wolves": "Wolverhampton Wanderers", "Nott'm Forest": "Nottingham Forest",
               "AFC Bournemouth": "Bournemouth", "Brighton": "Brighton and Hove Albion"}
    x["team_name"] = x["clubName"].replace(mapping)
    return x.groupby("team_name").agg(
        avg_rating=("overallRating", "mean"), max_rating=("overallRating", "max")
    ).reset_index()


def _prior_form(df: pd.DataFrame, team_id: int, season: int, date: pd.Timestamp) -> tuple[float, float, float, float]:
    p = df[(df.season == season) & (df.kickoff < date) &
           ((df.homeTeam_id == team_id) | (df.awayTeam_id == team_id))].tail(5)
    pts = []; gf = []; ga = []
    for r in p.itertuples():
        home = r.homeTeam_id == team_id
        own, opp = (r.homeTeam_score, r.awayTeam_score) if home else (r.awayTeam_score, r.homeTeam_score)
        pts.append(3 if own > opp else 1 if own == opp else 0); gf.append(own); ga.append(opp)
    return float(sum(pts)), float(np.mean(gf) if gf else 0), float(np.mean(ga) if ga else 0), float(sum(1 for v in pts if v == 3) / len(pts) if pts else 0)


def build_feature_table(matches: pd.DataFrame) -> tuple[pd.DataFrame, dict[int, dict[str, dict[str, Any]]]]:
    standings = _history().set_index(["season", "team_id"])
    ratings = _ratings().set_index("team_name")
    rows = []
    states: dict[int, dict[str, dict[str, Any]]] = {}
    for r in matches.itertuples():
        def prev(team):
            try: return standings.loc[(r.season, int(team))].to_dict()
            except KeyError: return {k: 0.0 for k in ["previous_position", "previous_points", "previous_wins", "previous_draws", "previous_losses", "previous_goals_for", "previous_goals_against", "previous_goal_difference"]}
        h, a = prev(r.homeTeam_id), prev(r.awayTeam_id)
        hf, hgs, hgc, hwr = _prior_form(matches, r.homeTeam_id, r.season, r.kickoff)
        af, ags, agc, awr = _prior_form(matches, r.awayTeam_id, r.season, r.kickoff)
        hr = ratings.loc[r.homeTeam_name] if r.homeTeam_name in ratings.index else {"avg_rating": 0, "max_rating": 0}
        ar = ratings.loc[r.awayTeam_name] if r.awayTeam_name in ratings.index else {"avg_rating": 0, "max_rating": 0}
        row = {"season": r.season, "matchWeek": r.matchWeek,
               **{f"home_{k}": v for k, v in h.items()}, **{f"away_{k}": v for k, v in a.items()},
               "home_form_points": hf, "away_form_points": af, "form_points_diff": hf-af,
               "home_avg_rating": hr["avg_rating"], "home_max_rating": hr["max_rating"],
               "away_avg_rating": ar["avg_rating"], "away_max_rating": ar["max_rating"],
               "home_rating_available": int(hr["avg_rating"] > 0), "away_rating_available": int(ar["avg_rating"] > 0),
               "previous_points_diff": h["previous_points"]-a["previous_points"],
               "previous_position_diff": a["previous_position"]-h["previous_position"],
               "previous_goal_diff_diff": h["previous_goal_difference"]-a["previous_goal_difference"],
               "home_home_win_rate": hwr, "away_away_win_rate": awr,
               "home_away_win_rate_diff": hwr-awr, "home_recent_goals_scored": hgs,
               "home_recent_goals_conceded": hgc, "away_recent_goals_scored": ags,
               "away_recent_goals_conceded": agc, "recent_goals_scored_diff": hgs-ags,
               "recent_goals_conceded_diff": hgc-agc}
        rows.append(row)
    return pd.DataFrame(rows)[FEATURE_COLUMNS], states


def _build_models():
    return {
        "Logistic Regression": Pipeline([("scale", StandardScaler()), ("model", LogisticRegression(max_iter=1000, random_state=42))]),
        "Decision Tree": DecisionTreeClassifier(max_depth=6, min_samples_leaf=10, class_weight="balanced", random_state=42),
        "Random Forest": RandomForestClassifier(n_estimators=200, max_depth=12, min_samples_leaf=3, class_weight="balanced_subsample", random_state=42, n_jobs=-1),
    }


def train_models(path: Path = DATA_PATH) -> ModelBundle:
    matches = load_matches(path)
    table, states = build_feature_table(matches)
    target = matches.result.reset_index(drop=True)
    train_mask, test_mask = table.season <= 2022, table.season >= 2023
    train_x, test_x = table.loc[train_mask, MODEL_FEATURE_COLUMNS], table.loc[test_mask, MODEL_FEATURE_COLUMNS]
    train_y, test_y = target.loc[train_mask], target.loc[test_mask]
    models, metrics, reports, matrices = _build_models(), [], {}, {}
    for name, model in models.items():
        model.fit(train_x, train_y); pred = model.predict(test_x)
        report = classification_report(test_y, pred, labels=["H", "D", "A"], target_names=["Home Win", "Draw", "Away Win"], output_dict=True, zero_division=0)
        reports[name] = report; matrices[name] = confusion_matrix(test_y, pred, labels=["H", "D", "A"])
        metrics.append({"Model": name, "Accuracy": accuracy_score(test_y, pred), "Macro F1": report["macro avg"]["f1-score"], "Draw F1": report["Draw"]["f1-score"]})
    provenance = {"repository": REPOSITORY_URL, "source_commit": SOURCE_COMMIT, "feature_contract": "public feature_engineering.py ml_features (39 columns)", "dataset_files": [p.name for p in [path, RATINGS_PATH]], "historical_standings_source": "Snowflake HISTORICAL_TEAM_PERFORMANCE", "training_split": "season <= 2022", "test_split": "season >= 2023"}
    latest = matches[matches.season == int(matches.season.max())]
    teams = sorted(set(latest.homeTeam_name) | set(latest.awayTeam_name))
    return ModelBundle(matches, table[MODEL_FEATURE_COLUMNS], target, train_x, test_x, train_y, test_y, models, pd.DataFrame(metrics).sort_values("Accuracy", ascending=False), reports, matrices, ["H", "D", "A"], int(matches.season.max()), teams, states, provenance)


def build_prediction_features(bundle, home_team: str, away_team: str) -> pd.DataFrame:
    latest = bundle.matches[bundle.matches.season == bundle.latest_season]
    def team_id(team: str) -> int:
        home = latest.loc[latest.homeTeam_name == team, "homeTeam_id"]
        if not home.empty:
            return int(home.iloc[-1])
        away = latest.loc[latest.awayTeam_name == team, "awayTeam_id"]
        if not away.empty:
            return int(away.iloc[-1])
        raise ValueError(f"Team {team!r} is not present in the latest season.")
    home_id, away_id = team_id(home_team), team_id(away_team)
    synthetic = pd.DataFrame([{
        "season": bundle.latest_season, "matchWeek": 39,
        "kickoff": latest.kickoff.max() + pd.Timedelta(days=1),
        "homeTeam_id": home_id, "awayTeam_id": away_id,
        "homeTeam_name": home_team, "awayTeam_name": away_team,
        "homeTeam_score": 0, "awayTeam_score": 0,
    }])
    row, _ = build_feature_table(pd.concat([bundle.matches, synthetic], ignore_index=True))
    return row.iloc[[-1]][MODEL_FEATURE_COLUMNS]