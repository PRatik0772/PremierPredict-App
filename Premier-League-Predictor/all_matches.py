import requests
import pandas as pd

# ---------------------------------------
# SETTINGS
# ---------------------------------------

year_start = 2008
year_end = 2026

file_path = "datasets/current_points_table.xlsx"
output_file = "datasets/premier_league_matches.xlsx"


# ---------------------------------------
# READ TEAM DATA
# ---------------------------------------

df = pd.read_excel(
    file_path,
    sheet_name="team"
)

print("Teams found:", len(df))


# ---------------------------------------
# GET MATCH DATA
# ---------------------------------------

all_matches = []

for team_id, team_name in zip(df['id'], df['name']):

    print(f"\nGetting matches for {team_name} ({team_id})")

    for year in range(year_start, year_end):

        url = (
            "https://sdp-prem-prod.premier-league-prod.pulselive.com/"
            "api/v2/matches"
        )

        params = {
            "competition": 8,
            "season": year,
            "team": team_id,
            "_limit": 40
        }

        try:

            response = requests.get(
                url,
                params=params,
            )

            response.raise_for_status()

            data = response.json()

            # Check if data exists
            if 'data' not in data:
                print(f"No data for {team_name} - {year}")
                continue

            # ---------------------------------------
            # PROCESS EACH MATCH
            # ---------------------------------------

            for match in data['data']:

                home = match.get('homeTeam', {})
                away = match.get('awayTeam', {})

                all_matches.append({

                    # Match information
                    'season': year,
                    'matchWeek': match.get('matchWeek'),
                    'kickoff': match.get('kickoff'),
                    'matchId': match.get('matchId'),

                    # Home team
                    'homeTeam_id': home.get('id'),
                    'homeTeam_name': home.get('name'),
                    'homeTeam_shortName': home.get('shortName'),
                    'homeTeam_abbr': home.get('abbr'),
                    'homeTeam_score': home.get('score'),
                    'homeTeam_halfTimeScore': home.get('halfTimeScore'),
                    'homeTeam_redCards': home.get('redCards'),

                    # Away team
                    'awayTeam_id': away.get('id'),
                    'awayTeam_name': away.get('name'),
                    'awayTeam_shortName': away.get('shortName'),
                    'awayTeam_abbr': away.get('abbr'),
                    'awayTeam_score': away.get('score'),
                    'awayTeam_halfTimeScore': away.get('halfTimeScore'),
                    'awayTeam_redCards': away.get('redCards'),

                    # Other match information
                    'ground': match.get('ground'),
                    'resultType': match.get('resultType'),
                    'attendance': match.get('attendance')
                })

        except requests.exceptions.RequestException as e:

            print(
                f"Error getting {team_name} "
                f"for {year}: {e}"
            )


# ---------------------------------------
# CREATE DATAFRAME
# ---------------------------------------

matches_df = pd.DataFrame(all_matches)

print("\nTotal records before removing duplicates:")
print(len(matches_df))


# ---------------------------------------
# REMOVE DUPLICATE MATCHES
# ---------------------------------------

matches_df = matches_df.drop_duplicates(
    subset=['matchId']
)

matches_df = matches_df.sort_values(
    by=['season', 'matchWeek', 'kickoff']
)


print("\nTotal unique matches:")
print(len(matches_df))


# ---------------------------------------
# DISPLAY DATA
# ---------------------------------------

print(
    matches_df.to_string(index=False)
)


# ---------------------------------------
# SAVE TO EXCEL
# ---------------------------------------

matches_df.to_excel(
    output_file,
    index=False
)

print(
    f"\nData successfully saved to: {output_file}"
)