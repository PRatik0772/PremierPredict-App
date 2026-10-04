const PREMIER_LEAGUE_BADGE_IDS: Record<string, number> = {
  Arsenal: 3,
  'Aston Villa': 7,
  Bournemouth: 91,
  Brentford: 94,
  'Brighton and Hove Albion': 36,
  Burnley: 90,
  Chelsea: 8,
  'Crystal Palace': 31,
  Everton: 11,
  Fulham: 54,
  'Leeds United': 2,
  Liverpool: 14,
  'Manchester City': 43,
  'Manchester United': 1,
  'Newcastle United': 4,
  'Nottingham Forest': 17,
  Sunderland: 56,
  'Tottenham Hotspur': 6,
  'West Ham United': 21,
  'Wolverhampton Wanderers': 39,
  'Ipswich Town': 40,
  'AFC Bournemouth': 91,
  'Brighton & Hove Albion': 36,
  'Coventry City': 80,
  Coventry: 80,
  'Hull City': 88,
};

export function getClubCrestUrl(team: string) {
  const badgeId = PREMIER_LEAGUE_BADGE_IDS[team];
  return badgeId
    ? `${import.meta.env?.BASE_URL ?? '/'}images/club-crests/t${badgeId}.png`
    : undefined;
}

export function getClubInitials(team: string) {
  const words = team
    .replace('and Hove', '')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .filter((word) => !['United', 'City', 'Town', 'Wanderers'].includes(word))
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}