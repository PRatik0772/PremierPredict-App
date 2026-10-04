import { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { CaptainMatchupHero } from '@/components/CaptainMatchupHero';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useLiveOdds } from '@/hooks/use-live-odds';
import { resolveModelTeam, type OddsOutcome } from '@/lib/live-odds';
import type { DashboardData } from '@/hooks/use-dashboard-data';

const OUT: OddsOutcome[] = ['H', 'D', 'A'];
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const when = (v: string) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? 'Unknown' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); };

export function LiveOddsPanel({ data }: { data: DashboardData }) {
  const { data: feed, isLoading, isError, error, refetch, isFetching } = useLiveOdds();
  const [fixtureId, setFixtureId] = useState('');
  const [book, setBook] = useState('');
  const [model, setModel] = useState(data.metrics[0]?.model ?? '');

  const fixture = useMemo(() => feed?.fixtures.find((f) => f.id === fixtureId) ?? feed?.fixtures[0], [feed, fixtureId]);
  const market = fixture?.markets.find((m) => m.bookmaker === book) ?? fixture?.markets[0];
  const home = fixture ? resolveModelTeam(fixture.homeTeam, data.teams) : null;
  const away = fixture ? resolveModelTeam(fixture.awayTeam, data.teams) : null;
  const prediction = home && away ? data.predictions[model]?.[`${home}|||${away}`] : undefined;
  const modelProb = (o: OddsOutcome) => prediction?.probabilities.find((p) => p.outcome === o)?.probability;
  const label: Record<OddsOutcome, string> = { H: 'Home', D: 'Draw', A: 'Away' };

  const retry = (
    <Button size="sm" variant="outline" className="gap-2" onClick={() => refetch()} disabled={isFetching} data-testid="button-retry-odds">
      <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />{isFetching ? 'Fetching' : 'Refetch'}
    </Button>
  );

  return (
    <div className="space-y-5" data-testid="panel-live-odds">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="mono-font text-[10px] uppercase tracking-[0.2em] text-primary">Live odds / model comparison</p>
          <h2 className="display-font mt-1 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Fixtures vs bookmaker prices.</h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">Public ESPN prices compared with stored model probabilities. Comparison only, no wagers.</p>
        </div>
        {retry}
      </div>

      {isLoading ? (
        <div className="space-y-3" data-testid="state-odds-loading"><Skeleton className="h-14 w-full" /><Skeleton className="h-64 w-full" /></div>
      ) : isError ? (
        <Card className="border-destructive/30" data-testid="state-odds-error"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" /><div><p className="font-semibold">Odds provider error</p><p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'The odds provider could not be read.'} No odds are shown.</p></div></div>
          {retry}
        </CardContent></Card>
      ) : !feed || feed.fixtures.length === 0 ? (
        <Card data-testid="state-odds-empty"><CardContent className="p-8 text-center"><p className="font-semibold">No upcoming EPL fixtures in the feed</p><p className="mt-1 text-sm text-muted-foreground">The provider returned an empty pre-match schedule. Nothing is estimated in its place.</p></CardContent></Card>
      ) : fixture && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-1">
              <label htmlFor="odds-fixture-select" className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Fixture</label>
              <Select value={fixture.id} onValueChange={(v) => { setFixtureId(v); setBook(''); }}>
                <SelectTrigger id="odds-fixture-select" data-testid="select-odds-fixture" className="h-11 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>{feed.fixtures.map((f) => <SelectItem key={f.id} value={f.id}>{f.homeTeam} v {f.awayTeam} · {when(f.kickoff)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="odds-book-select" className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Bookmaker</label>
              {fixture.markets.length ? (
                <Select value={market?.bookmaker ?? ''} onValueChange={setBook}>
                  <SelectTrigger id="odds-book-select" data-testid="select-odds-bookmaker" className="h-11 bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>{fixture.markets.map((m) => <SelectItem key={m.bookmaker} value={m.bookmaker}>{m.bookmaker}</SelectItem>)}</SelectContent>
                </Select>
              ) : <div className="flex h-11 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">None available</div>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="odds-model-select" className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Model</label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="odds-model-select" data-testid="select-odds-model" className="h-11 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>{data.metrics.map((m) => <SelectItem key={m.model} value={m.model}>{m.model}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <CaptainMatchupHero home={fixture.homeTeam} away={fixture.awayTeam} />
          <Card className="overflow-hidden rounded-2xl">
            <CardHeader className="border-b border-border/70 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="display-font text-xl" data-testid="text-odds-fixture">{fixture.homeTeam} v {fixture.awayTeam}</CardTitle>
                  <CardDescription className="mt-1">Kickoff {when(fixture.kickoff)} · model identity: {home ?? 'unresolved'} / {away ?? 'unresolved'}</CardDescription>
                </div>
                {market && <Badge variant="outline" className="mono-font text-[10px]">Margin {pct(market.overround)}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              {(!home || !away) && <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm" data-testid="state-odds-missing-model">No model club for {[!home && fixture.homeTeam, !away && fixture.awayTeam].filter(Boolean).join(' and ')}; it is absent from the historical model data, so no model probability is shown.</p>}
              {home && away && !prediction && <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm">{model} has no stored prediction for {home} v {away}.</p>}
              {!market ? (
                <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm" data-testid="state-odds-no-prices">No complete home/draw/away market is available for this fixture. Prices are not estimated.</p>
              ) : (
                <div className="space-y-4">
                  {prediction && <p className="rounded-lg border border-primary/30 bg-primary/[0.06] p-3 text-sm" data-testid="text-odds-model-pick">{model} most likely outcome: <strong>{prediction.predicted === 'H' ? `${fixture.homeTeam} win` : prediction.predicted === 'A' ? `${fixture.awayTeam} win` : 'Draw'}</strong>. This is the model's estimate from historical data, not a guarantee.</p>}
                  <div className="grid gap-3 md:grid-cols-3">
                    {OUT.map((o) => {
                      const p = market.prices.find((x) => x.outcome === o);
                      const m = modelProb(o);
                      const title = o === 'H' ? `${fixture.homeTeam} wins` : o === 'A' ? `${fixture.awayTeam} wins` : 'Draw';
                      const top = prediction?.predicted === o;
                      return (
                        <div key={o} className={`rounded-2xl border p-4 ${top ? 'border-primary/40 bg-primary/[0.06]' : 'border-border bg-card'}`} data-testid={`card-odds-${o}`}>
                          <div className="flex items-center justify-between gap-2"><h3 className="display-font text-base font-semibold">{title}</h3>{top && <Badge className="bg-primary text-[9px]">Model's pick</Badge>}</div>
                          <dl className="mt-3 space-y-2.5 text-sm">
                            <div><dt className="text-[11px] text-muted-foreground">Model chance (%)</dt><dd className="display-font text-2xl font-semibold">{m === undefined ? 'n/a' : pct(m)}</dd></div>
                            <div><dt className="text-[11px] text-muted-foreground">Bookmaker chance (%, margin-normalized)</dt><dd className="mono-font text-lg">{p ? pct(p.normalizedProbability) : 'n/a'}</dd></div>
                            <div><dt className="text-[11px] text-muted-foreground">Decimal odds (multiplier, not %)</dt><dd className="mono-font text-lg">{p ? `${p.decimal.toFixed(2)}x` : 'n/a'}</dd></div>
                          </dl>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                    <p><strong className="text-foreground">Reading decimal odds:</strong> a price of 2.50 means a 10 unit stake would return 25 in total if that outcome happened (15 profit). Lower numbers mean the bookmaker rates the outcome as more likely.</p>
                    <p><strong className="text-foreground">Source and timing:</strong> {feed.source}; prices retrieved by this browser at {when(feed.fetchedAt)}. The quote time is unavailable. Model cutoff: {data.provenance?.prediction_as_of ?? 'not recorded'}.</p>
                  </div>
                  <details className="rounded-lg border border-border p-3 text-sm" data-testid="details-odds-advanced">
                    <summary className="cursor-pointer font-medium">Advanced calculation details</summary>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm" data-testid="table-odds">
                        <thead><tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-3">Outcome</th><th className="px-3">Decimal</th><th className="px-3">Raw implied</th><th className="px-3">Normalized</th><th className="px-3">{model}</th><th className="pl-3">Model − normalized</th>
                        </tr></thead>
                        <tbody>{OUT.map((o) => {
                          const p = market.prices.find((x) => x.outcome === o);
                          const m = modelProb(o);
                          return (
                            <tr key={o} className="border-b border-border/60 last:border-0" data-testid={`row-odds-${o}`}>
                              <td className="py-3 pr-3 font-medium">{label[o]}</td>
                              <td className="mono-font px-3">{p ? p.decimal.toFixed(2) : 'n/a'}</td>
                              <td className="mono-font px-3">{p ? pct(p.impliedProbability) : 'n/a'}</td>
                              <td className="mono-font px-3">{p ? pct(p.normalizedProbability) : 'n/a'}</td>
                              <td className="mono-font px-3">{m === undefined ? 'n/a' : pct(m)}</td>
                              <td className="mono-font pl-3">{m === undefined || !p ? 'n/a' : `${(m - p.normalizedProbability) * 100 >= 0 ? '+' : ''}${((m - p.normalizedProbability) * 100).toFixed(1)} pts`}</td>
                            </tr>
                          );
                        })}</tbody>
                      </table>
                      <p className="mt-3 text-[11px] text-muted-foreground">Raw implied = 1 / decimal price (sums above 100% by the margin). Normalized divides by that sum.</p>
                    </div>
                  </details>
                </div>
              )}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground" data-testid="text-odds-timestamps">Model cutoff: {data.provenance?.prediction_as_of ?? 'not recorded'}. Retrieved <span data-testid="text-odds-fetched-at">{when(feed.fetchedAt)}</span> (retrieval time, not quote time). Live odds never update the model. Prices are not streamed; use Refetch.</p>
          <p className="text-xs text-muted-foreground" data-testid="text-odds-coverage">{feed.fixtures.length} upcoming fixtures, {feed.pricedFixtures} with at least one complete market.</p>
        </>
      )}
    </div>
  );
}
