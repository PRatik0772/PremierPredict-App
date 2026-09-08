###############################################################################################################
######################## All the necessary functions for the file will be added here###########################
###############################################################################################################
import pandas as pd

def read_dataset():
    # reading all the datasets. as our datasets are in xlsx file so using read_excel functions
    current_standings = pd.read_excel("datasets/current_points_table.xlsx")
    historical_points = pd.read_excel("datasets/history_points_table.xlsx")
    epl_results = pd.read_excel("datasets/premier_league_matches.xlsx")
    player_ratings = pd.read_excel("datasets/premier_league_player_ratings.xlsx")


    # Making an array of datasets
    datasets = {
        "Current Standings": current_standings,
        "Historical Points": historical_points,
        "EPL Results": epl_results,
        "Player Ratings": player_ratings
    }

    return datasets



# As our datasets has away and home scorelines so getting the exact result value 
# 'H' --> 'Home win'
# 'A' --> 'Away win'
# 'D' --> 'Draw' 

def get_match_result(row):
    if row["homeTeam_score"] > row["awayTeam_score"]:
        return "H"
    elif row["homeTeam_score"] < row["awayTeam_score"]:
        return "A"
    else:
        return "D"


# Calculate the form of the team before the match considering the last 5 results
#  Win = 3 points, Draw = 1 and Lose = 0
def calculate_form_points(team_id, season, match_date, results, n=5):

    previous_matches = results[
        (
            ((results["homeTeam_id"] == team_id) |
             (results["awayTeam_id"] == team_id))
            &
            (results["season"] == season)
            &
            (results["kickoff"] < match_date)
        )
    ].tail(n)

    points = 0

    for _, match in previous_matches.iterrows():

        if match["homeTeam_id"] == team_id:

            if match["homeTeam_score"] > match["awayTeam_score"]:
                points += 3

            elif match["homeTeam_score"] == match["awayTeam_score"]:
                points += 1

        else:

            if match["awayTeam_score"] > match["homeTeam_score"]:
                points += 3

            elif match["awayTeam_score"] == match["homeTeam_score"]:
                points += 1

    return points

# Function to calculate the wine rate of the home team
def calculate_home_win_rate(team_id, season, current_date, results, n_matches=5):
    
    previous_matches = results[
        (results["season"] == season) &
        (results["kickoff"] < current_date) &
        (
            results["homeTeam_id"] == team_id
        )
    ].sort_values("kickoff").tail(n_matches)

    if len(previous_matches) == 0:
        return 0

    wins = (
        previous_matches["homeTeam_score"]
        > previous_matches["awayTeam_score"]
    ).sum()

    return wins / len(previous_matches)


# Function to calculate the win rate of the away team
def calculate_away_win_rate(team_id, season, current_date, results, n_matches=5):
    
    previous_matches = results[
        (results["season"] == season) &
        (results["kickoff"] < current_date) &
        (
            results["awayTeam_id"] == team_id
        )
    ].sort_values("kickoff").tail(n_matches)

    if len(previous_matches) == 0:
        return 0

    wins = (
        previous_matches["awayTeam_score"]
        > previous_matches["homeTeam_score"]
    ).sum()

    return wins / len(previous_matches)


# function to determine the total goals scored vs conceded in recent 5 matches by the team
def calculate_recent_goals(team_id, season, current_date, results, n_matches=5):

    previous_matches = results[
        (results["season"] == season) &
        (results["kickoff"] < current_date) &
        (
            (results["homeTeam_id"] == team_id) |
            (results["awayTeam_id"] == team_id)
        )
    ].sort_values("kickoff").tail(n_matches)

    if len(previous_matches) == 0:
        return 0, 0

    goals_scored = 0
    goals_conceded = 0

    for _, match in previous_matches.iterrows():

        if match["homeTeam_id"] == team_id:
            goals_scored += match["homeTeam_score"]
            goals_conceded += match["awayTeam_score"]

        else:
            goals_scored += match["awayTeam_score"]
            goals_conceded += match["homeTeam_score"]

    return goals_scored, goals_conceded