import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CircleHelp,
  Gauge,
  GitBranch,
  Info,
  Layers3,
  Sigma,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import type { DashboardData, PredictionData } from '@/hooks/use-dashboard-data';
import { Badge } from '@/components/ui/badge';
import { ClubCrest } from '@/components/ClubCrest';

type ModelInsightPanelProps = {
  data: DashboardData;
  model: string;
  prediction: PredictionData;
  homeTeam: string;
  awayTeam: string;
};

type InsightLens = 'drivers' | 'context' | 'track-record';

const modelDetails: Record<string, {
  icon: typeof GitBranch;
  title: string;
  shortLabel: string;
  summary: string;
  mechanics: string[];
  settings: string[];
}> = {
  'Decision Tree': {
    icon: GitBranch,
    title: 'Decision Tree',
    shortLabel: 'Branching rules',
    summary: 'A sequence of feature splits routes this fixture to a final outcome distribution.',
    mechanics: [
      'The model starts with the split that best separates the three outcomes.',
      'Form, ratings, standings, and goal difference refine the route.',
      'The reached leaf supplies the home, draw, and away probabilities.',
    ],
    settings: ['Maximum depth: 6', 'Minimum samples per leaf: 10', 'Balanced class weights', 'Random state: 42'],
  },
  'Logistic Regression': {
    icon: Sigma,
    title: 'Logistic Regression',
    shortLabel: 'Weighted evidence',
    summary: 'The 37 inputs become weighted evidence for each outcome, then are normalised into probabilities.',
    mechanics: [
      'Each feature pushes the home, draw, or away score up or down.',
      'The three scores are normalised together into one probability split.',
      'A larger probability means the weighted evidence is stronger for that outcome.',
    ],
    settings: ['37 predictor inputs', 'Three outcome classes', 'Probability output', 'Transparent linear baseline'],
  },
  'Random Forest': {
    icon: Layers3,
    title: 'Random Forest',
    shortLabel: 'Many tree votes',
    summary: 'Many Decision Trees vote on the fixture and the forest averages their class probabilities.',
    mechanics: [
      'Each tree sees a slightly different view of the training examples.',
      'Every tree votes for home win, draw, or away win.',
      'Averaging the trees reduces the effect of one unusual split.',
    ],
    settings: ['200 trees', 'Maximum depth: 12', 'Minimum samples per leaf: 3', 'Balanced subsample weights'],
  },
};

const friendlyFeatureNames: Record<string, string> = {
  home_rating_available: 'Home rating data',
  away_rating_available: 'Away rating data',
  home_max_rating: 'Home highest rating',
  away_max_rating: 'Away highest rating',
  home_avg_rating: 'Home average rating',
  away_avg_rating: 'Away average rating',
  previous_goal_diff_diff: 'Previous goal-difference gap',
  previous_points_diff: 'Previous points gap',
  form_points_diff: 'Recent form-points gap',
  home_form_points: 'Home recent form points',
  away_form_points: 'Away recent form points',
  recent_goals_scored_diff: 'Recent goals-scored gap',
  recent_goals_conceded_diff: 'Recent goals-conceded gap',
  home_previous_position: 'Home previous position',
  away_previous_position: 'Away previous position',
  home_home_win_rate: 'Home home-win rate',
  away_away_win_rate: 'Away away-win rate',
};

function featureLabel(feature: string) {
  return friendlyFeatureNames[feature] || feature.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatImportance(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function outcomeLabel(outcome: string) {
  return outcome === 'H' ? 'Home win' : outcome === 'A' ? 'Away win' : 'Draw';
}

function outcomeShortLabel(outcome: string) {
  return outcome === 'H' ? 'HOME' : outcome === 'A' ? 'AWAY' : 'DRAW';
}

function featureContext(feature: string, data: DashboardData, homeTeam: string, awayTeam: string) {
  const homeForm = data.formByClub[homeTeam];
  const awayForm = data.formByClub[awayTeam];
  const homePerformance = data.clubPerformance[homeTeam];
  const awayPerformance = data.clubPerformance[awayTeam];
  const homePlayers = data.playersByClub[homeTeam] || [];
  const awayPlayers = data.playersByClub[awayTeam] || [];
  const homeAverage = homePlayers.length ? homePlayers.reduce((sum, player) => sum + player.overallRating, 0) / homePlayers.length : undefined;
  const awayAverage = awayPlayers.length ? awayPlayers.reduce((sum, player) => sum + player.overallRating, 0) / awayPlayers.length : undefined;
  const homeMax = homePlayers.length ? Math.max(...homePlayers.map((player) => player.overallRating)) : undefined;
  const awayMax = awayPlayers.length ? Math.max(...awayPlayers.map((player) => player.overallRating)) : undefined;
  const recentGoals = (form: typeof homeForm, key: 'goalsFor' | 'goalsAgainst') => form?.matches.reduce((sum, match) => sum + match[key], 0);

  const values: Record<string, string | undefined> = {
    home_form_points: homeForm ? `${homeForm.wins * 3 + homeForm.draws} pts` : undefined,
    away_form_points: awayForm ? `${awayForm.wins * 3 + awayForm.draws} pts` : undefined,
    form_points_diff: homeForm && awayForm ? `${(homeForm.wins * 3 + homeForm.draws) - (awayForm.wins * 3 + awayForm.draws)} pts` : undefined,
    recent_goals_scored_diff: homeForm && awayForm ? `${(recentGoals(homeForm, 'goalsFor') || 0) - (recentGoals(awayForm, 'goalsFor') || 0)} goals` : undefined,
    recent_goals_conceded_diff: homeForm && awayForm ? `${(recentGoals(homeForm, 'goalsAgainst') || 0) - (recentGoals(awayForm, 'goalsAgainst') || 0)} goals` : undefined,
    home_avg_rating: homeAverage === undefined ? undefined : homeAverage.toFixed(1),
    away_avg_rating: awayAverage === undefined ? undefined : awayAverage.toFixed(1),
    home_max_rating: homeMax === undefined ? undefined : String(homeMax),
    away_max_rating: awayMax === undefined ? undefined : String(awayMax),
    home_home_win_rate: homePerformance ? `${(homePerformance.homeWinRate * 100).toFixed(1)}%` : undefined,
    away_away_win_rate: awayPerformance ? `${(awayPerformance.awayWinRate * 100).toFixed(1)}%` : undefined,
  };

  return values[feature] || 'Stored model input';
}

function featureNarrative(feature: string, value: string, homeTeam: string, awayTeam: string) {
  if (feature.includes('form_points_diff')) return value.startsWith('-') ? `${awayTeam} arrive with the stronger recent points return.` : `${homeTeam} arrive with the stronger recent points return.`;
  if (feature.includes('goals_scored_diff')) return value.startsWith('-') ? `${awayTeam} have scored more across the recent form window.` : `${homeTeam} have scored more across the recent form window.`;
  if (feature.includes('goals_conceded_diff')) return value.startsWith('-') ? `${awayTeam} have the lower recent goals-conceded figure.` : `${homeTeam} have the lower recent goals-conceded figure.`;
  if (feature.includes('home_')) return `${homeTeam}'s home profile is part of this model input.`;
  if (feature.includes('away_')) return `${awayTeam}'s away profile is part of this model input.`;
  if (feature.includes('previous_points') || feature.includes('previous_goal')) return 'The historical gap gives the model a longer-term team-strength signal.';
  return 'This feature is part of the model evidence used for the fixture.';
}

function resultTone(result: 'W' | 'D' | 'L') {
  return result === 'W' ? 'bg-primary text-primary-foreground' : result === 'D' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground';
}

function formString(form: DashboardData['formByClub'][string] | undefined) {
  return form?.matches.slice(0, 5).map((match) => match.result).join('') || '—';
}

export function ModelInsightPanel({ data, model, prediction, homeTeam, awayTeam }: ModelInsightPanelProps) {
  const detail = modelDetails[model] || modelDetails['Logistic Regression'];
  const Icon = detail.icon;
  const metric = data.metrics.find((item) => item.model === model);
  const classMetrics = data.classMetrics[model] || [];
  const topFeatures = (data.featureImportance[model] || []).slice(0, 6);
  const firstFeature = topFeatures[0]?.feature || '';
  const h2h = data.headToHead[`${homeTeam}|||${awayTeam}`];
  const homeForm = data.formByClub[homeTeam];
  const awayForm = data.formByClub[awayTeam];
  const homePerformance = data.clubPerformance[homeTeam];
  const awayPerformance = data.clubPerformance[awayTeam];
  const [lens, setLens] = useState<InsightLens>('drivers');
  const [activeOutcome, setActiveOutcome] = useState(prediction.predicted);
  const [activeFeature, setActiveFeature] = useState(topFeatures[0]?.feature || '');

  useEffect(() => {
    setActiveOutcome(prediction.predicted);
  }, [prediction.predicted, model, homeTeam, awayTeam]);

  useEffect(() => {
    setActiveFeature(firstFeature);
  }, [model, homeTeam, awayTeam, firstFeature]);

  const activeProbability = prediction.probabilities.find((item) => item.outcome === activeOutcome);
  const selectedFeature = topFeatures.find((item) => item.feature === activeFeature) || topFeatures[0];
  const selectedFeatureValue = selectedFeature ? featureContext(selectedFeature.feature, data, homeTeam, awayTeam) : 'Stored model input';
  const confidenceLabel = activeProbability && activeProbability.probability >= 0.55 ? 'Clear lean' : activeProbability && activeProbability.probability >= 0.4 ? 'Moderate lean' : 'Tight call';
  const homeFormPoints = homeForm ? homeForm.wins * 3 + homeForm.draws : 0;
  const awayFormPoints = awayForm ? awayForm.wins * 3 + awayForm.draws : 0;

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-[#1e5a45] bg-[#061b14] text-white shadow-[0_20px_45px_-28px_rgba(2,43,28,.8)]">
        <div className="absolute -right-28 -top-32 h-72 w-72 rounded-full border-[34px] border-white/[0.045]" />
        <div className="absolute -bottom-36 left-1/3 h-64 w-64 rounded-full border-[22px] border-[#f4c84a]/[0.06]" />
        <div className="relative z-10 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f4c84a] text-[#061b14]"><Icon className="h-4 w-4" /></div>
                <div>
                  <div className="mono-font text-[9px] uppercase tracking-[0.2em] text-[#f4c84a]">Model call</div>
                  <div className="mt-0.5 text-sm font-semibold">{detail.title} <span className="font-normal text-white/45">/ {detail.shortLabel}</span></div>
                </div>
              </div>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">{detail.summary}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2 text-right">
              <div className="mono-font text-[9px] uppercase tracking-[0.16em] text-white/45">Signal</div>
              <div className="mt-1 flex items-center justify-end gap-1.5 text-xs font-semibold text-[#f4c84a]"><span className="h-1.5 w-1.5 rounded-full bg-[#f4c84a]" />{confidenceLabel}</div>
            </div>
          </div>

          <div className="mt-7 grid items-center gap-6 sm:grid-cols-[1fr_auto_1fr]">
            <div className="flex items-center gap-3 sm:flex-col sm:gap-2 sm:text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg sm:h-16 sm:w-16"><ClubCrest team={homeTeam} size="lg" /></div>
              <div className="min-w-0"><div className="truncate text-sm font-semibold">{homeTeam}</div><div className="mono-font mt-1 text-[9px] uppercase tracking-[0.14em] text-white/40">Home</div></div>
            </div>
            <div className="text-center">
              <div className="mono-font text-[9px] uppercase tracking-[0.2em] text-white/35">Fixture</div>
              <div className="display-font mt-1 text-3xl font-semibold text-[#f4c84a]">VS</div>
            </div>
            <div className="flex items-center justify-end gap-3 text-right sm:flex-col sm:gap-2">
              <div className="min-w-0"><div className="truncate text-sm font-semibold">{awayTeam}</div><div className="mono-font mt-1 text-[9px] uppercase tracking-[0.14em] text-white/40">Away</div></div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg sm:h-16 sm:w-16"><ClubCrest team={awayTeam} size="lg" /></div>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-5 border-t border-white/10 pt-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mono-font text-[9px] uppercase tracking-[0.18em] text-[#f4c84a]">Predicted result</div>
              <div data-testid="text-model-call" className="display-font mt-1 text-3xl font-semibold tracking-[-0.04em]">{outcomeLabel(prediction.predicted)}</div>
              <div className="mt-1 text-sm text-white/55">{prediction.predicted === 'H' ? homeTeam : prediction.predicted === 'A' ? awayTeam : `${homeTeam} and ${awayTeam}`}</div>
            </div>
            <div className="flex items-end gap-3 sm:text-right">
              <div>
                <div className="mono-font text-[9px] uppercase tracking-[0.16em] text-white/40">Top probability</div>
                <div className="display-font mt-1 text-4xl font-semibold text-[#f4c84a]">{((prediction.probabilities.find((item) => item.outcome === prediction.predicted)?.probability || 0) * 100).toFixed(1)}%</div>
              </div>
              <Target className="mb-1 h-6 w-6 text-[#f4c84a]/70" />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mono-font text-[9px] uppercase tracking-[0.18em] text-primary">Probability split</div>
            <p className="mt-1 text-xs text-muted-foreground">Tap an outcome to inspect its place in the call.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><CircleHelp className="h-3.5 w-3.5" /> Stored model output</div>
        </div>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted">
          {prediction.probabilities.map((item) => (
            <button
              key={item.outcome}
              type="button"
              aria-label={`Inspect ${outcomeLabel(item.outcome)} probability`}
              onClick={() => setActiveOutcome(item.outcome)}
              className={`h-full transition-all ${activeOutcome === item.outcome ? 'brightness-90' : 'opacity-65 hover:opacity-100'}`}
              style={{ width: `${item.probability * 100}%`, backgroundColor: item.outcome === 'H' ? 'hsl(var(--primary))' : item.outcome === 'D' ? 'hsl(var(--accent))' : 'hsl(var(--chart-3))' }}
            />
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {prediction.probabilities.map((item) => {
            const active = activeOutcome === item.outcome;
            const color = item.outcome === 'H' ? 'hsl(var(--primary))' : item.outcome === 'D' ? 'hsl(var(--accent))' : 'hsl(var(--chart-3))';
            return (
              <button key={item.outcome} type="button" onClick={() => setActiveOutcome(item.outcome)} className={`rounded-2xl border p-3 text-left transition-all ${active ? 'border-primary/50 bg-primary/[0.07] shadow-sm' : 'border-border bg-background hover:border-primary/30'}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.12em]">{outcomeShortLabel(item.outcome)}</span>{item.outcome === prediction.predicted && <Badge className="bg-primary px-2 py-0.5 text-[9px]">Model call</Badge>}</div>
                <div className="mt-1.5 flex items-baseline justify-between gap-2"><span className="display-font text-2xl font-semibold">{(item.probability * 100).toFixed(1)}%</span><span className="text-[10px] text-muted-foreground">{outcomeLabel(item.outcome)}</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${item.probability * 100}%`, backgroundColor: color }} /></div>
              </button>
            );
          })}
        </div>
        {activeProbability && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/45 px-3 py-2 text-[11px] text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span><strong className="text-foreground">{outcomeLabel(activeOutcome)}</strong> is currently showing {(activeProbability.probability * 100).toFixed(1)}% of the model's probability mass.</span>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-sm">
        <div className="border-b border-border/70 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 className="display-font text-xl font-semibold">Why this model leans here</h3></div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Explore the evidence behind this fixture without treating global importance as a direct percentage adjustment.</p>
            </div>
            <Badge variant="outline" className="hidden shrink-0 text-[9px] sm:inline-flex">Interactive evidence</Badge>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1">
            {([
              ['drivers', 'What affects it', TrendingUp],
              ['context', 'Fixture context', Activity],
              ['track-record', 'Model track record', BarChart3],
            ] as const).map(([value, label, LensIcon]) => (
              <button key={value} type="button" onClick={() => setLens(value)} className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-[10px] font-semibold transition-all ${lens === value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <LensIcon className="hidden h-3.5 w-3.5 sm:block" />{label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {lens === 'drivers' && (
            <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
              <div className="space-y-2">
                <div className="mb-3 flex items-center justify-between"><span className="mono-font text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Global influence ranking</span><span className="text-[10px] text-muted-foreground">Tap a feature</span></div>
                {topFeatures.map((item, index) => {
                  const active = selectedFeature?.feature === item.feature;
                  return (
                    <button key={item.feature} type="button" onClick={() => setActiveFeature(item.feature)} className={`group w-full rounded-2xl border p-3 text-left transition-all ${active ? 'border-primary/45 bg-primary/[0.055]' : 'border-border/70 hover:border-primary/25 hover:bg-muted/25'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{String(index + 1).padStart(2, '0')}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3"><span className="truncate text-xs font-semibold">{featureLabel(item.feature)}</span><span className="mono-font shrink-0 text-[10px] text-primary">{formatImportance(item.importance)}</span></div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(3, item.importance * 100)}%` }} /></div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-primary/[0.055] p-5">
                <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full border-[11px] border-primary/[0.08]" />
                {selectedFeature ? (
                  <>
                    <div className="relative flex items-start justify-between gap-4">
                      <div><div className="mono-font text-[9px] uppercase tracking-[0.16em] text-primary">Selected driver</div><h4 className="display-font mt-2 text-2xl font-semibold">{featureLabel(selectedFeature.feature)}</h4></div>
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[6px] border-primary/20 bg-card text-center"><span className="mono-font text-xs font-semibold text-primary">{formatImportance(selectedFeature.importance)}</span></div>
                    </div>
                    <div className="mt-6 rounded-2xl border border-primary/15 bg-card p-4">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">This fixture's context</div>
                      <div className="mt-2 flex items-end justify-between gap-3"><span className="display-font text-2xl font-semibold text-primary">{selectedFeatureValue}</span><CheckCircle2 className="mb-1 h-4 w-4 text-primary" /></div>
                    </div>
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{featureNarrative(selectedFeature.feature, selectedFeatureValue, homeTeam, awayTeam)}</p>
                    <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/55 p-3 text-[10px] leading-relaxed text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />Importance shows how much this feature matters across the model. It is not a direct percentage added to this match.</div>
                  </>
                ) : <EmptyInsight text="No feature importance was stored for this model." />}
              </div>
            </div>
          )}

          {lens === 'context' && (
            <div className="grid gap-3 md:grid-cols-3">
              <ContextCard icon={Activity} title="Recent form" detail={`${homeTeam} vs ${awayTeam}`}>
                <div className="grid grid-cols-2 gap-2">
                  <FormBlock team={homeTeam} form={homeForm} points={homeFormPoints} />
                  <FormBlock team={awayTeam} form={awayForm} points={awayFormPoints} />
                </div>
              </ContextCard>
              <ContextCard icon={Gauge} title="Venue profile" detail="Long-run win rates">
                <div className="space-y-4">
                  <RateRow label={`${homeTeam} at home`} value={homePerformance?.homeWinRate} />
                  <RateRow label={`${awayTeam} away`} value={awayPerformance?.awayWinRate} />
                </div>
              </ContextCard>
              <ContextCard icon={Target} title="Head-to-head" detail={h2h ? `${h2h.meetings} meetings in the stored slice` : 'No stored meetings'}>
                {h2h ? (
                  <div className="space-y-3">
                    <div className="flex items-end justify-between"><div><div className="display-font text-2xl font-semibold">{h2h.firstWins}</div><div className="text-[10px] text-muted-foreground">{homeTeam} wins</div></div><div className="text-center"><div className="display-font text-2xl font-semibold">{h2h.draws}</div><div className="text-[10px] text-muted-foreground">draws</div></div><div className="text-right"><div className="display-font text-2xl font-semibold">{h2h.secondWins}</div><div className="text-[10px] text-muted-foreground">{awayTeam} wins</div></div></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="flex h-full"><span className="bg-primary" style={{ width: `${(h2h.firstWins / h2h.meetings) * 100}%` }} /><span className="bg-accent" style={{ width: `${(h2h.draws / h2h.meetings) * 100}%` }} /><span className="bg-chart-3" style={{ width: `${(h2h.secondWins / h2h.meetings) * 100}%` }} /></div></div>
                  </div>
                ) : <EmptyInsight text="The selected pairing has no stored head-to-head record." />}
              </ContextCard>
            </div>
          )}

          {lens === 'track-record' && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <TrackStat label="Accuracy" value={metric ? `${(metric.accuracy * 100).toFixed(1)}%` : '—'} note="held-out matches" />
                <TrackStat label="Macro F1" value={metric ? `${(metric.macroF1 * 100).toFixed(1)}%` : '—'} note="all outcomes" />
                <TrackStat label="Draw F1" value={metric ? `${(metric.drawF1 * 100).toFixed(1)}%` : '—'} note="draw reliability" />
              </div>
              <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
                <div className="rounded-2xl border border-primary/15 bg-primary/[0.045] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold"><Icon className="h-4 w-4 text-primary" /> What {detail.title} does</div>
                  <div className="mt-4 space-y-3">{detail.mechanics.map((item, index) => <div key={item} className="flex gap-2.5 text-[11px] leading-relaxed text-muted-foreground"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">{index + 1}</span>{item}</div>)}</div>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-border/70">
                  <table className="w-full min-w-[360px] text-left text-[11px]">
                    <thead className="bg-muted/45 text-muted-foreground"><tr><th className="px-3 py-2.5 font-semibold">Outcome</th><th className="px-3 py-2.5 font-semibold">Precision</th><th className="px-3 py-2.5 font-semibold">Recall</th><th className="px-3 py-2.5 font-semibold">F1</th></tr></thead>
                    <tbody className="divide-y divide-border/70">{classMetrics.map((item) => <tr key={item.outcome}><td className="px-3 py-2.5 font-semibold">{outcomeLabel(item.outcome)}</td><td className="px-3 py-2.5">{(item.precision * 100).toFixed(1)}%</td><td className="px-3 py-2.5">{(item.recall * 100).toFixed(1)}%</td><td className="px-3 py-2.5">{(item.f1 * 100).toFixed(1)}%</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-[10px] leading-relaxed text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />These metrics describe past held-out reliability from 2023–2025. They are context for the selected model, not extra points added to this fixture's probabilities.</div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ContextCard({ icon: ContextIcon, title, detail, children }: { icon: typeof Activity; title: string; detail: string; children: ReactNode }) {
  return <div className="rounded-2xl border border-border/70 bg-background p-4"><div className="flex items-center gap-2 text-xs font-semibold"><ContextIcon className="h-4 w-4 text-primary" />{title}</div><div className="mt-1 text-[10px] text-muted-foreground">{detail}</div><div className="mt-5">{children}</div></div>;
}

function FormBlock({ team, form, points }: { team: string; form: DashboardData['formByClub'][string] | undefined; points: number }) {
  return <div><div className="flex items-center justify-between gap-2"><span className="max-w-[6rem] truncate text-[10px] font-semibold">{team}</span><span className="mono-font text-[10px] text-primary">{points} pts</span></div><div className="mt-2 flex gap-1">{form?.matches.slice(0, 5).map((match, index) => <span key={`${match.kickoff}-${index}`} className={`flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-bold ${resultTone(match.result)}`}>{match.result}</span>) || <span className="text-[10px] text-muted-foreground">No form</span>}</div><div className="mono-font mt-2 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{formString(form)}</div></div>;
}

function RateRow({ label, value }: { label: string; value: number | undefined }) {
  const percentage = value === undefined ? 0 : value * 100;
  return <div><div className="flex items-center justify-between gap-3 text-[10px]"><span className="truncate text-muted-foreground">{label}</span><span className="mono-font font-semibold text-primary">{value === undefined ? '—' : `${percentage.toFixed(1)}%`}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} /></div></div>;
}

function TrackStat({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-2xl border border-border/70 bg-background p-4"><div className="display-font text-2xl font-semibold text-primary">{value}</div><div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]">{label}</div><div className="mt-1 text-[10px] text-muted-foreground">{note}</div></div>;
}

function EmptyInsight({ text }: { text: string }) {
  return <div className="flex min-h-32 items-center justify-center text-center text-xs text-muted-foreground">{text}</div>;
}