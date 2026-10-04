"""XGBoost adapter with the same labelled probability interface as sklearn."""
from __future__ import annotations

import numpy as np
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.utils.validation import check_is_fitted
from xgboost import XGBClassifier


class OutcomeXGBoostClassifier(ClassifierMixin, BaseEstimator):
    """Encode football outcomes for XGBoost without changing probability order."""

    def fit(self, X, y):
        self.classes_ = np.asarray(["H", "D", "A"])
        labels = {label: index for index, label in enumerate(self.classes_)}
        unknown = set(y) - set(labels)
        if unknown:
            raise ValueError(f"Unknown match outcomes: {sorted(unknown)}")
        encoded = np.asarray([labels[label] for label in y], dtype=np.int32)
        self.estimator_ = XGBClassifier(
            n_estimators=200, max_depth=3, learning_rate=0.05,
            subsample=0.9, colsample_bytree=0.9, reg_lambda=1.0,
            objective="multi:softprob", num_class=3, eval_metric="mlogloss",
            tree_method="hist", base_score=0.0, random_state=42, n_jobs=2,
        )
        self.estimator_.fit(X, encoded)
        self.n_features_in_ = self.estimator_.n_features_in_
        return self

    def predict_proba(self, X):
        check_is_fitted(self, "estimator_")
        # Use XGBoost's raw margins with a float64 softmax so the browser and
        # Python expose consistently normalised probabilities, rather than
        # float32 probabilities whose sum can differ slightly from one.
        margins = self.estimator_.predict(X, output_margin=True).astype(np.float64)
        exponentials = np.exp(margins - margins.max(axis=1, keepdims=True))
        return exponentials / exponentials.sum(axis=1, keepdims=True)

    def predict(self, X):
        return self.classes_[self.predict_proba(X).argmax(axis=1)]

    @property
    def feature_importances_(self):
        check_is_fitted(self, "estimator_")
        return self.estimator_.feature_importances_