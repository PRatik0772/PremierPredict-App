import joblib
import pandas as pd
from snowflake_connector import snowflake_connector_init

from library import read_dataset


# Load the trained Gradient Boosting model
model = joblib.load("gradient_boosting_model.pkl")

print("Gradient Boosting model loaded successfully.")
print("Number of features expected:", model.n_features_in_)


# Load project datasets
datasets = read_dataset()

epl_results = datasets["EPL Results"]
player_ratings = datasets["Player Ratings"]


# Convert kickoff to datetime
epl_results["kickoff"] = pd.to_datetime(
    epl_results["kickoff"],
    errors="coerce"
)

# Sort matches by date
epl_results = epl_results.sort_values(
    "kickoff"
).reset_index(drop=True)


# Get available teams
teams = sorted(
    epl_results["homeTeam_name"]
    .dropna()
    .unique()
)


# Select home team
print("\nAvailable teams:")
for i, team in enumerate(teams, start=1):
    print(f"{i}. {team}")

home_choice = int(input("\nEnter the number for the HOME team: "))
home_team = teams[home_choice - 1]

# Select away team
away_choice = int(input("Enter the number for the AWAY team: "))
away_team = teams[away_choice - 1]


print("\nSelected match:")
print(f"{home_team} vs {away_team}")


# Find the most recent match involving each team
home_matches = epl_results[
    (epl_results["homeTeam_name"] == home_team) |
    (epl_results["awayTeam_name"] == home_team)
]

away_matches = epl_results[
    (epl_results["homeTeam_name"] == away_team) |
    (epl_results["awayTeam_name"] == away_team)
]


print("\nLatest match for home team:")
print(
    home_matches[
        [
            "kickoff",
            "homeTeam_name",
            "awayTeam_name",
            "homeTeam_score",
            "awayTeam_score"
        ]
    ].tail(1)
)


print("\nLatest match for away team:")
print(
    away_matches[
        [
            "kickoff",
            "homeTeam_name",
            "awayTeam_name",
            "homeTeam_score",
            "awayTeam_score"
        ]
    ].tail(1)
)



# Get the latest season in the dataset
latest_season = epl_results["season"].max()

print("\nLatest season in dataset:", latest_season)


# Get the previous season
previous_season = latest_season - 1

print("Previous season:", previous_season)


# Get matches from the previous season
previous_season_matches = epl_results[
    epl_results["season"] == previous_season
]


# Home team previous-season matches
home_previous_matches = previous_season_matches[
    (previous_season_matches["homeTeam_name"] == home_team) |
    (previous_season_matches["awayTeam_name"] == home_team)
]


# Away team previous-season matches
away_previous_matches = previous_season_matches[
    (previous_season_matches["homeTeam_name"] == away_team) |
    (previous_season_matches["awayTeam_name"] == away_team)
]


print(f"\n{home_team} matches in {previous_season}:",
      len(home_previous_matches))

print(f"{away_team} matches in {previous_season}:",
      len(away_previous_matches))



# Function to calculate previous-season statistics
def get_team_season_stats(matches, team):

    wins = 0
    draws = 0
    losses = 0
    goals_for = 0
    goals_against = 0

    for _, row in matches.iterrows():

        if row["homeTeam_name"] == team:
            goals_for += row["homeTeam_score"]
            goals_against += row["awayTeam_score"]

            if row["homeTeam_score"] > row["awayTeam_score"]:
                wins += 1
            elif row["homeTeam_score"] == row["awayTeam_score"]:
                draws += 1
            else:
                losses += 1

        elif row["awayTeam_name"] == team:
            goals_for += row["awayTeam_score"]
            goals_against += row["homeTeam_score"]

            if row["awayTeam_score"] > row["homeTeam_score"]:
                wins += 1
            elif row["awayTeam_score"] == row["homeTeam_score"]:
                draws += 1
            else:
                losses += 1

    points = (wins * 3) + draws
    goal_difference = goals_for - goals_against

    return {
        "points": points,
        "wins": wins,
        "draws": draws,
        "losses": losses,
        "goals_for": goals_for,
        "goals_against": goals_against,
        "goal_difference": goal_difference
    }


# Calculate previous-season statistics
home_stats = get_team_season_stats(
    home_previous_matches,
    home_team
)

away_stats = get_team_season_stats(
    away_previous_matches,
    away_team
)

print(f"\n{home_team} previous-season statistics:")
print(home_stats)

print(f"\n{away_team} previous-season statistics:")
print(away_stats)



# initializing the snowflake connection
conn = snowflake_connector_init()

# Load historical team performance
historical_team_performance = pd.read_sql(
    """
    SELECT *
    FROM HISTORICAL_TEAM_PERFORMANCE
    """,
    conn
)


# Get home team's previous-season position
home_position_data = historical_team_performance[
    (historical_team_performance["SEASON"] == previous_season) &
    (historical_team_performance["TEAM_NAME"] == home_team)
]


# Get away team's previous-season position
away_position_data = historical_team_performance[
    (historical_team_performance["SEASON"] == previous_season) &
    (historical_team_performance["TEAM_NAME"] == away_team)
]


home_previous_position = home_position_data["POSITION"].iloc[0]
away_previous_position = away_position_data["POSITION"].iloc[0]


print(f"\n{home_team} previous-season position:",
      home_previous_position)

print(f"{away_team} previous-season position:",
      away_previous_position)


# Calculate differences between home and away teams

previous_points_diff = (
    home_stats["points"] - away_stats["points"]
)

previous_position_diff = (
    home_previous_position - away_previous_position
)

previous_goal_diff_diff = (
    home_stats["goal_difference"]
    - away_stats["goal_difference"]
)


print("\nPrevious performance differences:")

print("Previous points difference:",
      previous_points_diff)

print("Previous position difference:",
      previous_position_diff)

print("Previous goal difference difference:",
      previous_goal_diff_diff)


# Prediction date
prediction_date = epl_results["kickoff"].max()

print("\nPrediction date:", prediction_date)


# Get matches before the prediction date
previous_matches = epl_results[
    epl_results["kickoff"] < prediction_date
]


# Get the last 5 matches for each team
home_recent_matches = previous_matches[
    (previous_matches["homeTeam_name"] == home_team) |
    (previous_matches["awayTeam_name"] == home_team)
].tail(5)


away_recent_matches = previous_matches[
    (previous_matches["homeTeam_name"] == away_team) |
    (previous_matches["awayTeam_name"] == away_team)
].tail(5)


print(f"\nLast 5 matches for {home_team}:")
print(
    home_recent_matches[
        [
            "kickoff",
            "homeTeam_name",
            "awayTeam_name",
            "homeTeam_score",
            "awayTeam_score"
        ]
    ]
)


print(f"\nLast 5 matches for {away_team}:")
print(
    away_recent_matches[
        [
            "kickoff",
            "homeTeam_name",
            "awayTeam_name",
            "homeTeam_score",
            "awayTeam_score"
        ]
    ]
)



def calculate_recent_form(matches, team):

    points = 0

    for _, row in matches.iterrows():

        if row["homeTeam_name"] == team:

            if row["homeTeam_score"] > row["awayTeam_score"]:
                points += 3

            elif row["homeTeam_score"] == row["awayTeam_score"]:
                points += 1

        elif row["awayTeam_name"] == team:

            if row["awayTeam_score"] > row["homeTeam_score"]:
                points += 3

            elif row["awayTeam_score"] == row["homeTeam_score"]:
                points += 1

    return points


home_form_points = calculate_recent_form(
    home_recent_matches,
    home_team
)

away_form_points = calculate_recent_form(
    away_recent_matches,
    away_team
)

form_points_diff = (
    home_form_points - away_form_points
)


print("\nRecent form:")

print(f"{home_team} form points:",
      home_form_points)

print(f"{away_team} form points:",
      away_form_points)

print("Form points difference:",
      form_points_diff)


# Team name mapping for player ratings
team_mapping = {
    "Man Utd": "Manchester United",
    "Nott'm Forest": "Nottingham Forest",
    "Spurs": "Tottenham Hotspur",
    "AFC Bournemouth": "Bournemouth"
}

player_ratings["mapped_team"] = (
    player_ratings["clubName"]
    .replace(team_mapping)
)

home_players_to_remove = [
    "Bukayo Saka"
]

away_players_to_remove = [
    "Bruno Miguel Borges Fernandes"
]

print("\nPlayers removed from home team:")
for player in home_players_to_remove:
    print("-", player)

print("\nPlayers removed from away team:")
for player in away_players_to_remove:
    print("-", player)


# Get player ratings for each team
home_players = player_ratings[
    player_ratings["mapped_team"] == home_team
]

away_players = player_ratings[
    player_ratings["mapped_team"] == away_team
]


home_players_after_removal = home_players[
    ~home_players["playerName"].isin(home_players_to_remove)
]

away_players_after_removal = away_players[
    ~away_players["playerName"].isin(away_players_to_remove)
]


# Recalculate ratings after player removal
home_avg_rating = home_players_after_removal["overallRating"].mean()
home_max_rating = home_players_after_removal["overallRating"].max()

away_avg_rating = away_players_after_removal["overallRating"].mean()
away_max_rating = away_players_after_removal["overallRating"].max()


print("\nRating summary after player removal:")

print(f"{home_team} player count:",
      len(home_players_after_removal))

print(f"{home_team} average rating:",
      home_avg_rating)

print(f"{home_team} maximum rating:",
      home_max_rating)

print(f"\n{away_team} player count:",
      len(away_players_after_removal))

print(f"{away_team} average rating:",
      away_avg_rating)

print(f"{away_team} maximum rating:",
      away_max_rating)


print("\nPlayer rating features:")

print(f"{home_team} average rating:",
      home_avg_rating)

print(f"{home_team} maximum rating:",
      home_max_rating)

print(f"{away_team} average rating:",
      away_avg_rating)

print(f"{away_team} maximum rating:",
      away_max_rating)


# Check whether player rating data is available
home_rating_available = 1 if len(home_players) > 0 else 0
away_rating_available = 1 if len(away_players) > 0 else 0


print("\nPlayer ratings used for prediction:")

print(f"\n{home_team}:")
print(home_players_after_removal[[
    "playerName",
    "overallRating"
]].sort_values(
    "overallRating",
    ascending=False
).to_string(index=False))

print(f"\n{away_team}:")
print(away_players_after_removal[[
    "playerName",
    "overallRating"
]].sort_values(
    "overallRating",
    ascending=False
).to_string(index=False))


print("\nRating availability:")

print(f"{home_team} rating available:",
      home_rating_available)

print(f"{away_team} rating available:",
      away_rating_available)



def calculate_home_away_win_rates(matches, team):

    home_matches = matches[
        matches["homeTeam_name"] == team
    ]

    away_matches = matches[
        matches["awayTeam_name"] == team
    ]

    # Home win rate
    if len(home_matches) > 0:
        home_wins = (
            home_matches["homeTeam_score"]
            > home_matches["awayTeam_score"]
        ).sum()

        home_win_rate = home_wins / len(home_matches)
    else:
        home_win_rate = 0


    # Away win rate
    if len(away_matches) > 0:
        away_wins = (
            away_matches["awayTeam_score"]
            > away_matches["homeTeam_score"]
        ).sum()

        away_win_rate = away_wins / len(away_matches)
    else:
        away_win_rate = 0


    return home_win_rate, away_win_rate


# Use all matches before the prediction date
home_home_win_rate, home_away_win_rate = calculate_home_away_win_rates(
    previous_matches,
    home_team
)

away_home_win_rate, away_away_win_rate = calculate_home_away_win_rates(
    previous_matches,
    away_team
)


# Difference between the relevant home and away rates
home_away_win_rate_diff = (
    home_home_win_rate - away_away_win_rate
)


print("\nHome/Away performance:")

print(f"{home_team} home win rate:",
      home_home_win_rate)

print(f"{away_team} away win rate:",
      away_away_win_rate)

print("Home/Away win rate difference:",
      home_away_win_rate_diff)



def calculate_recent_goals(matches, team):

    goals_scored = 0
    goals_conceded = 0

    for _, row in matches.iterrows():

        if row["homeTeam_name"] == team:

            goals_scored += row["homeTeam_score"]
            goals_conceded += row["awayTeam_score"]

        elif row["awayTeam_name"] == team:

            goals_scored += row["awayTeam_score"]
            goals_conceded += row["homeTeam_score"]

    return goals_scored, goals_conceded


home_recent_goals_scored, home_recent_goals_conceded = calculate_recent_goals(
    home_recent_matches,
    home_team
)

away_recent_goals_scored, away_recent_goals_conceded = calculate_recent_goals(
    away_recent_matches,
    away_team
)


recent_goals_scored_diff = (
    home_recent_goals_scored - away_recent_goals_scored
)

recent_goals_conceded_diff = (
    home_recent_goals_conceded - away_recent_goals_conceded
)


print("\nRecent goals:")

print(f"{home_team} goals scored:",
      home_recent_goals_scored)

print(f"{home_team} goals conceded:",
      home_recent_goals_conceded)

print(f"{away_team} goals scored:",
      away_recent_goals_scored)

print(f"{away_team} goals conceded:",
      away_recent_goals_conceded)

print("Recent goals scored difference:",
      recent_goals_scored_diff)

print("Recent goals conceded difference:",
      recent_goals_conceded_diff)



print("\nModel features we have:")

feature_values = {
    "season": latest_season,
    "matchWeek": epl_results[
        epl_results["kickoff"] == prediction_date
    ]["matchWeek"].iloc[0],

    "home_previous_position": home_previous_position,
    "home_previous_points": home_stats["points"],
    "home_previous_wins": home_stats["wins"],
    "home_previous_draws": home_stats["draws"],
    "home_previous_losses": home_stats["losses"],
    "home_previous_goals_for": home_stats["goals_for"],
    "home_previous_goals_against": home_stats["goals_against"],
    "home_previous_goal_difference": home_stats["goal_difference"],

    "away_previous_position": away_previous_position,
    "away_previous_points": away_stats["points"],
    "away_previous_wins": away_stats["wins"],
    "away_previous_draws": away_stats["draws"],
    "away_previous_losses": away_stats["losses"],
    "away_previous_goals_for": away_stats["goals_for"],
    "away_previous_goals_against": away_stats["goals_against"],
    "away_previous_goal_difference": away_stats["goal_difference"],

    "home_form_points": home_form_points,
    "away_form_points": away_form_points,
    "form_points_diff": form_points_diff,

    "home_avg_rating": home_avg_rating,
    "home_max_rating": home_max_rating,
    "away_avg_rating": away_avg_rating,
    "away_max_rating": away_max_rating,
    "home_rating_available": home_rating_available,
    "away_rating_available": away_rating_available,

    "previous_points_diff": previous_points_diff,
    "previous_position_diff": previous_position_diff,
    "previous_goal_diff_diff": previous_goal_diff_diff,

    "home_home_win_rate": home_home_win_rate,
    "away_away_win_rate": away_away_win_rate,
    "home_away_win_rate_diff": home_away_win_rate_diff,

    "home_recent_goals_scored": home_recent_goals_scored,
    "home_recent_goals_conceded": home_recent_goals_conceded,
    "away_recent_goals_scored": away_recent_goals_scored,
    "away_recent_goals_conceded": away_recent_goals_conceded,
    "recent_goals_scored_diff": recent_goals_scored_diff,
    "recent_goals_conceded_diff": recent_goals_conceded_diff
}

print("Number of features:", len(feature_values))

for feature, value in feature_values.items():
    print(f"{feature}: {value}")




    # Create prediction input in the exact order used during training

ml_feature_names = [
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


prediction_data = pd.DataFrame(
    [[feature_values[feature] for feature in ml_feature_names]],
    columns=ml_feature_names
)


print("\nPrediction input shape:")
print(prediction_data.shape)

print("\nPrediction input:")
print(prediction_data)


print("\nModel attributes:")

print("Has scaler:",
      hasattr(model, "scaler"))

print("Has imputer:",
      hasattr(model, "imputer"))

print("Has label encoder:",
      hasattr(model, "label_encoder"))


print("\nModel classes:")
print(model.classes_)


prediction = model.predict(prediction_data)

prediction_probabilities = model.predict_proba(prediction_data)

print("\nPrediction:")
print(prediction[0])

print("\nPrediction probabilities:")

for class_name, probability in zip(
    model.classes_,
    prediction_probabilities[0]
):
    print(f"{class_name}: {probability:.2%}")


    predicted_result = prediction[0]

result_names = {
    "H": "Home Win",
    "D": "Draw",
    "A": "Away Win"
}

print("\nFinal Prediction:")
print(f"{home_team} vs {away_team}")
print(f"Predicted Result: {result_names[predicted_result]}")

print("\nProbabilities:")
for class_name, probability in zip(
    model.classes_,
    prediction_probabilities[0]
):
    print(
        f"{result_names[class_name]}: "
        f"{probability:.2%}"
    )