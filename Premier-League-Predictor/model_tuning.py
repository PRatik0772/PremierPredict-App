import optuna

from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score


def tune_logistic_regression(X_train, y_train):

    def objective(trial):

        C = trial.suggest_float(
            "C",
            0.001,
            100,
            log=True
        )

        solver = trial.suggest_categorical(
            "solver",
            ["lbfgs", "liblinear"]
        )

        class_weight = trial.suggest_categorical(
            "class_weight",
            [None, "balanced"]
        )

        model = LogisticRegression(
            C=C,
            solver=solver,
            class_weight=class_weight,
            max_iter=1000,
            random_state=42
        )

        scores = cross_val_score(
            model,
            X_train,
            y_train,
            cv=5,
            scoring="f1_weighted",
            n_jobs=-1
        )

        return scores.mean()

    study = optuna.create_study(
        direction="maximize",
        study_name="logistic_regression_tuning"
    )

    study.optimize(
        objective,
        n_trials=30
    )

    best_model = LogisticRegression(
        **study.best_params,
        max_iter=1000,
        random_state=42
    )

    best_model.fit(X_train, y_train)

    return study, best_model



def tune_decision_tree(X_train, y_train):

    from sklearn.tree import DecisionTreeClassifier
    import optuna
    from sklearn.model_selection import cross_val_score

    def objective(trial):

        criterion = trial.suggest_categorical(
            "criterion",
            ["gini", "entropy"]
        )

        max_depth = trial.suggest_int(
            "max_depth",
            3,
            20
        )

        min_samples_split = trial.suggest_int(
            "min_samples_split",
            2,
            20
        )

        min_samples_leaf = trial.suggest_int(
            "min_samples_leaf",
            1,
            10
        )

        max_features = trial.suggest_categorical(
            "max_features",
            [None, "sqrt", "log2"]
        )

        class_weight = trial.suggest_categorical(
            "class_weight",
            [None, "balanced"]
        )

        model = DecisionTreeClassifier(
            criterion=criterion,
            max_depth=max_depth,
            min_samples_split=min_samples_split,
            min_samples_leaf=min_samples_leaf,
            max_features=max_features,
            class_weight=class_weight,
            random_state=42
        )

        scores = cross_val_score(
            model,
            X_train,
            y_train,
            cv=5,
            scoring="f1_weighted",
            n_jobs=-1
        )

        return scores.mean()

    study = optuna.create_study(
        direction="maximize",
        study_name="decision_tree_tuning"
    )

    study.optimize(
        objective,
        n_trials=30
    )

    best_model = DecisionTreeClassifier(
        **study.best_params,
        random_state=42
    )

    best_model.fit(X_train, y_train)

    return study, best_model


def tune_random_forest(X_train, y_train):

    from sklearn.ensemble import RandomForestClassifier
    import optuna
    from sklearn.model_selection import cross_val_score

    def objective(trial):

        n_estimators = trial.suggest_int(
            "n_estimators",
            100,
            500,
            step=50
        )

        max_depth = trial.suggest_int(
            "max_depth",
            5,
            20
        )

        min_samples_split = trial.suggest_int(
            "min_samples_split",
            2,
            20
        )

        min_samples_leaf = trial.suggest_int(
            "min_samples_leaf",
            1,
            10
        )

        max_features = trial.suggest_categorical(
            "max_features",
            ["sqrt", "log2", None]
        )

        class_weight = trial.suggest_categorical(
            "class_weight",
            [None, "balanced", "balanced_subsample"]
        )

        model = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            min_samples_split=min_samples_split,
            min_samples_leaf=min_samples_leaf,
            max_features=max_features,
            class_weight=class_weight,
            random_state=42,
            n_jobs=-1
        )

        scores = cross_val_score(
            model,
            X_train,
            y_train,
            cv=5,
            scoring="f1_weighted",
            n_jobs=-1
        )

        return scores.mean()

    study = optuna.create_study(
        direction="maximize",
        study_name="random_forest_tuning"
    )

    study.optimize(
        objective,
        n_trials=30
    )

    best_model = RandomForestClassifier(
        **study.best_params,
        random_state=42,
        n_jobs=-1
    )

    best_model.fit(X_train, y_train)

    return study, best_model


def tune_gradient_boosting(X_train, y_train):

    from sklearn.ensemble import GradientBoostingClassifier
    import optuna
    from sklearn.model_selection import cross_val_score

    def objective(trial):

        n_estimators = trial.suggest_int(
            "n_estimators", 100, 500, step=50
        )

        learning_rate = trial.suggest_float(
            "learning_rate", 0.01, 0.3, log=True
        )

        max_depth = trial.suggest_int(
            "max_depth", 2, 10
        )

        min_samples_split = trial.suggest_int(
            "min_samples_split", 2, 20
        )

        min_samples_leaf = trial.suggest_int(
            "min_samples_leaf", 1, 10
        )

        subsample = trial.suggest_float(
            "subsample", 0.6, 1.0
        )

        model = GradientBoostingClassifier(
            n_estimators=n_estimators,
            learning_rate=learning_rate,
            max_depth=max_depth,
            min_samples_split=min_samples_split,
            min_samples_leaf=min_samples_leaf,
            subsample=subsample,
            random_state=42
        )

        scores = cross_val_score(
            model,
            X_train,
            y_train,
            cv=5,
            scoring="f1_weighted",
            n_jobs=-1
        )

        return scores.mean()

    study = optuna.create_study(
        direction="maximize",
        study_name="gradient_boosting_tuning"
    )

    study.optimize(
        objective,
        n_trials=30
    )

    best_model = GradientBoostingClassifier(
        **study.best_params,
        random_state=42
    )

    best_model.fit(X_train, y_train)

    return study, best_model