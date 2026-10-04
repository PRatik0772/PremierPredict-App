# Season-aligned player ratings

The model uses the player-rating edition matching each Premier League season's
start year. A match in season `2023` uses FIFA 23, `2024` uses EA Sports FC 24,
and `2025` uses EA Sports FC 25. The selected snapshot must be dated before
1 August of its match season.

## Sources

- **FIFA 15 through EA Sports FC 24:** [EA Sports FC 24 Complete Player Dataset](https://www.kaggle.com/datasets/stefanoleone992/ea-sports-fc-24-complete-player-dataset), CC0. The source archive contains `male_players.csv` with `fifa_version` and `update_as_of`.
- **EA Sports FC 25:** [EA Sports FC 25 Database — Ratings and Stats](https://www.kaggle.com/datasets/nyagami/ea-sports-fc-25-database-ratings-and-stats), Apache-2.0. The source snapshot used here is dated 26 September 2024.

The builder filters each edition to the clubs actually present in that season's
match data. It does not rely on the source league label, so promoted clubs are
included when their ratings are present. Club-name variants are normalized to
the match workbook's names, and the build fails if any season from 2015–2025
does not cover all 20 match-data clubs.

| Match season | Rating edition | Snapshot date | Clubs | Player records |
| ---: | --- | --- | ---: | ---: |
| 2015 | FIFA 15 | 2014-09-18 | 20 | 651 |
| 2016 | FIFA 16 | 2015-09-21 | 20 | 616 |
| 2017 | FIFA 17 | 2016-09-20 | 20 | 677 |
| 2018 | FIFA 18 | 2017-09-18 | 20 | 671 |
| 2019 | FIFA 19 | 2018-08-21 | 20 | 675 |
| 2020 | FIFA 20 | 2019-09-19 | 20 | 677 |
| 2021 | FIFA 21 | 2020-09-23 | 20 | 677 |
| 2022 | FIFA 22 | 2021-09-23 | 20 | 646 |
| 2023 | FIFA 23 | 2022-09-26 | 20 | 654 |
| 2024 | EA Sports FC 24 | 2023-09-22 | 20 | 642 |
| 2025 | EA Sports FC 25 | 2024-09-26 | 20 | 623 |

## Unavailable early seasons

No compatible edition dataset is used for 2008–2014. Those 2,218 training
matches remain in the dataset; rating inputs stay missing and the rating
availability flags stay zero. Each model's median imputer is fitted on the
2008–2022 training rows only. No current, undated player-rating snapshot is
used to fill historical seasons.

## Rebuild

With the two source archives available locally, run:

```bash
python build_historical_ratings.py \
  --fc24-archive /path/to/fc24-archive.zip \
  --fc25-archive /path/to/fc25-archive.zip
```

This writes `premier_league_player_ratings_by_season.csv` and
`premier_league_team_ratings_by_season.csv` in this directory. The original
undated `premier_league_player_ratings.xlsx` is retained as source material but
is not part of the model pipeline.