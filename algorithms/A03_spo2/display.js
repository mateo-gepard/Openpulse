// display.js for A03: SpO2
// Dashboard render module — declares layout, formatting, and visualization
export default {
  id: 'A03',
  name: 'SpO2',
  version: 1,

  layout: 'gauge',

  primary: {
    type: 'number',
    label: 'SpO2',
    unit: '%',
    decimals: 0,
    range: [70, 100],
    zones: [
      { min: 70, max: 90, color: '#ef4444', label: 'Low' },
      { min: 90, max: 94, color: '#f59e0b', label: 'Below Normal' },
      { min: 94, max: 100, color: '#22c55e', label: 'Normal' },
    ],
  },

  secondary: [
    { type: 'sqi-bar', label: 'Signal Quality' },
    { type: 'number', key: 'rRatio', label: 'R-Ratio', unit: '', decimals: 2 },
  ],

  chart: {
    type: 'line',
    windowSeconds: 120,
    yRange: [85, 100],
  },

  size: '1x1',
  classification: 'health-screening',
  channels: ['ppg'],
  tier: 2,
  disclaimer: 'This is not a medical device. Consult a healthcare provider for medical decisions.',

  params: [
    { name: 'R-Ratio Calibration A', min: 100, max: 115, default: 110, step: 1, unit: '' },
    { name: 'R-Ratio Calibration B', min: -30, max: -10, default: -25, step: 1, unit: '' },
  ],
};
