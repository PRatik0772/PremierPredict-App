# Player portrait attribution

Player photos originate from the Premier League / Fantasy Premier League public
photo service. Copyright and image rights remain with the respective owners.
No ownership, endorsement, or unrestricted reuse licence is claimed.

The identity/source manifest is `src/data/player-portraits.json`. EA player IDs
and FPL image codes are different. Images are matched using unambiguous full
names or first-and-last names, never surname-only guesses.

The manifest records each source URL, matching method, FPL code, local image
hash, retrieval date, and every unavailable player. Missing or failed images
show initials explicitly, not stock or generated faces.

Photos are display assets and may be more recent than the static ratings
snapshot. They do not change any model inputs or probabilities.

Refresh with `python Premier-League-Predictor/fetch_player_portraits.py` after
generating the dashboard data. Pillow and requests are listed in the predictor's
requirements.