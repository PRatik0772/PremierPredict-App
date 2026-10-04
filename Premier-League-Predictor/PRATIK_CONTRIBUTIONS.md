# Pratik's PremierPredict contributions

This records Pratik's dashboard, integration and demonstration work. The app
builds on Bishal's upstream Premier League predictor; it does not claim that
the upstream datasets or original pipeline were created solely by Pratik.

## Dashboard and model integration

- Built the PremierPredict React dashboard with Overview, Match prediction,
  Team insights, Explore & compare, Model evaluation and Live odds.
- Integrated five genuine trained models: Logistic Regression, XGBoost,
  Gradient Boosting, Random Forest and Decision Tree.
- Added browser inference and named-player rating exclusions, with baseline
  comparison and reset. Exclusions rerun trained numeric parameters rather
  than manually shifting the probabilities.
- Added roster photos with verified identities and explicit unavailable
  fallbacks instead of guessing faces.
- Preserved a static classroom demonstration and documented reconstructed
  standings, historical rating sources and fixed model configurations.

## Latest additions

- Added key-free upcoming ESPN bookmaker markets, explicit model-club matching,
  complete home/draw/away market validation, refresh and unavailable states.
- Separated model estimates, bookmaker margin-normalized estimates and decimal
  price multipliers. Highlighted each model's most likely outcome without
  presenting it as a guaranteed result.
- Added per-class evaluation for all five models and downloadable replacement
  technical reports in Word, Markdown and CSV.
- Redesigned the matchup presentation with full-body illustrated captains on
  dimensional podiums, official club emblems, team lighting and a central VS.
- Supplied 23 club figures, including Ipswich, Coventry and Hull. Historical
  captain references are dated; illustrations are not confirmed match lineups.
- Reused the matchup stage across Live odds, Overview and Match prediction.
  Overview and Match prediction share the selected teams.
- Improved phone layouts, plain-language explanations and expandable source
  and calculation details.

## Verification and evidence

- 42 Python tests passed for the pipeline/report work.
- 10 TypeScript tests passed for odds parsing and captain asset coverage.
- Dashboard type checking and production build passed.
- Desktop and phone renders were checked for full bodies, boots, podiums and
  outcome-card readability.
- Demonstration notes and screenshots are in `evidence/2026-10-04.md` and
  `evidence/screenshots/`.

## Limits that must remain visible

The historical model boundary is 24 May 2026. Fetching bookmaker prices does
not retrain the models or update their historical inputs. Retrieval time is
not the bookmaker's quote-update time, which the public feed does not supply.
Reconstructed standings are not live Snowflake results, and the fixed local
model settings are not represented as upstream Optuna-tuned results.