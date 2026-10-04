"""Dashboard adapter for Bishal's PremierPredict feature contract.

The upstream table now has 42 columns, including season and match week.
The dashboard uses the other 40 as predictors, a held-out chronological split,
and fixed model configurations. Historical standings are explicitly reconstructed
from prior-season match results by default; Snowflake is an opt-in source.
Upstream tuning scripts are separate.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier
from xgboost_model import OutcomeXGBoostClassifier

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "datasets"
DATA_PATH = DATA_DIR / "premier_league_matches.xlsx"
HISTORY_PATH = DATA_DIR / "history_points_table.xlsx"
RATINGS_PATH = DATA_DIR / "premier_league_team_ratings_by_season.csv"
PLAYER_RATINGS_PATH = DATA_DIR / "premier_league_player_ratings_by_season.csv"
LEGACY_CURRENT_RATINGS_PATH = DATA_DIR / "premier_league_player_ratings.xlsx"
REPOSITORY_URL = "https://github.com/BishalBhujel/Premier-League-Predictor"
SOURCE_COMMIT = "e1c12b2e6fdf554c79b1a45b3a49fff9af29b793"

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
    "home_current_points", "away_current_points", "current_points_diff",
]
MODEL_FEATURE_COLUMNS = [c for c in FEATURE_COLUMNS if c not in {"season", "matchWeek"}]
HISTORY_FEATURES = [
    "previous_position", "previous_points", "previous_wins", "previous_draws",
    "previous_losses", "previous_goals_for", "previous_goals_against",
    "previous_goal_difference",
]
STATE_FEATURES = HISTORY_FEATURES + [
    "form_points", "avg_rating", "max_rating", "rating_available",
    "recent_goals_scored", "recent_goals_conceded", "current_points",
]


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
    evaluation_summary: dict[str, Any]


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


def _standings_from_matches(matches: pd.DataFrame) -> pd.DataFrame:
    """Reconstruct prior-season standings without using current-season outcomes."""
    appearances = []
    for side, opponent in [("home", "away"), ("away", "home")]:
        appearances.append(pd.DataFrame({
            "season": matches.season,
            "team_id": matches[f"{side}Team_id"],
            "goals_for": matches[f"{side}Team_score"],
            "goals_against": matches[f"{opponent}Team_score"],
        }))
    rows = pd.concat(appearances, ignore_index=True)
    rows["wins"] = (rows.goals_for > rows.goals_against).astype(int)
    rows["draws"] = (rows.goals_for == rows.goals_against).astype(int)
    rows["losses"] = (rows.goals_for < rows.goals_against).astype(int)
    rows["points"] = rows.wins * 3 + rows.draws
    totals = rows.groupby(["season", "team_id"], as_index=False).agg({
        column: "sum" for column in [
            "goals_for", "goals_against", "wins", "draws", "losses", "points"
        ]
    })
    totals["goal_difference"] = totals.goals_for - totals.goals_against
    totals = totals.sort_values(
        ["season", "points", "goal_difference", "goals_for", "team_id"],
        ascending=[True, False, False, False, True],
    )
    totals["position"] = totals.groupby("season").cumcount() + 1
    totals["season"] += 1
    totals = totals.rename(columns={
        name: f"previous_{name}" for name in [
            "position", "points", "wins", "draws", "losses",
            "goals_for", "goals_against", "goal_difference",
        ]
    })
    return totals[["season", "team_id", *HISTORY_FEATURES]]


def _history(matches: pd.DataFrame, source: str = "matches") -> pd.DataFrame:
    if source == "matches":
        return _standings_from_matches(matches)
    if source != "snowflake":
        raise ValueError(f"Unknown historical standings source: {source!r}")
    # An explicit Snowflake request fails rather than silently using another source.
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
    x = pd.read_csv(RATINGS_PATH)
    required = {"season", "team_name", "avg_rating", "max_rating"}
    missing = required - set(x.columns)
    if missing:
        raise ValueError(f"Seasonal rating data is missing columns: {sorted(missing)}")
    x["season"] = pd.to_numeric(x["season"], errors="raise").astype(int)
    x["avg_rating"] = pd.to_numeric(x["avg_rating"], errors="raise")
    x["max_rating"] = pd.to_numeric(x["max_rating"], errors="raise")
    if x.duplicated(["season", "team_name"]).any():
        raise ValueError("Seasonal rating data contains duplicate team-season rows.")
    return x


def _prior_form(df: pd.DataFrame, team_id: int, season: int, date: pd.Timestamp) -> tuple[float, float, float, float]:
    p = df[(df.season == season) & (df.kickoff < date) &
           ((df.homeTeam_id == team_id) | (df.awayTeam_id == team_id))].tail(5)
    pts = []; gf = []; ga = []
    for r in p.itertuples():
        home = r.homeTeam_id == team_id
        own, opp = (r.homeTeam_score, r.awayTeam_score) if home else (r.awayTeam_score, r.homeTeam_score)
        pts.append(3 if own > opp else 1 if own == opp else 0); gf.append(own); ga.append(opp)
    return float(sum(pts)), float(sum(gf)), float(sum(ga)), float(sum(1 for v in pts if v == 3) / len(pts) if pts else 0)


def _venue_win_rate(matches, team_id, season, date, home):
    """Match upstream's last-five home-only or away-only win-rate feature."""
    id_column = "homeTeam_id" if home else "awayTeam_id"
    rows = matches[
        (matches.season == season) & (matches.kickoff < date)
        & (matches[id_column] == team_id)
    ].tail(5)
    if rows.empty:
        return 0.0
    own = rows.homeTeam_score if home else rows.awayTeam_score
    opponent = rows.awayTeam_score if home else rows.homeTeam_score
    return float((own > opponent).mean())


def _compose_feature_row(season, match_week, home, away):
    row = {"season": season, "matchWeek": match_week}
    for side, state in [("home", home), ("away", away)]:
        row.update({f"{side}_{key}": state[key] for key in STATE_FEATURES})
    row.update({
        "form_points_diff": home["form_points"] - away["form_points"],
        "previous_points_diff": home["previous_points"] - away["previous_points"],
        "previous_position_diff": away["previous_position"] - home["previous_position"],
        "previous_goal_diff_diff": home["previous_goal_difference"] - away["previous_goal_difference"],
        "home_home_win_rate": home["home_win_rate"],
        "away_away_win_rate": away["away_win_rate"],
        "home_away_win_rate_diff": home["home_win_rate"] - away["away_win_rate"],
        "recent_goals_scored_diff": home["recent_goals_scored"] - away["recent_goals_scored"],
        "recent_goals_conceded_diff": home["recent_goals_conceded"] - away["recent_goals_conceded"],
        "current_points_diff": home["current_points"] - away["current_points"],
    })
    return row


def build_feature_table(matches: pd.DataFrame, history_source: str = "matches") -> tuple[pd.DataFrame, dict[str, dict[str, Any]]]:
    matches = matches.sort_values(["season", "kickoff"]).reset_index(drop=True)
    standings = _history(matches, history_source).set_index(["season", "team_id"])
    ratings = _ratings().set_index(["season", "team_name"])
    rows = []
    points: dict[tuple[int, int], int] = {}

    def team_state(team_id, team_name, season, date):
        try:
            previous = standings.loc[(season, int(team_id))].to_dict()
        except KeyError:
            previous = {key: 0.0 for key in HISTORY_FEATURES}
        rating_key = (int(season), team_name)
        rating = ratings.loc[rating_key] if rating_key in ratings.index else None
        form, scored, conceded, _ = _prior_form(matches, team_id, season, date)
        return {
            **previous,
            "form_points": form,
            "avg_rating": float(rating["avg_rating"]) if rating is not None else np.nan,
            "max_rating": float(rating["max_rating"]) if rating is not None else np.nan,
            "rating_available": int(rating is not None),
            "recent_goals_scored": scored,
            "recent_goals_conceded": conceded,
            "home_win_rate": _venue_win_rate(matches, team_id, season, date, True),
            "away_win_rate": _venue_win_rate(matches, team_id, season, date, False),
            "current_points": points.get((season, int(team_id)), 0),
        }

    for r in matches.itertuples():
        home = team_state(r.homeTeam_id, r.homeTeam_name, r.season, r.kickoff)
        away = team_state(r.awayTeam_id, r.awayTeam_name, r.season, r.kickoff)
        rows.append(_compose_feature_row(r.season, r.matchWeek, home, away))
        # Update only after creating this match's predictors.
        home_key, away_key = (r.season, int(r.homeTeam_id)), (r.season, int(r.awayTeam_id))
        home_award = 3 if r.homeTeam_score > r.awayTeam_score else 1 if r.homeTeam_score == r.awayTeam_score else 0
        away_award = 3 if r.awayTeam_score > r.homeTeam_score else 1 if r.homeTeam_score == r.awayTeam_score else 0
        points[home_key] = points.get(home_key, 0) + home_award
        points[away_key] = points.get(away_key, 0) + away_award

    latest_season = int(matches.season.max())
    latest = matches[matches.season == latest_season]
    prediction_date = latest.kickoff.max() + pd.Timedelta(days=1)
    states = {}
    for r in latest.itertuples():
        for team_id, team_name in [(r.homeTeam_id, r.homeTeam_name), (r.awayTeam_id, r.awayTeam_name)]:
            if team_name not in states:
                states[team_name] = team_state(team_id, team_name, latest_season, prediction_date)
    return pd.DataFrame(rows)[FEATURE_COLUMNS], states


def _build_models():
    def pipeline(estimator, scale=False):
        steps = [("imputer", SimpleImputer(strategy="median"))]
        if scale:
            steps.append(("scale", StandardScaler()))
        steps.append(("model", estimator))
        return Pipeline(steps)

    return {
        "Logistic Regression": pipeline(LogisticRegression(max_iter=1000, random_state=42), scale=True),
        "Decision Tree": pipeline(DecisionTreeClassifier(max_depth=6, min_samples_leaf=10, class_weight="balanced", random_state=42)),
        "Random Forest": pipeline(RandomForestClassifier(n_estimators=200, max_depth=12, min_samples_leaf=3, class_weight="balanced_subsample", random_state=42, n_jobs=-1)),
        "Gradient Boosting": pipeline(GradientBoostingClassifier(n_estimators=200, learning_rate=0.05, max_depth=3, random_state=42)),
        "XGBoost": pipeline(OutcomeXGBoostClassifier()),
    }


def train_models(path: Path = DATA_PATH, history_source: str = "matches") -> ModelBundle:
    matches = load_matches(path)
    table, states = build_feature_table(matches, history_source)
    target = matches.result.reset_index(drop=True)
    train_mask, test_mask = table.season <= 2022, table.season >= 2023
    train_x, test_x = table.loc[train_mask, MODEL_FEATURE_COLUMNS], table.loc[test_mask, MODEL_FEATURE_COLUMNS]
    train_y, test_y = target.loc[train_mask], target.loc[test_mask]
    if train_x.empty or test_x.empty:
        raise ValueError("The chronological split must contain both training and held-out matches.")
    rated_historical = table.season.between(2015, 2022)
    rated_test = test_mask
    missing_rated_train = table.loc[rated_historical, ["home_rating_available", "away_rating_available"]].ne(1).any(axis=1)
    missing_test = table.loc[rated_test, ["home_rating_available", "away_rating_available"]].ne(1).any(axis=1)
    if missing_rated_train.any():
        raise ValueError(
            f"Season-specific player ratings are missing from {int(missing_rated_train.sum())} "
            "training matches in seasons 2015–2022."
        )
    if missing_test.any():
        raise ValueError(
            f"Season-specific player ratings are missing from {int(missing_test.sum())} "
            "held-out matches in seasons 2023–2025."
        )
    models, metrics, reports, matrices = _build_models(), [], {}, {}
    for name, model in models.items():
        model.fit(train_x, train_y)
        pred = model.predict(test_x)
        report = classification_report(test_y, pred, labels=["H", "D", "A"], target_names=["Home Win", "Draw", "Away Win"], output_dict=True, zero_division=0)
        reports[name] = report; matrices[name] = confusion_matrix(test_y, pred, labels=["H", "D", "A"])
        metrics.append({"Model": name, "Accuracy": accuracy_score(test_y, pred), "Macro F1": report["macro avg"]["f1-score"], "Draw F1": report["Draw"]["f1-score"]})
        metrics[-1]["Macro Precision"] = report["macro avg"]["precision"]

    outcome_counts = {
        scope: {label: int((values == label).sum()) for label in ["H", "D", "A"]}
        for scope, values in [
            ("all", target), ("train", train_y), ("test", test_y),
        ]
    }
    total_counts = outcome_counts["all"]
    train_counts = outcome_counts["train"]
    train_majority = max(["H", "D", "A"], key=lambda label: train_counts[label])
    overall_majority = max(["H", "D", "A"], key=lambda label: total_counts[label])
    evaluation_summary = {
        "validUniqueMatches": int(len(matches)),
        "trainMatches": int(len(train_y)),
        "testMatches": int(len(test_y)),
        "outcomeCounts": outcome_counts,
        "trainingMajorityOutcome": train_majority,
        "holdoutMajorityBaselineAccuracy": float((test_y == train_majority).mean()),
        "datasetMajorityOutcome": overall_majority,
        "datasetMajorityBaselineAccuracy": float(total_counts[overall_majority] / len(target)),
        "ratedMatchCount": int(
            (table[["home_rating_available", "away_rating_available"]].eq(1).all(axis=1)).sum()
        ),
        "ratedTestMatchCount": int(
            (table.loc[test_mask, ["home_rating_available", "away_rating_available"]].eq(1).all(axis=1)).sum()
        ),
        "imputedPre2015MatchCount": int((table.season < 2015).sum()),
    }
    historical_source = "Snowflake HISTORICAL_TEAM_PERFORMANCE" if history_source == "snowflake" else "Reconstructed from checked-in prior-season match results: points, goal difference, goals for, then team ID as final tie-break"
    rating_seasons = sorted(_ratings().season.unique().tolist())
    provenance = {
        "repository": REPOSITORY_URL,
        "source_commit": SOURCE_COMMIT,
        "feature_contract": "Upstream feature table has 42 columns; season and matchWeek are excluded, leaving 40 predictors.",
        "dataset_files": [p.name for p in [path, RATINGS_PATH, PLAYER_RATINGS_PATH]],
        "historical_standings_source": historical_source,
        "training_split": "season <= 2022; 2008–2022",
        "test_split": "season >= 2023; 2023–2025",
        "model_configuration": "Fixed dashboard configurations; upstream Optuna tuning is not applied to these results.",
        "ratings_source": (
            "Season-matched EA FIFA/FC edition snapshots: FC 15–24 ratings from "
            "https://www.kaggle.com/datasets/stefanoleone992/ea-sports-fc-24-complete-player-dataset "
            "and FC 25 ratings from "
            "https://www.kaggle.com/datasets/nyagami/ea-sports-fc-25-database-ratings-and-stats."
        ),
        "ratings_seasons": ", ".join(map(str, rating_seasons)),
        "ratings_method": (
            "Each match season uses the matching edition snapshot dated before 1 August "
            "of that season. Ratings are unavailable for 2008–2014; rating values for those "
            "training rows are median-imputed by each model using training rows only, with "
            "availability flags set to 0. The undated current snapshot workbook is not used."
        ),
    }
    latest = matches[matches.season == int(matches.season.max())]
    teams = sorted(set(latest.homeTeam_name) | set(latest.awayTeam_name))
    return ModelBundle(
        matches, table[MODEL_FEATURE_COLUMNS], target, train_x, test_x,
        train_y, test_y, models,
        pd.DataFrame(metrics).sort_values("Accuracy", ascending=False),
        reports, matrices, ["H", "D", "A"], int(matches.season.max()),
        teams, states, provenance, evaluation_summary,
    )


def build_prediction_features(bundle, home_team: str, away_team: str) -> pd.DataFrame:
    if home_team == away_team:
        raise ValueError("Home and away teams must be different.")
    for team in [home_team, away_team]:
        if team not in bundle.latest_states:
            raise ValueError(f"Team {team!r} is not present in the latest season.")
    row = _compose_feature_row(
        bundle.latest_season, 39,
        bundle.latest_states[home_team], bundle.latest_states[away_team],
    )
    return pd.DataFrame([row])[MODEL_FEATURE_COLUMNS]