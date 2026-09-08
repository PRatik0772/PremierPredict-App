import { useMemo, useState } from 'react';
import { Activity, ArrowRight, BrainCircuit, FlaskConical, History, Home, Info, Scale, Sparkles } from 'lucide-react';
import type { DashboardData, PredictionData } from '@/hooks/use-dashboard-data';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';

const outcomes: Record<string, string> = { H: 'Home win', D: 'Draw', A: 'Away win' };

export function PredictionIntelligence({ data, prediction, homeTeam, awayTeam }: { data: DashboardData; prediction: PredictionData; homeTeam: string; awayTeam: string }) {
  const [homeAdjustment, setHomeAdjustment] = useState(0);
  const [awayAdjustment, setAwayAdjustment] = useState(0);
  const homePerformance = data.clubPerformance[homeTeam];
  const awayPerformance = data.clubPerformance[awayTeam];
  const homeForm = data.formByClub[homeTeam];
  const awayForm = data.formByClub[awayTeam];
  const h2h = data.headToHead[`${homeTeam}|||${awayTeam}`];
  const consensus = Object.entries(data.predictions).map(([model, fixtures]) => ({ model, prediction: fixtures[`${homeTeam}|||${awayTeam}`] })).filter((item) => item.prediction);
  const consensusCounts = consensus.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.prediction.predicted]: (counts[item.prediction.predicted] || 0) + 1 }), {});
  const topConsensus = Object.entries(consensusCounts).sort((a, b) => b[1] - a[1])[0];
  const factors = buildFactors(data, homeTeam, awayTeam);

  const scenario = useMemo(() => {
    const source = Object.fromEntries(prediction.probabilities.map((item) => [item.outcome, item.probability]));
    const adjusted = {
      H: Math.max(0.01, (source.H || 0) + homeAdjustment / 100),
      D: Math.max(0.01, source.D || 0),
      A: Math.max(0.01, (source.A || 0) + awayAdjustment / 100),
    };
    const total = adjusted.H + adjusted.D + adjusted.A;
    return Object.entries(adjusted).map(([outcome, probability]) => ({ outcome, probability: probability / total, baseProbability: source[outcome] || 0 }));
  }, [awayAdjustment, homeAdjustment, prediction]);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden rounded-3xl">
          <CardHeader className="border-b border-border/70"><CardTitle className="display-font flex items-center gap-2 text-xl"><Sparkles className="h-5 w-5 text-primary" /> Why the fixture leans this way</CardTitle><CardDescription>Evidence-led matchup context, separate from the stored model calculation.</CardDescription></CardHeader>
          <CardContent className="space-y-3 p-5 sm:p-6">
            {factors.map((factor) => <div key={factor.label} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-2xl border border-border/70 bg-muted/25 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><factor.icon className="h-4 w-4" /></div><div><div className="text-xs font-semibold">{factor.label}</div><div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{factor.detail}</div></div><Badge variant={factor.edge === 'Even' ? 'secondary' : 'outline'} className="text-[9px]">{factor.edge}</Badge></div>)}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl">
          <CardHeader className="border-b border-border/70"><CardTitle className="display-font flex items-center gap-2 text-xl"><BrainCircuit className="h-5 w-5 text-primary" /> Model consensus</CardTitle><CardDescription>See whether the three trained approaches agree on this fixture.</CardDescription></CardHeader>
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="rounded-2xl bg-primary/[0.06] p-4">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Agreement</div>
              <div className="display-font mt-1 text-2xl font-semibold">{topConsensus ? `${topConsensus[1]} of ${consensus.length} models` : 'No consensus data'}</div>
              {topConsensus && <div className="mt-1 text-xs text-muted-foreground">Most often select <span className="font-semibold text-foreground">{outcomes[topConsensus[0]]}</span>.</div>}
            </div>
            <div className="space-y-2">
              {consensus.map(({ model, prediction: modelPrediction }) => {
                const confidence = modelPrediction.probabilities.find((item) => item.outcome === modelPrediction.predicted)?.probability || 0;
                return <div key={model} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"><span className="min-w-0 flex-1 truncate text-xs font-semibold">{model}</span><span className="text-[10px] text-muted-foreground">{outcomes[modelPrediction.predicted]}</span><span className="mono-font text-xs font-semibold">{(confidence * 100).toFixed(1)}%</span></div>;
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-primary/20 bg-primary/[0.035]">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-[auto_1fr_1fr] sm:items-center sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Info className="h-5 w-5" /></div>
          <div><div className="text-sm font-semibold">How to read this section</div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">The prediction above is the model’s actual stored result. Head-to-head is historical context. The what-if tool is optional: it lets you ask “what if I manually give one team a small advantage?”</p></div>
          <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-3 sm:gap-3"><div><span className="font-semibold text-foreground">1.</span> Read the base probabilities.</div><div><span className="font-semibold text-foreground">2.</span> Check the historical context.</div><div><span className="font-semibold text-foreground">3.</span> Move a slider only to test a scenario.</div></div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <Card className="overflow-hidden rounded-3xl">
          <CardHeader className="border-b border-border/70"><CardTitle className="display-font flex items-center gap-2 text-xl"><History className="h-5 w-5 text-primary" /> Head-to-head history</CardTitle><CardDescription>How these clubs finished against each other in past meetings—not a new prediction.</CardDescription></CardHeader>
          <CardContent className="p-5 sm:p-6">
            {h2h?.meetings ? <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <HeadStat label={`${homeTeam} wins`} value={h2h.firstWins} />
                <HeadStat label="Draws" value={h2h.draws} />
                <HeadStat label={`${awayTeam} wins`} value={h2h.secondWins} />
              </div>
              <div className="mt-5 rounded-xl border border-border/70 bg-muted/25 p-3 text-[11px] leading-relaxed text-muted-foreground"><Info className="mr-1.5 inline h-3.5 w-3.5 text-primary" />The first box counts wins by the team currently selected as home. The third counts wins by the selected away team. In these older matches, either club may actually have played at home.</div>
              <div className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Five most recent meetings</div>
              <div className="space-y-2">{h2h.recent.map((match) => <div key={`${match.kickoff}-${match.homeTeam}`} className="grid grid-cols-[1fr_58px_1fr] items-center gap-2 text-xs"><span className="truncate text-right font-medium">{match.homeTeam}</span><span className="mono-font rounded-lg bg-muted px-2 py-1.5 text-center font-semibold">{match.homeScore}–{match.awayScore}</span><span className="truncate font-medium">{match.awayTeam}</span></div>)}</div>
              <div className="mt-4 text-center text-[10px] text-muted-foreground">{h2h.meetings} meetings · {h2h.firstGoals} goals by {homeTeam} · {h2h.secondGoals} goals by {awayTeam}</div>
            </> : <div className="py-12 text-center text-sm text-muted-foreground">No historical meetings found.</div>}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-accent/30">
          <CardHeader className="border-b border-border/70"><CardTitle className="display-font flex items-center gap-2 text-xl"><FlaskConical className="h-5 w-5 text-accent-foreground" /> What-if scenario</CardTitle><CardDescription>Ask: “What would happen if I manually gave one team an advantage?”</CardDescription></CardHeader>
          <CardContent className="space-y-6 p-5 sm:p-6">
            <div className="rounded-xl border border-accent/25 bg-accent/[0.09] p-3 text-[11px] leading-relaxed text-muted-foreground"><Info className="mr-2 inline h-3.5 w-3.5 text-accent-foreground" /><strong className="text-foreground">One point means one percentage point.</strong> For example, +5 adds five percentage points to that team before all three outcomes are rebalanced to total 100%. This does not retrain the model or replace its prediction.</div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setHomeAdjustment(5); setAwayAdjustment(0); }} className="rounded-full border border-border bg-card px-3 py-2 text-[11px] font-semibold hover:border-primary/30">Try +5 for {homeTeam}</button><button type="button" onClick={() => { setHomeAdjustment(0); setAwayAdjustment(5); }} className="rounded-full border border-border bg-card px-3 py-2 text-[11px] font-semibold hover:border-primary/30">Try +5 for {awayTeam}</button><button type="button" onClick={() => { setHomeAdjustment(0); setAwayAdjustment(0); }} className="rounded-full px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted">Reset</button></div>
            <ScenarioSlider label={`Give ${homeTeam} an advantage`} value={homeAdjustment} onChange={setHomeAdjustment} />
            <ScenarioSlider label={`Give ${awayTeam} an advantage`} value={awayAdjustment} onChange={setAwayAdjustment} />
            <div className="grid gap-2 sm:grid-cols-3">
              {scenario.map((item) => <div key={item.outcome} className="rounded-2xl border border-border bg-card p-3"><div className="text-[9px] uppercase tracking-wider text-muted-foreground">{outcomes[item.outcome]}</div><div className="display-font mt-1 text-xl font-semibold">{(item.probability * 100).toFixed(1)}%</div><div className="mt-1 text-[9px] text-muted-foreground">Originally {(item.baseProbability * 100).toFixed(1)}% <span className={item.probability >= item.baseProbability ? 'text-emerald-600' : 'text-rose-600'}>({item.probability >= item.baseProbability ? '+' : ''}{((item.probability - item.baseProbability) * 100).toFixed(1)} pts)</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${item.probability * 100}%` }} /></div></div>)}
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">If you do not want to test an assumption, leave both sliders at <strong className="text-foreground">0</strong>. The original model prediction above is the result to use.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function buildFactors(data: DashboardData, homeTeam: string, awayTeam: string) {
  const homePerformance = data.clubPerformance[homeTeam];
  const awayPerformance = data.clubPerformance[awayTeam];
  const homeForm = data.formByClub[homeTeam];
  const awayForm = data.formByClub[awayTeam];
  const homeSquad = data.playersByClub[homeTeam] || [];
  const awaySquad = data.playersByClub[awayTeam] || [];
  const homeAverage = homeSquad.reduce((sum, player) => sum + player.overallRating, 0) / Math.max(homeSquad.length, 1);
  const awayAverage = awaySquad.reduce((sum, player) => sum + player.overallRating, 0) / Math.max(awaySquad.length, 1);
  const edge = (first: number, second: number, lowerIsBetter = false) => Math.abs(first - second) < 0.05 ? 'Even' : (lowerIsBetter ? first < second : first > second) ? homeTeam : awayTeam;
  const homeFormPoints = (homeForm?.wins || 0) * 3 + (homeForm?.draws || 0);
  const awayFormPoints = (awayForm?.wins || 0) * 3 + (awayForm?.draws || 0);
  return [
    { label: 'Recent form', detail: `${homeTeam} ${homeFormPoints} pts vs ${awayTeam} ${awayFormPoints} pts across each club’s last five available matches.`, edge: edge(homeFormPoints, awayFormPoints), icon: Activity },
    { label: 'Scoring profile', detail: `${homePerformance?.goalsPerMatch.toFixed(2)} vs ${awayPerformance?.goalsPerMatch.toFixed(2)} historical goals per match.`, edge: edge(homePerformance?.goalsPerMatch || 0, awayPerformance?.goalsPerMatch || 0), icon: Sparkles },
    { label: 'Defensive record', detail: `${homePerformance?.concededPerMatch.toFixed(2)} vs ${awayPerformance?.concededPerMatch.toFixed(2)} goals conceded per match.`, edge: edge(homePerformance?.concededPerMatch || 0, awayPerformance?.concededPerMatch || 0, true), icon: Scale },
    { label: 'Squad rating', detail: `${homeAverage.toFixed(1)} vs ${awayAverage.toFixed(1)} average overall rating in the supplied EA FC snapshot.`, edge: edge(homeAverage, awayAverage), icon: Home },
  ];
}

function ScenarioSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div><div className="mb-3 flex items-center justify-between text-xs font-semibold"><span>{label}</span><span className="mono-font text-primary">{value > 0 ? '+' : ''}{value} pts</span></div><Slider min={-10} max={10} step={1} value={[value]} onValueChange={([next]) => onChange(next)} /><div className="mt-2 flex justify-between text-[9px] text-muted-foreground"><span>−10</span><span>Original</span><span>+10</span></div></div>;
}

function HeadStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-border bg-muted/25 p-3"><div className="display-font text-2xl font-semibold">{value}</div><div className="mt-1 truncate text-[9px] text-muted-foreground">{label}</div></div>;
}