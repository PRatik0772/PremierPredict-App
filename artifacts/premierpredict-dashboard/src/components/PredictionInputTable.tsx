import { useState } from 'react';
import type { DashboardData } from '@/hooks/use-dashboard-data';
import { formatInputValue, inputLabel } from '@/lib/prediction-inputs';

export function PredictionInputTable({ data, homeTeam, awayTeam }: {
  data: DashboardData; homeTeam: string; awayTeam: string;
}) {
  const [search, setSearch] = useState('');
  const inputs = data.predictionInputs[`${homeTeam}|||${awayTeam}`];
  if (!inputs) return <p className="text-sm text-muted-foreground">Exact prediction inputs are unavailable.</p>;
  const features = data.featureNames.filter((feature) =>
    inputLabel(feature).toLowerCase().includes(search.toLowerCase()) || feature.includes(search.toLowerCase()),
  );
  return (
    <details className="mt-6 rounded-2xl border border-border p-4" data-testid="prediction-inputs">
      <summary className="cursor-pointer text-sm font-semibold">Inspect all {data.featureCount} prediction inputs</summary>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        These are the actual values sent to all models for this stored fixture, not local feature contributions.
        Match history through {data.provenance?.prediction_as_of?.slice(0, 10) || 'an unavailable date'}.
      </p>
      <label className="mt-4 block text-xs font-medium">
        Find an input
        <input className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search points, goals, ratings..." />
      </label>
      <div className="mt-3 max-h-96 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-card"><tr><th className="p-2">Model input</th><th className="p-2 text-right">Value</th></tr></thead>
          <tbody>{features.map((feature) => <tr key={feature} className="border-t border-border/60">
            <th scope="row" className="p-2 font-normal"><span>{inputLabel(feature)}</span><span className="mt-1 block font-mono text-[10px] text-muted-foreground">{feature}</span></th>
            <td className="p-2 text-right font-mono" title={`Raw value: ${inputs[feature]}`}>{formatInputValue(feature, inputs[feature])}</td>
          </tr>)}</tbody>
        </table>
        {features.length === 0 && <p className="p-3 text-muted-foreground">No inputs match this search.</p>}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">{data.provenance?.historical_standings_source}</p>
    </details>
  );
}