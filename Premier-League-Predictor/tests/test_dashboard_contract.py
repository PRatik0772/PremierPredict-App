import copy
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1]))
from dashboard_contract import DEFAULT_PATH, MODEL_NAMES, validate_dashboard_payload, write_dashboard_payload
from model_pipeline import MODEL_FEATURE_COLUMNS


@pytest.fixture
def payload():
    fixtures = ["One|||Two", "Two|||One"]
    classes = ["H", "D", "A"]
    return {
        "schemaVersion": 5,
        "inferenceArtifact": {"path": "data/model-inference-0000000000000000.json", "sha256": "0" * 64},
        "totalMatches": 4,
        "featureCount": 40,
        "featureNames": MODEL_FEATURE_COLUMNS,
        "teams": ["One", "Two"],
        "predictionInputs": {fixture: {key: 0 for key in MODEL_FEATURE_COLUMNS} for fixture in fixtures},
        "provenance": {
            "repository": "https://example.com/project", "source_commit": "test",
            "historical_standings_source": "Synthetic test data",
            "training_split": "Training only", "test_split": "Held out",
            "model_configuration": "Test configuration",
            "ratings_source": "Test source", "ratings_seasons": "2015–2025",
            "ratings_method": "Season-specific test ratings.",
            "generated_at": "2026-10-04T00:00:00+00:00",
            "prediction_as_of": "2026-05-17T00:00:00",
        },
        "evaluationSummary": {
            "validUniqueMatches": 4, "trainMatches": 1, "testMatches": 3,
            "outcomeCounts": {
                "all": {"H": 2, "D": 1, "A": 1},
                "train": {"H": 1, "D": 0, "A": 0},
                "test": {"H": 1, "D": 1, "A": 1},
            },
            "trainingMajorityOutcome": "H",
            "holdoutMajorityBaselineAccuracy": 1 / 3,
            "datasetMajorityOutcome": "H",
            "datasetMajorityBaselineAccuracy": 0.5,
            "ratedMatchCount": 3, "ratedTestMatchCount": 3,
            "imputedPre2015MatchCount": 0,
        },
        "outcomeDistribution": [
            {"outcome": "H", "matches": 2},
            {"outcome": "D", "matches": 1},
            {"outcome": "A", "matches": 1},
        ],
        "metrics": [{"model": model, "accuracy": 1, "macroF1": 1, "macroPrecision": 1, "drawF1": 1} for model in MODEL_NAMES],
        "predictions": {
            model: {fixture: {"predicted": "H", "probabilities": [
                {"outcome": outcome, "probability": value}
                for outcome, value in zip(classes, [0.6, 0.25, 0.15])
            ]} for fixture in fixtures} for model in MODEL_NAMES
        },
        "featureImportance": {
            model: [{"feature": key, "importance": 1 / 40} for key in MODEL_FEATURE_COLUMNS] for model in MODEL_NAMES
        },
        "confusionMatrices": {model: {"labels": classes, "values": [[1, 0, 0], [0, 1, 0], [0, 0, 1]]} for model in MODEL_NAMES},
        "classMetrics": {model: [{"outcome": outcome, "precision": 1, "recall": 1, "f1": 1, "support": 1} for outcome in classes] for model in MODEL_NAMES},
    }


def test_valid_contract(payload):
    validate_dashboard_payload(payload)


@pytest.mark.parametrize("corruption", [
    "schema", "missing_model", "missing_fixture", "missing_input", "nan_input",
    "infinite_probability", "probability_sum", "wrong_prediction", "duplicate_class",
    "wrong_accuracy", "wrong_macro_f1", "wrong_support", "negative_matrix",
    "missing_importance", "missing_source", "points_difference", "wrong_precision",
    "wrong_baseline", "wrong_outcome_distribution",
])
def test_rejects_corrupted_evidence(payload, corruption):
    model, fixture = "Gradient Boosting", "One|||Two"
    prediction = payload["predictions"][model][fixture]
    if corruption == "schema":
        payload["schemaVersion"] = 1
    elif corruption == "missing_model":
        del payload["predictions"][model]
    elif corruption == "missing_fixture":
        del payload["predictions"][model][fixture]
    elif corruption == "missing_input":
        payload["predictionInputs"][fixture].pop(MODEL_FEATURE_COLUMNS[0])
    elif corruption == "nan_input":
        payload["predictionInputs"][fixture][MODEL_FEATURE_COLUMNS[0]] = float("nan")
    elif corruption == "infinite_probability":
        prediction["probabilities"][0]["probability"] = float("inf")
    elif corruption == "probability_sum":
        prediction["probabilities"][0]["probability"] = 0.5
    elif corruption == "wrong_prediction":
        prediction["predicted"] = "A"
    elif corruption == "duplicate_class":
        prediction["probabilities"][1]["outcome"] = "H"
    elif corruption == "wrong_accuracy":
        payload["metrics"][0]["accuracy"] = 0.5
    elif corruption == "wrong_macro_f1":
        payload["metrics"][0]["macroF1"] = 0.5
    elif corruption == "wrong_support":
        payload["classMetrics"][model][0]["support"] = 20
    elif corruption == "negative_matrix":
        payload["confusionMatrices"][model]["values"][0][0] = -1
    elif corruption == "missing_importance":
        payload["featureImportance"][model].pop()
    elif corruption == "missing_source":
        payload["provenance"].pop("historical_standings_source")
    elif corruption == "points_difference":
        payload["predictionInputs"][fixture]["current_points_diff"] = 4
    elif corruption == "wrong_precision":
        payload["classMetrics"][model][0]["precision"] = 0.5
    elif corruption == "wrong_baseline":
        payload["evaluationSummary"]["holdoutMajorityBaselineAccuracy"] = 0.7
    elif corruption == "wrong_outcome_distribution":
        payload["outcomeDistribution"][0]["matches"] = 99
    with pytest.raises(ValueError, match="Dashboard payload"):
        validate_dashboard_payload(payload)


def test_invalid_refresh_preserves_previous_file(payload, tmp_path):
    path = tmp_path / "data.json"
    path.write_text("previous valid evidence")
    invalid = copy.deepcopy(payload)
    invalid["featureCount"] = 37
    with pytest.raises(ValueError):
        write_dashboard_payload(invalid, path)
    assert path.read_text() == "previous valid evidence"
    assert list(tmp_path.iterdir()) == [path]


def test_atomic_valid_refresh(payload, tmp_path):
    path = tmp_path / "data.json"
    write_dashboard_payload(payload, path)
    validate_dashboard_payload(json.loads(path.read_text()))
    assert list(tmp_path.iterdir()) == [path]


def test_real_dashboard_evidence():
    validate_dashboard_payload(json.loads(DEFAULT_PATH.read_text()))