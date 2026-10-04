"""Export numeric model parameters, never pickle code, for genuine browser inference."""
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

from model_pipeline import MODEL_FEATURE_COLUMNS


def _tree(estimator, classification=False):
    tree = estimator.tree_
    values = tree.value[:, 0]
    if classification:
        values = values / values.sum(axis=1, keepdims=True)
    return {
        "left": tree.children_left.tolist(), "right": tree.children_right.tolist(),
        "feature": tree.feature.tolist(), "threshold": tree.threshold.tolist(),
        "value": values.tolist(),
    }


def _xgboost(estimator):
    learner = json.loads(estimator.estimator_.get_booster().save_raw(raw_format="json"))["learner"]
    if learner["objective"]["name"] != "multi:softprob":
        raise ValueError("Browser XGBoost requires the multiclass probability objective.")
    booster = learner["gradient_booster"]["model"]
    trees = []
    for tree in booster["trees"]:
        if any(tree["split_type"]):
            raise ValueError("Categorical XGBoost trees are not supported by browser inference.")
        trees.append({
            "left": tree["left_children"], "right": tree["right_children"],
            "feature": tree["split_indices"], "threshold": tree["split_conditions"],
            "value": [[value] for value in tree["split_conditions"]],
        })
    initial = json.loads(learner["learner_model_param"]["base_score"])
    if not isinstance(initial, list):
        initial = [initial] * len(estimator.classes_)
    return {
        "kind": "xgboost", "classes": estimator.classes_.tolist(),
        "initial": initial, "trees": trees, "classIndices": booster["tree_info"],
    }


def export_browser_models(bundle, prediction_features, output_dir):
    models = {}
    for name, model in bundle.models.items():
        estimator = model.named_steps["model"] if hasattr(model, "named_steps") else model
        if name == "Logistic Regression":
            scaler, classifier = model.named_steps["scale"], estimator
            models[name] = {
                "kind": "logistic", "classes": classifier.classes_.tolist(),
                "mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(),
                "coefficients": classifier.coef_.tolist(), "intercept": classifier.intercept_.tolist(),
            }
        elif name == "Gradient Boosting":
            models[name] = {
                "kind": "gradient", "classes": estimator.classes_.tolist(),
                "initial": estimator._raw_predict_init(prediction_features.iloc[:1].to_numpy(dtype=float))[0].tolist(),
                "learningRate": estimator.learning_rate,
                "stages": [[_tree(tree) for tree in stage] for stage in estimator.estimators_],
            }
        elif name == "XGBoost":
            models[name] = _xgboost(estimator)
        else:
            estimators = estimator.estimators_ if name == "Random Forest" else [estimator]
            models[name] = {
                "kind": "forest", "classes": estimator.classes_.tolist(),
                "trees": [_tree(tree, classification=True) for tree in estimators],
            }
    imputation_values = bundle.models["Logistic Regression"].named_steps["imputer"].statistics_.tolist()
    for model in bundle.models.values():
        values = model.named_steps["imputer"].statistics_.tolist()
        if not np.allclose(values, imputation_values):
            raise ValueError("Dashboard models were fitted with different training imputation values.")
    verification = []
    for offset in range(min(12, len(prediction_features))):
        row = prediction_features.iloc[offset].copy()
        # Include changed ratings and genuinely missing ratings, not only baselines.
        row["home_avg_rating"] = max(0, row["home_avg_rating"] - 6)
        row["home_max_rating"] = max(0, row["home_max_rating"] - 8)
        if offset % 3 == 0:
            row["away_avg_rating"] = row["away_max_rating"] = np.nan
            row["away_rating_available"] = 0
        frame = pd.DataFrame([row], columns=MODEL_FEATURE_COLUMNS)
        verification.append({
            "inputs": [None if pd.isna(value) else float(value) for value in row.tolist()],
            "probabilities": {name: model.predict_proba(frame)[0].tolist() for name, model in bundle.models.items()},
        })
    artifact = {
        "version": 3,
        "featureNames": MODEL_FEATURE_COLUMNS,
        "imputationValues": imputation_values,
        "models": models,
        "verificationCases": verification,
    }
    encoded = (json.dumps(artifact, separators=(",", ":"), allow_nan=False) + "\n").encode()
    digest = hashlib.sha256(encoded).hexdigest()
    filename = f"model-inference-{digest[:16]}.json"
    path = Path(output_dir) / filename
    if not path.exists():
        path.write_bytes(encoded)
    elif hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        raise ValueError("Existing content-addressed model artifact is corrupted.")
    return {"path": f"data/{filename}", "sha256": digest}