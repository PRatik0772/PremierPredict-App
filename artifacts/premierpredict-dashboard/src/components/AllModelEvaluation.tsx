import { Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardData } from '@/hooks/use-dashboard-data';

const CLASSES = [['H', 'Home'], ['D', 'Draw'], ['A', 'Away']] as const;
const pc = (v: number | undefined) => (v === undefined ? 'n/a' : `${(v * 100).toFixed(1)}%`);
const reports = [
  ['technical-evaluation-update.docx', 'Technical evaluation update (DOCX)'],
  ['technical-evaluation-update.md', 'Technical evaluation update (Markdown)'],
  ['model-class-metrics.csv', 'Class metrics (CSV)'],
];

export function AllModelEvaluation({ data }: { data: DashboardData }) {
  const base = import.meta.env.BASE_URL;
  const support = data.evaluationSummary.testMatches;
  return (
    <Card className="overflow-hidden rounded-3xl" data-testid="card-all-model-evaluation">
      <CardHeader className="border-b border-border/70 pb-5">
        <CardTitle className="display-font text-xl">All models, per-class metrics</CardTitle>
        <CardDescription className="mt-1">Precision, recall, F1 and support for Home, Draw and Away on the same {support.toLocaleString()}-match chronological holdout. Values are read from the loaded evaluation data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm" data-testid="table-all-model-metrics">
            <thead><tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground"><th className="py-2 pr-3">Model</th><th className="px-3">Class</th><th className="px-3">Precision</th><th className="px-3">Recall</th><th className="px-3">F1</th><th className="pl-3">Support</th></tr></thead>
            <tbody>{data.metrics.flatMap((m) => CLASSES.map(([code, name], i) => {
              const c = data.classMetrics[m.model]?.find((x) => x.outcome === code || x.outcome === name);
              return (
                <tr key={`${m.model}-${code}`} className={`${i === 2 ? 'border-b border-border' : 'border-b border-border/40'}`} data-testid={`row-eval-${m.model}-${code}`}>
                  <td className="py-2 pr-3 font-medium">{i === 0 ? m.model : ''}</td><td className="px-3">{name}</td>
                  <td className="mono-font px-3">{pc(c?.precision)}</td><td className="mono-font px-3">{pc(c?.recall)}</td><td className="mono-font px-3">{pc(c?.f1)}</td><td className="mono-font pl-3">{c ? c.support.toLocaleString() : 'n/a'}</td>
                </tr>
              );
            }))}</tbody>
          </table>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground" data-testid="text-teacher-feedback-note">
            <p className="font-semibold text-foreground">Earlier teacher-feedback figures</p>
            <p className="mt-1">The Decision Tree about 43.6% and Logistic Regression 51.8% figures in teacher feedback are earlier, unreconciled numbers. They are not current verified results, and they are not comparable experiments without the original split and configuration. Use the table above for current results.</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground" data-testid="status-project">
            <p className="font-semibold text-foreground">Project status</p>
            <p className="mt-1"><strong className="text-foreground">Completed:</strong> majority baseline, all five trained models, common holdout evaluation and live-odds comparison.</p>
            <p className="mt-1"><strong className="text-foreground">Not claimed:</strong> live warehouse results, upstream Optuna-tuned scores, or revision/submission of the unavailable original team report.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {reports.map(([file, text]) => (
            <a key={file} href={`${base}reports/${file}`} download data-testid={`link-download-${file}`} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"><Download className="h-3.5 w-3.5" />{text}</a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
