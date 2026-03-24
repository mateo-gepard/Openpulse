// display.js for A02: HRV (RMSSD)
// Dashboard render module — declares layout, formatting, and visualization
export default {
  id: 'A02',
  name: 'HRV (RMSSD)',
  version: 1,

  layout: 'gauge',

  primary: {
    type: 'number',
    label: 'RMSSD',
    unit: 'ms',
    decimals: 1,
    range: [0, 300],
    zones: [
      { min: 0, max: 20, color: '#ef4444', label: 'Low' },
      { min: 20, max: 50, color: '#f59e0b', label: 'Below Average' },
      { min: 50, max: 100, color: '#22c55e', label: 'Good' },
      { min: 100, max: 300, color: '#3b82f6', label: 'Excellent' },
    ],
  },

  secondary: [
    { type: 'sqi-bar', label: 'Signal Quality' },
    { type: 'number', key: 'sdnn', label: 'SDNN', unit: 'ms', decimals: 1 },
    { type: 'number', key: 'pnn50', label: 'pNN50', unit: '%', decimals: 1 },
  ],

  chart: {
    type: 'line',
    windowSeconds: 300,
    yRange: [0, 200],
  },

  size: '1x1',
  classification: 'health-indicator',
  channels: ['ppg'],
  tier: 1,

  params: [
    { name: 'Min R-R Intervals', min: 10, max: 60, default: 30, step: 5, unit: '' },
    { name: 'Outlier Threshold', min: 10, max: 50, default: 20, step: 5, unit: '%' },
  ],
};
