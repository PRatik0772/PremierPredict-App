import copy
import json
from pathlib import Path

import pytest

from build_evaluation_report import validated_results

PAYLOAD = Path(__file__).parents[2] / "artifacts/premierpredict-dashboard/public/data/premierpredict.json"


def payload():
    return json.loads(PAYLOAD.read_text())


def test_all_models_share_support_and_reconcile_with_confusion_matrices():
    rows, overview = validated_results(payload())
    assert len(rows) == 18
    assert len(overview) == 6
    for model in {row["model"] for row in rows}:
        selected = [row for row in rows if row["model"] == model]
        assert [row["support"] for row in selected] == [474, 272, 356]
        assert sum(row["support"] for row in selected) == 1102


def test_baseline_uses_training_majority_not_dataset_prevalence():
    rows, overview = validated_results(payload())
    baseline = overview[-1]
    assert baseline["accuracy"] == pytest.approx(474 / 1102)
    assert baseline["accuracy"] != pytest.approx(0.4517809139784946)
    assert rows[-3]["recall"] == 1
    assert rows[-2]["f1"] == rows[-1]["f1"] == 0


def test_rejects_stale_or_fabricated_class_values():
    data = copy.deepcopy(payload())
    data["classMetrics"]["Logistic Regression"][0]["precision"] = 0.9
    with pytest.raises(ValueError, match="Class metric drift"):
        validated_results(data)


def test_rejects_inconsistent_model_test_support():
    data = payload()
    data["classMetrics"]["Decision Tree"][0]["support"] = 123
    with pytest.raises(ValueError, match="same class support"):
        validated_results(data)