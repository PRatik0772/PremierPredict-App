/** Public, key-free ESPN fixture/odds feed. No sportsbook links or wagers. */
export const LIVE_ODDS_ENDPOINT = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard';
export type OddsOutcome = 'H' | 'D' | 'A';
export interface OddsPrice {
  outcome: OddsOutcome;
  american: number;
  decimal: number;
  impliedProbability: number;
  normalizedProbability: number;
}
export interface LiveMarket {
  bookmaker: string;
  prices: OddsPrice[];
  overround: number;
  /** This public feed does not provide an authoritative quote-update timestamp. */
  quoteUpdatedAt: null;
}
export interface LiveFixture {
  id: string;
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  markets: LiveMarket[];
}
export interface LiveOddsFeed {
  source: 'ESPN public scoreboard';
  sourceUrl: string;
  fetchedAt: string;
  fixtures: LiveFixture[];
  pricedFixtures: number;
}
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as ObjectValue : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export function americanToDecimal(value: unknown): { american: number; decimal: number } | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const raw = typeof value === 'string' ? value.trim() : value;
  if (typeof raw === 'string' && !/^[+-]?\d+$/.test(raw) && raw.toUpperCase() !== 'EVEN') return null;
  const american = typeof raw === 'string' && raw.toUpperCase() === 'EVEN' ? 100 : Number(raw);
  if (!Number.isFinite(american) || Math.abs(american) < 100) return null;
  return { american, decimal: american > 0 ? 1 + american / 100 : 1 + 100 / -american };
}

function readMarket(raw: unknown): LiveMarket | null {
  const market = object(raw);
  const bookmaker = text(object(market.provider).displayName) || text(object(market.provider).name);
  if (!bookmaker) return null;
  const moneyline = object(market.moneyline);
  const read = (side: string, legacy: string) => {
    // ESPN's "close" slot holds the latest listed price even for pre-match games.
    const current = object(object(moneyline[side]).close).odds;
    return americanToDecimal(current === undefined ? object(market[legacy]).moneyLine : current);
  };
  const values = [read('home', 'homeTeamOdds'), read('draw', 'drawOdds'), read('away', 'awayTeamOdds')];
  if (values.some(value => value === null)) return null;
  const complete = values as Array<{ american: number; decimal: number }>;
  const sum = complete.reduce((total, price) => total + 1 / price.decimal, 0);
  return {
    bookmaker,
    overround: sum - 1,
    quoteUpdatedAt: null,
    prices: complete.map((price, index) => ({
      outcome: (['H', 'D', 'A'] as const)[index],
      ...price,
      impliedProbability: 1 / price.decimal,
      normalizedProbability: (1 / price.decimal) / sum,
    })),
  };
}

export function parseLiveOdds(raw: unknown, now = new Date()): LiveOddsFeed {
  const payload = object(raw);
  if (!Array.isArray(payload.events)) throw new Error('ESPN returned an unexpected fixture format.');
  const fixtures: LiveFixture[] = [];
  const seen = new Set<string>();
  for (const rawEvent of payload.events) {
    const event = object(rawEvent);
    const id = text(event.id);
    const kickoff = text(event.date);
    const time = Date.parse(kickoff);
    if (!id || seen.has(id) || !Number.isFinite(time) || time <= now.getTime()) continue;
    const competition = object(list(event.competitions)[0]);
    const state = text(object(object(event.status).type).state)
      || text(object(object(competition.status).type).state);
    if (state !== 'pre') continue; // Never compare pre-match models with in-play/completed prices.
    const competitors = list(competition.competitors).map(object);
    const home = competitors.find(team => team.homeAway === 'home');
    const away = competitors.find(team => team.homeAway === 'away');
    const homeTeam = text(object(home?.team).displayName);
    const awayTeam = text(object(away?.team).displayName);
    if (!homeTeam || !awayTeam || homeTeam === awayTeam) continue;
    const markets = list(competition.odds).map(readMarket).filter((market): market is LiveMarket => market !== null);
    fixtures.push({ id, kickoff, homeTeam, awayTeam, markets });
    seen.add(id);
  }
  fixtures.sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  return {
    source: 'ESPN public scoreboard',
    sourceUrl: LIVE_ODDS_ENDPOINT,
    fetchedAt: now.toISOString(),
    fixtures,
    pricedFixtures: fixtures.filter(fixture => fixture.markets.length > 0).length,
  };
}

export async function fetchLiveOdds(signal?: AbortSignal): Promise<LiveOddsFeed> {
  const timeout = AbortSignal.timeout(15_000);
  const response = await fetch(LIVE_ODDS_ENDPOINT, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error(`Live odds source is unavailable (HTTP ${response.status}).`);
  return parseLiveOdds(await response.json());
}

/** Exact names or explicit aliases only; never guess an unfamiliar/promoted club. */
export function resolveModelTeam(name: string, modelTeams: string[]): string | null {
  const normalize = (value: string) => value.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
  const exact = modelTeams.filter(team => normalize(team) === normalize(name));
  if (exact.length === 1) return exact[0];
  const aliases: Record<string, string> = {
    'afc bournemouth': 'Bournemouth', 'ipswich town': 'Ipswich',
    'man city': 'Manchester City', 'man united': 'Manchester United',
    'man utd': 'Manchester United', 'spurs': 'Tottenham Hotspur',
    'wolves': 'Wolverhampton Wanderers',
  };
  const canonical = aliases[normalize(name)];
  return canonical && modelTeams.includes(canonical) ? canonical : null;
}