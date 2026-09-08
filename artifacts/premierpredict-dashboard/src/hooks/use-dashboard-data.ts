import { useQuery } from '@tanstack/react-query';

export interface ModelMetric {
  model: string;
  accuracy: number;
  macroF1: number;
  drawF1: number;
}

export interface OutcomeDistribution {
  outcome: string;
  matches: number;
}

export interface RecentMatch {
  season: number;
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  result: string;
}

export interface PredictionProbabilities {
  outcome: string;
  probability: number;
}

export interface PredictionData {
  predicted: string;
  probabilities: PredictionProbabilities[];
}

export interface PredictionsData {
  [model: string]: {
    [fixture: string]: PredictionData;
  };
}

export interface TeamStat {
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface PlayerProfile {
  id: number;
  name: string;
  commonName: string | null;
  position: string;
  overallRating: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  preferredFoot: number | string;
  skillMoves: number;
}

export interface ClubPerformance {
  matches: number;
  goalsFor: number;
  goalsAgainst: number;
  goalsPerMatch: number;
  concededPerMatch: number;
  cleanSheets: number;
  bothTeamsScored: number;
  overTwoPointFiveGoals: number;
  homeWinRate: number;
  awayWinRate: number;
  goalsScoredBuckets: Record<string, number>;
}

export interface FormMatch {
  kickoff: string;
  opponent: string;
  venue: 'H' | 'A';
  goalsFor: number;
  goalsAgainst: number;
  result: 'W' | 'D' | 'L';
}

export interface ClubForm {
  matches: FormMatch[];
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface HeadToHead {
  meetings: number;
  firstWins: number;
  draws: number;
  secondWins: number;
  firstGoals: number;
  secondGoals: number;
  recent: Array<{
    kickoff: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
  }>;
}

export interface SeasonTrend {
  season: number;
  matches: number;
  goalsPerMatch: number;
  homeWinRate: number;
  drawRate: number;
  awayWinRate: number;
}

export interface ClassMetric {
  outcome: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface ConfusionMatrix {
  labels: string[];
  values: number[][];
}

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface DashboardData {
  totalMatches: number;
  featureCount: number;
  latestSeason: number;
  teams: string[];
  metrics: ModelMetric[];
  outcomeDistribution: OutcomeDistribution[];
  recentMatches: RecentMatch[];
  predictions: PredictionsData;
  teamStats: TeamStat[];
  playersByClub: Record<string, PlayerProfile[]>;
  clubPerformance: Record<string, ClubPerformance>;
  formByClub: Record<string, ClubForm>;
  headToHead: Record<string, HeadToHead>;
  seasonTrends: SeasonTrend[];
  classMetrics: Record<string, ClassMetric[]>;
  confusionMatrices: Record<string, ConfusionMatrix>;
  featureImportance: Record<string, FeatureImportance[]>;
  provenance?: {
    repository: string;
    source_commit: string;
    feature_contract: string;
    historical_standings_source: string;
  };
}

export function useDashboardData() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard-data'],
    queryFn: async () => {
      // Fetching from static public file
      const res = await fetch(
        `${import.meta.env.BASE_URL}data/premierpredict.json`,
      );
      if (!res.ok) {
        throw new Error('Failed to load dashboard data');
      }
      const payload: unknown = await res.json();
      if (
        !payload ||
        typeof payload !== 'object' ||
        !Array.isArray((payload as DashboardData).metrics) ||
        (payload as DashboardData).metrics.length === 0 ||
        !Array.isArray((payload as DashboardData).teams) ||
        !Array.isArray((payload as DashboardData).teamStats) ||
        !Array.isArray((payload as DashboardData).seasonTrends) ||
        !(payload as DashboardData).playersByClub ||
        typeof (payload as DashboardData).playersByClub !== 'object' ||
        !(payload as DashboardData).clubPerformance ||
        typeof (payload as DashboardData).clubPerformance !== 'object' ||
        !(payload as DashboardData).formByClub ||
        typeof (payload as DashboardData).formByClub !== 'object' ||
        !(payload as DashboardData).headToHead ||
        typeof (payload as DashboardData).headToHead !== 'object'
      ) {
        throw new Error('Dashboard data is incomplete or has an invalid format');
      }
      return payload as DashboardData;
    },
    staleTime: 1000 * 60 * 60, // 1 hour for static data
    refetchOnWindowFocus: false,
  });
}
