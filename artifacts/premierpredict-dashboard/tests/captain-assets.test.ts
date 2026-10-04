import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { CLUB_CAPTAINS, getClubCaptain } from '../src/data/club-captains';
import { getClubCrestUrl } from '../src/lib/club-logos';

const publicDir = new URL('../public/', import.meta.url);
const dashboard = JSON.parse(readFileSync(new URL('data/premierpredict.json', publicDir), 'utf8'));

test('every model club has its own sourced full-body captain asset and official emblem', () => {
  for (const team of dashboard.teams) {
    const captain = getClubCaptain(team);
    assert.ok(captain, `Missing captain reference: ${team}`);
    assert.ok(existsSync(new URL(captain.image, publicDir)), `Missing avatar: ${team}`);
    const crest = getClubCrestUrl(team);
    assert.ok(crest);
    assert.ok(existsSync(fileURLToPath(new URL(crest.replace(/^\//, ''), publicDir))));
    assert.match(captain.sourceUrl, /^https:\/\//);
  }
  assert.equal(new Set(CLUB_CAPTAINS.map(captain => captain.slug)).size, CLUB_CAPTAINS.length);
  for (const captain of CLUB_CAPTAINS) {
    assert.ok(existsSync(new URL(captain.image, publicDir)));
    const crest = getClubCrestUrl(captain.club);
    assert.ok(crest);
    assert.ok(existsSync(new URL(crest.replace(/^\//, ''), publicDir)));
  }
});
test('provider aliases resolve to the correct captain and crest, including Ipswich', () => {
  assert.equal(getClubCaptain('AFC Bournemouth')?.name, 'Adam Smith');
  assert.equal(getClubCaptain('Brighton & Hove Albion')?.name, 'Lewis Dunk');
  assert.equal(getClubCaptain('Ipswich Town')?.name, 'Dara O’Shea');
  assert.equal(getClubCaptain('Coventry City')?.name, 'Matt Grimes');
  assert.equal(getClubCaptain('Hull City')?.name, 'Lewie Coyle');
  assert.ok(getClubCrestUrl('Ipswich Town'));
  assert.equal(getClubCaptain('Unknown United'), undefined);
});
test('older captain references remain explicitly dated instead of implying live lineups', () => {
  for (const team of ['Burnley', 'West Ham United', 'Wolverhampton Wanderers']) {
    assert.equal(getClubCaptain(team)?.season, '2025/26');
  }
  assert.equal(getClubCaptain('Tottenham Hotspur')?.name, 'Micky van de Ven');
  assert.equal(getClubCaptain('Manchester City')?.name, 'Rúben Dias');
  assert.equal(getClubCaptain('Everton')?.name, 'James Tarkowski');
});