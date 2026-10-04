import type { DashboardData, PredictionData } from '../hooks/use-dashboard-data';

export interface NumericTree {
  left: number[]; right: number[]; feature: number[]; threshold: number[]; value: number[][];
}
type NumericModel =
  | { kind: 'logistic'; classes: string[]; mean: number[]; scale: number[]; coefficients: number[][]; intercept: number[] }
  | { kind: 'forest'; classes: string[]; trees: NumericTree[] }
  | { kind: 'gradient'; classes: string[]; initial: number[]; learningRate: number; stages: NumericTree[][] }
  | { kind: 'xgboost'; classes: string[]; initial: number[]; trees: NumericTree[]; classIndices: number[] };
export interface InferenceArtifact {
  version: number; featureNames: string[]; imputationValues: number[];
  models: Record<string, NumericModel>;
  verificationCases: { inputs: (number | null)[]; probabilities: Record<string, number[]> }[];
}

function leaf(tree: NumericTree, inputs: number[]) {
  let node = 0;
  while (tree.left[node] !== -1) {
    // sklearn tree inference converts input arrays to float32 before comparing thresholds.
    node = Math.fround(inputs[tree.feature[node]]) <= tree.threshold[node] ? tree.left[node] : tree.right[node];
  }
  return tree.value[node];
}

function softmax(values: number[]) {
  const maximum = Math.max(...values);
  const exponents = values.map((value) => Math.exp(value - maximum));
  const total = exponents.reduce((a, b) => a + b, 0);
  return exponents.map((value) => value / total);
}

function xgboostLeaf(tree: NumericTree, inputs: number[]) {
  let node = 0;
  while (tree.left[node] !== -1) {
    // XGBoost numerical splits use strict < and float32 values, unlike sklearn.
    node = Math.fround(inputs[tree.feature[node]]) < Math.fround(tree.threshold[node])
      ? tree.left[node] : tree.right[node];
  }
  return Math.fround(tree.value[node][0]);
}

export function scoreModel(artifact: InferenceArtifact, name: string, inputs: Record<string, number | null | undefined>): PredictionData {
  const model = artifact.models[name];
  if (!model) throw new Error(`Model ${name} is unavailable.`);
  if (artifact.imputationValues.length !== artifact.featureNames.length) throw new Error('The model imputation contract is invalid.');
  const x = artifact.featureNames.map((feature, index) => {
    const value = inputs[feature];
    return typeof value !== 'number' || !Number.isFinite(value)
      ? artifact.imputationValues[index]
      : value;
  });
  if (x.length !== 40 || x.some((value) => !Number.isFinite(value))) throw new Error('The model requires 40 finite predictor values.');
  let probabilities: number[];
  if (model.kind === 'logistic') {
    const scaled = x.map((value, index) => (value - model.mean[index]) / model.scale[index]);
    probabilities = softmax(model.coefficients.map((row, index) =>
      row.reduce((sum, coefficient, column) => sum + coefficient * scaled[column], model.intercept[index]),
    ));
  } else if (model.kind === 'forest') {
    probabilities = model.classes.map(() => 0);
    for (const tree of model.trees) {
      const values = leaf(tree, x);
      values.forEach((value, index) => { probabilities[index] += value / model.trees.length; });
    }
  } else if (model.kind === 'xgboost') {
    if (model.trees.length !== model.classIndices.length || model.initial.length !== model.classes.length) {
      throw new Error('The XGBoost tree contract is invalid.');
    }
    const scores = model.initial.map(Math.fround);
    model.trees.forEach((tree, index) => {
      const classIndex = model.classIndices[index];
      // Match the CPU booster's float32 margin accumulation before softmax.
      scores[classIndex] = Math.fround(scores[classIndex] + xgboostLeaf(tree, x));
    });
    probabilities = softmax(scores);
  } else {
    const scores = [...model.initial];
    for (const stage of model.stages) stage.forEach((tree, index) => {
      scores[index] += model.learningRate * leaf(tree, x)[0];
    });
    probabilities = softmax(scores);
  }
  if (probabilities.some((value) => !Number.isFinite(value) || value < 0 || value > 1) ||
      Math.abs(probabilities.reduce((a, b) => a + b, 0) - 1) > 1e-8) throw new Error('The model returned invalid probabilities.');
  const winner = probabilities.indexOf(Math.max(...probabilities));
  return { predicted: model.classes[winner], probabilities: model.classes.map((outcome, index) => ({ outcome, probability: probabilities[index] })) };
}

export function ratingScenarioInputs(data: DashboardData, homeTeam: string, awayTeam: string, excludedHome: number[], excludedAway: number[]) {
  const original = data.predictionInputs[`${homeTeam}|||${awayTeam}`];
  if (!original) throw new Error('This fixture has no input evidence.');
  const inputs = { ...original };
  for (const [side, team, excluded] of [
    ['home', homeTeam, excludedHome], ['away', awayTeam, excludedAway],
  ] as const) {
    if (excluded.length === 0) continue;
    const squad = data.playersByClub[team] || [];
    if (excluded.some((id) => !squad.some((player) => player.id === id))) throw new Error('An excluded player does not belong to this club.');
    const remaining = squad.filter((player) => !excluded.includes(player.id));
    if (!remaining.length) throw new Error(`Keep at least one rated ${team} player.`);
    inputs[`${side}_avg_rating`] = remaining.reduce((sum, player) => sum + player.overallRating, 0) / remaining.length;
    inputs[`${side}_max_rating`] = Math.max(...remaining.map((player) => player.overallRating));
    inputs[`${side}_rating_available`] = 1;
  }
  return inputs;
}

export function scoreFixtureScenario(artifact: InferenceArtifact, data: DashboardData, homeTeam: string, awayTeam: string, excludedHome: number[], excludedAway: number[]) {
  if (artifact.featureNames.join('|') !== data.featureNames.join('|')) throw new Error('Model and dashboard feature contracts differ.');
  const fixture = `${homeTeam}|||${awayTeam}`;
  const baseInputs = data.predictionInputs[fixture];
  const inputs = ratingScenarioInputs(data, homeTeam, awayTeam, excludedHome, excludedAway);
  const baseline: Record<string, PredictionData> = {};
  const predictions: Record<string, PredictionData> = {};
  for (const model of Object.keys(data.predictions)) {
    baseline[model] = scoreModel(artifact, model, baseInputs);
    for (const probability of baseline[model].probabilities) {
      const stored = data.predictions[model][fixture].probabilities.find((p) => p.outcome === probability.outcome);
      if (!stored || Math.abs(stored.probability - probability.probability) > 1e-8) throw new Error('The live model parameters do not match the stored prediction. Refresh the project data.');
    }
    predictions[model] = scoreModel(artifact, model, inputs);
  }
  return { inputs, baseline, predictions };
}