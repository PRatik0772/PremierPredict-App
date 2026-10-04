"""Validate generated dashboard evidence before replacing the served payload."""
from __future__ import annotations

import argparse
import json
import math
import os
from datetime import datetime
from pathlib import Path
from tempfile import NamedTemporaryFile

from model_pipeline import MODEL_FEATURE_COLUMNS

MODEL_NAMES = {"Logistic Regression", "Decision Tree", "Random Forest", "Gradient Boosting", "XGBoost"}
OUTCOMES = {"H", "D", "A"}
DEFAULT_PATH = Path(__file__).parents[1] / "artifacts/premierpredict-dashboard/public/data/premierpredict.json"


def _require(condition, message):
    if not condition:
        raise ValueError(f"Dashboard payload: {message}")


def _number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_dashboard_payload(payload):
    _require(payload.get("schemaVersion") == 5, "unsupported schema version")
    artifact = payload.get("inferenceArtifact", {})
    _require(isinstance(artifact.get("path"), str) and artifact["path"].startswith("data/model-inference-"), "missing model artifact")
    _require(isinstance(artifact.get("sha256"), str) and len(artifact["sha256"]) == 64 and all(c in "0123456789abcdef" for c in artifact["sha256"]), "invalid model artifact digest")
    _require(artifact["path"] == f"data/model-inference-{artifact['sha256'][:16]}.json", "model artifact path and digest differ")
    _require(payload.get("featureCount") == len(MODEL_FEATURE_COLUMNS), "incorrect feature count")
    _require(payload.get("featureNames") == MODEL_FEATURE_COLUMNS, "feature contract differs")
    teams = payload.get("teams", [])
    _require(len(teams) >= 2 and len(set(teams)) == len(teams), "invalid team list")
    fixtures = {f"{home}|||{away}" for home in teams for away in teams if home != away}
    inputs = payload.get("predictionInputs", {})
    _require(set(inputs) == fixtures, "fixture input coverage is incomplete")
    for fixture, row in inputs.items():
        _require(set(row) == set(MODEL_FEATURE_COLUMNS), f"{fixture}: incorrect input keys")
        _require(all(_number(v) for v in row.values()), f"{fixture}: non-finite input")
        _require(math.isclose(row["current_points_diff"], row["home_current_points"] - row["away_current_points"]), f"{fixture}: inconsistent points difference")

    provenance = payload.get("provenance", {})
    for key in ["repository", "source_commit", "historical_standings_source",
                "training_split", "test_split", "model_configuration",
                "ratings_source", "ratings_seasons", "ratings_method",
                "generated_at", "prediction_as_of"]:
        _require(isinstance(provenance.get(key), str) and bool(provenance[key]), f"missing provenance: {key}")
    for key in ["generated_at", "prediction_as_of"]:
        try:
            datetime.fromisoformat(provenance[key])
        except ValueError as exc:
            raise ValueError(f"Dashboard payload: invalid date: {key}") from exc

    metrics = payload.get("metrics", [])
    _require(len(metrics) == len(MODEL_NAMES) and {m["model"] for m in metrics} == MODEL_NAMES, "model metrics are incomplete or duplicated")
    _require(set(payload.get("predictions", {})) == MODEL_NAMES, "prediction model coverage differs")
    for field in ["featureImportance", "confusionMatrices", "classMetrics"]:
        _require(set(payload.get(field, {})) == MODEL_NAMES, f"{field}: model coverage differs")
    evaluation_sizes = set()
    summary = payload.get("evaluationSummary", {})
    _require(summary.get("validUniqueMatches") == payload.get("totalMatches"), "unique match count differs")
    for key in ["validUniqueMatches", "trainMatches", "testMatches", "ratedMatchCount", "ratedTestMatchCount", "imputedPre2015MatchCount"]:
        _require(
            isinstance(summary.get(key), int) and not isinstance(summary.get(key), bool) and summary[key] >= 0,
            f"invalid evaluation count: {key}",
        )
    _require(summary.get("testMatches", 0) > 0, "empty test period")
    _require(
        summary.get("trainMatches", 0) + summary.get("testMatches", 0) == payload.get("totalMatches"),
        "training and test match counts do not sum to the dataset total",
    )
    _require(
        summary.get("ratedTestMatchCount") == summary.get("testMatches"),
        "held-out matches do not all have season-specific ratings",
    )
    _require(summary["ratedMatchCount"] <= payload.get("totalMatches", 0), "invalid season-specific rating coverage")
    counts = summary.get("outcomeCounts", {})
    _require(set(counts) == {"all", "train", "test"}, "missing outcome count scope")
    for scope, expected in [
        ("all", payload.get("totalMatches")),
        ("train", summary.get("trainMatches")),
        ("test", summary.get("testMatches")),
    ]:
        _require(set(counts[scope]) == OUTCOMES, f"{scope}: incomplete outcome counts")
        _require(
            all(isinstance(value, int) and not isinstance(value, bool) and value >= 0 for value in counts[scope].values()),
            f"{scope}: invalid outcome counts",
        )
        _require(sum(counts[scope].values()) == expected, f"{scope}: outcome counts do not sum")
    baseline_class = summary.get("trainingMajorityOutcome")
    _require(baseline_class in OUTCOMES, "invalid training-majority baseline class")
    expected_baseline = counts["test"][baseline_class] / summary["testMatches"]
    _require(
        _number(summary.get("holdoutMajorityBaselineAccuracy"))
        and math.isclose(summary["holdoutMajorityBaselineAccuracy"], expected_baseline, abs_tol=1e-9),
        "holdout majority-class baseline differs from test counts",
    )
    dataset_class = summary.get("datasetMajorityOutcome")
    _require(dataset_class in OUTCOMES, "invalid dataset-majority class")
    expected_dataset_baseline = counts["all"][dataset_class] / summary["validUniqueMatches"]
    _require(
        _number(summary.get("datasetMajorityBaselineAccuracy"))
        and math.isclose(summary["datasetMajorityBaselineAccuracy"], expected_dataset_baseline, abs_tol=1e-9),
        "dataset majority-class baseline differs from match counts",
    )
    distribution = {item["outcome"]: item["matches"] for item in payload.get("outcomeDistribution", [])}
    _require(distribution == counts["all"], "full-dataset outcome distribution differs")
    for metric in metrics:
        name = metric["model"]
        for field in ["accuracy", "macroF1", "macroPrecision", "drawF1"]:
            _require(_number(metric.get(field)) and 0 <= metric[field] <= 1, f"{name}: invalid {field}")
        predictions = payload["predictions"][name]
        _require(set(predictions) == fixtures, f"{name}: prediction coverage is incomplete")
        for fixture, prediction in predictions.items():
            probabilities = prediction.get("probabilities", [])
            _require(len(probabilities) == 3 and {p["outcome"] for p in probabilities} == OUTCOMES, f"{name}/{fixture}: invalid outcome classes")
            _require(all(_number(p["probability"]) and 0 <= p["probability"] <= 1 for p in probabilities), f"{name}/{fixture}: invalid probability")
            _require(math.isclose(sum(p["probability"] for p in probabilities), 1, abs_tol=1e-9), f"{name}/{fixture}: probabilities do not sum to one")
            scores = {p["outcome"]: p["probability"] for p in probabilities}
            predicted = prediction.get("predicted")
            _require(predicted in scores and math.isclose(scores[predicted], max(scores.values()), abs_tol=1e-9), f"{name}/{fixture}: predicted class conflicts with probabilities")

        importance = payload.get("featureImportance", {}).get(name, [])
        _require(len(importance) == len(MODEL_FEATURE_COLUMNS) and {f["feature"] for f in importance} == set(MODEL_FEATURE_COLUMNS), f"{name}: feature importance differs")
        _require(all(_number(f["importance"]) and 0 <= f["importance"] <= 1 for f in importance), f"{name}: invalid feature importance")
        _require(math.isclose(sum(f["importance"] for f in importance), 1, abs_tol=1e-6), f"{name}: importance is not normalised")

        confusion = payload.get("confusionMatrices", {}).get(name, {})
        labels, matrix = confusion.get("labels", []), confusion.get("values", [])
        _require(len(labels) == 3 and set(labels) == OUTCOMES, f"{name}: invalid matrix labels")
        _require(len(matrix) == 3 and all(len(row) == 3 for row in matrix), f"{name}: invalid confusion matrix")
        _require(all(isinstance(v, int) and not isinstance(v, bool) and v >= 0 for row in matrix for v in row), f"{name}: invalid confusion counts")
        total = sum(sum(row) for row in matrix)
        _require(total > 0, f"{name}: empty evaluation")
        evaluation_sizes.add(total)
        _require(math.isclose(metric["accuracy"], sum(matrix[i][i] for i in range(3)) / total, abs_tol=1e-6), f"{name}: accuracy differs from matrix")
        classes = payload.get("classMetrics", {}).get(name, [])
        _require(len(classes) == 3 and {c["outcome"] for c in classes} == OUTCOMES, f"{name}: missing class metrics")
        for index, label in enumerate(labels):
            c = next(c for c in classes if c["outcome"] == label)
            _require(c["support"] == sum(matrix[index]), f"{name}: support differs from matrix")
            _require(c["support"] == counts["test"][label], f"{name}: class support differs from common test set")
            for field in ["precision", "recall", "f1"]:
                _require(_number(c[field]) and 0 <= c[field] <= 1, f"{name}: invalid class {field}")
            positives = sum(row[index] for row in matrix)
            support = sum(matrix[index])
            precision = matrix[index][index] / positives if positives else 0
            recall = matrix[index][index] / support if support else 0
            f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
            for field, expected in [("precision", precision), ("recall", recall), ("f1", f1)]:
                _require(math.isclose(c[field], expected, abs_tol=1e-6), f"{name}: class {field} differs from matrix")
        _require(math.isclose(metric["macroF1"], sum(c["f1"] for c in classes) / 3, abs_tol=1e-6), f"{name}: macro F1 differs")
        _require(math.isclose(metric["macroPrecision"], sum(c["precision"] for c in classes) / 3, abs_tol=1e-6), f"{name}: macro precision differs")
        _require(math.isclose(metric["drawF1"], next(c["f1"] for c in classes if c["outcome"] == "D"), abs_tol=1e-6), f"{name}: draw F1 differs")
    _require(len(evaluation_sizes) == 1, "models used different evaluation sample counts")


def write_dashboard_payload(payload, path=DEFAULT_PATH):
    """Keep the previous valid file intact if validation or serialization fails."""
    validate_dashboard_payload(payload)
    text = json.dumps(payload, indent=2, allow_nan=False) + "\n"
    path = Path(path)
    temporary = None
    try:
        with NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, prefix=".premierpredict-", suffix=".json", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", type=Path, default=DEFAULT_PATH)
    args = parser.parse_args()
    validate_dashboard_payload(json.loads(args.path.read_text()))
    print(f"Validated dashboard evidence: {args.path}")