import { useQuery } from '@tanstack/react-query';
import type { DashboardData } from './use-dashboard-data';
import type { InferenceArtifact } from '../lib/model-inference';

export function useInferenceArtifact(data: DashboardData) {
  return useQuery({
    queryKey: ['rating-models', data.inferenceArtifact.sha256],
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<InferenceArtifact> => {
      const { path, sha256 } = data.inferenceArtifact;
      if (!/^data\/model-inference-[a-f0-9]{16}\.json$/.test(path)) throw new Error('The model artifact path is invalid.');
      const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
      if (!response.ok) throw new Error('The trained rating models could not be loaded.');
      const bytes = await response.arrayBuffer();
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((value) => value.toString(16).padStart(2, '0')).join('');
      if (digest !== sha256) throw new Error('The trained model file failed its integrity check.');
      const artifact = JSON.parse(new TextDecoder().decode(bytes)) as InferenceArtifact;
      if (artifact.version !== 3 || artifact.featureNames.join('|') !== data.featureNames.join('|') ||
          artifact.imputationValues.length !== data.featureNames.length ||
          artifact.imputationValues.some((value) => !Number.isFinite(value))) {
        throw new Error('Model and dashboard versions differ.');
      }
      return artifact;
    },
  });
}