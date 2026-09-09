import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Database,
  Download,
  GitCommitHorizontal,
  Info,
  Network,
  RefreshCw,
  Share2,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocation } from 'wouter';
import { useDashboardData, type DashboardData, type ModelMetric, type PlayerProfile } from '@/hooks/use-dashboard-data';
import { ExploreWorkbench } from '@/components/ExploreWorkbench';
import { ClubCrest } from '@/components/ClubCrest';
import { ClubFormation } from '@/components/ClubFormation';
import { ModelInsightPanel } from '@/components/ModelInsightPanel';
import { PredictionIntelligence } from '@/components/PredictionIntelligence';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { generateMatchReportPdf } from '@/lib/match-report-pdf';
import { getPositionLabel } from '@/lib/positions';

const CHART_COLORS = {
  primary: 'hsl(var(--chart-1))',
  accent: 'hsl(var(--chart-2))',
  blue: 'hsl(var(--chart-3))',
  slate: 'hsl(var(--chart-4))',
};

const tabs = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'prediction', label: 'Match prediction', icon: Target },
  { value: 'teams', label: 'Team insights', icon: UsersRound },
  { value: 'explore', label: 'Explore & compare', icon: Compass },
  { value: 'evaluation', label: 'Model evaluation', icon: BrainCircuit },
];

const outcomeInfo: Record<string, { label: string; short: string; color: string }> = {
  H: { label: 'Home win', short: 'Home team wins', color: CHART_COLORS.primary },
  D: { label: 'Draw', short: 'Both teams finish level', color: CHART_COLORS.accent },
  A: { label: 'Away win', short: 'Away team wins', color: CHART_COLORS.blue },
};

const modelInfo: Record<string, { title: string; description: string; bestFor: string }> = {
  'Decision Tree': {
    title: 'Decision Tree',
    description: 'Follows a sequence of yes/no-style splits, such as recent form, previous standings, goals, and ratings.',
    bestFor: 'Easy to explain: the most presentation-friendly model.',
  },
  'Logistic Regression': {
    title: 'Logistic Regression',
    description: 'Combines the input features into weighted evidence for each possible result.',
    bestFor: 'A simple, transparent baseline for comparison.',
  },
  'Random Forest': {
    title: 'Random Forest',
    description: 'Combines many decision trees so one unusual split has less influence on the final result.',
    bestFor: 'A stronger ensemble comparison model.',
  },
};

export default function Dashboard() {
  const { data, isLoading, isError, refetch } = useDashboardData();
  const [activeTab, setActiveTab] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    return tabs.some((tab) => tab.value === requested) ? requested! : 'overview';
  });
  const [selectedModel, setSelectedModel] = useState('');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!data) return;
    setSelectedModel((current) => current || data.metrics[0]?.model || '');
    setHomeTeam((current) => current || data.teams[0] || '');
    setAwayTeam((current) => current || data.teams.find((team) => team !== data.teams[0]) || '');
  }, [data]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeTab === 'overview') url.searchParams.delete('tab');
    else url.searchParams.set('tab', activeTab);
    window.history.replaceState({}, '', url);
  }, [activeTab]);

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !data) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-destructive/20">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="display-font text-xl font-semibold">The dataset is unavailable</h2>
              <p className="mt-2 text-sm text-muted-foreground">PremierPredict could not read its local evidence file. Try loading it again.</p>
            </div>
            <Button data-testid="button-retry-dashboard" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry load
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const topModel = data.metrics.reduce((best, metric) => (best.accuracy > metric.accuracy ? best : metric));

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <div className="display-font text-[17px] font-semibold tracking-tight">PremierPredict</div>
            <div className="mono-font text-[9px] uppercase tracking-[0.22em] text-sidebar-foreground/55">Research desk</div>
          </div>
        </div>

        <div className="flex flex-1 flex-col px-3 py-7">
          <p className="mono-font px-3 text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/45">Workspace</p>
          <nav className="mt-3 space-y-1" aria-label="Dashboard sections">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  data-testid={`button-sidebar-${tab.value}`}
                  onClick={() => setActiveTab(tab.value)}
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-sidebar-primary' : 'text-sidebar-foreground/45'}`} />
                  <span>{tab.label}</span>
                  {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary" />}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/55 p-4">
            <div className="flex items-center gap-2 text-xs font-medium">
              <ShieldCheck className="h-4 w-4 text-sidebar-primary" />
              Evidence pinned
            </div>
            <p className="mt-2 text-xs leading-relaxed text-sidebar-foreground/55">A presentation-ready view of the reproducible research dataset.</p>
          </div>
        </div>

        <div className="border-t border-sidebar-border px-6 py-4">
          <div className="mono-font text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/45">Premier League</div>
          <div className="mt-1 text-xs text-sidebar-foreground/65">Outcome intelligence · v1</div>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex min-h-20 max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Trophy className="h-4 w-4" /></div>
              <div>
                <div className="display-font text-base font-semibold">PremierPredict</div>
                <div className="mono-font text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Research desk</div>
              </div>
            </div>
            <div className="hidden lg:block">
              <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-muted-foreground">University data science presentation</p>
              <p className="mt-1 text-xs text-muted-foreground">Match intelligence desk <span className="mx-1.5 text-border">/</span> local evidence view</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => exportDashboardReport(data, selectedModel, homeTeam, awayTeam)} className="hidden gap-2 rounded-full sm:flex" data-testid="button-export-report"><Download className="h-3.5 w-3.5" /> Export</Button>
              <Button variant="outline" size="icon" onClick={async () => {
                const shared = await shareDashboard();
                toast({ title: shared ? 'Dashboard shared' : 'Link copied', description: shared ? 'The share sheet was opened.' : 'The dashboard link is ready to paste.' });
              }} className="h-9 w-9 rounded-full" aria-label="Share dashboard" data-testid="button-share-dashboard"><Share2 className="h-3.5 w-3.5" /></Button>
              <Badge variant="outline" className="hidden gap-1.5 border-primary/20 bg-primary/5 text-primary sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Dataset ready
              </Badge>
              <div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Through {data.latestSeason}</span>
              </div>
            </div>
          </div>
          <div className="border-t border-border/60 px-5 py-2 lg:hidden">
            <div className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  data-testid={`button-mobile-${tab.value}`}
                  onClick={() => setActiveTab(tab.value)}
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium ${activeTab === tab.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:py-10">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <div className="hidden items-end justify-between gap-5 lg:flex">
              <div>
                <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-primary">PremierPredict / Dashboard</p>
                <h1 className="display-font mt-2 text-4xl font-semibold tracking-[-0.035em]">Premier League predictions.</h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Choose a section to view the project data.</p>
              </div>
              <TabsList className="h-11 border border-border bg-card p-1 shadow-sm">
                {tabs.map((tab) => <TabsTrigger key={tab.value} value={tab.value} data-testid={`tab-${tab.value}`} className="h-9 gap-2 px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><tab.icon className="h-3.5 w-3.5" />{tab.label}</TabsTrigger>)}
              </TabsList>
            </div>

            <TabsContent value="overview" className="m-0 space-y-7">
              <OverviewTab data={data} topModel={topModel} />
              <ProvenanceCard provenance={data.provenance} />
            </TabsContent>
            <TabsContent value="prediction" className="m-0 space-y-7">
              <PredictionTab data={data} selectedModel={selectedModel} setSelectedModel={setSelectedModel} homeTeam={homeTeam} setHomeTeam={setHomeTeam} awayTeam={awayTeam} setAwayTeam={setAwayTeam} />
            </TabsContent>
            <TabsContent value="teams" className="m-0 space-y-7">
              <TeamInsightsTab data={data} selectedTeam={homeTeam} setSelectedTeam={setHomeTeam} />
            </TabsContent>
            <TabsContent value="explore" className="m-0 space-y-7">
              <ExploreWorkbench data={data} />
            </TabsContent>
            <TabsContent value="evaluation" className="m-0 space-y-7">
              <EvaluationTab data={data} selectedModel={selectedModel} setSelectedModel={setSelectedModel} />
              <ProvenanceCard provenance={data.provenance} compact />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}

function OverviewTab({ data, topModel }: { data: DashboardData; topModel: ModelMetric }) {
  const chartData = data.outcomeDistribution.map((item) => ({ name: outcomeInfo[item.outcome]?.label || item.outcome, code: item.outcome, matches: item.matches }));

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <MetricCard icon={Activity} label="Matches modelled" value={data.totalMatches.toLocaleString()} note="All tracked seasons" accent="default" />
        <MetricCard icon={Network} label="Input features" value={data.featureCount.toString()} note="Per prediction instance" accent="default" />
        <MetricCard icon={Target} label="Best accuracy" value={`${(topModel.accuracy * 100).toFixed(1)}%`} note={topModel.model} accent="primary" />
        <MetricCard icon={Trophy} label="Dataset boundary" value={data.latestSeason.toString()} note="Latest season available" accent="accent" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.08fr_.92fr]">
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-start justify-between space-y-0 border-b border-border/70 pb-5">
            <div>
              <CardTitle className="display-font text-xl">Historical outcomes</CardTitle>
              <CardDescription className="mt-1">How the target has resolved across the training evidence.</CardDescription>
            </div>
            <Badge variant="outline" className="mono-font gap-1.5 text-[10px] uppercase tracking-wider"><BarChart3 className="h-3 w-3" /> Distribution</Badge>
          </CardHeader>
          <CardContent className="p-5 pt-7 sm:p-7">
            {chartData.length ? (
              <div className="h-[280px] sm:h-[320px]" data-testid="chart-historical-outcomes">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip cursor={{ fill: 'hsl(var(--muted) / .55)' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '10px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
                    <Bar dataKey="matches" radius={[5, 5, 1, 1]} isAnimationActive={false}>
                      {chartData.map((item, index) => <Cell key={`outcome-${index}`} fill={item.code === 'D' ? CHART_COLORS.accent : item.code === 'A' ? CHART_COLORS.blue : CHART_COLORS.primary} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState title="No outcome distribution" detail="The loaded dataset has no historical outcome records to chart." />}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70 pb-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="display-font text-xl">Recent matches</CardTitle>
                <CardDescription className="mt-1">The latest rows at the dataset boundary.</CardDescription>
              </div>
              <Badge variant="secondary" className="mono-font text-[10px]">{data.latestSeason}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-5">
            {data.recentMatches.length ? (
              <div className="divide-y divide-border/70">
                {data.recentMatches.slice(0, 6).map((match, index) => (
                  <div key={`${match.kickoff}-${match.homeTeam}-${index}`} data-testid={`row-recent-match-${index}`} className="flex items-center gap-2 px-2 py-3.5 sm:px-3">
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right text-xs font-semibold sm:text-sm"><span className="truncate">{match.homeTeam}</span><ClubCrest team={match.homeTeam} size="sm" /></div>
                    <div className="w-[74px] shrink-0 text-center">
                      <div className="mono-font rounded-md bg-muted px-2 py-1.5 text-xs font-medium">{match.homeScore} <span className="text-muted-foreground">—</span> {match.awayScore}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">{safeDate(match.kickoff)}</div>
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-semibold sm:text-sm"><ClubCrest team={match.awayTeam} size="sm" /><span className="truncate">{match.awayTeam}</span></div>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No recent matches" detail="There are no recent fixtures in the loaded slice." />}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function MetricCard({ icon: Icon, label, value, note, accent }: { icon: typeof Activity; label: string; value: string; note: string; accent: 'default' | 'primary' | 'accent' }) {
  return (
    <Card data-testid={`card-metric-${label.toLowerCase().replaceAll(' ', '-')}`} className="playful-pop relative overflow-hidden rounded-2xl">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">{label}</p>
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${accent === 'primary' ? 'bg-primary/10 text-primary' : accent === 'accent' ? 'bg-accent/20 text-accent-foreground' : 'bg-muted text-muted-foreground'}`}><Icon className="h-3.5 w-3.5" /></div>
        </div>
        <p className={`display-font mt-4 text-2xl font-semibold tracking-tight sm:text-3xl ${accent === 'primary' ? 'text-primary' : ''}`}>{value}</p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">{note}</p>
      </CardContent>
      {accent !== 'default' && <div className={`absolute bottom-0 left-0 h-0.5 w-full ${accent === 'primary' ? 'bg-primary' : 'bg-accent'}`} />}
    </Card>
  );
}

function CompetitionBadge({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${dark ? 'border-white/15 bg-white/10 text-white' : 'border-primary/20 bg-card text-foreground shadow-sm'}`}>
      <div className={`flex h-7 w-7 items-center justify-center rounded-full ${dark ? 'bg-[#f4c84a] text-[#071d16]' : 'bg-primary text-primary-foreground'}`}>
        <Trophy className="h-3.5 w-3.5" />
      </div>
      <div className="text-left leading-none">
        <div className={`text-[8px] uppercase tracking-[0.18em] ${dark ? 'text-white/55' : 'text-muted-foreground'}`}>UEFA</div>
        <div className="mt-0.5 text-[10px] font-bold tracking-[0.06em]">CHAMPIONS LEAGUE</div>
      </div>
    </div>
  );
}

function PredictionTab({ data, selectedModel, setSelectedModel, homeTeam, setHomeTeam, awayTeam, setAwayTeam }: { data: DashboardData; selectedModel: string; setSelectedModel: (value: string) => void; homeTeam: string; setHomeTeam: (value: string) => void; awayTeam: string; setAwayTeam: (value: string) => void }) {
  const prediction = data.predictions[selectedModel]?.[`${homeTeam}|||${awayTeam}`];
  const selectedMetric = data.metrics.find((metric) => metric.model === selectedModel);
  const homeForm = data.formByClub[homeTeam];
  const awayForm = data.formByClub[awayTeam];
  const homePerformance = data.clubPerformance[homeTeam];
  const awayPerformance = data.clubPerformance[awayTeam];
  const headToHead = data.headToHead[`${homeTeam}|||${awayTeam}`];
  const chartData = prediction?.probabilities.map((item) => ({ ...item, label: outcomeInfo[item.outcome]?.label || item.outcome, probability: Number((item.probability * 100).toFixed(1)) })) || [];
  const predictedInfo = prediction ? outcomeInfo[prediction.predicted] || outcomeInfo.D : null;
  const confidence = prediction?.probabilities.find((item) => item.outcome === prediction.predicted)?.probability || 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-primary">Match prediction</p>
          <h2 className="display-font mt-2 text-3xl font-semibold tracking-[-0.03em]">Select a fixture.</h2>
          <p className="mt-2 text-sm text-muted-foreground">Choose two clubs and a model.</p>
        </div>
        <CompetitionBadge />
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-5 xl:sticky xl:top-24">
          <Card className="playful-pop overflow-hidden rounded-3xl">
            <CardHeader className="border-b border-border/70 pb-5">
              <CardTitle className="display-font text-xl">Prediction setup</CardTitle>
              <CardDescription className="mt-1">Select a model and fixture.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-5 sm:p-6">
              <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-[#071d16] p-4 text-white shadow-inner">
                <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full border-[18px] border-white/[0.06]" />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/55">Home</div>
                    <div className="flex items-center gap-2"><ClubCrest team={homeTeam} size="md" /><span className="truncate text-sm font-semibold">{homeTeam || 'Select team'}</span></div>
                  </div>
                  <div className="mono-font rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/70">VS</div>
                  <div className="min-w-0 flex-1 text-right">
                    <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/55">Away</div>
                    <div className="flex items-center justify-end gap-2"><span className="truncate text-sm font-semibold">{awayTeam || 'Select team'}</span><ClubCrest team={awayTeam} size="md" /></div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="model-select" className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Model</label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger id="model-select" data-testid="select-model" className="h-11 bg-background"><SelectValue placeholder="Select a model" /></SelectTrigger>
                  <SelectContent>{data.metrics.map((metric) => <SelectItem key={metric.model} value={metric.model} data-testid={`option-model-${metric.model}`}>{metric.model}</SelectItem>)}</SelectContent>
                </Select>
                {selectedMetric && <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5 shrink-0 text-primary" /> Test accuracy: <strong className="text-foreground">{(selectedMetric.accuracy * 100).toFixed(1)}%</strong></div>}
              </div>

              <div className="relative rounded-3xl border border-border bg-muted/40 p-4">
                <div className="space-y-2">
                  <label htmlFor="home-team-select" className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Home team</label>
                  <Select value={homeTeam} onValueChange={setHomeTeam}>
                    <SelectTrigger id="home-team-select" data-testid="select-home-team" className="h-11 bg-card"><SelectValue placeholder="Select home team" /></SelectTrigger>
                    <SelectContent>{data.teams.map((team) => <SelectItem key={`home-${team}`} value={team} disabled={team === awayTeam}>{team}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="relative z-10 flex justify-center py-2">
                  <Button type="button" variant="outline" size="icon" data-testid="button-swap-teams" onClick={() => { setHomeTeam(awayTeam); setAwayTeam(homeTeam); }} title="Swap home and away teams" className="h-8 w-8 rounded-full bg-card shadow-sm">
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <label htmlFor="away-team-select" className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Away team</label>
                  <Select value={awayTeam} onValueChange={setAwayTeam}>
                    <SelectTrigger id="away-team-select" data-testid="select-away-team" className="h-11 bg-card"><SelectValue placeholder="Select away team" /></SelectTrigger>
                    <SelectContent>{data.teams.map((team) => <SelectItem key={`away-${team}`} value={team} disabled={team === homeTeam}>{team}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <MatchupReadCard homeTeam={homeTeam} awayTeam={awayTeam} homeForm={homeForm} awayForm={awayForm} homePerformance={homePerformance} awayPerformance={awayPerformance} headToHead={headToHead} />
        </div>

        <Card className="playful-pop min-h-[560px] overflow-hidden rounded-3xl">
          <CardHeader className="border-b border-border/70 pb-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="display-font text-xl">Prediction</CardTitle>
                <CardDescription className="mt-1">Model probabilities for this fixture.</CardDescription>
              </div>
              {selectedMetric && <Badge variant="outline" className="mono-font text-[10px]">{selectedMetric.model}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="p-5 sm:p-7">
            {prediction ? (
              <div className="space-y-6">
                <div className="relative overflow-hidden rounded-3xl border border-[#1e5a45] bg-[#071d16] p-5 text-white shadow-lg sm:p-7">
                   <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full border-[26px] border-white/[0.04]" />
                   <div className="relative z-10 mb-5 flex justify-center"><CompetitionBadge dark /></div>
                   <div className="relative z-10 mb-5 flex items-center justify-center gap-4 sm:gap-7">
                     <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
                       <ClubCrest team={homeTeam} size="lg" className="shadow-md shadow-primary/10" />
                       <span className="max-w-[9rem] truncate text-xs font-semibold sm:text-sm">{homeTeam}</span>
                     </div>
                     <div className="flex flex-col items-center gap-1">
                       <span className="mono-font text-[9px] uppercase tracking-[0.2em] text-white/50">Match</span>
                       <span className="display-font text-2xl font-semibold text-[#f4c84a]">VS</span>
                     </div>
                     <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
                       <ClubCrest team={awayTeam} size="lg" className="shadow-md shadow-primary/10" />
                       <span className="max-w-[9rem] truncate text-xs font-semibold sm:text-sm">{awayTeam}</span>
                     </div>
                   </div>
                   <div className="relative z-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                    <div>
                      <div className="mono-font text-[10px] uppercase tracking-[0.18em] text-[#f4c84a]">Predicted result</div>
                      <div data-testid="text-predicted-winner" className="display-font mt-2 text-4xl font-semibold tracking-[-0.04em]">{predictedInfo?.label}</div>
                      <div className="mt-2 text-sm text-white/65"><span className="font-semibold text-white">{prediction.predicted === 'H' ? homeTeam : prediction.predicted === 'A' ? awayTeam : `${homeTeam} and ${awayTeam}`}</span></div>
                    </div>
                    <div className="sm:text-right">
                      <div className="text-xs uppercase tracking-[0.1em] text-white/55">Probability</div>
                      <div className="display-font mt-1 text-3xl font-semibold text-[#f4c84a]">{(confidence * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {chartData.map((item) => (
                    <div key={item.outcome} className={`playful-pop rounded-2xl border p-4 ${item.outcome === prediction.predicted ? 'border-primary/35 bg-primary/[0.06]' : 'border-border bg-card'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">{item.label}</span>
                        {item.outcome === prediction.predicted && <Badge className="bg-primary text-[9px]">Top result</Badge>}
                      </div>
                      <div className="mt-3 flex items-end justify-between"><span className="display-font text-2xl font-semibold">{item.probability}%</span><span className="text-[10px] text-muted-foreground">model chance</span></div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${item.probability}%`, backgroundColor: outcomeInfo[item.outcome]?.color }} /></div>
                    </div>
                  ))}
                </div>
                <ModelInsightPanel data={data} model={selectedModel} prediction={prediction} homeTeam={homeTeam} awayTeam={awayTeam} />
              </div>
            ) : (
              <EmptyState title="No stored prediction for this fixture" detail="Try another team pairing or model. This view never fills gaps with an invented estimate." large />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MatchupReadCard({
  homeTeam,
  awayTeam,
  homeForm,
  awayForm,
  homePerformance,
  awayPerformance,
  headToHead,
}: {
  homeTeam: string;
  awayTeam: string;
  homeForm: DashboardData['formByClub'][string] | undefined;
  awayForm: DashboardData['formByClub'][string] | undefined;
  homePerformance: DashboardData['clubPerformance'][string] | undefined;
  awayPerformance: DashboardData['clubPerformance'][string] | undefined;
  headToHead: DashboardData['headToHead'][string] | undefined;
}) {
  const homePoints = homeForm ? homeForm.wins * 3 + homeForm.draws : 0;
  const awayPoints = awayForm ? awayForm.wins * 3 + awayForm.draws : 0;
  const totalMeetings = headToHead?.meetings || 0;

  return (
    <Card className="overflow-hidden rounded-3xl border-primary/10">
      <CardHeader className="border-b border-border/70 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="display-font text-lg">Quick matchup read</CardTitle>
            <CardDescription className="mt-1 text-xs">The context around this fixture.</CardDescription>
          </div>
          <div className="rounded-xl bg-primary/10 p-2 text-primary"><Activity className="h-4 w-4" /></div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/45 p-3">
          <div className="flex min-w-0 items-center gap-2">
            <ClubCrest team={homeTeam} size="sm" />
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold">{homeTeam}</div>
              <div className="mono-font mt-0.5 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Home</div>
            </div>
          </div>
          <span className="mono-font rounded-full border border-border bg-card px-2 py-1 text-[9px] font-semibold text-muted-foreground">VS</span>
          <div className="flex min-w-0 items-center gap-2 text-right">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold">{awayTeam}</div>
              <div className="mono-font mt-0.5 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Away</div>
            </div>
            <ClubCrest team={awayTeam} size="sm" />
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">Recent form</div>
            <div className="text-[10px] text-muted-foreground">Last 5</div>
          </div>
          <div className="mt-3 space-y-3">
            <CompactFormRow team={homeTeam} form={homeForm} points={homePoints} />
            <CompactFormRow team={awayTeam} form={awayForm} points={awayPoints} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <SidebarStat label={`${homeTeam} home win`} value={homePerformance ? `${(homePerformance.homeWinRate * 100).toFixed(1)}%` : '—'} />
          <SidebarStat label={`${awayTeam} away win`} value={awayPerformance ? `${(awayPerformance.awayWinRate * 100).toFixed(1)}%` : '—'} />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-accent/[0.08] p-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">Head-to-head</div>
            <div className="mt-1 text-[10px] text-muted-foreground">{totalMeetings ? `${totalMeetings} stored meetings` : 'No stored meetings'}</div>
          </div>
          {headToHead ? (
            <div className="flex items-center gap-2 text-right">
              <div><div className="display-font text-lg font-semibold">{headToHead.firstWins}</div><div className="text-[9px] text-muted-foreground">{homeTeam} W</div></div>
              <div className="text-muted-foreground">·</div>
              <div><div className="display-font text-lg font-semibold">{headToHead.draws}</div><div className="text-[9px] text-muted-foreground">Draw</div></div>
              <div className="text-muted-foreground">·</div>
              <div><div className="display-font text-lg font-semibold">{headToHead.secondWins}</div><div className="text-[9px] text-muted-foreground">{awayTeam} W</div></div>
            </div>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function CompactFormRow({ team, form, points }: { team: string; form: DashboardData['formByClub'][string] | undefined; points: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 truncate text-[10px] font-semibold">{team}</span>
      <div className="flex flex-1 gap-1">
        {form?.matches.slice(0, 5).map((match, index) => (
          <span key={`${match.kickoff}-${index}`} className={`flex h-5 w-5 items-center justify-center rounded-md text-[8px] font-bold ${match.result === 'W' ? 'bg-primary text-primary-foreground' : match.result === 'D' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
            {match.result}
          </span>
        )) || <span className="text-[10px] text-muted-foreground">No form data</span>}
      </div>
      <span className="mono-font text-[10px] font-semibold text-primary">{points} pts</span>
    </div>
  );
}

function SidebarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
      <div className="display-font text-lg font-semibold text-primary">{value}</div>
      <div className="mt-1 truncate text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
    </div>
  );
}

function TeamInsightsTab({ data, selectedTeam, setSelectedTeam }: { data: DashboardData; selectedTeam: string; setSelectedTeam: (value: string) => void }) {
  const team = data.teamStats.find((item) => item.team === selectedTeam) || data.teamStats[0];
  const performance = team ? data.clubPerformance[team.team] : undefined;
  const form = team ? data.formByClub[team.team] : undefined;
  const trendData = data.seasonTrends.map((item) => ({
    ...item,
    season: String(item.season),
    'Goals / match': Number(item.goalsPerMatch.toFixed(2)),
    'Home win': Number((item.homeWinRate * 100).toFixed(1)),
    Draw: Number((item.drawRate * 100).toFixed(1)),
    'Away win': Number((item.awayWinRate * 100).toFixed(1)),
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="flex items-center gap-3">
            <ClubCrest team={team.team} size="lg" />
            <div>
              <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-primary">Exploration / team evidence</p>
              <h2 className="display-font mt-2 text-3xl font-semibold tracking-[-0.03em]">Compare form with the league story.</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Inspect performance, squad ratings, and an inferred matchday shape without losing the historical evidence underneath.</p>
            </div>
        </div>
        <div className="w-full sm:w-[280px]">
          <label htmlFor="insight-team-select" className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Focus team</label>
          <Select value={team?.team || ''} onValueChange={setSelectedTeam}>
            <SelectTrigger id="insight-team-select" data-testid="select-insight-team" className="h-11 bg-card"><SelectValue placeholder="Select a team" /></SelectTrigger>
            <SelectContent>{data.teamStats.map((item) => <SelectItem key={item.team} value={item.team}>{item.team}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {team && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard icon={Trophy} label="Season points" value={String(team.points)} note={`${team.wins} wins · ${team.draws} draws`} accent="primary" />
          <MetricCard icon={Activity} label="Matches played" value={String(team.played)} note={`${team.losses} losses`} accent="default" />
          <MetricCard icon={TrendingUp} label="Goals scored" value={String(team.goalsFor)} note={`${team.goalsAgainst} conceded`} accent="accent" />
          <MetricCard icon={Target} label="Goal difference" value={`${team.goalDifference > 0 ? '+' : ''}${team.goalDifference}`} note={`${(team.goalsFor / Math.max(team.played, 1)).toFixed(2)} goals per match`} accent="default" />
        </section>
      )}

      {team && performance && form && (
        <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <Card className="overflow-hidden rounded-3xl">
            <CardHeader className="border-b border-border/70"><CardTitle className="display-font text-xl">Recent form</CardTitle><CardDescription>The five latest available results for {team.team}.</CardDescription></CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="mb-5 flex items-center gap-2">{form.matches.map((match, index) => <div key={`${match.kickoff}-${index}`} title={`${match.result} ${match.goalsFor}-${match.goalsAgainst} vs ${match.opponent}`} className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${match.result === 'W' ? 'bg-emerald-100 text-emerald-700' : match.result === 'D' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{match.result}</div>)}<div className="ml-auto text-right"><div className="text-sm font-semibold">{form.wins * 3 + form.draws} points</div><div className="text-[10px] text-muted-foreground">{form.goalsFor} scored · {form.goalsAgainst} conceded</div></div></div>
              <div className="divide-y divide-border/70">{form.matches.map((match) => <div key={`${match.kickoff}-${match.opponent}`} className="grid grid-cols-[40px_1fr_auto] items-center gap-3 py-3"><Badge variant="outline" className="justify-center text-[9px]">{match.venue}</Badge><div className="text-xs font-medium">{match.opponent}</div><div className="mono-font text-xs font-semibold">{match.goalsFor}–{match.goalsAgainst}</div></div>)}</div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden rounded-3xl">
            <CardHeader className="border-b border-border/70"><CardTitle className="display-font text-xl">Scoring tendencies</CardTitle><CardDescription>Long-run club context from the complete match dataset.</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 p-4 sm:p-6">
              <CompactInsight label="Goals / match" value={performance.goalsPerMatch.toFixed(2)} />
              <CompactInsight label="Conceded / match" value={performance.concededPerMatch.toFixed(2)} />
              <CompactInsight label="Clean sheets" value={`${(performance.cleanSheets / performance.matches * 100).toFixed(1)}%`} />
              <CompactInsight label="Both scored" value={`${(performance.bothTeamsScored / performance.matches * 100).toFixed(1)}%`} />
              <CompactInsight label="Home win rate" value={`${(performance.homeWinRate * 100).toFixed(1)}%`} />
              <CompactInsight label="Away win rate" value={`${(performance.awayWinRate * 100).toFixed(1)}%`} />
            </CardContent>
          </Card>
        </div>
      )}

      {team && <ClubFormation club={team.team} players={data.playersByClub[team.team] || []} />}

      {team && <SquadPanel club={team.team} players={data.playersByClub[team.team] || []} side="Selected club" />}

      <div className="grid gap-5 xl:grid-cols-[1.08fr_.92fr]">
        <Card className="playful-pop overflow-hidden rounded-3xl">
          <CardHeader className="border-b border-border/70 pb-5">
            <CardTitle className="display-font text-xl">Historical outcome trends</CardTitle>
            <CardDescription className="mt-1">Home, draw, and away result rates by season.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-7 sm:p-7">
            <div className="h-[330px]" data-testid="chart-season-trends">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 10, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="season" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} minTickGap={24} />
                  <YAxis domain={[0, 60]} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} formatter={(value: number) => [`${value}%`]} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                  <Line type="monotone" dataKey="Home win" stroke={CHART_COLORS.primary} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="Draw" stroke={CHART_COLORS.accent} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="Away win" stroke={CHART_COLORS.blue} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl">
          <CardHeader className="border-b border-border/70 pb-5">
            <CardTitle className="display-font text-xl">Latest season table</CardTitle>
            <CardDescription className="mt-1">Calculated directly from the {data.latestSeason} match results.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[408px] overflow-auto p-0">
            <table className="w-full min-w-[440px] text-sm" data-testid="table-team-standings">
              <thead className="sticky top-0 z-10 bg-muted"><tr className="text-left text-[10px] uppercase tracking-[0.11em] text-muted-foreground"><th className="px-4 py-3">#</th><th className="px-4 py-3">Team</th><th className="px-3 py-3 text-right">P</th><th className="px-3 py-3 text-right">GD</th><th className="px-4 py-3 text-right">Pts</th></tr></thead>
              <tbody className="divide-y divide-border/70">
                {data.teamStats.map((item, index) => <tr key={item.team} className={item.team === team?.team ? 'bg-primary/[0.06]' : 'hover:bg-muted/35'}><td className="px-4 py-3 text-xs text-muted-foreground">{index + 1}</td><td className="px-4 py-3"><div className="flex items-center gap-2.5"><ClubCrest team={item.team} size="sm" /><span className="font-semibold">{item.team}</span></div></td><td className="px-3 py-3 text-right text-muted-foreground">{item.played}</td><td className="px-3 py-3 text-right text-muted-foreground">{item.goalDifference > 0 ? '+' : ''}{item.goalDifference}</td><td className="px-4 py-3 text-right font-semibold">{item.points}</td></tr>)}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SquadPanel({ club, players, side, compact = false }: { club: string; players: PlayerProfile[]; side: string; compact?: boolean }) {
  const [, navigate] = useLocation();
  const topPlayer = players[0];
  const average = players.length ? players.reduce((sum, player) => sum + player.overallRating, 0) / players.length : 0;
  const positions = new Set(players.map((player) => player.position)).size;

  if (!players.length) {
    return <EmptyState title={`No ${club} players`} detail="No matching player ratings were found for this club." />;
  }

  return (
    <Card className="playful-pop overflow-hidden rounded-3xl" data-testid={`squad-${club.toLowerCase().replaceAll(' ', '-')}`}>
      <div className="relative overflow-hidden border-b border-border/70 bg-gradient-to-br from-primary/[0.12] via-card to-accent/[0.13] p-5">
        <div className="absolute -right-7 -top-8 h-28 w-28 rounded-full border-[18px] border-primary/[0.08]" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <ClubCrest team={club} size="lg" />
            <div>
            <div className="mono-font text-[9px] uppercase tracking-[0.18em] text-primary">{side} · squad intelligence</div>
            <h3 className="display-font mt-2 text-xl font-semibold">{club}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{players.length} rated players · {positions} positions · {average.toFixed(1)} average</p>
            </div>
          </div>
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
            <span className="display-font text-xl font-semibold">{topPlayer.overallRating}</span>
            <span className="text-[8px] uppercase tracking-wider">Top OVR</span>
          </div>
        </div>
        <div className="relative mt-4 flex items-center gap-3 rounded-2xl border border-white/35 bg-card/75 p-3 backdrop-blur">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/25 text-accent-foreground"><UserRound className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{topPlayer.commonName || topPlayer.name}</div><div className="text-[10px] text-muted-foreground">Highest-rated player · {getPositionLabel(topPlayer.position)}</div></div>
          <div className="mono-font text-sm font-semibold text-primary">{topPlayer.overallRating}</div>
        </div>
      </div>

      <CardContent className="p-3 sm:p-4">
        <div className={`grid gap-2 ${compact ? 'sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {players.map((player, index) => (
            <button type="button" key={player.id} onClick={() => navigate(`/player/${player.id}`)} data-testid={`player-${player.id}`} className="group grid w-full grid-cols-[30px_minmax(0,1fr)_42px] items-center gap-3 rounded-2xl border border-border/70 bg-card px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.035] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="mono-font text-center text-[10px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="truncate text-xs font-semibold sm:text-sm">{player.commonName || player.name}</span><Badge variant="outline" className="h-auto min-h-5 shrink-0 px-1.5 py-1 text-[8px] leading-tight">{getPositionLabel(player.position)}</Badge></div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <PlayerAttribute label="PAC" value={player.pace} />
                  <PlayerAttribute label="PAS" value={player.passing} />
                  <PlayerAttribute label={player.position === 'GK' ? 'PHY' : 'SHO'} value={player.position === 'GK' ? player.physical : player.shooting} />
                </div>
              </div>
              <div className={`mono-font relative flex h-9 w-9 items-center justify-center rounded-xl text-xs font-semibold ${player.overallRating >= 85 ? 'bg-accent/25 text-accent-foreground' : player.overallRating >= 80 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{player.overallRating}<ChevronRight className="absolute -right-3 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" /></div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PlayerAttribute({ label, value }: { label: string; value: number }) {
  return <div><div className="flex items-center justify-between text-[8px] text-muted-foreground"><span>{label}</span><span>{value}</span></div><div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} /></div></div>;
}

function CompactInsight({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-muted/25 p-4"><div className="display-font text-xl font-semibold">{value}</div><div className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div></div>;
}

function ModelProfile({ model }: { model: string }) {
  const isTree = model.toLowerCase().includes('tree');
  return (
    <div className="rounded-xl border border-border/80 bg-muted/35 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold"><BrainCircuit className="h-3.5 w-3.5 text-primary" /> Model profile</div>
      {isTree ? (
        <div className="mt-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-semibold">Recent form</div>
            <div className="h-3 w-px bg-border" />
            <div className="grid w-full max-w-[440px] grid-cols-2 gap-3">
              <div className="relative rounded-md border border-border bg-card px-3 py-2 text-center text-xs"><span className="block text-[10px] text-muted-foreground">home advantage</span><span className="font-semibold">Home path</span></div>
              <div className="relative rounded-md border border-border bg-card px-3 py-2 text-center text-xs"><span className="block text-[10px] text-muted-foreground">scoring form</span><span className="font-semibold">Away path</span></div>
            </div>
          </div>
          <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground"><CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Illustrative decision path for presentation context; the underlying prediction remains the supplied stored output.</p>
        </div>
      ) : <p className="mt-3 text-xs leading-relaxed text-muted-foreground">The selected model's stored output is shown above with its held-out metrics. Switch models to compare the inference surface.</p>}
    </div>
  );
}

function EvaluationTab({ data, selectedModel, setSelectedModel }: { data: DashboardData; selectedModel: string; setSelectedModel: (value: string) => void }) {
  const sortedMetrics = useMemo(() => [...data.metrics].sort((a, b) => b.accuracy - a.accuracy), [data.metrics]);
  const chartData = sortedMetrics.map((metric) => ({ name: metric.model, Accuracy: Number((metric.accuracy * 100).toFixed(1)), 'Draw F1': Number((metric.drawF1 * 100).toFixed(1)) }));
  const featureData = (data.featureImportance[selectedModel] || []).slice(0, 10).map((item) => ({
    feature: readableFeature(item.feature),
    importance: Number((item.importance * 100).toFixed(1)),
  })).reverse();
  const classMetrics = data.classMetrics[selectedModel] || [];
  const matrix = data.confusionMatrices[selectedModel];
  const matrixMax = matrix ? Math.max(...matrix.values.flat(), 1) : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-primary">Evaluation / held-out performance</p>
          <h2 className="display-font mt-2 text-3xl font-semibold tracking-[-0.03em]">Know what the models get right.</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Compare headline scores, class-level behavior, feature influence, and the exact prediction errors made on unseen matches.</p>
        </div>
        <div className="w-full sm:w-[280px]">
          <label htmlFor="evaluation-model-select" className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Inspect model</label>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger id="evaluation-model-select" data-testid="select-evaluation-model" className="h-11 bg-card"><SelectValue placeholder="Select a model" /></SelectTrigger>
            <SelectContent>{data.metrics.map((metric) => <SelectItem key={metric.model} value={metric.model}>{metric.model}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-start justify-between space-y-0 border-b border-border/70 pb-5">
          <div><CardTitle className="display-font text-xl">Model comparison</CardTitle><CardDescription className="mt-1">Accuracy against draw detection capability.</CardDescription></div>
          <Badge variant="outline" className="hidden gap-1.5 text-[10px] sm:flex"><Info className="h-3 w-3" /> Percent</Badge>
        </CardHeader>
        <CardContent className="p-5 pt-7 sm:p-7">
          {chartData.length ? <div className="h-[310px] sm:h-[360px]" data-testid="chart-model-comparison">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(value) => `${value}%`} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted) / .55)' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '10px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} formatter={(value: number) => [`${value}%`]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '14px' }} />
                <Bar dataKey="Accuracy" fill={CHART_COLORS.primary} radius={[4, 4, 1, 1]} isAnimationActive={false} />
                <Bar dataKey="Draw F1" fill={CHART_COLORS.accent} radius={[4, 4, 1, 1]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div> : <EmptyState title="No model metrics" detail="Evaluation data will appear when model metrics are available." />}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="playful-pop overflow-hidden rounded-3xl">
          <CardHeader className="border-b border-border/70 pb-5">
            <CardTitle className="display-font text-xl">What influences {selectedModel}</CardTitle>
            <CardDescription className="mt-1">Top ten features, normalised within this model.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-7 sm:p-7">
            {featureData.length ? <div className="h-[360px]" data-testid="chart-feature-importance">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureData} layout="vertical" margin={{ top: 0, right: 28, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 5" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="feature" type="category" axisLine={false} tickLine={false} width={150} tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} formatter={(value: number) => [`${value}%`, 'Relative influence']} />
                  <Bar dataKey="importance" fill={CHART_COLORS.primary} radius={[0, 5, 5, 0]} isAnimationActive={false} label={{ position: 'right', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                </BarChart>
              </ResponsiveContainer>
            </div> : <EmptyState title="No feature importance" detail="This model did not expose feature influence values." />}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl">
          <CardHeader className="border-b border-border/70 pb-5">
            <CardTitle className="display-font text-xl">Confusion matrix</CardTitle>
            <CardDescription className="mt-1">Rows are actual outcomes; columns are predicted outcomes.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 sm:p-7">
            {matrix ? (
              <div data-testid="matrix-model-evaluation">
                <div className="mb-3 grid grid-cols-[86px_repeat(3,1fr)] gap-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <div /><div>Home</div><div>Draw</div><div>Away</div>
                </div>
                {matrix.values.map((row, rowIndex) => (
                  <div key={matrix.labels[rowIndex]} className="mb-2 grid grid-cols-[86px_repeat(3,1fr)] gap-2">
                    <div className="flex items-center text-xs font-semibold">{outcomeInfo[matrix.labels[rowIndex]]?.label}</div>
                    {row.map((value, columnIndex) => {
                      const correct = rowIndex === columnIndex;
                      const intensity = 0.08 + (value / matrixMax) * 0.72;
                      return <div key={`${rowIndex}-${columnIndex}`} className="flex min-h-20 flex-col items-center justify-center rounded-2xl border border-border text-center" style={{ backgroundColor: correct ? `hsl(var(--primary) / ${intensity})` : `hsl(var(--accent) / ${intensity * 0.55})` }}><span className="display-font text-xl font-semibold">{value}</span><span className="mt-1 text-[9px] text-muted-foreground">{correct ? 'correct' : 'misclassified'}</span></div>;
                    })}
                  </div>
                ))}
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">A strong diagonal means correct classifications. Off-diagonal cells show exactly which outcomes the model confuses.</p>
              </div>
            ) : <EmptyState title="No confusion matrix" detail="No class-by-class prediction counts are available." />}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-3xl">
        <CardHeader className="border-b border-border/70 pb-5"><CardTitle className="display-font text-xl">{selectedModel} by outcome</CardTitle><CardDescription className="mt-1">Precision, recall, and F1 on the held-out 2023–2025 test period.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-3 sm:p-7">
          {classMetrics.map((metric) => <div key={metric.outcome} className="playful-pop rounded-2xl border border-border bg-card p-4"><div className="flex items-center justify-between"><span className="font-semibold">{outcomeInfo[metric.outcome]?.label || metric.outcome}</span><Badge variant="secondary">{metric.support.toLocaleString()} matches</Badge></div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><ScoreStat label="Precision" value={metric.precision} /><ScoreStat label="Recall" value={metric.recall} /><ScoreStat label="F1" value={metric.f1} /></div></div>)}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/70 pb-5"><CardTitle className="display-font text-xl">Performance metrics</CardTitle><CardDescription className="mt-1">A readable comparison of every supplied model.</CardDescription></CardHeader>
        <CardContent className="p-0">
          {sortedMetrics.length ? <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm" data-testid="table-performance-metrics">
              <thead><tr className="border-b border-border/70 bg-muted/45 text-left text-[10px] uppercase tracking-[0.11em] text-muted-foreground"><th className="px-5 py-4 font-semibold">Model architecture</th><th className="px-5 py-4 font-semibold">Overall accuracy</th><th className="px-5 py-4 font-semibold">Macro F1</th><th className="px-5 py-4 font-semibold">Draw F1</th></tr></thead>
              <tbody className="divide-y divide-border/70">
                {sortedMetrics.map((metric, index) => <tr key={metric.model} data-testid={`row-model-metric-${index}`} className="transition-colors hover:bg-muted/35">
                  <td className="px-5 py-4 font-semibold"><span className="flex items-center gap-2">{index === 0 && <Trophy className="h-3.5 w-3.5 text-accent" />}{metric.model}{index === 0 && <Badge className="ml-1 bg-primary/10 text-[10px] text-primary hover:bg-primary/10">Best accuracy</Badge>}</span></td>
                  <td className="mono-font px-5 py-4">{(metric.accuracy * 100).toFixed(1)}%</td>
                  <td className="mono-font px-5 py-4 text-muted-foreground">{(metric.macroF1 * 100).toFixed(1)}%</td>
                  <td className="px-5 py-4"><span className={`mono-font rounded-md px-2 py-1 text-xs ${metric.drawF1 > 0.3 ? 'bg-accent/20 text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{(metric.drawF1 * 100).toFixed(1)}%</span></td>
                </tr>)}
              </tbody>
            </table>
          </div> : <div className="p-6"><EmptyState title="No metrics to compare" detail="The evaluation table is waiting for model results." /></div>}
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreStat({ label, value }: { label: string; value: number }) {
  return <div><div className="display-font text-xl font-semibold">{(value * 100).toFixed(1)}%</div><div className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div></div>;
}

function readableFeature(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function ProvenanceCard({ provenance, compact = false }: { provenance: DashboardData['provenance']; compact?: boolean }) {
  if (!provenance) return null;
  return (
    <Card className={compact ? '' : 'border-primary/15'}>
      <CardHeader className="border-b border-border/70 pb-5"><div className="flex items-start justify-between gap-4"><div><CardTitle className="display-font text-xl">Evidence & provenance</CardTitle><CardDescription className="mt-1">The local reproduction is pinned to its public source evidence.</CardDescription></div><ShieldCheck className="h-5 w-5 text-primary" /></div></CardHeader>
      <CardContent className="grid gap-5 p-5 text-sm sm:grid-cols-2 sm:p-6">
        <div><div className="mono-font text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Repository</div><a data-testid="link-provenance-repository" className="mt-2 block break-all font-medium text-primary underline-offset-4 hover:underline" href={provenance.repository} target="_blank" rel="noreferrer">{provenance.repository}</a></div>
        <div><div className="mono-font text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Source commit</div><div data-testid="text-provenance-commit" className="mono-font mt-2 flex items-center gap-2"><GitCommitHorizontal className="h-3.5 w-3.5 text-muted-foreground" />{provenance.source_commit.slice(0, 10)}</div></div>
        <div><div className="mono-font text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Feature contract</div><div data-testid="text-provenance-feature-contract" className="mt-2 leading-relaxed">{provenance.feature_contract}</div></div>
        <div><div className="mono-font text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Standings source</div><div data-testid="text-provenance-standings" className="mt-2 leading-relaxed">{provenance.historical_standings_source}</div></div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, detail, large = false }: { title: string; detail: string; large?: boolean }) {
  return <div data-testid={`empty-${title.toLowerCase().replaceAll(' ', '-')}`} className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center ${large ? 'min-h-[405px]' : 'min-h-[180px]'}`}><div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><Database className="h-4 w-4" /></div><p className="mt-4 text-sm font-semibold">{title}</p><p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{detail}</p></div>;
}

function safeDate(value: string) {
  try { return format(new Date(value), 'MMM d, yyyy'); } catch { return 'Date unavailable'; }
}

function exportDashboardReport(data: DashboardData, selectedModel: string, homeTeam: string, awayTeam: string) {
  generateMatchReportPdf(data, selectedModel, homeTeam, awayTeam);
}

async function shareDashboard() {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'PremierPredict', text: 'Explore Premier League match predictions and model evidence.', url: window.location.href });
      return true;
    } catch {
      try { await navigator.clipboard.writeText(window.location.href); } catch { /* browser permission denied */ }
      return false;
    }
  }
  try { await navigator.clipboard.writeText(window.location.href); } catch { /* browser permission denied */ }
  return false;
}

function DashboardSkeleton() {
  return <div className="min-h-[100dvh] bg-background"><div className="hidden h-screen w-[248px] bg-sidebar lg:block fixed left-0 top-0" /><div className="lg:pl-[248px]"><div className="h-20 border-b border-border bg-card" /><main className="space-y-8 p-5 sm:p-8 lg:p-10"><div className="space-y-3"><Skeleton className="h-3 w-48" /><Skeleton className="h-10 w-[min(560px,80vw)]" /><Skeleton className="h-4 w-80" /></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div><div className="grid gap-5 xl:grid-cols-2"><Skeleton className="h-[390px]" /><Skeleton className="h-[390px]" /></div></main></div></div>;
}
