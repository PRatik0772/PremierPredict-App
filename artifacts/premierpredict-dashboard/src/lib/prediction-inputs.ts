export function inputLabel(feature: string) {
  return feature.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatInputValue(feature: string, value: number) {
  if (feature.endsWith('rating_available')) return value === 1 ? 'Available (1)' : 'Missing (0)';
  if (feature.includes('win_rate')) return `${(value * 100).toFixed(1)}%`;
  const formatted = value.toLocaleString('en-AU', { maximumFractionDigits: 3 });
  if (feature.includes('points')) return `${formatted} pts`;
  return formatted;
}