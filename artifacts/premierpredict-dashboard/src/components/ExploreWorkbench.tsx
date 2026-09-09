import { useEffect, useMemo, useState } from 'react';
import { Heart, Search, Shield, Sparkles, Star, Swords, UserRound, UsersRound } from 'lucide-react';
import { Radar, RadarChart, PolarAngleAxis, PolarGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { useLocation } from 'wouter';
import type { DashboardData, PlayerProfile, TeamStat } from '@/hooks/use-dashboard-data';
import { ClubCrest } from '@/components/ClubCrest';
import { getPositionLabel } from '@/lib/positions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FAVOURITES_KEY = 'premierpredict-favourites-v1';

type Favourites = { teams: string[]; players: number[] };

export function ExploreWorkbench({ data }: { data: DashboardData }) {
  const [, navigate] = useLocation();
  const allPlayers = useMemo(() => Object.entries(data.playersByClub).flatMap(([club, players]) => players.map((player) => ({ ...player, club }))), [data.playersByClub]);
  const [query, setQuery] = useState('');
  const [clubFilter, setClubFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const [teamA, setTeamA] = useState(data.teams[0]);
  const [teamB, setTeamB] = useState(data.teams[1]);
  const [playerAId, setPlayerAId] = useState(String(allPlayers[0]?.id || ''));
  const [playerBId, setPlayerBId] = useState(String(allPlayers[1]?.id || ''));
  const [favourites, setFavourites] = useState<Favourites>({ teams: [], players: [] });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVOURITES_KEY);
      if (stored) setFavourites(JSON.parse(stored) as Favourites);
    } catch {
      // Storage can be blocked; favourites remain usable for this session.
    }
  }, []);

  const persist = (next: Favourites) => {
    setFavourites(next);
    try { localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next)); } catch { /* session-only fallback */ }
  };

  const positions = useMemo(() => [...new Set(allPlayers.map((player) => player.position))].sort(), [allPlayers]);
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allPlayers.filter((player) => {
      const matchesText = !needle || player.name.toLowerCase().includes(needle) || player.commonName?.toLowerCase().includes(needle) || player.club.toLowerCase().includes(needle);
      return matchesText && (clubFilter === 'all' || player.club === clubFilter) && (positionFilter === 'all' || player.position === positionFilter) && (!onlyFavourites || favourites.players.includes(player.id));
    }).slice(0, 24);
  }, [allPlayers, clubFilter, favourites.players, onlyFavourites, positionFilter, query]);

  const firstPlayer = allPlayers.find((player) => String(player.id) === playerAId) || allPlayers[0];
  const secondPlayer = allPlayers.find((player) => String(player.id) === playerBId) || allPlayers[1];
  const radarData = firstPlayer && secondPlayer ? [
    { skill: 'Pace', first: firstPlayer.pace, second: secondPlayer.pace },
    { skill: 'Shooting', first: firstPlayer.shooting, second: secondPlayer.shooting },
    { skill: 'Passing', first: firstPlayer.passing, second: secondPlayer.passing },
    { skill: 'Dribbling', first: firstPlayer.dribbling, second: secondPlayer.dribbling },
    { skill: 'Defending', first: firstPlayer.defending, second: secondPlayer.defending },
    { skill: 'Physical', first: firstPlayer.physical, second: secondPlayer.physical },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-primary">Interactive scouting desk</p>
        <h2 className="display-font mt-2 text-3xl font-semibold tracking-[-0.03em]">Search, compare, and save your shortlist.</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Explore all 540 supplied player records, compare ratings and clubs, and keep favourites locally in this browser.</p>
      </div>

      <Card className="overflow-hidden rounded-3xl">
        <CardHeader className="border-b border-border/70">
          <CardTitle className="display-font text-xl">Player finder</CardTitle>
          <CardDescription>Search by name or club, then narrow by position.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-5 sm:p-7">
          <div className="grid gap-3 lg:grid-cols-[1fr_240px_190px]">
            <div className="relative"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search players or clubs…" className="h-11 pl-10" data-testid="input-player-search" /></div>
            <Select value={clubFilter} onValueChange={setClubFilter}><SelectTrigger className="h-11"><SelectValue placeholder="All clubs" /></SelectTrigger><SelectContent><SelectItem value="all">All clubs</SelectItem>{data.teams.map((team) => <SelectItem key={team} value={team}>{team}</SelectItem>)}</SelectContent></Select>
            <Select value={positionFilter} onValueChange={setPositionFilter}><SelectTrigger className="h-11"><SelectValue placeholder="All positions" /></SelectTrigger><SelectContent><SelectItem value="all">All positions</SelectItem>{positions.map((position) => <SelectItem key={position} value={position}>{getPositionLabel(position)}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{results.length} shown · {allPlayers.length} available</span><Button variant={onlyFavourites ? 'default' : 'outline'} size="sm" onClick={() => setOnlyFavourites((value) => !value)} className="h-8 gap-2 rounded-full"><Heart className={`h-3.5 w-3.5 ${onlyFavourites ? 'fill-current' : ''}`} />{favourites.players.length} favourites</Button></div>
          {results.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((player) => {
              const favourite = favourites.players.includes(player.id);
              return <div key={player.id} className="group rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm">
                <div className="flex items-start gap-3">
                  <button onClick={() => navigate(`/player/${player.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">{player.overallRating}</div>
                    <div className="min-w-0"><div className="truncate text-sm font-semibold">{player.commonName || player.name}</div><div className="mt-1 truncate text-[10px] text-muted-foreground">{player.club} · {getPositionLabel(player.position)}</div></div>
                  </button>
                  <Button variant="ghost" size="icon" onClick={() => persist({ ...favourites, players: favourite ? favourites.players.filter((id) => id !== player.id) : [...favourites.players, player.id] })} aria-label={`${favourite ? 'Remove' : 'Add'} ${player.name} ${favourite ? 'from' : 'to'} favourites`} className="h-9 w-9 rounded-full"><Heart className={`h-4 w-4 ${favourite ? 'fill-primary text-primary' : 'text-muted-foreground'}`} /></Button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[9px] text-muted-foreground"><MiniStat label="PAC" value={player.pace} /><MiniStat label="PAS" value={player.passing} /><MiniStat label="PHY" value={player.physical} /></div>
              </div>;
            })}
          </div> : <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No players match those filters.</div>}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden rounded-3xl">
          <CardHeader className="border-b border-border/70"><CardTitle className="display-font flex items-center gap-2 text-xl"><Swords className="h-5 w-5 text-primary" /> Club comparison</CardTitle><CardDescription>Current table, long-run scoring profile, and recent form side by side.</CardDescription></CardHeader>
          <CardContent className="space-y-5 p-5 sm:p-7">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="flex min-w-0 items-center gap-2"><ClubCrest team={teamA} size="sm" /><TeamSelect teams={data.teams} value={teamA} other={teamB} onChange={setTeamA} /></div>
              <span className="mono-font text-[10px] text-muted-foreground">VS</span>
              <div className="flex min-w-0 items-center justify-end gap-2"><TeamSelect teams={data.teams} value={teamB} other={teamA} onChange={setTeamB} /><ClubCrest team={teamB} size="sm" /></div>
            </div>
            <TeamComparison data={data} first={teamA} second={teamB} />
            <div className="flex flex-wrap gap-2">
              {[teamA, teamB].map((team) => {
                const favourite = favourites.teams.includes(team);
                return <Button key={team} variant="outline" size="sm" onClick={() => persist({ ...favourites, teams: favourite ? favourites.teams.filter((item) => item !== team) : [...favourites.teams, team] })} className="gap-2 rounded-full"><Star className={`h-3.5 w-3.5 ${favourite ? 'fill-accent text-accent' : ''}`} />{favourite ? 'Saved' : 'Save'} {team}</Button>;
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl">
          <CardHeader className="border-b border-border/70"><CardTitle className="display-font flex items-center gap-2 text-xl"><UserRound className="h-5 w-5 text-primary" /> Player radar</CardTitle><CardDescription>Compare the six supplied EA FC attributes on one scale.</CardDescription></CardHeader>
          <CardContent className="p-5 sm:p-7">
            <div className="grid gap-3 sm:grid-cols-2">
              <PlayerSelect players={allPlayers} value={String(firstPlayer?.id || '')} other={String(secondPlayer?.id || '')} onChange={setPlayerAId} />
              <PlayerSelect players={allPlayers} value={String(secondPlayer?.id || '')} other={String(firstPlayer?.id || '')} onChange={setPlayerBId} />
            </div>
            <div className="mt-3 h-[350px]" data-testid="chart-player-radar">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
                  <Radar name={firstPlayer?.commonName || firstPlayer?.name} dataKey="first" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.23} />
                  <Radar name={secondPlayer?.commonName || secondPlayer?.name} dataKey="second" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.18} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <PlayerSummary player={firstPlayer} tone="primary" />
              <PlayerSummary player={secondPlayer} tone="blue" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TeamComparison({ data, first, second }: { data: DashboardData; first: string; second: string }) {
  const firstStats = data.teamStats.find((team) => team.team === first);
  const secondStats = data.teamStats.find((team) => team.team === second);
  const firstPerformance = data.clubPerformance[first];
  const secondPerformance = data.clubPerformance[second];
  const firstForm = data.formByClub[first];
  const secondForm = data.formByClub[second];
  return <div className="space-y-2">
    <ComparisonRow label="Season points" first={firstStats?.points} second={secondStats?.points} />
    <ComparisonRow label="Goal difference" first={firstStats?.goalDifference} second={secondStats?.goalDifference} signed />
    <ComparisonRow label="Goals / match" first={firstPerformance?.goalsPerMatch} second={secondPerformance?.goalsPerMatch} decimals={2} />
    <ComparisonRow label="Conceded / match" first={firstPerformance?.concededPerMatch} second={secondPerformance?.concededPerMatch} decimals={2} lowerIsBetter />
    <ComparisonRow label="Recent form points" first={(firstForm?.wins || 0) * 3 + (firstForm?.draws || 0)} second={(secondForm?.wins || 0) * 3 + (secondForm?.draws || 0)} />
    <div className="grid grid-cols-[1fr_105px_1fr] items-center gap-2 pt-2"><FormDots matches={firstForm?.matches || []} /><div className="text-center text-[9px] uppercase tracking-wider text-muted-foreground">Last five</div><FormDots matches={secondForm?.matches || []} reverse /></div>
  </div>;
}

function ComparisonRow({ label, first, second, decimals = 0, signed = false, lowerIsBetter = false }: { label: string; first?: number; second?: number; decimals?: number; signed?: boolean; lowerIsBetter?: boolean }) {
  const formatValue = (value?: number) => value === undefined ? '—' : `${signed && value > 0 ? '+' : ''}${value.toFixed(decimals)}`;
  const firstWins = first !== undefined && second !== undefined && (lowerIsBetter ? first < second : first > second);
  const secondWins = first !== undefined && second !== undefined && (lowerIsBetter ? second < first : second > first);
  return <div className="grid grid-cols-[1fr_105px_1fr] items-center gap-2 rounded-xl bg-muted/35 px-3 py-2.5"><span className={`text-right text-sm font-semibold ${firstWins ? 'text-primary' : ''}`}>{formatValue(first)}</span><span className="text-center text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span><span className={`text-sm font-semibold ${secondWins ? 'text-primary' : ''}`}>{formatValue(second)}</span></div>;
}

function FormDots({ matches, reverse = false }: { matches: DashboardData['formByClub'][string]['matches']; reverse?: boolean }) {
  return <div className={`flex gap-1.5 ${reverse ? 'justify-start' : 'justify-end'}`}>{matches.map((match, index) => <span title={`${match.result} ${match.goalsFor}-${match.goalsAgainst} vs ${match.opponent}`} key={`${match.kickoff}-${index}`} className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold ${match.result === 'W' ? 'bg-emerald-100 text-emerald-700' : match.result === 'D' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{match.result}</span>)}</div>;
}

function TeamSelect({ teams, value, other, onChange }: { teams: string[]; value: string; other: string; onChange: (value: string) => void }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{teams.map((team) => <SelectItem key={team} value={team} disabled={team === other}>{team}</SelectItem>)}</SelectContent></Select>;
}

function PlayerSelect({ players, value, other, onChange }: { players: Array<PlayerProfile & { club: string }>; value: string; other: string; onChange: (value: string) => void }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{players.map((player) => <SelectItem key={player.id} value={String(player.id)} disabled={String(player.id) === other}>{player.commonName || player.name} · {player.club}</SelectItem>)}</SelectContent></Select>;
}

function PlayerSummary({ player, tone }: { player?: PlayerProfile & { club: string }; tone: 'primary' | 'blue' }) {
  if (!player) return null;
  return <div className={`rounded-2xl border p-3 ${tone === 'primary' ? 'border-primary/25 bg-primary/[0.05]' : 'border-blue-500/25 bg-blue-500/[0.05]'}`}><div className="flex items-center gap-2"><div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${tone === 'primary' ? 'bg-primary text-primary-foreground' : 'bg-blue-600 text-white'}`}>{player.overallRating}</div><div className="min-w-0"><div className="truncate text-xs font-semibold">{player.commonName || player.name}</div><div className="truncate text-[9px] text-muted-foreground">{player.club} · {getPositionLabel(player.position)}</div></div></div></div>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-muted/45 py-1.5"><div className="font-semibold text-foreground">{value}</div><div>{label}</div></div>;
}