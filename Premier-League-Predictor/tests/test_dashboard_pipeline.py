import sys
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).parents[1]))
import model_pipeline as pipeline


@pytest.fixture
def feature_fixture(monkeypatch):
    history = pd.DataFrame([
        {"season": season, "team_id": team, **{key: 0 for key in pipeline.HISTORY_FEATURES}}
        for season in [2020, 2021] for team in [1, 2]
    ])
    ratings = pd.DataFrame([
        {"season": 2020, "team_name": "One", "avg_rating": 80, "max_rating": 90},
        {"season": 2020, "team_name": "Two", "avg_rating": 75, "max_rating": 85},
        {"season": 2021, "team_name": "One", "avg_rating": 82, "max_rating": 92},
        {"season": 2021, "team_name": "Two", "avg_rating": 77, "max_rating": 87},
    ])
    monkeypatch.setattr(pipeline, "_history", lambda *_: history)
    monkeypatch.setattr(pipeline, "_ratings", lambda: ratings)
    return pd.DataFrame([
        {"season": 2020, "matchWeek": 1, "kickoff": pd.Timestamp("2020-01-01"), "homeTeam_id": 1, "awayTeam_id": 2, "homeTeam_name": "One", "awayTeam_name": "Two", "homeTeam_score": 3, "awayTeam_score": 0},
        {"season": 2020, "matchWeek": 2, "kickoff": pd.Timestamp("2020-01-02"), "homeTeam_id": 2, "awayTeam_id": 1, "homeTeam_name": "Two", "awayTeam_name": "One", "homeTeam_score": 1, "awayTeam_score": 1},
        {"season": 2021, "matchWeek": 1, "kickoff": pd.Timestamp("2021-01-01"), "homeTeam_id": 1, "awayTeam_id": 2, "homeTeam_name": "One", "awayTeam_name": "Two", "homeTeam_score": 0, "awayTeam_score": 2},
    ])


def test_points_are_pre_match_and_reset_per_season(feature_fixture):
    table, states = pipeline.build_feature_table(feature_fixture)
    assert table.home_current_points.tolist() == [0, 0, 0]
    assert table.away_current_points.tolist() == [0, 3, 0]
    assert table.current_points_diff.tolist() == [0, -3, 0]
    assert states["One"]["current_points"] == 0
    assert states["Two"]["current_points"] == 3


def test_current_outcome_does_not_affect_its_predictors(feature_fixture):
    original, _ = pipeline.build_feature_table(feature_fixture)
    changed = feature_fixture.copy()
    changed.loc[0, ["homeTeam_score", "awayTeam_score"]] = [0, 4]
    updated, _ = pipeline.build_feature_table(changed)
    pd.testing.assert_series_equal(original.iloc[0], updated.iloc[0])
    assert updated.iloc[1].home_current_points == 3


def test_team_ratings_are_matched_to_their_season(feature_fixture):
    table, _ = pipeline.build_feature_table(feature_fixture)
    assert table.iloc[0].home_avg_rating == 80
    assert table.iloc[2].home_avg_rating == 82
    assert table.iloc[0].home_rating_available == 1
    assert table.iloc[2].home_rating_available == 1


def test_missing_season_rating_stays_missing(feature_fixture, monkeypatch):
    ratings = pd.DataFrame([
        {"season": 2021, "team_name": "One", "avg_rating": 82, "max_rating": 92},
        {"season": 2021, "team_name": "Two", "avg_rating": 77, "max_rating": 87},
    ])
    monkeypatch.setattr(pipeline, "_ratings", lambda: ratings)
    table, _ = pipeline.build_feature_table(feature_fixture)
    assert pd.isna(table.iloc[0].home_avg_rating)
    assert table.iloc[0].home_rating_available == 0


def test_prediction_uses_cached_latest_states(feature_fixture, monkeypatch):
    _, states = pipeline.build_feature_table(feature_fixture)
    bundle = SimpleNamespace(latest_season=2021, latest_states=states)
    monkeypatch.setattr(pipeline, "_history", lambda *_: pytest.fail("Prediction re-queried Snowflake"))
    row = pipeline.build_prediction_features(bundle, "One", "Two")
    assert list(row.columns) == pipeline.MODEL_FEATURE_COLUMNS
    assert len(row.columns) == 40
    assert row.iloc[0].away_current_points == 3
    with pytest.raises(ValueError):
        pipeline.build_prediction_features(bundle, "One", "One")
    with pytest.raises(ValueError):
        pipeline.build_prediction_features(bundle, "Unknown", "Two")


def test_dashboard_models_include_the_assignment_xgboost_model():
    assert set(pipeline._build_models()) == {
        "Logistic Regression", "Decision Tree", "Random Forest", "Gradient Boosting", "XGBoost"
    }


def test_xgboost_preserves_outcome_labels_and_training_imputation():
    import numpy as np

    train_x = pd.DataFrame(0.0, index=range(12), columns=pipeline.MODEL_FEATURE_COLUMNS)
    train_x["home_avg_rating"] = [70.0, np.nan, 80.0, 90.0] * 3
    labels = ["H", "D", "A"] * 4
    model = pipeline._build_models()["XGBoost"]
    model.fit(train_x, labels)
    assert model.classes_.tolist() == ["H", "D", "A"]
    probabilities = model.predict_proba(train_x)
    np.testing.assert_allclose(probabilities.sum(axis=1), 1.0, atol=1e-12)
    assert set(model.predict(train_x)) <= {"H", "D", "A"}
    index = pipeline.MODEL_FEATURE_COLUMNS.index("home_avg_rating")
    assert model.named_steps["imputer"].statistics_[index] == 80.0
    assert len(model.named_steps["model"].feature_importances_) == 40


def test_rating_imputation_is_learned_from_training_rows_only():
    import numpy as np

    train_x = pd.DataFrame(0.0, index=range(4), columns=pipeline.MODEL_FEATURE_COLUMNS)
    train_x["home_avg_rating"] = [70.0, np.nan, 80.0, 90.0]
    model = pipeline._build_models()["Decision Tree"]
    model.fit(train_x, ["H", "D", "A", "H"])
    index = pipeline.MODEL_FEATURE_COLUMNS.index("home_avg_rating")
    assert model.named_steps["imputer"].statistics_[index] == 80.0


def test_reconstructed_standings_apply_only_to_next_season(feature_fixture):
    history = pipeline._standings_from_matches(feature_fixture)
    assert 2020 not in history.season.tolist()
    previous = history[history.season == 2021].set_index("team_id")
    assert previous.loc[1, "previous_points"] == 4
    assert previous.loc[2, "previous_points"] == 1
    assert previous.loc[1, "previous_position"] == 1


def test_recent_goals_are_sums_and_win_rates_are_venue_specific(feature_fixture):
    date = pd.Timestamp("2020-01-03")
    points, scored, conceded, _ = pipeline._prior_form(feature_fixture, 1, 2020, date)
    assert (points, scored, conceded) == (4, 4, 1)
    assert pipeline._venue_win_rate(feature_fixture, 1, 2020, date, True) == 1
    assert pipeline._venue_win_rate(feature_fixture, 1, 2020, date, False) == 0


def test_current_season_result_cannot_change_previous_standings(feature_fixture, monkeypatch):
    monkeypatch.setattr(pipeline, "_history", lambda matches, _: pipeline._standings_from_matches(matches))
    original, _ = pipeline.build_feature_table(feature_fixture)
    changed = feature_fixture.copy()
    changed.loc[2, ["homeTeam_score", "awayTeam_score"]] = [9, 0]
    updated, _ = pipeline.build_feature_table(changed)
    pd.testing.assert_series_equal(original.iloc[2], updated.iloc[2])