# PremierPredict — Technical Evaluation Update

Replacement technical section addressing the teacher feedback dated 25 September 2026. This is a newly generated evaluation update, not an edit of the unavailable original team report.

## 1. Completed implementation and common evaluation protocol

All five models and the simple majority baseline are implemented and evaluated. The same 4,850 training matches and 1,102 held-out matches are used for every model, with 40 predictor inputs. No model is reported on a different test period.

Training: season-start years 2008–2022 (16 August 2008 to 28 May 2023). Testing: season-start years 2023–2025 (11 August 2023 to 24 May 2026). Seasons are start-year labels, so the 2025 season includes matches in 2026. This is a chronological holdout, not a random split.

Recent form, venue win rates and goals use matches strictly before the match kickoff. Historical table features use the previous season. Imputation and scaling are fitted on training rows, not the holdout. The dashboard uses fixed local model configurations; separate upstream Optuna experiments are not claimed as these results.

Holdout support is 474 Home wins, 272 Draws and 356 Away wins. Precision is correct predictions divided by predictions of that class; recall is correct predictions divided by actual examples of that class; F1 is their harmonic mean. Macro averages give each class equal weight. Undefined precision/F1 is reported as zero, matching sklearn zero_division=0.

| Model | Accuracy | Macro precision | Macro recall | Macro F1 |
| --- | --- | --- | --- | --- |
| Logistic Regression | 52.36% | 42.98% | 45.36% | 39.33% |
| Decision Tree | 41.83% | 44.23% | 42.19% | 41.66% |
| Random Forest | 49.73% | 44.19% | 45.31% | 43.96% |
| Gradient Boosting | 51.54% | 48.74% | 45.76% | 43.67% |
| XGBoost | 52.09% | 48.90% | 45.61% | 41.98% |
| Majority baseline (H) | 43.01% | 14.34% | 33.33% | 20.05% |

## 2. Each model's Home / Draw / Away results

These values are recomputed from the published confusion matrices and checked against the dashboard class metrics. Each model has identical test support; every value below is a percentage.

| Model | Outcome | Precision | Recall | F1 | Support |
| --- | --- | --- | --- | --- | --- |
| Logistic Regression | Home win | 53.82% | 78.69% | 63.92% | 474 |
| Logistic Regression | Draw | 25.00% | 0.37% | 0.72% | 272 |
| Logistic Regression | Away win | 50.12% | 57.02% | 53.35% | 356 |
| Decision Tree | Home win | 59.46% | 41.77% | 49.07% | 474 |
| Decision Tree | Draw | 26.47% | 46.32% | 33.69% | 272 |
| Decision Tree | Away win | 46.76% | 38.48% | 42.22% | 356 |
| Random Forest | Home win | 56.02% | 64.77% | 60.08% | 474 |
| Random Forest | Draw | 27.03% | 14.71% | 19.05% | 272 |
| Random Forest | Away win | 49.51% | 56.46% | 52.76% | 356 |
| Gradient Boosting | Home win | 53.12% | 75.53% | 62.37% | 474 |
| Gradient Boosting | Draw | 42.67% | 11.76% | 18.44% | 272 |
| Gradient Boosting | Away win | 50.42% | 50.00% | 50.21% | 356 |
| XGBoost | Home win | 53.24% | 78.06% | 63.30% | 474 |
| XGBoost | Draw | 42.50% | 6.25% | 10.90% | 272 |
| XGBoost | Away win | 50.95% | 52.53% | 51.73% | 356 |
| Majority baseline (H) | Home win | 43.01% | 100.00% | 60.15% | 474 |
| Majority baseline (H) | Draw | 0.00% | 0.00% | 0.00% | 272 |
| Majority baseline (H) | Away win | 0.00% | 0.00% | 0.00% | 356 |

## 3. Interpretation and reconciliation of earlier figures

Logistic Regression has the highest current accuracy, Random Forest the highest macro F1 and XGBoost the highest macro precision. Accuracy alone is insufficient: Logistic Regression correctly identifies 1 of the 272 draws. The class table makes this weakness visible instead of presenting one score as complete evidence of quality.

The comparable baseline always predicts the training-majority class (Home win), scoring 43.01% on the same holdout. The 45.18% full-dataset majority prevalence is not a comparable test score.

The feedback quotes an earlier Decision Tree accuracy of about 43.6% and a Logistic Regression screenshot of 51.8%. The original report, split and configuration for those figures are unavailable, so their experimental provenance cannot be reconciled. They must not be mixed with the current verified run. Current values are Decision Tree 41.83% and Logistic Regression 52.36%. Use this dated, fully specified evaluation consistently; label any retained older screenshots as historical.

## 4. Consistent implementation status

| Component | Current status | Evidence |
| --- | --- | --- |
| Majority baseline | Completed | Same-period score and class results above |
| Logistic Regression / Decision Tree / Random Forest | Completed | Trained parameters, predictions and holdout results |
| Gradient Boosting / XGBoost | Completed | Genuine distinct models; XGBoost exports 600 trees |
| Evaluation and dashboard | Completed | Five-model and class-level results; all models use one split |
| Player-exclusion demonstration | Completed | Reruns trained parameters; reset restores the baseline |
| Live bookmaker comparison | Implemented separately | Public ESPN upcoming fixtures and complete three-way listed prices |
| Original report revision / final submission | Not claimed | Original team report was not provided |

## 5. Limits, provenance and reproducibility

All 1,102 holdout matches have season-matched FIFA/FC ratings. The 2,218 pre-2015 training rows retain missing-rating flags and use training-only median imputation. Prior-season standings are reconstructed from checked-in match results, not queried from a live Snowflake warehouse.

The model history ends at 2026-05-24T16:00:00. Live bookmaker odds are retrieved separately for actual upcoming fixtures and are not any of the 40 model inputs. They do not retrain the models or refresh team form. Only complete Home/Draw/Away markets are compared. Decimal implied probability is 1/price; margin-normalized probability divides each implied value by their sum. This comparison is descriptive, not proof of profitable betting or a historical bookmaker benchmark. Prices have a browser retrieval timestamp; the public feed does not provide a reliable quote-update timestamp, guaranteed coverage or a streaming/SLA commitment.

Reproduce: python -m pytest tests -q; regenerate model data with python generate_dashboard_data.py; regenerate this report with python build_evaluation_report.py. The frontend live-odds parser tests run with pnpm --filter @workspace/premierpredict-dashboard exec tsx --test tests/live-odds.test.ts.

Evaluation artifact generated at 2026-10-04T06:29:56.157993+00:00. Artifact SHA-256: 925e2755c5a50fac3c260911e9e2a89bab1ec76a103d4400b8b3376d746dd5a1. Sources: checked-in PremierPredict data; https://github.com/BishalBhujel/Premier-League-Predictor (upstream source e1c12b2e6fdf554c79b1a45b3a49fff9af29b793); https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard for live fixture/odds display.
