"""Create the static artifact payload from the same fidelity pipeline."""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from model_pipeline import MODEL_FEATURE_COLUMNS, PLAYER_RATINGS_PATH, build_prediction_features, train_models
from dashboard_contract import write_dashboard_payload
from browser_models import export_browser_models

OUT = Path(__file__).parents[1] / "artifacts/premierpredict-dashboard/public/data/premierpredict.json"


def _team_stats(matches, latest_season):
    latest = matches[matches.season == latest_season]
    teams = sorted(set(latest.homeTeam_name) | set(latest.awayTeam_name))
    rows = []
    for team in teams:
        home = latest[latest.homeTeam_name == team]
        away = latest[latest.awayTeam_name == team]
        wins = int((home.result == "H").sum() + (away.result == "A").sum())
        draws = int((home.result == "D").sum() + (away.result == "D").sum())
        losses = int((home.result == "A").sum() + (away.result == "H").sum())
        goals_for = int(home.homeTeam_score.sum() + away.awayTeam_score.sum())
        goals_against = int(home.awayTeam_score.sum() + away.homeTeam_score.sum())
        rows.append({
            "team": team,
            "played": int(len(home) + len(away)),
            "wins": wins,
            "draws": draws,
            "losses": losses,
            "goalsFor": goals_for,
            "goalsAgainst": goals_against,
            "goalDifference": goals_for - goals_against,
            "points": wins * 3 + draws,
        })
    return sorted(rows, key=lambda row: (row["points"], row["goalDifference"], row["goalsFor"]), reverse=True)


def _season_trends(matches):
    rows = []
    for season, group in matches.groupby("season", sort=True):
        total = len(group)
        rows.append({
            "season": int(season),
            "matches": int(total),
            "goalsPerMatch": float((group.homeTeam_score + group.awayTeam_score).mean()),
            "homeWinRate": float((group.result == "H").mean()),
            "drawRate": float((group.result == "D").mean()),
            "awayWinRate": float((group.result == "A").mean()),
        })
    return rows


def _players_by_club(latest_season):
    ratings = pd.read_csv(PLAYER_RATINGS_PATH)
    ratings = ratings[ratings.season == latest_season].copy()
    if ratings.empty:
        raise ValueError(f"No player-level ratings are available for latest season {latest_season}.")
    fields = [
        "player_id", "player_name", "common_name", "team_name", "position",
        "overall_rating", "pace", "shooting", "passing", "dribbling",
        "defending", "physical", "preferred_foot", "skill_moves",
    ]
    missing = set(fields) - set(ratings.columns)
    if missing:
        raise ValueError(f"Seasonal player ratings are missing columns: {sorted(missing)}")
    ratings = ratings[fields]
    clubs = {}
    for club, group in ratings.groupby("team_name", sort=True):
        players = []
        for row in group.sort_values(["overall_rating", "player_name"], ascending=[False, True]).to_dict("records"):
            players.append({
                "id": int(row["player_id"]),
                "name": row["player_name"],
                "commonName": None if pd.isna(row["common_name"]) else row["common_name"],
                "position": row["position"],
                "overallRating": int(row["overall_rating"]),
                "pace": int(row["pace"]),
                "shooting": int(row["shooting"]),
                "passing": int(row["passing"]),
                "dribbling": int(row["dribbling"]),
                "defending": int(row["defending"]),
                "physical": int(row["physical"]),
                "preferredFoot": row["preferred_foot"],
                "skillMoves": int(row["skill_moves"]),
            })
        clubs[club] = players
    return clubs


def _club_performance(matches):
    clubs = sorted(set(matches.homeTeam_name) | set(matches.awayTeam_name))
    performance = {}
    for club in clubs:
        home = matches[matches.homeTeam_name == club]
        away = matches[matches.awayTeam_name == club]
        goals_for = pd.concat([
            home[["homeTeam_score"]].rename(columns={"homeTeam_score": "goals"}),
            away[["awayTeam_score"]].rename(columns={"awayTeam_score": "goals"}),
        ])["goals"]
        goals_against = pd.concat([
            home[["awayTeam_score"]].rename(columns={"awayTeam_score": "goals"}),
            away[["homeTeam_score"]].rename(columns={"homeTeam_score": "goals"}),
        ])["goals"]
        club_matches = len(goals_for)
        score_buckets = {
            "0": int((goals_for == 0).sum()),
            "1": int((goals_for == 1).sum()),
            "2": int((goals_for == 2).sum()),
            "3+": int((goals_for >= 3).sum()),
        }
        performance[club] = {
            "matches": int(club_matches),
            "goalsFor": int(goals_for.sum()),
            "goalsAgainst": int(goals_against.sum()),
            "goalsPerMatch": float(goals_for.mean()),
            "concededPerMatch": float(goals_against.mean()),
            "cleanSheets": int(((home.awayTeam_score == 0).sum()) + ((away.homeTeam_score == 0).sum())),
            "bothTeamsScored": int(((home.homeTeam_score > 0) & (home.awayTeam_score > 0)).sum() + ((away.homeTeam_score > 0) & (away.awayTeam_score > 0)).sum()),
            "overTwoPointFiveGoals": int(((home.homeTeam_score + home.awayTeam_score > 2).sum()) + ((away.homeTeam_score + away.awayTeam_score > 2).sum())),
            "homeWinRate": float((home.result == "H").mean()) if len(home) else 0,
            "awayWinRate": float((away.result == "A").mean()) if len(away) else 0,
            "goalsScoredBuckets": score_buckets,
        }
    return performance


def _recent_form(matches, teams, limit=5):
    ordered = matches.sort_values("kickoff", ascending=False)
    form = {}
    for club in teams:
        club_matches = ordered[
            (ordered.homeTeam_name == club) | (ordered.awayTeam_name == club)
        ].head(limit)
        rows = []
        for match in club_matches.itertuples():
            is_home = match.homeTeam_name == club
            goals_for = int(match.homeTeam_score if is_home else match.awayTeam_score)
            goals_against = int(match.awayTeam_score if is_home else match.homeTeam_score)
            result = "W" if goals_for > goals_against else "D" if goals_for == goals_against else "L"
            rows.append({
                "kickoff": match.kickoff.isoformat(),
                "opponent": match.awayTeam_name if is_home else match.homeTeam_name,
                "venue": "H" if is_home else "A",
                "goalsFor": goals_for,
                "goalsAgainst": goals_against,
                "result": result,
            })
        form[club] = {
            "matches": rows,
            "wins": sum(row["result"] == "W" for row in rows),
            "draws": sum(row["result"] == "D" for row in rows),
            "losses": sum(row["result"] == "L" for row in rows),
            "goalsFor": sum(row["goalsFor"] for row in rows),
            "goalsAgainst": sum(row["goalsAgainst"] for row in rows),
        }
    return form


def _head_to_head(matches, teams, recent_limit=5):
    ordered = matches.sort_values("kickoff", ascending=False)
    comparisons = {}
    for first in teams:
        for second in teams:
            if first == second:
                continue
            meetings = ordered[
                ((ordered.homeTeam_name == first) & (ordered.awayTeam_name == second))
                | ((ordered.homeTeam_name == second) & (ordered.awayTeam_name == first))
            ]
            first_wins = 0
            second_wins = 0
            draws = 0
            first_goals = 0
            second_goals = 0
            recent = []
            for index, match in enumerate(meetings.itertuples()):
                first_is_home = match.homeTeam_name == first
                first_score = int(match.homeTeam_score if first_is_home else match.awayTeam_score)
                second_score = int(match.awayTeam_score if first_is_home else match.homeTeam_score)
                first_goals += first_score
                second_goals += second_score
                if first_score > second_score:
                    first_wins += 1
                elif second_score > first_score:
                    second_wins += 1
                else:
                    draws += 1
                if index < recent_limit:
                    recent.append({
                        "kickoff": match.kickoff.isoformat(),
                        "homeTeam": match.homeTeam_name,
                        "awayTeam": match.awayTeam_name,
                        "homeScore": int(match.homeTeam_score),
                        "awayScore": int(match.awayTeam_score),
                    })
            comparisons[f"{first}|||{second}"] = {
                "meetings": int(len(meetings)),
                "firstWins": first_wins,
                "draws": draws,
                "secondWins": second_wins,
                "firstGoals": first_goals,
                "secondGoals": second_goals,
                "recent": recent,
            }
    return comparisons


def _feature_importance(bundle):
    rows = {}
    for name, model in bundle.models.items():
        fitted = model
        if hasattr(model, "named_steps"):
            fitted = model.named_steps["model"]
        if hasattr(fitted, "feature_importances_"):
            values = fitted.feature_importances_
        else:
            values = np.abs(fitted.coef_).mean(axis=0)
        total = float(values.sum()) or 1.0
        rows[name] = sorted(
            [
                {"feature": feature, "importance": float(value / total)}
                for feature, value in zip(bundle.features.columns, values)
            ],
            key=lambda item: item["importance"],
            reverse=True,
        )
    return rows


parser = argparse.ArgumentParser()
parser.add_argument(
    "--history-source", choices=["matches", "snowflake"], default="matches",
    help="Use reconstructed prior-season match standings (default) or explicitly query Snowflake.",
)
parser.add_argument(
    "--regenerate-predictions",
    action="store_true",
    help="Retained for compatibility. All predictions are now regenerated in batches on every run.",
)
args = parser.parse_args()

b = train_models(history_source=args.history_source)
payload = {
    "schemaVersion": 5,
    "featureNames": MODEL_FEATURE_COLUMNS,
    "totalMatches": len(b.matches),
    "featureCount": len(b.features.columns),
    "latestSeason": b.latest_season,
    "trainingSeasons": "2008–2022",
    "testSeasons": "2023–2025",
    "teams": b.teams,
    "metrics": [
        {
            "model": r["Model"],
            "accuracy": r["Accuracy"],
            "macroF1": r["Macro F1"],
            "macroPrecision": r["Macro Precision"],
            "drawF1": r["Draw F1"],
        }
        for r in b.metrics.to_dict("records")
    ],
    "evaluationSummary": b.evaluation_summary,
    "outcomeDistribution": [
        {"outcome": key, "matches": int(value)}
        for key, value in b.matches.result.value_counts().sort_index().items()
    ],
    "recentMatches": [
        {"season": int(r.season), "kickoff": r.kickoff.isoformat(),
         "homeTeam": r.homeTeam_name, "awayTeam": r.awayTeam_name,
         "homeScore": int(r.homeTeam_score), "awayScore": int(r.awayTeam_score),
         "result": r.result}
        for r in b.matches.tail(20).itertuples()
    ],
    "provenance": b.provenance,
    "teamStats": _team_stats(b.matches, b.latest_season),
    "playersByClub": _players_by_club(b.latest_season),
    "clubPerformance": _club_performance(b.matches),
    "formByClub": _recent_form(b.matches, b.teams),
    "headToHead": _head_to_head(b.matches, b.teams),
    "seasonTrends": _season_trends(b.matches),
    "featureImportance": _feature_importance(b),
    "classMetrics": {
        model: [
            {
                "outcome": outcome,
                "precision": float(report[label]["precision"]),
                "recall": float(report[label]["recall"]),
                "f1": float(report[label]["f1-score"]),
                "support": int(report[label]["support"]),
            }
            for outcome, label in [("H", "Home Win"), ("D", "Draw"), ("A", "Away Win")]
        ]
        for model, report in b.reports.items()
    },
    "confusionMatrices": {
        model: {
            "labels": ["H", "D", "A"],
            "values": matrix.astype(int).tolist(),
        }
        for model, matrix in b.confusion_matrices.items()
    },
    "predictions": {},
}
pairs = [(home, away) for home in b.teams for away in b.teams if home != away]
prediction_features = pd.concat(
    [build_prediction_features(b, home, away) for home, away in pairs],
    ignore_index=True,
)
payload["inferenceArtifact"] = export_browser_models(b, prediction_features, OUT.parent)
for metric in payload["metrics"]:
    if abs(metric["macroPrecision"] - float(b.reports[metric["model"]]["macro avg"]["precision"])) > 1e-12:
        raise ValueError(f"{metric['model']} macro precision differs from its classification report.")
payload["predictionInputs"] = {
    f"{home}|||{away}": {key: float(value) for key, value in row.items()}
    for (home, away), row in zip(pairs, prediction_features.to_dict("records"))
}
payload["provenance"]["generated_at"] = datetime.now(timezone.utc).isoformat()
payload["provenance"]["prediction_as_of"] = b.matches.kickoff.max().isoformat()
for model_name, model in b.models.items():
    predicted = model.predict(prediction_features)
    probabilities = model.predict_proba(prediction_features)
    payload["predictions"][model_name] = {
        f"{home}|||{away}": {
            "predicted": predicted[index],
            "probabilities": [
                {"outcome": label, "probability": float(prob)}
                for label, prob in zip(model.classes_, probabilities[index])
            ],
        }
        for index, (home, away) in enumerate(pairs)
    }
write_dashboard_payload(payload, OUT)
print(
    f"Wrote {OUT} with {len(b.features.columns)} model features and "
    f"{sum(len(items) for items in payload['predictions'].values())} stored predictions"
)