# Pratik — live demonstration guide

This guide covers my live-demo portion only. Slides 11–12 provide team context;
my speaking segment is the live demonstration on Slide 13.

## Slide 13: live demonstration

1. Open **Match prediction**. Select **Arsenal** at home,
   **Manchester United** away, and **Gradient Boosting**.
2. Read the baseline home/draw/away probabilities and show the exact input values.
3. Scroll to **Player rating scenario**. Exclude **Bukayo Saka** at home and
   **Bruno Fernandes** away. This matches Bishal’s example of
   removing a player from both squads. Show the remaining counts and ratings.
4. In the season-matched FC25 scenario, **home win changes from 55.4% to 58.5%**,
   draw from **35.6% to 33.1%**, and away win from **9.0% to 8.4%**. The most
   likely outcome remains a home win.
5. Explain that excluding Bruno alone leaves the Gradient Boosting result
   unchanged; excluding Saka causes the full shift. These are probabilities
   from rerunning trained parameters, not a manual adjustment.
6. Click **Reset** and show that the baseline probabilities are restored.
7. Select **XGBoost** in the model buttons to show the additional trained model.
   It also supports the same player-removal scenario and reset.
8. Open **Model evaluation**, then show the five-model table containing
   **accuracy, macro F1, and macro precision**.
9. If the existing match PDF comes up, explain that it is the **baseline**
   report, not a report of the temporary roster scenario.
10. In **Model evaluation**, show the consolidated Home/Draw/Away precision,
    recall, F1 and support table for all five models. The downloadable evaluation
    update documents the same test period and separates current verified scores
    from the unreconciled figures in the earlier teacher feedback.
11. Open **Live odds**. Choose an actual upcoming fixture, a bookmaker and a
    model. Compare decimal prices and margin-normalized bookmaker probabilities
    with model probabilities. Use **Refetch** to request the latest listed prices.
    If the source has no complete market or the model does not cover a club,
    show the unavailable message rather than choosing a substitute team.
12. Show the full-body captain-versus podium banner in Live odds, Overview and
    Match prediction. Team selections update the figures and club emblems.
    These are illustrated club-captain references, not confirmed matchday lineups.
    The outcome cards separate the model's percentage estimate from the
    bookmaker's normalized estimate and decimal price multiplier.

## Evaluation facts for the live demo

All five models use the same 1,102 held-out matches from 2023–2025; training
uses 4,850 matches from 2008–2022. Logistic Regression leads accuracy at 52.36%;
Random Forest leads macro F1 at 43.96%; XGBoost leads macro precision
at 48.90% and scores 52.09% accuracy. The comparable baseline always predicts Home, the training-majority
class, and scores 43.01% on the holdout. The 45.18% full-dataset home-win rate
is outcome prevalence, not a test baseline. Test support is 474 home wins,
272 draws, and 356 away wins.

## Closing sentence

“The browser inference matched Python across 1,960 model results, including
changed-rating cases. This makes the teammate handoff testable in the web app
instead of only visible in a Python script.”

## Honest limits to mention

- These are locally retrained, fixed configurations. Do not call these results
  Bishal’s Optuna-tuned results.
- Previous-season standings are reconstructed from the checked-in matches;
  the demo is not querying an active Snowflake warehouse.
- Each match season uses its matching FIFA/FC edition snapshot for 2015–2025.
  Ratings are unavailable for 2008–2014; those rows remain in training with
  missing rating values, imputed by medians learned on training rows only.
- The history boundary is **24 May 2026**. The test labels **2023–2025** refer
  to season-start years, not a claim that all match dates precede 2026.
- The ratings are a static squad snapshot. Exclusion is sensitivity analysis,
  not a confirmed match lineup or proof of a causal injury effect.
- The model is not retrained when a checkbox changes.
- Live odds come from ESPN's public feed, currently DraftKings. The timestamp
  records browser retrieval, not the bookmaker's quote update. Coverage is
  limited and prices are not streamed. Models still use history ending on
  24 May 2026; odds do not refresh model inputs or prove betting profitability.

## Scope

My assigned presentation portion is the live demonstration. Recording, Lab 8,
and final submission packaging are outside this work.