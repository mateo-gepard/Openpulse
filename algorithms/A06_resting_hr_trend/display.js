// display.js for A06: Resting HR Trend
// Dashboard render module — declares layout, formatting, and visualization
export default {
  id: 'A06',
  name: 'Resting HR Trend',
  version: 1,

  layout: 'timeline',

  primary: {
    type: 'number',
    label: 'Resting HR',
    unit: 'BPM',
    decimals: 0,
    range: [40, 100],
    zones: [
      { min: 40, max: 50, color: '#3b82f6', label: 'Athletic' },
      { min: 50, max: 65, color: '#22c55e', label: 'Excellent' },
      { min: 65, max: 75, color: '#a3e635', label: 'Good' },
      { min: 75, max: 85, color: '#f59e0b', label: 'Above Average' },
      { min: 85, max: 100, color: '#ef4444', label: 'Elevated' },
    ],
  },

  secondary: [
    { type: 'sqi-bar', label: 'Signal Quality' },
    { type: 'number', key: 'rhr_7d_trend', label: '7d Trend', unit: 'BPM/day', decimals: 2 },
    { type: 'number', key: 'rhr_baseline_short', label: 'Baseline', unit: 'BPM', decimals: 0 },
  ],

  chart: {
    type: 'line',
    windowSeconds: 2592000, // 30 days in seconds
    yRange: [40, 100],
  },

  size: '2x1',
  classification: 'wellness',
  channels: ['ppg'],
  tier: 3,

  params: [],
};
