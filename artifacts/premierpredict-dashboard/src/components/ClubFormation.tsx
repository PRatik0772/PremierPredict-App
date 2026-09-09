import { useMemo, useState } from 'react';
import { ArrowRight, Shield, Sparkles } from 'lucide-react';
import { type PlayerProfile } from '@/hooks/use-dashboard-data';
import { ClubCrest } from '@/components/ClubCrest';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getPositionLabel } from '@/lib/positions';

type FormationName = '4-3-3' | '4-2-3-1' | '3-4-3';
type Role = 'GK' | 'DEF' | 'MID' | 'WIDE' | 'FWD';

type FormationSlot = {
  label: string;
  role: Role;
  x: number;
  y: number;
};

const formations: Record<FormationName, FormationSlot[]> = {
  '4-3-3': [
    { label: 'GK', role: 'GK', x: 50, y: 91 },
    { label: 'LB', role: 'DEF', x: 14, y: 73 },
    { label: 'CB', role: 'DEF', x: 38, y: 76 },
    { label: 'CB', role: 'DEF', x: 62, y: 76 },
    { label: 'RB', role: 'DEF', x: 86, y: 73 },
    { label: 'CM', role: 'MID', x: 24, y: 53 },
    { label: 'CM', role: 'MID', x: 50, y: 59 },
    { label: 'CM', role: 'MID', x: 76, y: 53 },
    { label: 'LW', role: 'WIDE', x: 14, y: 27 },
    { label: 'ST', role: 'FWD', x: 50, y: 20 },
    { label: 'RW', role: 'WIDE', x: 86, y: 27 },
  ],
  '4-2-3-1': [
    { label: 'GK', role: 'GK', x: 50, y: 91 },
    { label: 'LB', role: 'DEF', x: 14, y: 73 },
    { label: 'CB', role: 'DEF', x: 38, y: 76 },
    { label: 'CB', role: 'DEF', x: 62, y: 76 },
    { label: 'RB', role: 'DEF', x: 86, y: 73 },
    { label: 'CDM', role: 'MID', x: 36, y: 57 },
    { label: 'CDM', role: 'MID', x: 64, y: 57 },
    { label: 'LW', role: 'WIDE', x: 14, y: 34 },
    { label: 'CAM', role: 'MID', x: 50, y: 38 },
    { label: 'RW', role: 'WIDE', x: 86, y: 34 },
    { label: 'ST', role: 'FWD', x: 50, y: 18 },
  ],
  '3-4-3': [
    { label: 'GK', role: 'GK', x: 50, y: 91 },
    { label: 'CB', role: 'DEF', x: 24, y: 76 },
    { label: 'CB', role: 'DEF', x: 50, y: 79 },
    { label: 'CB', role: 'DEF', x: 76, y: 76 },
    { label: 'LM', role: 'WIDE', x: 10, y: 53 },
    { label: 'CM', role: 'MID', x: 36, y: 58 },
    { label: 'CM', role: 'MID', x: 64, y: 58 },
    { label: 'RM', role: 'WIDE', x: 90, y: 53 },
    { label: 'LW', role: 'WIDE', x: 18, y: 26 },
    { label: 'ST', role: 'FWD', x: 50, y: 18 },
    { label: 'RW', role: 'WIDE', x: 82, y: 26 },
  ],
};

const roleGroups: Record<Role, string[]> = {
  GK: ['GK'],
  DEF: ['CB', 'LB', 'RB', 'LWB', 'RWB', 'SW', 'LCB', 'RCB'],
  MID: ['CM', 'CDM', 'CAM', 'LM', 'RM', 'DM', 'AM'],
  WIDE: ['LW', 'RW', 'LM', 'RM', 'LWB', 'RWB', 'LMF', 'RMF'],
  FWD: ['ST', 'CF', 'FW', 'LW', 'RW', 'SS'],
};

const positionPriority: Record<string, string[]> = {
  GK: ['GK'],
  DEF: ['CB', 'LB', 'RB', 'LWB', 'RWB', 'SW', 'LCB', 'RCB'],
  MID: ['CM', 'CDM', 'CAM', 'DM', 'AM', 'LM', 'RM'],
  WIDE: ['LW', 'RW', 'LM', 'RM', 'LWB', 'RWB', 'LMF', 'RMF'],
  FWD: ['ST', 'CF', 'FW', 'SS', 'LW', 'RW'],
};

const formationDescriptions: Record<FormationName, string> = {
  '4-3-3': '4 defenders · 3 midfielders · 3 attackers',
  '4-2-3-1': '4 defenders · 2 defensive midfielders · 3 attacking players · 1 striker',
  '3-4-3': '3 defenders · 4 midfielders · 3 attackers',
};

function displayName(player: PlayerProfile) {
  return player.commonName || player.name.split(' ').slice(-1)[0];
}

function selectPlayers(players: PlayerProfile[], slots: FormationSlot[]) {
  const remaining = [...players].sort((a, b) => b.overallRating - a.overallRating);
  return slots.map((slot) => {
    const candidates = remaining.filter((player) => roleGroups[slot.role].includes(player.position));
    const preferred = positionPriority[slot.label] || positionPriority[slot.role];
    const player = [...candidates].sort((a, b) => {
      const aPriority = preferred.indexOf(a.position);
      const bPriority = preferred.indexOf(b.position);
      const aScore = (aPriority < 0 ? 99 : aPriority) * 100 - a.overallRating;
      const bScore = (bPriority < 0 ? 99 : bPriority) * 100 - b.overallRating;
      return aScore - bScore;
    })[0] || remaining[0];

    if (player) {
      const index = remaining.findIndex((candidate) => candidate.id === player.id);
      if (index >= 0) remaining.splice(index, 1);
    }

    return { slot, player };
  });
}

export function ClubFormation({ club, players }: { club: string; players: PlayerProfile[] }) {
  const [formation, setFormation] = useState<FormationName>('4-3-3');
  const slots = formations[formation];
  const lineup = useMemo(() => selectPlayers(players, slots), [players, slots]);
  const starters = lineup.filter(({ player }) => player).length;
  const average = starters ? lineup.reduce((sum, item) => sum + (item.player?.overallRating || 0), 0) / starters : 0;

  if (!players.length) return null;

  return (
    <Card className="overflow-hidden rounded-3xl border-primary/15 shadow-sm" data-testid="club-formation-card">
      <CardHeader className="border-b border-border/70 bg-gradient-to-r from-primary/[0.08] via-card to-accent/[0.10] pb-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            <ClubCrest team={club} size="md" />
            <div>
              <div className="mono-font flex items-center gap-2 text-[9px] uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3 w-3" />
                Matchday lab
              </div>
              <CardTitle className="display-font mt-2 text-xl">Projected field formation</CardTitle>
              <CardDescription className="mt-1 max-w-xl">
                A presentation-friendly starting XI inferred from the highest-rated supplied players.
              </CardDescription>
            </div>
          </div>
          <div className="w-full sm:w-[170px]">
            <label htmlFor="club-formation-select" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Shape</label>
            <Select value={formation} onValueChange={(value) => setFormation(value as FormationName)}>
              <SelectTrigger id="club-formation-select" data-testid="select-club-formation" className="h-10 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(formations) as FormationName[]).map((option) => <SelectItem key={option} value={option}>{option} · {formationDescriptions[option]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1.5 text-[9px]"><Shield className="h-3 w-3" /> {club}</Badge>
          <Badge variant="outline" className="text-[9px]">{starters}/11 slots filled</Badge>
          <Badge variant="outline" className="text-[9px]">{average.toFixed(1)} XI average</Badge>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(280px,0.92fr)_minmax(0,1.08fr)]">
        <div className="mx-auto w-full max-w-[430px]">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[1.6rem] border-4 border-white/65 bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-800 p-3 shadow-inner dark:border-white/15">
            <div className="absolute inset-3 rounded-[1.15rem] border border-white/50" />
            <div className="absolute left-1/2 top-3 bottom-3 w-px -translate-x-1/2 bg-white/40" />
            <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/45" />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
            <div className="absolute left-1/2 top-3 h-[17%] w-[42%] -translate-x-1/2 border border-t-0 border-white/45" />
            <div className="absolute left-1/2 bottom-3 h-[17%] w-[42%] -translate-x-1/2 border border-b-0 border-white/45" />
            <div className="absolute left-1/2 top-3 h-3 w-24 -translate-x-1/2 rounded-b-full border-b border-white/45" />
            <div className="absolute bottom-3 left-1/2 h-3 w-24 -translate-x-1/2 rounded-t-full border-t border-white/45" />
            {lineup.map(({ slot, player }, index) => (
              <div
                key={`${slot.label}-${index}`}
                className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-primary text-[10px] font-bold text-primary-foreground shadow-lg sm:h-10 sm:w-10">
                  {player?.overallRating || '—'}
                </div>
                <div className="max-w-[72px] rounded-md bg-black/55 px-1.5 py-1 text-center text-[9px] font-semibold leading-tight text-white backdrop-blur-sm">
                  {player ? displayName(player) : 'Open slot'}
                </div>
                  <span className="max-w-[92px] rounded bg-white/90 px-1 text-center text-[7px] font-bold leading-tight text-emerald-900">{getPositionLabel(slot.label)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
            Opponents attack from the top. Select another shape to re-balance the inferred XI.
          </p>
        </div>

        <div className="flex flex-col justify-between">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="display-font text-lg font-semibold">{formation} starting XI</div>
                <div className="text-xs text-muted-foreground">Rating-led projection · not a historical lineup</div>
              </div>
              <ArrowRight className="h-4 w-4 text-primary" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {lineup.map(({ slot, player }, index) => (
                <div key={`${slot.label}-list-${index}`} className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/25 px-3 py-2.5">
                  <span className="mono-font w-8 text-[9px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                  <span className="w-[6.5rem] shrink-0 text-[9px] font-bold leading-tight text-primary">{getPositionLabel(slot.label)}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{player ? player.commonName || player.name : 'Open slot'}</span>
                  {player && <span className="mono-font text-[10px] font-semibold text-muted-foreground">{player.overallRating}</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/[0.10] p-4">
            <div className="text-xs font-semibold">Reading the formation</div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Positions come from the supplied EA FC player records. The system fills each role with the best available fit, then uses remaining high-rated players when a club does not have a perfect positional match.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}