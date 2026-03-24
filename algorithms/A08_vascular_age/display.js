// display.js for A08: Vascular Age
// Dashboard render module — declares layout, formatting, and visualization
export default {
  id: 'A08',
  name: 'Vascular Age',
  version: 1,

  layout: 'gauge',

  primary: {
    type: 'number',
    label: 'Vascular Age',
    unit: 'years',
    decimals: 0,
    range: [18, 100],
    // Zones are relative to chronological age offset
    zones: [
      { min: -20, max: -5, color: '#22c55e', label: 'Younger' },
      { min: -5, max: 5, color: '#3b82f6', label: 'On Track' },
      { min: 5, max: 15, color: '#f59e0b', label: 'Older' },
      { min: 15, max: 30, color: '#ef4444', label: 'Elevated' },
    ],
  },

  secondary: [
    { type: 'sqi-bar', label: 'Signal Quality' },
    { type: 'number', key: 'ageOffset', label: 'Offset', unit: 'years', decimals: 0 },
    { type: 'number', key: 'zScore', label: 'Z-Score', unit: 'σ', decimals: 1 },
  ],

  chart: {
    type: 'scatter',
    windowSeconds: 7776000, // 90 days
    yRange: [18, 100],
  },

  size: '1x1',
  classification: 'health-screening',
  channels: ['ppg'],
  tier: 2,
  disclaimer: 'This is not a medical device. Consult a healthcare provider for medical decisions.',

  params: [],
};
