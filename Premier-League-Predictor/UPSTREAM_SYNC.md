# Upstream integration

Source: BishalBhujel/Premier-League-Predictor, `main`, commit
`e1c12b2e6fdf554c79b1a45b3a49fff9af29b793`.

The upstream repository is standalone while this workspace contains multiple
products. Its changes were imported into this folder, not merged at the
workspace root. Our dashboard, configuration, and secret-based Snowflake
connector were preserved.

Imported upstream changes include current-season points, Optuna tuning routines,
the experimental AI analysis script, prediction script, updated workbooks, and
the upstream Gradient Boosting model file.

The dashboard adapter trains five models locally with fixed configurations,
including the XGBoost model named in the project brief, using a chronological
split. It does not load the upstream pickle or claim
that the displayed results are Optuna-tuned. The AI analysis script remains an
upstream experiment containing static example results; it is not connected to
the dashboard or invoked automatically.

The dashboard now uses 40 model predictors (42 upstream columns minus season
and match week). Current-season points are computed before the current match,
and totals reset each season. Prediction payloads are regenerated from the
same freshly trained models as the evaluation metrics.

Run `python generate_dashboard_data.py` from this folder to refresh the React
dashboard data. This explicitly reconstructs prior-season standings from the
checked-in match dataset; the 20-row historical workbook is not a complete
multi-season table. Ranking uses points, goal difference, goals for, and team
ID as the final tie-break, so it is not a certified official table.
Use `--history-source snowflake` to explicitly request the original live source;
it requires an active warehouse and connection values in workspace Secrets.
An unavailable Snowflake source fails rather than silently changing sources.
Run `python -m pytest tests` from this folder for adapter regression tests.

The imported experimental scripts require `optuna` and `openai-agents`, declared
in this folder's requirements. They are not required by the working dashboard.
Their installation in this workspace is currently blocked by the package
installer incorrectly assigning Optuna to the PyTorch CPU-only index.

## Dashboard evidence checks

Every refresh now publishes the exact 40-value input vector for each ordered
fixture and records generation time and the match-history boundary. The UI's
selected-driver value and inspectable input table read those actual values,
not approximations from descriptive club statistics. Match PDFs include the
input values and source metadata.

Run from this folder:

```sh
python generate_dashboard_data.py --history-source matches
python dashboard_contract.py
python -m pytest tests -q
```

The generator validates fixture/model coverage, probability arithmetic, numeric
inputs, global importance, evaluation consistency, and provenance before
atomically replacing the served JSON. Invalid refreshes preserve the previous
file instead of publishing incomplete results.

## Player-rating handoff

The dashboard now excludes named players from either squad, recomputes average
and maximum rating, and evaluates the trained models' exported numeric
parameters in the browser. The original stored result is retained as the
baseline. This replaces manual probability-point shifting for the actual
player-rating feature; it neither retrains the models nor guarantees that an
exclusion changes the winning class.

Each refresh creates a content-addressed model JSON with a SHA-256 integrity
reference in the dashboard payload. Browser tree traversal uses float32 inputs
to match scikit-learn and XGBoost; XGBoost uses strict numerical splits and
float32 margin accumulation. The regression suite compares every stored fixture and
additional modified-rating cases with Python results.

The comparison table now includes accuracy, macro F1 and macro precision.
Pratik's closing section is slides 11–13 of the existing presentation.
Team-section assembly, the assignment recording, and individual Lab 8 remain
unverified until their materials and requirements are supplied.