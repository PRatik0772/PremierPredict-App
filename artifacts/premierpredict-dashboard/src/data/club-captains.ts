/** Sourced club-captain references, not live lineups or model inputs. */
export const CAPTAIN_REFERENCE_URL = 'https://www.premierleague.com/en/news/4706912/premier-league-club-captains-for-202627-season';
const HISTORICAL_REFERENCE_URL = 'https://www.sportingnews.com/uk/football/news/who-each-premier-league-teams-club-captain-202526/40c8917dc93dc6b3a80295fe';
export interface ClubCaptain {
  club: string;
  name: string;
  slug: string;
  color: string;
  accent: string;
  season: string;
  sourceUrl: string;
  verifiedAt: string;
  image: string;
}
const references: Array<[string, string, string, string, string, boolean?]> = [
  ['Arsenal', 'Martin Ødegaard', 'arsenal', '#EF3340', '#FFFFFF'],
  ['Aston Villa', 'John McGinn', 'aston-villa', '#8A1538', '#95BFE5'],
  ['Bournemouth', 'Adam Smith', 'bournemouth', '#DA291C', '#171717'],
  ['Brentford', 'Nathan Collins', 'brentford', '#E30613', '#FFFFFF'],
  ['Brighton and Hove Albion', 'Lewis Dunk', 'brighton', '#0057B8', '#FFFFFF'],
  ['Burnley', 'Josh Cullen', 'burnley', '#6C1D45', '#99D6EA', true],
  ['Chelsea', 'Reece James', 'chelsea', '#034694', '#FFFFFF'],
  ['Crystal Palace', 'Dean Henderson', 'crystal-palace', '#1B458F', '#C41230'],
  ['Everton', 'James Tarkowski', 'everton', '#003399', '#FFFFFF'],
  ['Fulham', 'Tom Cairney', 'fulham', '#F5F5F5', '#111111'],
  ['Leeds United', 'Ethan Ampadu', 'leeds', '#F5F5F5', '#FFCD00'],
  ['Liverpool', 'Virgil van Dijk', 'liverpool', '#C8102E', '#F6EB61'],
  ['Manchester City', 'Rúben Dias', 'manchester-city', '#6CABDD', '#FFFFFF'],
  ['Manchester United', 'Bruno Fernandes', 'manchester-united', '#DA291C', '#FBE122'],
  ['Newcastle United', 'Dan Burn', 'newcastle', '#F5F5F5', '#111111'],
  ['Nottingham Forest', 'Ryan Yates', 'nottingham-forest', '#E53233', '#FFFFFF'],
  ['Sunderland', 'Granit Xhaka', 'sunderland', '#EB172B', '#FFFFFF'],
  ['Tottenham Hotspur', 'Micky van de Ven', 'tottenham', '#F5F5F5', '#132257'],
  ['West Ham United', 'Jarrod Bowen', 'west-ham', '#7A263A', '#1BB1E7', true],
  ['Wolverhampton Wanderers', 'Toti Gomes', 'wolves', '#FDB913', '#111111', true],
  ['Ipswich Town', 'Dara O’Shea', 'ipswich', '#0057B8', '#FFFFFF'],
  ['Coventry City', 'Matt Grimes', 'coventry', '#77B5FE', '#FFFFFF'],
  ['Hull City', 'Lewie Coyle', 'hull', '#F5A12A', '#111111'],
];
export const CLUB_CAPTAINS: ClubCaptain[] = references.map(([club, name, slug, color, accent, historical]) => ({
  club, name, slug, color, accent,
  season: historical ? '2025/26' : '2026/27',
  sourceUrl: historical ? HISTORICAL_REFERENCE_URL : CAPTAIN_REFERENCE_URL,
  verifiedAt: '2026-10-04',
  image: `images/captains/${slug}.webp`,
}));
export function getClubCaptain(team: string): ClubCaptain | undefined {
  const normalize = (name: string) => name.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
  const aliases: Record<string, string> = { 'afc bournemouth': 'Bournemouth', 'leeds': 'Leeds United', 'coventry': 'Coventry City' };
  const canonical = aliases[normalize(team)] ?? team;
  return CLUB_CAPTAINS.find(captain => normalize(captain.club) === normalize(canonical));
}