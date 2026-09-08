import requests
import pandas as pd

url = "https://drop-api.ea.com/rating/ea-sports-fc"

all_players = []

offset = 0
limit = 100

while True:

    params = {
        "locale": "en",
        "limit": limit,
        "gender": 0,
        "offset": offset
    }

    response = requests.get(url, params=params)
    response.raise_for_status()

    data = response.json()

    players = data.get("items", [])

    if not players:
        break

    for player in players:

        # Only Premier League players
        if player.get("leagueName") == "Premier League":

            stats = player.get("stats", {})
            team = player.get("team", {})
            position = player.get("position", {})

            all_players.append({
                "id": player.get("id"),
                "playerName": (
                    f"{player.get('firstName', '')} "
                    f"{player.get('lastName', '')}"
                ).strip(),

                "commonName": player.get("commonName"),

                "clubName": team.get("label"),

                "position": position.get("shortLabel"),

                "overallRating": player.get("overallRating"),

                "pace": stats.get("pac", {}).get("value"),
                "shooting": stats.get("sho", {}).get("value"),
                "passing": stats.get("pas", {}).get("value"),
                "dribbling": stats.get("dri", {}).get("value"),
                "defending": stats.get("def", {}).get("value"),
                "physical": stats.get("phy", {}).get("value"),

                "preferredFoot": player.get("preferredFoot"),
                "skillMoves": player.get("skillMoves"),
                "weakFootAbility": player.get("weakFootAbility"),

                "height": player.get("height"),
                "weight": player.get("weight")
            })

    print(
        f"Checked {offset + len(players)} players | "
        f"Premier League: {len(all_players)}"
    )

    offset += limit


# ---------------------------------------
# CREATE DATAFRAME
# ---------------------------------------

players_df = pd.DataFrame(all_players)

# Sort by overall rating
players_df = players_df.sort_values(
    by="overallRating",
    ascending=False
)

# Print without index
print(players_df.to_string(index=False))


# ---------------------------------------
# SAVE TO EXCEL
# ---------------------------------------

output_file = "datasets/premier_league_player_ratings.xlsx"

players_df.to_excel(
    output_file,
    index=False
)

print(f"\nSaved to: {output_file}")
print(f"Total Premier League players: {len(players_df)}")