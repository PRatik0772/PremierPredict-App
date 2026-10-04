import { jsPDF } from 'jspdf';
import type { DashboardData } from '@/hooks/use-dashboard-data';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
type RGB = readonly [number, number, number];
const COLORS: Record<'ink' | 'green' | 'greenMid' | 'gold' | 'paper' | 'line' | 'muted' | 'white', RGB> = {
  ink: [20, 37, 31],
  green: [7, 29, 22],
  greenMid: [30, 117, 88],
  gold: [244, 200, 74],
  paper: [247, 250, 248],
  line: [218, 228, 222],
  muted: [93, 111, 102],
  white: [255, 255, 255],
};

const featureNames: Record<string, string> = {
  home_rating_available: 'Home rating data available',
  away_rating_available: 'Away rating data available',
  home_max_rating: 'Home highest player rating',
  away_max_rating: 'Away highest player rating',
  home_avg_rating: 'Home average player rating',
  away_avg_rating: 'Away average player rating',
  previous_goal_diff_diff: 'Previous goal-difference gap',
  previous_points_diff: 'Previous points gap',
  form_points_diff: 'Recent form-points gap',
  home_form_points: 'Home recent form points',
  away_form_points: 'Away recent form points',
  recent_goals_scored_diff: 'Recent goals-scored gap',
  recent_goals_conceded_diff: 'Recent goals-conceded gap',
};

const modelDescriptions: Record<string, { summary: string; mechanics: string[] }> = {
  'Decision Tree': {
    summary: 'A sequence of feature-based splits sends the fixture down branches until it reaches a leaf with the final class distribution.',
    mechanics: [
      'The root split chooses the feature that best separates home win, draw, and away win in the training data.',
      'Later splits refine the decision using form, ratings, standings, goal difference, and other engineered inputs.',
      'The reached leaf supplies the three outcome probabilities.',
    ],
  },
  'Logistic Regression': {
    summary: 'A weighted combination of the predictor inputs creates one score for each outcome, then normalises those scores into probabilities.',
    mechanics: [
      'Each input contributes positive or negative evidence to the home-win, draw, and away-win scores.',
      'The three scores are normalised together, so the displayed probabilities sum to 100%.',
      'A larger probability means the weighted evidence is stronger for that outcome in this fixture.',
    ],
  },
  'Random Forest': {
    summary: 'Many Decision Trees vote on the fixture. The forest averages those votes to produce its final probabilities.',
    mechanics: [
      'Each tree sees a slightly different view of the training examples and candidate feature splits.',
      'Every tree votes for home win, draw, or away win.',
      'Averaging the trees reduces the effect of one unusual split and produces the ensemble output.',
    ],
  },
  'Gradient Boosting': {
    summary: 'Small trees are added sequentially to correct errors in the current ensemble.',
    mechanics: [
      'An initial estimate is refined by a sequence of shallow trees.',
      'Each new tree targets errors left by the current training predictions.',
      'The combined scores produce home, draw, and away probabilities using fixed dashboard settings.',
    ],
  },
  'XGBoost': {
    summary: 'A regularised ensemble trained by the XGBoost library, separate from scikit-learn Gradient Boosting.',
    mechanics: [
      'Successive trees improve multiclass loss on the training period only.',
      'Row sampling, feature sampling, and regularisation constrain the ensemble.',
      'The trained class scores are normalised into home, draw, and away probabilities.',
    ],
  },
};

function outcomeLabel(outcome: string) {
  return outcome === 'H' ? 'Home win' : outcome === 'A' ? 'Away win' : 'Draw';
}

function friendlyFeatureName(feature: string) {
  return featureNames[feature] || feature.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeFilePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function generateMatchReportPdf(data: DashboardData, selectedModel: string, homeTeam: string, awayTeam: string) {
  const prediction = data.predictions[selectedModel]?.[`${homeTeam}|||${awayTeam}`];
  const metric = data.metrics.find((item) => item.model === selectedModel);
  const h2h = data.headToHead[`${homeTeam}|||${awayTeam}`];
  const model = modelDescriptions[selectedModel] || modelDescriptions['Logistic Regression'];
  const topFeatures = (data.featureImportance[selectedModel] || []).slice(0, 6);
  const classMetrics = data.classMetrics[selectedModel] || [];
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 16;

  const setText = (color: readonly [number, number, number]) => doc.setTextColor(color[0], color[1], color[2]);
  const setFill = (color: readonly [number, number, number]) => doc.setFillColor(color[0], color[1], color[2]);
  const setDraw = (color: readonly [number, number, number]) => doc.setDrawColor(color[0], color[1], color[2]);

  const footer = () => {
    const page = doc.getNumberOfPages();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(COLORS.muted);
    doc.text('PremierPredict · Match prediction report', MARGIN, PAGE_HEIGHT - 10);
    doc.text(`Page ${page}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10, { align: 'right' });
  };

  const newPage = () => {
    footer();
    doc.addPage();
    y = 18;
    setFill(COLORS.green);
    doc.rect(0, 0, PAGE_WIDTH, 9, 'F');
  };

  const ensure = (height: number) => {
    if (y + height > PAGE_HEIGHT - 20) newPage();
  };

  const text = (value: string, size = 9, color = COLORS.ink, options: { bold?: boolean; width?: number } = {}) => {
    doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    setText(color);
    const lines = doc.splitTextToSize(value, options.width || CONTENT_WIDTH);
    const lineHeight = size * 0.48;
    ensure(lines.length * lineHeight + 5);
    doc.text(lines, MARGIN, y);
    y += lines.length * lineHeight + 5;
  };

  const section = (title: string, subtitle?: string) => {
    ensure(18);
    setFill(COLORS.green);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 9, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setText(COLORS.white);
    doc.text(title.toUpperCase(), MARGIN + 4, y + 6);
    y += 14;
    if (subtitle) text(subtitle, 8.5, COLORS.muted);
  };

  const metricBox = (label: string, value: string, x: number, width: number) => {
    setFill(COLORS.paper);
    setDraw(COLORS.line);
    doc.roundedRect(x, y, width, 21, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    setText(COLORS.ink);
    doc.text(value, x + 4, y + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setText(COLORS.muted);
    doc.text(label.toUpperCase(), x + 4, y + 16);
  };

  const tableRow = (columns: string[], widths: number[], header = false) => {
    const rowHeight = header ? 8 : 7;
    ensure(rowHeight);
    if (header) {
      setFill(COLORS.paper);
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, 'F');
    }
    let x = MARGIN;
    columns.forEach((column, index) => {
      doc.setFont('helvetica', header ? 'bold' : 'normal');
      doc.setFontSize(8);
      setText(header ? COLORS.muted : COLORS.ink);
      doc.text(column, x + 3, y + 5, { maxWidth: widths[index] - 6 });
      x += widths[index];
    });
    setDraw(COLORS.line);
    doc.line(MARGIN, y + rowHeight, MARGIN + CONTENT_WIDTH, y + rowHeight);
    y += rowHeight;
  };

  // Header and report identity.
  setFill(COLORS.green);
  doc.rect(0, 0, PAGE_WIDTH, 40, 'F');
  setFill(COLORS.gold);
  doc.circle(MARGIN + 5, 16, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  setText(COLORS.white);
  doc.text('PremierPredict', MARGIN + 15, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText([205, 225, 215]);
  doc.text('MATCH PREDICTION REPORT', MARGIN + 15, 22);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, MARGIN + 15, 29);

  y = 50;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  setText(COLORS.ink);
  doc.text(`${homeTeam} vs ${awayTeam}`, MARGIN, y);
  y += 8;
  text(`${selectedModel} · stored project prediction`, 9, COLORS.muted);

  // Result hero.
  ensure(48);
  setFill(COLORS.green);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 43, 4, 4, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText([185, 213, 199]);
  doc.text('PREDICTED RESULT', MARGIN + 7, y + 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  setText(COLORS.white);
  doc.text(prediction ? outcomeLabel(prediction.predicted) : 'No stored prediction', MARGIN + 7, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText([205, 225, 215]);
  const predictedTeam = prediction?.predicted === 'H' ? homeTeam : prediction?.predicted === 'A' ? awayTeam : 'Both teams';
  doc.text(predictedTeam, MARGIN + 7, y + 29);
  const confidence = prediction?.probabilities.find((item) => item.outcome === prediction.predicted)?.probability || 0;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText([185, 213, 199]);
  doc.text('PROBABILITY', PAGE_WIDTH - MARGIN - 45, y + 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  setText(COLORS.gold);
  doc.text(`${(confidence * 100).toFixed(1)}%`, PAGE_WIDTH - MARGIN - 45, y + 22);
  y += 52;

  section('Outcome probabilities', 'The stored model output for the selected fixture.');
  const probabilityWidths = CONTENT_WIDTH / 3;
  if (prediction) {
    prediction.probabilities.forEach((item, index) => {
      const x = MARGIN + index * probabilityWidths;
      metricBox(outcomeLabel(item.outcome), `${(item.probability * 100).toFixed(1)}%`, x, probabilityWidths - 3);
    });
    y += 29;
  } else {
    text('No stored prediction is available for this fixture.', 9, COLORS.muted);
  }

  section('Selected model', model.summary);
  if (metric) {
    const boxW = (CONTENT_WIDTH - 6) / 3;
    metricBox('Accuracy', `${(metric.accuracy * 100).toFixed(1)}%`, MARGIN, boxW);
    metricBox('Macro F1', `${(metric.macroF1 * 100).toFixed(1)}%`, MARGIN + boxW + 3, boxW);
    metricBox('Draw F1', `${(metric.drawF1 * 100).toFixed(1)}%`, MARGIN + (boxW + 3) * 2, boxW);
    y += 29;
  }
  model.mechanics.forEach((item, index) => text(`${index + 1}. ${item}`, 8.8, COLORS.muted));

  section('Feature influence', 'Top global feature influence for this model. These values describe the model overall; they are not direct percentage-point adjustments for one fixture.');
  if (topFeatures.length) {
    const featureWidths = [CONTENT_WIDTH * 0.7, CONTENT_WIDTH * 0.3];
    tableRow(['Feature', 'Global influence'], featureWidths, true);
    topFeatures.forEach((item) => tableRow([friendlyFeatureName(item.feature), `${(item.importance * 100).toFixed(1)}%`], featureWidths));
    y += 5;
  } else {
    text('No feature influence values are available for this model.', 9, COLORS.muted);
  }

  section('Exact prediction inputs', 'Actual feature values passed to the models for this stored fixture, not local feature contributions.');
  const inputs = data.predictionInputs[`${homeTeam}|||${awayTeam}`];
  if (inputs) {
    const widths = [CONTENT_WIDTH * 0.78, CONTENT_WIDTH * 0.22];
    tableRow(['Input', 'Raw value'], widths, true);
    data.featureNames.forEach((feature) => {
      if (y + 7 > PAGE_HEIGHT - 20) {
        newPage();
        tableRow(['Input (continued)', 'Raw value'], widths, true);
      }
      tableRow([friendlyFeatureName(feature), String(Number(inputs[feature].toFixed(6)))], widths);
    });
    y += 5;
  } else {
    text('Exact input values are unavailable.', 9, COLORS.muted);
  }
  text(`Match history through: ${data.provenance?.prediction_as_of || 'Unavailable'}`, 8, COLORS.muted);
  text(`Evidence generated: ${data.provenance?.generated_at || 'Unavailable'}`, 8, COLORS.muted);
  text(`Standings source: ${data.provenance?.historical_standings_source || 'Unavailable'}`, 8, COLORS.muted);
  text(`Model configuration: ${data.provenance?.model_configuration || 'Unavailable'}`, 8, COLORS.muted);

  section('Class-level performance', 'Precision, recall, and F1 are measured on held-out matches from the evaluation seasons.');
  if (classMetrics.length) {
    const classWidths = [CONTENT_WIDTH * 0.4, CONTENT_WIDTH * 0.2, CONTENT_WIDTH * 0.2, CONTENT_WIDTH * 0.2];
    tableRow(['Outcome', 'Precision', 'Recall', 'F1'], classWidths, true);
    classMetrics.forEach((item) => tableRow([outcomeLabel(item.outcome), `${(item.precision * 100).toFixed(1)}%`, `${(item.recall * 100).toFixed(1)}%`, `${(item.f1 * 100).toFixed(1)}%`], classWidths));
  }

  section('Fixture context', 'Descriptive context shown alongside the stored prediction.');
  const homeForm = data.formByClub[homeTeam];
  const awayForm = data.formByClub[awayTeam];
  text(`${homeTeam} recent form: ${homeForm?.matches.map((match) => `${match.result} ${match.goalsFor}-${match.goalsAgainst} vs ${match.opponent}`).join(' · ') || 'Unavailable'}`, 8.8, COLORS.muted);
  text(`${awayTeam} recent form: ${awayForm?.matches.map((match) => `${match.result} ${match.goalsFor}-${match.goalsAgainst} vs ${match.opponent}`).join(' · ') || 'Unavailable'}`, 8.8, COLORS.muted);
  if (h2h) text(`Head-to-head: ${homeTeam} wins ${h2h.firstWins} · draws ${h2h.draws} · ${awayTeam} wins ${h2h.secondWins} across ${h2h.meetings} meetings.`, 8.8, COLORS.muted);

  ensure(20);
  setFill(COLORS.paper);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 14, 2, 2, 'F');
  text('Probabilities are stored model outputs. Feature influence and fixture context explain the evidence around the prediction; they do not retrain or manually alter the selected model.', 8, COLORS.muted, { width: CONTENT_WIDTH - 8 });

  footer();
  const filename = `premierpredict-${safeFilePart(homeTeam)}-vs-${safeFilePart(awayTeam)}.pdf`;
  doc.save(filename);
}