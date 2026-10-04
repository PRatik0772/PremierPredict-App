import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const inference = await import(pathToFileURL(process.argv[2]));
const data = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const bytes = readFileSync(resolve(dirname(process.argv[3]), '..', data.inferenceArtifact.path));
assert.equal(createHash('sha256').update(bytes).digest('hex'), data.inferenceArtifact.sha256);
const artifact = JSON.parse(bytes);
assert.equal(artifact.version, 3);
assert.equal(artifact.models.XGBoost.kind, 'xgboost');
assert.equal(artifact.imputationValues.length, data.featureNames.length);
assert.ok(artifact.verificationCases.some((sample) => sample.inputs.includes(null)), 'Expected missing-rating imputation cases.');
let comparisons = 0;
for (const [fixture, inputs] of Object.entries(data.predictionInputs)) {
  for (const model of Object.keys(artifact.models)) {
    const actual = inference.scoreModel(artifact, model, inputs);
    const expected = data.predictions[model][fixture];
    assert.equal(actual.predicted, expected.predicted);
    for (const probability of actual.probabilities) {
      const target = expected.probabilities.find((p) => p.outcome === probability.outcome).probability;
      assert.ok(Math.abs(probability.probability - target) < 1e-8, `${fixture}/${model}`);
    }
    comparisons++;
  }
}
for (const sample of artifact.verificationCases) {
  const inputs = Object.fromEntries(artifact.featureNames.map((feature, index) => [feature, sample.inputs[index]]));
  for (const model of Object.keys(artifact.models)) {
    const actual = inference.scoreModel(artifact, model, inputs);
    actual.probabilities.forEach((p, index) => assert.ok(Math.abs(p.probability - sample.probabilities[model][index]) < 1e-8, `${model}: modified rating parity`));
    comparisons++;
  }
}
const [home, away] = data.teams;
const homePlayers = data.playersByClub[home];
const best = [...homePlayers].sort((a, b) => b.overallRating - a.overallRating)[0];
const remaining = homePlayers.filter((p) => p.id !== best.id);
const scenario = inference.scoreFixtureScenario(artifact, data, home, away, [best.id], []);
assert.equal(scenario.inputs.home_max_rating, Math.max(...remaining.map((p) => p.overallRating)));
assert.equal(scenario.inputs.home_avg_rating, remaining.reduce((sum, p) => sum + p.overallRating, 0) / remaining.length);
const changedFields = new Set(['home_avg_rating', 'home_max_rating', 'home_rating_available']);
for (const feature of data.featureNames) if (!changedFields.has(feature)) assert.equal(scenario.inputs[feature], data.predictionInputs[`${home}|||${away}`][feature]);
assert.throws(() => inference.ratingScenarioInputs(data, home, away, homePlayers.map((p) => p.id), []), /at least one/);
assert.throws(() => inference.ratingScenarioInputs(data, home, away, [-999], []), /does not belong/);
const zero = inference.scoreFixtureScenario(artifact, data, home, away, [], []);
assert.deepEqual(zero.predictions, zero.baseline);
assert.ok(Object.keys(scenario.predictions).some((model) =>
  scenario.predictions[model].probabilities.some((p, index) => Math.abs(p.probability - zero.predictions[model].probabilities[index].probability) > 1e-8),
), 'A meaningful rating scenario should change at least one trained model probability.');
console.log(`Browser/Python parity: ${comparisons} model predictions matched, including XGBoost and missing-rating imputation; roster exclusion, unchanged non-rating inputs, empty/invalid squads, and reset checked.`);