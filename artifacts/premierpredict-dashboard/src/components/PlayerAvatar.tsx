import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import portraitManifest from '@/data/player-portraits.json';

type PlayerIdentity = { id: number; name: string; commonName?: string | null };
type Portrait = { path: string; sourceUrl: string; name: string; matchedName: string };

export function getPlayerPortrait(id: number): Portrait | undefined {
  return (portraitManifest.portraits as Record<string, Portrait>)[String(id)];
}

export function PlayerAvatar({ player, className }: { player: PlayerIdentity; className?: string }) {
  const portrait = getPlayerPortrait(player.id);
  const name = player.commonName || player.name;
  const initials = name.split(/\s+/).filter(Boolean).map((word) => word[0]).slice(0, 2).join('');
  return (
    <Avatar className={cn('h-10 w-10 shrink-0 border border-border bg-muted', className)}
      title={portrait ? `${name} · Premier League photo` : `${name} · photo unavailable`}>
      {portrait && <AvatarImage src={`${import.meta.env.BASE_URL}${portrait.path}`}
        alt={`Portrait of ${name}`} loading="lazy" className="object-contain object-bottom" />}
      <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary"
        aria-label={`${name}: photo unavailable`}>{initials}</AvatarFallback>
    </Avatar>
  );
}