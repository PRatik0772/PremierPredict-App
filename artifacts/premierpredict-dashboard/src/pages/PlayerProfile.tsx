import {
  ArrowLeft,
  BrainCircuit,
  CircleHelp,
  Crosshair,
  Dumbbell,
  Footprints,
  Shield,
  Sparkles,
  Target,
  Trophy,
  WandSparkles,
} from 'lucide-react';
import { useLocation, useRoute } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardData, type PlayerProfile as Player } from '@/hooks/use-dashboard-data';

const ratingDetails = [
  { key: 'pace', label: 'Pace', icon: Footprints, color: 'bg-blue-500' },
  { key: 'shooting', label: 'Shooting', icon: Crosshair, color: 'bg-primary' },
  { key: 'passing', label: 'Passing', icon: Target, color: 'bg-amber-500' },
  { key: 'dribbling', label: 'Dribbling', icon: WandSparkles, color: 'bg-violet-500' },
  { key: 'defending', label: 'Defending', icon: Shield, color: 'bg-emerald-600' },
  { key: 'physical', label: 'Physical', icon: Dumbbell, color: 'bg-slate-600' },
] as const;

export default function PlayerProfilePage() {
  const [, params] = useRoute<{ id: string }>('/player/:id');
  const [, navigate] = useLocation();
  const { data, isLoading, isError } = useDashboardData();
  const playerId = Number(params?.id);
  const clubEntry = data
    ? Object.entries(data.playersByClub).find(([, players]) => players.some((player) => player.id === playerId))
    : undefined;
  const club = clubEntry?.[0];
  const player = clubEntry?.[1].find((item) => item.id === playerId);

  if (isLoading) return <ProfileSkeleton />;

  if (isError || !data || !club || !player) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md rounded-3xl">
          <CardContent className="p-8 text-center">
            <CircleHelp className="mx-auto h-8 w-8 text-muted-foreground" />
            <h1 className="display-font mt-4 text-2xl font-semibold">Player not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">This player is not present in the current EA FC Premier League ratings snapshot.</p>
            <Button onClick={() => navigate('/')} className="mt-5">Back to dashboard</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const performance = data.clubPerformance[club];
  const teamStat = data.teamStats.find((item) => item.team === club);
  const clubPlayers = data.playersByClub[club];
  const rank = clubPlayers.findIndex((item) => item.id === player.id) + 1;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-[1280px] items-center justify-between gap-3 px-5 sm:px-8">
          <Button variant="ghost" onClick={() => window.history.length > 1 ? window.history.back() : navigate('/')} className="gap-2 rounded-full">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="text-right">
            <div className="display-font text-sm font-semibold">PremierPredict</div>
            <div className="mono-font text-[8px] uppercase tracking-[0.18em] text-muted-foreground">Player intelligence</div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1280px] space-y-6 px-5 py-7 sm:px-8 sm:py-10">
        <section className="surface-grid relative overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/[0.14] via-card to-accent/[0.16] p-6 sm:p-9">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[44px] border-primary/[0.07]" />
          <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-end">
            <div className="flex items-center gap-5">
              <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-[1.75rem] bg-primary text-primary-foreground shadow-xl shadow-primary/20">
                <span className="display-font text-4xl font-semibold">{player.overallRating}</span>
                <span className="text-[9px] uppercase tracking-[0.16em]">Overall</span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2"><Badge>{player.position}</Badge><Badge variant="outline">#{rank} at {club}</Badge></div>
                <h1 className="display-font mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">{player.commonName || player.name}</h1>
                {player.commonName && <p className="mt-2 text-sm text-muted-foreground">{player.name}</p>}
                <p className="mt-1 text-sm font-medium text-primary">{club}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <HeroFact label="Preferred foot" value={preferredFoot(player.preferredFoot)} />
              <HeroFact label="Skill moves" value={`${player.skillMoves} / 5`} />
              <HeroFact label="Squad rank" value={`#${rank}`} />
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <Card className="overflow-hidden rounded-3xl">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="display-font text-xl">Complete rating profile</CardTitle>
              <CardDescription>Every performance attribute available in the supplied player workbook.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
              {ratingDetails.map(({ key, label, icon: Icon, color }) => <RatingBar key={key} label={label} value={player[key]} icon={Icon} color={color} />)}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-3xl">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="display-font text-xl">Rating interpretation</CardTitle>
              <CardDescription>How this player sits within the current club snapshot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-5 sm:p-7">
              <Insight label="Club average" value={`${clubAverage(clubPlayers).toFixed(1)} OVR`} detail={`${player.overallRating - clubAverage(clubPlayers) >= 0 ? '+' : ''}${(player.overallRating - clubAverage(clubPlayers)).toFixed(1)} versus the squad mean`} />
              <Insight label="Strongest attribute" value={strongestAttribute(player)} detail="Highest of the six supplied outfield rating dimensions" />
              <Insight label="Model contribution" value="Club-level aggregate" detail="The prediction model uses squad average and maximum overall ratings, not this player as an isolated input." />
            </CardContent>
          </Card>
        </section>

        {performance && (
          <section className="space-y-4">
            <div>
              <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-primary">Feature engineering / club context</p>
              <h2 className="display-font mt-2 text-2xl font-semibold">How {club} tends to score</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">These are engineered from the match-results dataset. They describe the club around the player; the source does not identify individual scorers or goal types.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <FeatureCard label="Goals per match" value={performance.goalsPerMatch.toFixed(2)} detail={`${performance.goalsFor.toLocaleString()} total goals`} />
              <FeatureCard label="Clean sheets" value={performance.cleanSheets.toLocaleString()} detail={`${percent(performance.cleanSheets, performance.matches)} of matches`} />
              <FeatureCard label="Both teams scored" value={percent(performance.bothTeamsScored, performance.matches)} detail={`${performance.bothTeamsScored.toLocaleString()} matches`} />
              <FeatureCard label="Over 2.5 goals" value={percent(performance.overTwoPointFiveGoals, performance.matches)} detail={`${performance.overTwoPointFiveGoals.toLocaleString()} matches`} />
            </div>
            <Card className="overflow-hidden rounded-3xl">
              <CardHeader className="border-b border-border/70"><CardTitle className="display-font text-xl">Goals scored per match</CardTitle><CardDescription>Distribution across all available {club} matches.</CardDescription></CardHeader>
              <CardContent className="grid gap-4 p-5 sm:grid-cols-4 sm:p-7">
                {Object.entries(performance.goalsScoredBuckets).map(([bucket, count]) => <GoalBucket key={bucket} label={bucket === '3+' ? '3+ goals' : `${bucket} goal${bucket === '1' ? '' : 's'}`} count={count} total={performance.matches} />)}
              </CardContent>
            </Card>
          </section>
        )}

        {teamStat && (
          <Card className="rounded-3xl border-primary/15">
            <CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-7">
              <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/20"><Trophy className="h-5 w-5" /></div><div><div className="font-semibold">{club} · latest season</div><div className="text-xs text-muted-foreground">{teamStat.wins} wins · {teamStat.draws} draws · {teamStat.losses} losses</div></div></div>
              <div className="display-font text-2xl font-semibold">{teamStat.points} points</div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function RatingBar({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof BrainCircuit; color: string }) {
  return <div className="rounded-2xl border border-border/70 bg-card p-4"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><span className="text-xs font-semibold">{label}</span><span className="mono-font ml-auto text-sm font-semibold">{value}</span></div><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} /></div></div>;
}

function HeroFact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-[112px] rounded-2xl border border-white/40 bg-card/75 p-3 backdrop-blur"><div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold">{value}</div></div>;
}

function Insight({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-border/70 bg-muted/25 p-4"><div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 font-semibold">{value}</div><div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</div></div>;
}

function FeatureCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <Card className="playful-pop rounded-2xl"><CardContent className="p-4 sm:p-5"><Sparkles className="h-4 w-4 text-primary" /><div className="display-font mt-3 text-2xl font-semibold">{value}</div><div className="mt-1 text-xs font-semibold">{label}</div><div className="mt-1 text-[10px] text-muted-foreground">{detail}</div></CardContent></Card>;
}

function GoalBucket({ label, count, total }: { label: string; count: number; total: number }) {
  const share = total ? count / total * 100 : 0;
  return <div className="rounded-2xl border border-border bg-muted/20 p-4"><div className="flex items-end justify-between"><span className="text-xs font-semibold">{label}</span><span className="mono-font text-lg font-semibold">{count}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} /></div><div className="mt-2 text-[10px] text-muted-foreground">{share.toFixed(1)}% of matches</div></div>;
}

function clubAverage(players: Player[]) {
  return players.reduce((sum, player) => sum + player.overallRating, 0) / Math.max(players.length, 1);
}

function strongestAttribute(player: Player) {
  const attributes = ratingDetails.map(({ key, label }) => ({ label, value: player[key] }));
  const strongest = attributes.reduce((best, item) => item.value > best.value ? item : best);
  return `${strongest.label} · ${strongest.value}`;
}

function preferredFoot(value: number | string) {
  if (value === 1 || value === '1') return 'Right';
  if (value === 2 || value === '2') return 'Left';
  return String(value || 'Unknown');
}

function percent(value: number, total: number) {
  return `${(total ? value / total * 100 : 0).toFixed(1)}%`;
}

function ProfileSkeleton() {
  return <div className="min-h-screen bg-background p-6 sm:p-10"><div className="mx-auto max-w-[1280px] space-y-5"><Skeleton className="h-8 w-28" /><Skeleton className="h-72 rounded-[2rem]" /><div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-96 rounded-3xl" /><Skeleton className="h-96 rounded-3xl" /></div></div></div>;
}