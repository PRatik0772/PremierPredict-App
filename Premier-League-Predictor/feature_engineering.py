# importing all the necessary libraries
import pandas as pd
from snowflake_connector import snowflake_connector_init
import matplotlib.pyplot as plt
from library import get_match_result, calculate_form_points, calculate_away_win_rate, calculate_home_win_rate,calculate_recent_goals,read_dataset
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.ensemble import RandomForestClassifier


datasets = read_dataset()
epl_results = datasets["EPL Results"]
player_ratings = datasets["Player Ratings"]


# reading all the necessary data structures and first 3 rows of the datasets
for name, df in datasets.items():
    print("\n" + "=" * 60)
    print(name)
    print("=" * 60)

    # printing the shapr of the datasets
    print("Shape:", df.shape)
    print("\nColumns:")

    # printing the column names so that it will be easier for furthur analysis
    print(df.columns.tolist())

    # printing the first 3 rows of the datasets
    print("\nFirst 3 rows:")
    print(df.head(3))

    # finding the missing values for every columns in the datasets
    print("\nMissing values:")
    print(df.isnull().sum())

epl_results.info()
epl_results.describe(include="all")

# Passing every rows of the result dataset to get the total home win, away win and draws
epl_results["match_result"] = epl_results.apply(
    get_match_result,
    axis=1
)

# printing the first 10 rows of the updated dataframe to see if the new column is populated properly or not
print(epl_results[
    [
        "homeTeam_name",
        "homeTeam_score",
        "awayTeam_name",
        "awayTeam_score",
        "match_result"
    ]
].head(10))

# determining the total number of home wins, away wins and draws
print(epl_results["match_result"].value_counts())


# converting kickoff column data into datetime format
epl_results["kickoff"] = pd.to_datetime(
    epl_results["kickoff"],
    errors="coerce"
)

print(epl_results["kickoff"].dtype)

# Detemininf total na values in kickoff column 
print(epl_results["kickoff"].isna().sum())
epl_results = epl_results.sort_values(
    "kickoff"
).reset_index(drop=True)

# printing the first and last match of the datasets from our historical match table
print("First match:", epl_results["kickoff"].min())
print("Last match:", epl_results["kickoff"].max())

# printing the sample data for furthur analysis
print(epl_results[
    [
        "season",
        "matchWeek",
        "kickoff",
        "homeTeam_name",
        "awayTeam_name",
        "homeTeam_score",
        "awayTeam_score",
        "match_result"
    ]
].head(10))



# initializing the snowflake connection
con = snowflake_connector_init()


# query to retrieve historical data from snowflake
query = """
SELECT *
FROM HISTORICAL_TEAM_PERFORMANCE
ORDER BY SEASON, POSITION
"""

# fetching all the historical data from snowflake
historical_team_performance = con.cursor().execute(query).fetch_pandas_all()
# print(historical_team_performance)

# Determining the shape, columns of the table 
print(historical_team_performance.shape)
print(historical_team_performance.head())
print(historical_team_performance.columns.tolist())


# creating a new data frame for furthur feature development
historical_features = historical_team_performance.copy()

# renaming the columns name as a part of feature engineering
historical_features = historical_features.rename(columns={
    "SEASON": "previous_season",
    "TEAM_ID": "team_id",
    "TEAM_KEY": "team_key",
    "TEAM_NAME": "team_name",
    "POSITION": "previous_position",
    "POINTS": "previous_points",
    "WON": "previous_wins",
    "DRAWN": "previous_draws",
    "LOST": "previous_losses",
    "GOALS_FOR": "previous_goals_for",
    "GOALS_AGAINST": "previous_goals_against"
})


# Determining the goal difference 
historical_features["previous_goal_difference"] = (
    historical_features["previous_goals_for"]
    - historical_features["previous_goals_against"]
)

# creating a new feature previous year by subtracting the current season by 1
historical_features["season"] = (
    historical_features["previous_season"] + 1
)

# printing the top 20 results from the above developed features
print(
    historical_features[
        [
            "previous_season",
            "season",
            "team_id",
            "team_key",
            "team_name",
            "previous_position",
            "previous_points",
            "previous_goal_difference"
        ]
    ].head(20)
)

# printing the shap of the above feature created
print(historical_features.shape)


# creating new features for home results as done above
home_history = historical_features[
    [
        "season",
        "team_id",
        "previous_position",
        "previous_points",
        "previous_wins",
        "previous_draws",
        "previous_losses",
        "previous_goals_for",
        "previous_goals_against",
        "previous_goal_difference"
    ]
].copy()


# Renaming the columns for furthur ease
home_history = home_history.rename(columns={
    "team_id": "homeTeam_id",
    "previous_position": "home_previous_position",
    "previous_points": "home_previous_points",
    "previous_wins": "home_previous_wins",
    "previous_draws": "home_previous_draws",
    "previous_losses": "home_previous_losses",
    "previous_goals_for": "home_previous_goals_for",
    "previous_goals_against": "home_previous_goals_against",
    "previous_goal_difference": "home_previous_goal_difference"
})

# merging all the records based on the year for every team
# this is done since our records has multiple tables based on match location i.e home, away and overall
epl_features = epl_results.merge(
    home_history,
    on=["season", "homeTeam_id"],
    how="left"
)

away_history = historical_features[
    [
        "season",
        "team_id",
        "previous_position",
        "previous_points",
        "previous_wins",
        "previous_draws",
        "previous_losses",
        "previous_goals_for",
        "previous_goals_against",
        "previous_goal_difference"
    ]
].copy()


# creating new features for away results as done above
away_history = away_history.rename(columns={
    "team_id": "awayTeam_id",
    "previous_position": "away_previous_position",
    "previous_points": "away_previous_points",
    "previous_wins": "away_previous_wins",
    "previous_draws": "away_previous_draws",
    "previous_losses": "away_previous_losses",
    "previous_goals_for": "away_previous_goals_for",
    "previous_goals_against": "away_previous_goals_against",
    "previous_goal_difference": "away_previous_goal_difference"
})

epl_features = epl_features.merge(
    away_history,
    on=["season", "awayTeam_id"],
    how="left"
)

print(
    epl_features[
        [
            "season",
            "homeTeam_name",
            "awayTeam_name",
            "home_previous_points",
            "away_previous_points",
            "home_previous_position",
            "away_previous_position"
        ]
    ].head(20)
)



test_match = epl_results.iloc[100]

print("Match:")
print(test_match["homeTeam_name"], "vs", test_match["awayTeam_name"])



#####################################
# Calculating the team form
#####################################
home_form = calculate_form_points(
    test_match["homeTeam_id"],
    test_match["season"],
    test_match["kickoff"],
    epl_results
)

away_form = calculate_form_points(
    test_match["awayTeam_id"],
    test_match["season"],
    test_match["kickoff"],
    epl_results
)

print("Home form:", home_form)
print("Away form:", away_form)


# Taking the last 5 matches before the match we are predicting for home team
team_id = test_match["homeTeam_id"]
match_date = test_match["kickoff"]

previous_matches = epl_results[
    (
        (epl_results["homeTeam_id"] == team_id) |
        (epl_results["awayTeam_id"] == team_id)
    )
    &
    (epl_results["kickoff"] < match_date)
].tail(5)

print(
    previous_matches[
        [
            "kickoff",
            "homeTeam_name",
            "awayTeam_name",
            "homeTeam_score",
            "awayTeam_score",
            "match_result"
        ]
    ]
)


# Taking the last 5 matches before the match we are predicting for away team
team_id = test_match["awayTeam_id"]

previous_matches = epl_results[
    (
        (epl_results["homeTeam_id"] == team_id) |
        (epl_results["awayTeam_id"] == team_id)
    )
    &
    (epl_results["kickoff"] < test_match["kickoff"])
].tail(5)

print(
    previous_matches[
        [
            "kickoff",
            "homeTeam_name",
            "awayTeam_name",
            "homeTeam_score",
            "awayTeam_score",
            "match_result"
        ]
    ]
)




#####################################
# Calculating the team form at the start of our data frame
#####################################

first_match = epl_results.iloc[0]

print(first_match[
    [
        "kickoff",
        "homeTeam_name",
        "awayTeam_name"
    ]
])

print(
    "Home form:",
    calculate_form_points(
        first_match["homeTeam_id"],
        first_match["kickoff"],
        test_match["kickoff"],
        epl_results
    )
)

print(
    "Away form:",
    calculate_form_points(
        first_match["awayTeam_id"],
        first_match["kickoff"],
        test_match["kickoff"],
        epl_results
    )
)




#####################################
# Calculating the team form for the 3rd of our data frame
#####################################

early_match = epl_results.iloc[10]

print(
    early_match[
        [
            "kickoff",
            "homeTeam_name",
            "awayTeam_name"
        ]
    ]
)

print(
    "Home form:",
    calculate_form_points(
        early_match["homeTeam_id"],
        early_match["kickoff"],
        test_match["kickoff"],
        epl_results
    )
)

print(
    "Away form:",
    calculate_form_points(
        early_match["awayTeam_id"],
        early_match["kickoff"],
        test_match["kickoff"],
        epl_results
    )
)




#####################################
# verifying that the model doesnt use current match in consideration
#####################################

team_id = test_match["homeTeam_id"]
match_date = test_match["kickoff"]

previous_matches = epl_results[
    (
        (epl_results["homeTeam_id"] == team_id) |
        (epl_results["awayTeam_id"] == team_id)
    )
    &
    (epl_results["kickoff"] < match_date)
]

print("Current match date:", match_date)
print("Latest previous match:", previous_matches["kickoff"].max())




#####################################
# Testin the logic for model development is working correctly for 2009 
#####################################
first_2009 = epl_results[
    epl_results["season"] == 2009
].iloc[0]

print(first_2009[
    [
        "season",
        "kickoff",
        "homeTeam_name",
        "awayTeam_name"
    ]
])


team_id = first_2009["homeTeam_id"]

previous_matches = epl_results[
    (
        (epl_results["homeTeam_id"] == team_id) |
        (epl_results["awayTeam_id"] == team_id)
    )
    &
    (epl_results["kickoff"] < first_2009["kickoff"])
].tail(5)

print(
    previous_matches[
        [
            "season",
            "kickoff",
            "homeTeam_name",
            "awayTeam_name",
            "homeTeam_score",
            "awayTeam_score"
        ]
    ]
)


#####################################
# verifying that the model for 2009 starting
#####################################

first_2009 = epl_results[
    epl_results["season"] == 2009
].iloc[0]

print(
    first_2009[
        [
            "season",
            "kickoff",
            "homeTeam_name",
            "awayTeam_name"
        ]
    ]
)

home_form = calculate_form_points(
    first_2009["homeTeam_id"],
    first_2009["season"],
    first_2009["kickoff"],
    epl_results
)

away_form = calculate_form_points(
    first_2009["awayTeam_id"],
    first_2009["season"],
    first_2009["kickoff"],
    epl_results
)

print("Home form:", home_form)
print("Away form:", away_form)


test_2009 = epl_results[
    (epl_results["season"] == 2009)
].iloc[50]

print(
    test_2009[
        [
            "season",
            "kickoff",
            "homeTeam_name",
            "awayTeam_name"
        ]
    ]
)

home_form = calculate_form_points(
    test_2009["homeTeam_id"],
    test_2009["season"],
    test_2009["kickoff"],
    epl_results
)

away_form = calculate_form_points(
    test_2009["awayTeam_id"],
    test_2009["season"],
    test_2009["kickoff"],
    epl_results
)

print("Home form:", home_form)
print("Away form:", away_form)


# Creating a new feature to calculate home and away form of the point
epl_features["home_form_points"] = epl_features.apply(
    lambda row: calculate_form_points(
        row["homeTeam_id"],
        row["season"],
        row["kickoff"],
        epl_results
    ),
    axis=1
)

epl_features["away_form_points"] = epl_features.apply(
    lambda row: calculate_form_points(
        row["awayTeam_id"],
        row["season"],
        row["kickoff"],
        epl_results
    ),
    axis=1
)

# evaluating all the features created for furthur analysis
print(
    epl_features[
        [
            "season",
            "kickoff",
            "homeTeam_name",
            "awayTeam_name",
            "home_form_points",
            "away_form_points"
        ]
    ].head(20)
)


print(
    "Home form range:",
    epl_features["home_form_points"].min(),
    "to",
    epl_features["home_form_points"].max()
)

print(
    "Away form range:",
    epl_features["away_form_points"].min(),
    "to",
    epl_features["away_form_points"].max()
)

print(
    epl_features[
        [
            "season",
            "homeTeam_name",
            "awayTeam_name",
            "home_previous_points",
            "away_previous_points",
            "home_form_points",
            "away_form_points"
        ]
    ].tail(20)
)

# Evaluating the min and max points for each home and away form
print("Home form range:",
      epl_features["home_form_points"].min(),
      "to",
      epl_features["home_form_points"].max())

print("Away form range:",
      epl_features["away_form_points"].min(),
      "to",
      epl_features["away_form_points"].max())

# Determining the null home and away points
print("Missing home form:",
      epl_features["home_form_points"].isna().sum())

print("Missing away form:",
      epl_features["away_form_points"].isna().sum())



# Finding the player rating info, club names and all the columns that we get
print(player_ratings.info())
print(player_ratings.head(10))
print(player_ratings.columns.tolist())
print(player_ratings["clubName"].unique())
print(epl_results["homeTeam_name"].unique())


# Creating a dictonary for mapping the team name as it was different on two datasets that we are using
team_name_mapping = {
    "Man Utd": "Manchester United",
    "Newcastle Utd": "Newcastle United",
    "Spurs": "Tottenham Hotspur",
    "West Ham": "West Ham United",
    "Wolves": "Wolverhampton Wanderers",
    "Nott'm Forest": "Nottingham Forest",
    "AFC Bournemouth": "Bournemouth",
    "Brighton": "Brighton and Hove Albion"
}

player_ratings["team_name"] = (
    player_ratings["clubName"]
    .replace(team_name_mapping)
)

print(
    player_ratings[
        ["clubName", "team_name"]
    ].drop_duplicates().sort_values("clubName")
)


match_teams = set(epl_results["homeTeam_name"].unique()) | \
              set(epl_results["awayTeam_name"].unique())

player_teams = set(player_ratings["team_name"].unique())

missing_teams = player_teams - match_teams

print("Player teams not found in match data:")
print(missing_teams)


# Finding the overall rating of the team by using the player rating
# It also determine the min, max and average rating of the team and also finds the overall size of the team
team_ratings = (
    player_ratings
    .groupby("team_name")
    .agg(
        team_avg_rating=("overallRating", "mean"),
        team_max_rating=("overallRating", "max"),
        team_min_rating=("overallRating", "min"),
        player_count=("overallRating", "count")
    )
    .reset_index()
)
print(team_ratings.head(20))

# Same for the home team
home_ratings = team_ratings[
    [
        "team_name",
        "team_avg_rating",
        "team_max_rating"
    ]
].copy()

home_ratings = home_ratings.rename(columns={
    "team_name": "homeTeam_name",
    "team_avg_rating": "home_avg_rating",
    "team_max_rating": "home_max_rating"
})

epl_features = epl_features.merge(
    home_ratings,
    on="homeTeam_name",
    how="left"
)


# Same for the away team
away_ratings = team_ratings[
    [
        "team_name",
        "team_avg_rating",
        "team_max_rating"
    ]
].copy()

away_ratings = away_ratings.rename(columns={
    "team_name": "awayTeam_name",
    "team_avg_rating": "away_avg_rating",
    "team_max_rating": "away_max_rating"
})

epl_features = epl_features.merge(
    away_ratings,
    on="awayTeam_name",
    how="left"
)

print(
    epl_features[
        [
            "season",
            "homeTeam_name",
            "awayTeam_name",
            "home_avg_rating",
            "away_avg_rating",
            "home_max_rating",
            "away_max_rating"
        ]
    ].head(20)
)

# Detremining if there is any null values in different features as done above
epl_features["home_rating_available"] = (
    epl_features["home_avg_rating"].notna().astype(int)
)

epl_features["away_rating_available"] = (
    epl_features["away_avg_rating"].notna().astype(int)
)

print(
    epl_features[
        [
            "season",
            "homeTeam_name",
            "awayTeam_name",
            "home_avg_rating",
            "away_avg_rating",
            "home_rating_available",
            "away_rating_available"
        ]
    ].head(20)
)



# calculating the points difference between home and current team
epl_features["previous_points_diff"] = (
    epl_features["home_previous_points"]
    - epl_features["away_previous_points"]
)

#  calculating the position difference between home and current team
epl_features["previous_position_diff"] = (
    epl_features["away_previous_position"]
    - epl_features["home_previous_position"]
)

#  calculating the goal difference between home and current team
epl_features["previous_goal_diff_diff"] = (
    epl_features["home_previous_goal_difference"]
    - epl_features["away_previous_goal_difference"]
)

#  calculating the difference in form between home and current team
epl_features["form_points_diff"] = (
    epl_features["home_form_points"]
    - epl_features["away_form_points"]
)


print(
    epl_features[
        [
            "season",
            "homeTeam_name",
            "awayTeam_name",
            "home_previous_points",
            "away_previous_points",
            "previous_points_diff",
            "home_form_points",
            "away_form_points",
            "form_points_diff"
        ]
    ].head(20)
)

epl_features["home_advantage"] = 1
print(epl_features["home_advantage"].value_counts())


# Setting the test match position in the dataset and printing the match details
print(test_match[
    [
        "season",
        "kickoff",
        "homeTeam_name",
        "awayTeam_name"
    ]
])

# Calculating the win rate for the home team
home_rate = calculate_home_win_rate(
    test_match["homeTeam_id"],
    test_match["season"],
    test_match["kickoff"],
    epl_results
)

# calculating the win rate for the away team
away_rate = calculate_away_win_rate(
    test_match["awayTeam_id"],
    test_match["season"],
    test_match["kickoff"],
    epl_results
)

print("Home win rate:", home_rate)
print("Away win rate:", away_rate)


team_id = test_match["homeTeam_id"]
current_date = test_match["kickoff"]
season = test_match["season"]

# assigning the value according to team as the match was between city vs totenham
city_home_matches = epl_results[
    (epl_results["season"] == season) &
    (epl_results["kickoff"] < current_date) &
    (epl_results["homeTeam_id"] == team_id)
].sort_values("kickoff").tail(5)

print(
    city_home_matches[
        [
            "kickoff",
            "homeTeam_name",
            "awayTeam_name",
            "homeTeam_score",
            "awayTeam_score"
        ]
    ]
)


team_id = test_match["awayTeam_id"]

tottenham_away_matches = epl_results[
    (epl_results["season"] == season) &
    (epl_results["kickoff"] < current_date) &
    (epl_results["awayTeam_id"] == team_id)
].sort_values("kickoff").tail(5)

print(
    tottenham_away_matches[
        [
            "kickoff",
            "homeTeam_name",
            "awayTeam_name",
            "homeTeam_score",
            "awayTeam_score"
        ]
    ]
)

# Creating a new feature to track the home team win rate
epl_features["home_home_win_rate"] = epl_features.apply(
    lambda row: calculate_home_win_rate(
        row["homeTeam_id"],
        row["season"],
        row["kickoff"],
        epl_results
    ),
    axis=1
)

# Creating a new feature to track the away team win rate
epl_features["away_away_win_rate"] = epl_features.apply(
    lambda row: calculate_away_win_rate(
        row["awayTeam_id"],
        row["season"],
        row["kickoff"],
        epl_results
    ),
    axis=1
)


print(
    "Home win rate range:",
    epl_features["home_home_win_rate"].min(),
    "to",
    epl_features["home_home_win_rate"].max()
)

print(
    "Away win rate range:",
    epl_features["away_away_win_rate"].min(),
    "to",
    epl_features["away_away_win_rate"].max()
)


""" Creating a new feature to find out the win rate difference between two teams as it helps us to fond out the 
 recent team form difference """
epl_features["home_away_win_rate_diff"] = (
    epl_features["home_home_win_rate"]
    - epl_features["away_away_win_rate"]
)

# Printing first 20 rows to check if the new features are working properly or not
print(
    epl_features[
        [
            "season",
            "homeTeam_name",
            "awayTeam_name",
            "home_home_win_rate",
            "away_away_win_rate",
            "home_away_win_rate_diff"
        ]
    ].head(20)
)

# Calculating the goal scored and goal conceded by the home team in recent 5 matches
home_goals = calculate_recent_goals(
    test_match["homeTeam_id"],
    test_match["season"],
    test_match["kickoff"],
    epl_results
)

# Calculating the goal scored and goal conceded by the away team in recent 5 matches
away_goals = calculate_recent_goals(
    test_match["awayTeam_id"],
    test_match["season"],
    test_match["kickoff"],
    epl_results
)

print(test_match[
    [
        "kickoff",
        "homeTeam_name",
        "awayTeam_name"
    ]
])

print("Home goals:", home_goals)
print("Away goals:", away_goals)


# Creating new features for goal scored and goal conceded by home team in recent 5 matches
epl_features[
    ["home_recent_goals_scored", "home_recent_goals_conceded"]
] = epl_features.apply(
    lambda row: pd.Series(
        calculate_recent_goals(
            row["homeTeam_id"],
            row["season"],
            row["kickoff"],
            epl_results
        )
    ),
    axis=1
)

# Creating new features for goal scored and goal conceded by away team in recent 5 matches
epl_features[
    ["away_recent_goals_scored", "away_recent_goals_conceded"]
] = epl_features.apply(
    lambda row: pd.Series(
        calculate_recent_goals(
            row["awayTeam_id"],
            row["season"],
            row["kickoff"],
            epl_results
        )
    ),
    axis=1
)


print(
    epl_features[
        [
            "season",
            "kickoff",
            "homeTeam_name",
            "awayTeam_name",
            "home_recent_goals_scored",
            "home_recent_goals_conceded",
            "away_recent_goals_scored",
            "away_recent_goals_conceded"
        ]
    ].head(20)
)


print(
    "Home goals scored range:",
    epl_features["home_recent_goals_scored"].min(),
    "to",
    epl_features["home_recent_goals_scored"].max()
)

print(
    "Home goals conceded range:",
    epl_features["home_recent_goals_conceded"].min(),
    "to",
    epl_features["home_recent_goals_conceded"].max()
)

print(
    "Away goals scored range:",
    epl_features["away_recent_goals_scored"].min(),
    "to",
    epl_features["away_recent_goals_scored"].max()
)

print(
    "Away goals conceded range:",
    epl_features["away_recent_goals_conceded"].min(),
    "to",
    epl_features["away_recent_goals_conceded"].max()
)


print(
    epl_features[
        (epl_features["homeTeam_name"] == "Manchester City") &
        (epl_features["awayTeam_name"] == "Tottenham Hotspur") &
        (epl_features["kickoff"] == "2008-11-09 15:00:00")
    ][
        [
            "homeTeam_name",
            "awayTeam_name",
            "home_recent_goals_scored",
            "home_recent_goals_conceded",
            "away_recent_goals_scored",
            "away_recent_goals_conceded"
        ]
    ]
)



# Determining the goal differenece between the team
epl_features["recent_goals_scored_diff"] = (
    epl_features["home_recent_goals_scored"]
    - epl_features["away_recent_goals_scored"]
)

epl_features["recent_goals_conceded_diff"] = (
    epl_features["home_recent_goals_conceded"]
    - epl_features["away_recent_goals_conceded"]
)


print(
    epl_features[
        [
            "season",
            "homeTeam_name",
            "awayTeam_name",
            "home_recent_goals_scored",
            "away_recent_goals_scored",
            "recent_goals_scored_diff",
            "home_recent_goals_conceded",
            "away_recent_goals_conceded",
            "recent_goals_conceded_diff"
        ]
    ].head(20)
)


print(epl_features.shape)
print(epl_features.columns.tolist())
print(epl_features.isnull().sum())


# Creating data sets necessary for the ml data training
ml_features = epl_features[
    [
        "season",
        "matchWeek",

        # Previous season performance
        "home_previous_position",
        "home_previous_points",
        "home_previous_wins",
        "home_previous_draws",
        "home_previous_losses",
        "home_previous_goals_for",
        "home_previous_goals_against",
        "home_previous_goal_difference",

        "away_previous_position",
        "away_previous_points",
        "away_previous_wins",
        "away_previous_draws",
        "away_previous_losses",
        "away_previous_goals_for",
        "away_previous_goals_against",
        "away_previous_goal_difference",

        # Recent form
        "home_form_points",
        "away_form_points",
        "form_points_diff",

        # Player ratings
        "home_avg_rating",
        "home_max_rating",
        "away_avg_rating",
        "away_max_rating",
        "home_rating_available",
        "away_rating_available",

        # Previous performance differences
        "previous_points_diff",
        "previous_position_diff",
        "previous_goal_diff_diff",

        # Home/Away performance
        "home_home_win_rate",
        "away_away_win_rate",
        "home_away_win_rate_diff",

        # Recent goals
        "home_recent_goals_scored",
        "home_recent_goals_conceded",
        "away_recent_goals_scored",
        "away_recent_goals_conceded",
        "recent_goals_scored_diff",
        "recent_goals_conceded_diff",

        # Target
        "match_result"
    ]
].copy()

print(ml_features.shape)
print(ml_features.columns.tolist())
print(ml_features.head())

# Checking if any features have NA or null data in them
print(ml_features.isnull().sum())


# Starting the EDA process
# Assigning all the columns related to previous-season performance
previous_columns = [
    "home_previous_position",
    "home_previous_points",
    "home_previous_wins",
    "home_previous_draws",
    "home_previous_losses",
    "home_previous_goals_for",
    "home_previous_goals_against",
    "home_previous_goal_difference",
    "away_previous_position",
    "away_previous_points",
    "away_previous_wins",
    "away_previous_draws",
    "away_previous_losses",
    "away_previous_goals_for",
    "away_previous_goals_against",
    "away_previous_goal_difference"
]

# Assigning all the columns related to player rating columns
rating_columns = [
    "home_avg_rating",
    "home_max_rating",
    "away_avg_rating",
    "away_max_rating"
]

# If there is any missing values fill the missing values using the median
for column in previous_columns + rating_columns:
    ml_features[column] = ml_features[column].fillna(
        ml_features[column].median()
    )

ml_features["previous_points_diff"] = (
    ml_features["home_previous_points"]
    - ml_features["away_previous_points"]
)

ml_features["previous_position_diff"] = (
    ml_features["home_previous_position"]
    - ml_features["away_previous_position"]
)

ml_features["previous_goal_diff_diff"] = (
    ml_features["home_previous_goal_difference"]
    - ml_features["away_previous_goal_difference"]
)
print(ml_features.isnull().sum())


# Assigning the total value count of the match result
result_counts = ml_features["match_result"].value_counts()

# Creating a graph to find the distribution of the win rate for home, away and draw
plt.figure(figsize=(7, 5))
result_counts.plot(kind="bar")
plt.title("Distribution of Match Results")
plt.xlabel("Match Result")
plt.ylabel("Number of Matches")
plt.xticks(rotation=0)
plt.show()

# Creating a graph to showcase the change in win rate over time for home team and away team
season_results = pd.crosstab(
    ml_features["season"],
    ml_features["match_result"]
)

season_results.plot(
    kind="line",
    figsize=(10, 6)
)

plt.title("Match Results by Season")
plt.xlabel("Season")
plt.ylabel("Number of Matches")
plt.legend(["Away Win", "Draw", "Home Win"])
plt.show()

print(epl_features.describe())
correlation_matrix = epl_features.corr(numeric_only=True)

print(correlation_matrix.round(2))

# Creating a box plot graph to determine the form difference by match results
epl_features.boxplot(
    column="form_points_diff",
    by="match_result",
    figsize=(8, 6)
)

plt.title("Form Points Difference by Match Result")
plt.suptitle("")
plt.xlabel("Match Result")
plt.ylabel("Form Points Difference")

plt.show()


# Creating a box plot graph to determine the previous season points difference 
epl_features.boxplot(
    column="previous_points_diff",
    by="match_result",
    figsize=(8, 6)
)

plt.title("Previous Season Points Difference by Match Result")
plt.suptitle("")
plt.xlabel("Match Result")
plt.ylabel("Previous Season Points Difference")
plt.show()


# Creating a box plot graph to determine the results with consideration to team rating
epl_features["rating_diff"] = (
    epl_features["home_avg_rating"] -
    epl_features["away_avg_rating"]
)

epl_features.boxplot(
    column="rating_diff",
    by="match_result",
    figsize=(8, 6)
)

plt.title("Team Rating Difference by Match Result")
plt.suptitle("")
plt.xlabel("Match Result")
plt.ylabel("Home Rating - Away Rating")
plt.show()



# getting the columns ready for model training
ml_features = [
    "season",
    "matchWeek",

    "home_previous_position",
    "home_previous_points",
    "home_previous_wins",
    "home_previous_draws",
    "home_previous_losses",
    "home_previous_goals_for",
    "home_previous_goals_against",
    "home_previous_goal_difference",

    "away_previous_position",
    "away_previous_points",
    "away_previous_wins",
    "away_previous_draws",
    "away_previous_losses",
    "away_previous_goals_for",
    "away_previous_goals_against",
    "away_previous_goal_difference",

    "home_form_points",
    "away_form_points",
    "form_points_diff",

    "home_avg_rating",
    "home_max_rating",
    "away_avg_rating",
    "away_max_rating",

    "home_rating_available",
    "away_rating_available",

    "previous_points_diff",
    "previous_position_diff",
    "previous_goal_diff_diff",

    "home_home_win_rate",
    "away_away_win_rate",
    "home_away_win_rate_diff",

    "home_recent_goals_scored",
    "home_recent_goals_conceded",
    "away_recent_goals_scored",
    "away_recent_goals_conceded",

    "recent_goals_scored_diff",
    "recent_goals_conceded_diff"
]

X = epl_features[ml_features]
y = epl_features["match_result"]

print("X shape:", X.shape)
print("y shape:", y.shape)
print("Number of features:", len(ml_features))

X_train = X[epl_features["season"] <= 2022]
X_test = X[epl_features["season"] >= 2023]

y_train = y[epl_features["season"] <= 2022]
y_test = y[epl_features["season"] >= 2023]

print("Training set:", X_train.shape)
print("Testing set:", X_test.shape)

print("\nTraining seasons:")
print(epl_features.loc[X_train.index, "season"].min(),
      "to",
      epl_features.loc[X_train.index, "season"].max())

print("\nTesting seasons:")
print(epl_features.loc[X_test.index, "season"].min(),
      "to",
      epl_features.loc[X_test.index, "season"].max())


print("Missing values in training data:")
print(X_train.isnull().sum().sum())

print("\nMissing values in testing data:")
print(X_test.isnull().sum().sum())


# Create independent copies of the training and testing data
X_train = X[epl_features["season"] <= 2022].copy()
X_test = X[epl_features["season"] >= 2023].copy()

y_train = y[epl_features["season"] <= 2022].copy()
y_test = y[epl_features["season"] >= 2023].copy()


# Fill all missing numerical values using training-set medians
for column in X_train.columns:

    if X_train[column].isnull().any():

        median_value = X_train[column].median()

        X_train[column] = X_train[column].fillna(median_value)
        X_test[column] = X_test[column].fillna(median_value)


print("Missing values in training data:")
print(X_train.isnull().sum().sum())

print("\nMissing values in testing data:")
print(X_test.isnull().sum().sum())



''' Convert the H/D/A match outcomes into integer class labels for scikit-learn.
The test set is transformed with the same encoder so the mapping stays consistent.'''
label_encoder = LabelEncoder()
 
y_train_encoded = label_encoder.fit_transform(y_train)
y_test_encoded = label_encoder.transform(y_test)
 
print("Classes:", label_encoder.classes_)
 
 
''' Standardise the predictors to zero mean and unit variance. Logistic Regression is
 sensitive to feature scale, and our features span very different ranges (league
 position, points, win rates, player ratings). The scaler is fitted on the training
 data only and then applied to the test data, so no test information leaks into training.'''
scaler = StandardScaler()
 
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)
 
 
''' Logistic Regression serves as the baseline classifier. It is linear and easy to
 interpret, which makes it a fair reference point for judging whether the Random
 Forest is actually learning nonlinear structure in the data.
 max_iter is raised to 1000 to allow the solver to converge on the scaled features;
 random_state fixes the seed so results are reproducible.'''
baseline_model = LogisticRegression(
    max_iter=1000,
    random_state=42
)
 
 
# Fit the baseline on the training split.
baseline_model.fit(
    X_train_scaled,
    y_train_encoded
)
 
 
# Predict match outcomes for the held-out test matches.
y_pred_baseline = baseline_model.predict(X_test_scaled)
 
 
# Overall proportion of correctly predicted matches. Because home wins make up
# roughly 45% of the dataset, accuracy alone is not a sufficient measure here.
baseline_accuracy = accuracy_score(
    y_test_encoded,
    y_pred_baseline
)
 
print("\nBaseline Accuracy:")
print(baseline_accuracy)
 
 
# Per-class precision, recall and F1. This shows how the model performs on each of
# the three outcomes separately, and in particular whether draws (the minority class)
# are being predicted at all or simply absorbed into the majority classes.
print("\nBaseline Classification Report:")
 
print(
    classification_report(
        y_test_encoded,
        y_pred_baseline,
        target_names=label_encoder.classes_
    )
)



# Create Random Forest model
random_forest_model = RandomForestClassifier(
    n_estimators=100,
    random_state=42,
    n_jobs=-1
)


# Train the model
random_forest_model.fit(
    X_train,
    y_train_encoded
)


# Make predictions using the trained model
y_pred_random_forest = random_forest_model.predict(X_test)


# Calculate accuracy of the Random Forest model
random_forest_accuracy = accuracy_score(
    y_test_encoded,
    y_pred_random_forest
)

print("\nRandom Forest Accuracy:")
print(random_forest_accuracy)


# Generate classification report for the Random Forest model
print("\nRandom Forest Classification Report:")

print(
    classification_report(
        y_test_encoded,
        y_pred_random_forest,
        target_names=label_encoder.classes_
    )
)