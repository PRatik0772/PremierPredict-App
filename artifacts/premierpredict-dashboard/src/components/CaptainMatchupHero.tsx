import { useState, type ReactNode } from 'react';
import { ClubCrest } from '@/components/ClubCrest';
import { getClubCaptain } from '@/data/club-captains';
import './captain-hero.css';

type Side = 'home' | 'away';

function Figure({ team, side }: { team: string; side: Side }) {
  const captain = team ? getClubCaptain(team) : undefined;
  const [failedSrc, setFailedSrc] = useState('');
  const src = captain ? `${import.meta.env.BASE_URL}${captain.image}` : '';
  const ok = captain && failedSrc !== src;
  const color = captain?.color ?? '#6b7a73';
  return (
    <div className={`cmh-side cmh-${side}`} style={{ ['--club' as string]: color, ['--club-accent' as string]: captain?.accent ?? '#fff' }} data-testid={`hero-side-${side}`}>
      <div className="cmh-glow" aria-hidden="true" />
      <div className="cmh-figure-wrap">
        {ok ? (
          <img src={src} alt={`Illustration of ${captain.name}, ${captain.club} captain`} className="cmh-figure" onError={() => setFailedSrc(src)} data-testid={`img-captain-${side}`} />
        ) : (
          <div className="cmh-missing" data-testid={`state-captain-missing-${side}`}>
            {team ? (captain ? 'Illustration unavailable' : 'Captain not identified for this club') : 'Select a club'}
          </div>
        )}
      </div>
      <div className="cmh-podium" aria-hidden="true">
        <div className="cmh-podium-top" />
        <div className="cmh-podium-front"><ClubCrest team={team} size="md" className="cmh-crest" /></div>
      </div>
      <div className="cmh-name">
        <div className="cmh-club">{team || 'No club'}</div>
        <div className="cmh-cap" data-testid={`text-captain-${side}`}>
          {captain ? <><a href={captain.sourceUrl} target="_blank" rel="noopener noreferrer" title={`Captain reference verified ${captain.verifiedAt}`}>{captain.name}</a> <span>Captain · {captain.season}{captain.season === '2025/26' ? ' reference' : ''}</span></> : <span>No captain reference</span>}
        </div>
      </div>
    </div>
  );
}

export function CaptainMatchupHero({ home, away, children, className = '' }: { home: string; away: string; children?: ReactNode; className?: string }) {
  return (
    <section className={`cmh ${className}`} aria-label={`${home || 'Home'} versus ${away || 'Away'}`} data-testid="hero-captain-matchup">
      <div className="cmh-lights" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="cmh-stage">
        <Figure team={home} side="home" />
        <div className="cmh-vs" aria-hidden="true"><span className="cmh-vs-line" /><span className="cmh-vs-text">VS</span><span className="cmh-vs-line" /></div>
        <Figure team={away} side="away" />
      </div>
      {children && <div className="cmh-controls">{children}</div>}
      <p className="cmh-caption">Illustrated club captains · not confirmed matchday lineups. Historical 2025/26 references are marked.</p>
    </section>
  );
}
