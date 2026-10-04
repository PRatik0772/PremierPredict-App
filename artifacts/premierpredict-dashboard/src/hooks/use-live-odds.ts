import { useQuery } from '@tanstack/react-query';
import { fetchLiveOdds } from '@/lib/live-odds';

export function useLiveOdds() {
  return useQuery({
    queryKey: ['premierpredict-live-odds'],
    queryFn: ({ signal }) => fetchLiveOdds(signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}