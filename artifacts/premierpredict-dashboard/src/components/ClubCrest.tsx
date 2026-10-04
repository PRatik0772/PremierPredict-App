import { useEffect, useState } from 'react';
import { getClubCrestUrl, getClubInitials } from '@/lib/club-logos';

type ClubCrestProps = {
  team: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
};

const sizeClasses = {
  sm: 'h-8 w-8 rounded-xl p-1.5',
  md: 'h-11 w-11 rounded-2xl p-2',
  lg: 'h-16 w-16 rounded-2xl p-3',
  xl: 'h-24 w-24 rounded-[1.75rem] p-4',
};

export function ClubCrest({ team, size = 'md', className = '' }: ClubCrestProps) {
  const [failed, setFailed] = useState(false);
  const src = getClubCrestUrl(team);
  useEffect(() => { setFailed(false); }, [src]);

  return (
    <div
      className={`flex shrink-0 items-center justify-center border border-border/70 bg-card shadow-sm ${sizeClasses[size]} ${className}`}
      aria-label={`${team} crest`}
      title={team}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="display-font text-center text-[0.7em] font-bold tracking-tight text-primary">
          {getClubInitials(team)}
        </span>
      )}
    </div>
  );
}