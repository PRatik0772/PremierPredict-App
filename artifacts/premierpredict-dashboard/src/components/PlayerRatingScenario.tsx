import { useEffect, useMemo, useState } from 'react';
import type { DashboardData, PlayerProfile } from '@/hooks/use-dashboard-data';
import { useInferenceArtifact } from '@/hooks/use-inference-artifact';
import { scoreFixtureScenario } from '@/lib/model-inference';
import { Badge } from '@/components/ui/badge';
import { PlayerAvatar } from '@/components/PlayerAvatar';

type Props = { data: DashboardData; model: string; homeTeam: string; awayTeam: string };

const outcomeName = (o: string) => (o === 'H' ? 'Home win' : o === 'A' ? 'Away win' : 'Draw');
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function stats(squad: PlayerProfile[], excluded: number[]) {
  const rest = squad.filter((p) => !excluded.includes(p.id));
  return {
    count: rest.length,
    avg: rest.length ? rest.reduce((s, p) => s + p.overallRating, 0) / rest.length : 0,
    max: rest.length ? Math.max(...rest.map((p) => p.overallRating)) : 0,
  };
}

export function PlayerRatingScenario({ data, model, homeTeam, awayTeam }: Props) {
  const query = useInferenceArtifact(data);
  const artifact = query.data;
  const [exHome, setExHome] = useState<number[]>([]);
  const [exAway, setExAway] = useState<number[]>([]);

  useEffect(() => {
    setExHome([]);
    setExAway([]);
  }, [homeTeam, awayTeam, artifact]);

  const squads = useMemo(() => ({
    home: [...(data.playersByClub[homeTeam] || [])].sort((a, b) => b.overallRating - a.overallRating),
    away: [...(data.playersByClub[awayTeam] || [])].sort((a, b) => b.overallRating - a.overallRating),
  }), [data, homeTeam, awayTeam]);

  const result = useMemo(() => {
    if (!artifact) return { error: null as string | null, value: null };
    try {
      return { error: null, value: scoreFixtureScenario(artifact, data, homeTeam, awayTeam, exHome, exAway) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Scenario unavailable.', value: null };
    }
  }, [artifact, data, homeTeam, awayTeam, exHome, exAway]);

  const toggle = (side: 'home' | 'away', id: number) => {
    const [list, set, squad] = side === 'home' ? [exHome, setExHome, squads.home] : [exAway, setExAway, squads.away];
    if (list.includes(id)) return set(list.filter((x) => x !== id));
    if (list.length >= squad.length - 1) return; // keep at least one player
    set([...list, id]);
  };

  const excludeTop = (side: 'home' | 'away') => {
    const [list, set, squad] = side === 'home' ? [exHome, setExHome, squads.home] : [exAway, setExAway, squads.away];
    const top = squad.find((p) => !list.includes(p.id));
    if (top) toggle(side, top.id);
    void set;
  };

  const reset = () => { setExHome([]); setExAway([]); };
  const base = result.value?.baseline[model];
  const scen = result.value?.predictions[model];

  const renderSide = (side: 'home' | 'away', team: string) => {
    const squad = squads[side];
    const ex = side === 'home' ? exHome : exAway;
    const s = stats(squad, ex);
    const orig = stats(squad, []);
    return (
      <div className="rounded-2xl border border-border/70 bg-background p-4" data-testid={`panel-${side}-squad`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="mono-font text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{side}</div>
            <div className="truncate text-sm font-semibold">{team}</div>
          </div>
          <button type="button" data-testid={`button-exclude-top-${side}`} disabled={!artifact || ex.length >= squad.length - 1}
            onClick={() => excludeTop(side)}
            className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-semibold hover:border-primary/40 disabled:opacity-40">
            Exclude highest-rated
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[['Remaining', `${s.count} / ${orig.count}`], ['Average', s.avg.toFixed(2)], ['Max', String(s.max)]].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-muted/50 p-2">
              <div data-testid={`text-${side}-${l.toLowerCase()}`} className="display-font text-lg font-semibold text-primary">{v}</div>
              <div className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
        {squad.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">No rated players stored for {team}.</p> : (
          <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1">
            {squad.map((p) => {
              const out = ex.includes(p.id);
              const locked = !out && ex.length >= squad.length - 1;
              return (
                <li key={p.id}>
                  <label className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted/50 ${out ? 'opacity-55' : ''}`}>
                    <input type="checkbox" data-testid={`checkbox-player-${side}-${p.id}`} checked={out} disabled={!artifact || locked}
                      onChange={() => toggle(side, p.id)} aria-label={`Exclude ${p.name}`} />
                    <PlayerAvatar player={p} className="h-8 w-8" />
                    <span className={`min-w-0 flex-1 truncate ${out ? 'line-through' : ''}`}>{p.name}</span>
                    <span className="mono-font text-[10px] text-muted-foreground">{p.position}</span>
                    <span className="mono-font w-6 text-right text-[11px] font-semibold text-primary">{p.overallRating}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  return (
    <section data-testid="panel-player-rating-scenario" className="rounded-[1.5rem] border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mono-font text-[9px] uppercase tracking-[0.18em] text-primary">Player rating scenario</div>
          <h3 className="display-font mt-1 text-xl font-semibold">Exclude players, rerun the {model} model</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[9px]">{exHome.length + exAway.length} excluded</Badge>
          <button type="button" data-testid="button-reset-scenario" onClick={reset}
            disabled={exHome.length + exAway.length === 0}
            className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-40">
            Reset
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        This reruns the numeric trained model parameters with only the rating inputs changed (average, maximum and availability). Nothing is retrained. It is not a confirmed lineup and does not guarantee any outcome change.
      </p>

      {query.isLoading && <div data-testid="status-scenario-loading" className="mt-4 h-24 animate-pulse rounded-2xl bg-muted" role="status">Loading trained model parameters...</div>}
      {query.isError && (
        <div data-testid="status-scenario-error" role="alert" className="mt-4 rounded-2xl border border-destructive/40 p-4 text-xs">
          Scenario unavailable: {query.error instanceof Error ? query.error.message : 'the model could not be loaded.'}
          <button type="button" onClick={() => query.refetch()} className="ml-3 font-semibold underline">Retry</button>
        </div>
      )}
      {artifact && (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {renderSide('home', homeTeam)}
            {renderSide('away', awayTeam)}
          </div>
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/[0.05] p-4">
            <div className="mono-font text-[9px] uppercase tracking-[0.16em] text-primary">Scenario probabilities / {model}</div>
            {result.error || !base || !scen ? (
              <p data-testid="status-scenario-unavailable" role="alert" className="mt-2 text-xs">Scenario unavailable: {result.error || 'no result for this model.'}</p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {scen.probabilities.map((item) => {
                  const b = base.probabilities.find((x) => x.outcome === item.outcome)?.probability ?? 0;
                  const d = (item.probability - b) * 100;
                  return (
                    <div key={item.outcome} className="rounded-xl border border-border bg-card p-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em]">{outcomeName(item.outcome)}</div>
                      <div data-testid={`text-scenario-probability-${item.outcome}`} className="display-font mt-1 text-2xl font-semibold">{pct(item.probability)}</div>
                      <div data-testid={`text-baseline-probability-${item.outcome}`} className="text-[10px] text-muted-foreground">Baseline {pct(b)}</div>
                      <div data-testid={`text-probability-change-${item.outcome}`} className="mono-font text-[10px] font-semibold text-primary">{d >= 0 ? '+' : ''}{d.toFixed(1)} pts</div>
                    </div>
                  );
                })}
              </div>
            )}
            {base && scen && (
              <p data-testid="text-scenario-call" className="mt-3 text-xs text-muted-foreground">
                Model call: baseline {outcomeName(base.predicted)}, scenario {outcomeName(scen.predicted)}.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
