import assert from 'node:assert/strict';
import { test } from 'node:test';
import { americanToDecimal, parseLiveOdds, resolveModelTeam } from '../src/lib/live-odds';

const now = new Date('2026-10-04T08:00:00Z');
function fixture(odds: unknown = [{ provider: { name: 'Test provider' }, moneyline: {
  home: { close: { odds: '-260' } }, draw: { close: { odds: '+390' } }, away: { close: { odds: '+650' } },
} }]) {
  return { id: '1', date: '2026-10-10T11:30Z', status: { type: { state: 'pre' } },
    competitions: [{ competitors: [
      { homeAway: 'away', team: { displayName: 'Leeds United' } },
      { homeAway: 'home', team: { displayName: 'Arsenal' } },
    ], odds }] };
}
test('converts positive, negative and even moneylines without confusing formats', () => {
  assert.equal(americanToDecimal(200)?.decimal, 3);
  assert.equal(americanToDecimal(-200)?.decimal, 1.5);
  assert.equal(americanToDecimal('EVEN')?.decimal, 2);
  for (const value of [0, 99, Infinity, true, null, '', '2.5', '+abc']) assert.equal(americanToDecimal(value), null);
});
test('matches home/away orientation and normalizes a complete three-way market', () => {
  const feed = parseLiveOdds({ events: [fixture()] }, now);
  assert.equal(feed.fixtures[0].homeTeam, 'Arsenal');
  assert.equal(feed.fixtures[0].awayTeam, 'Leeds United');
  const market = feed.fixtures[0].markets[0];
  assert.deepEqual(market.prices.map(x => x.outcome), ['H', 'D', 'A']);
  assert.ok(Math.abs(market.prices.reduce((sum, price) => sum + price.normalizedProbability, 0) - 1) < 1e-12);
  assert.equal(market.quoteUpdatedAt, null);
  assert.equal(feed.fetchedAt, now.toISOString());
});
test('never substitutes handicap/total prices when a three-way price is missing', () => {
  const feed = parseLiveOdds({ events: [fixture([{ provider: { name: 'Test' }, moneyline: {
    home: { close: { odds: '-110' } }, away: { close: { odds: '-110' } },
  }, drawOdds: {}, pointSpread: { draw: { close: { odds: '+250' } } } }])] }, now);
  assert.equal(feed.fixtures.length, 1);
  assert.equal(feed.pricedFixtures, 0);
});
test('supports the legacy three-way moneyline schema', () => {
  const feed = parseLiveOdds({ events: [fixture([{ provider: { name: 'Test' },
    homeTeamOdds: { moneyLine: -150 }, drawOdds: { moneyLine: 250 }, awayTeamOdds: { moneyLine: 350 },
  }])] }, now);
  assert.equal(feed.pricedFixtures, 1);
});
test('excludes completed, in-play and past events and deduplicates fixture IDs', () => {
  const past = { ...fixture(), id: '2', date: '2026-10-01T12:00Z' };
  const live = { ...fixture(), id: '3', status: { type: { state: 'in' } } };
  const completed = { ...fixture(), id: '4', status: { type: { state: 'post' } } };
  assert.equal(parseLiveOdds({ events: [fixture(), fixture(), past, live, completed] }, now).fixtures.length, 1);
});
test('fails explicitly for malformed source responses, but permits a genuine empty schedule', () => {
  assert.throws(() => parseLiveOdds({}, now), /unexpected/);
  assert.equal(parseLiveOdds({ events: [] }, now).fixtures.length, 0);
});
test('team matching handles only exact identities or documented aliases', () => {
  const teams = ['Brighton and Hove Albion', 'Bournemouth', 'Manchester United'];
  assert.equal(resolveModelTeam('Brighton & Hove Albion', teams), teams[0]);
  assert.equal(resolveModelTeam('AFC Bournemouth', teams), 'Bournemouth');
  assert.equal(resolveModelTeam('Manchester', teams), null);
  assert.equal(resolveModelTeam('Ipswich Town', teams), null);
});