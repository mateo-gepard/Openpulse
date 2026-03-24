// display.js for A09: Perfusion Index
// Dashboard render module — declares layout, formatting, and visualization
export default {
  id: 'A09',
  name: 'Perfusion Index',
  version: 1,

  layout: 'gauge',

  primary: {
    type: 'number',
    label: 'Perfusion Index',
    unit: '%',
    decimals: 2,
    range: [0, 20],
    zones: [
      { min: 0, max: 0.5, color: '#ef4444', label: 'Very Low' },
      { min: 0.5, max: 2, color: '#f59e0b', label: 'Low' },
      { min: 2, max: 10, color: '#22c55e', label: 'Normal' },
      { min: 10, max: 20, color: '#3b82f6', label: 'Strong' },
    ],
  },

  secondary: [
    { type: 'sqi-bar', label: 'Signal Quality' },
    { type: 'number', key: 'dcLevel', label: 'DC Level', unit: 'raw', decimals: 0 },
    { type: 'number', key: 'acAmplitude', label: 'AC Amp', unit: 'raw', decimals: 0 },
  ],

  chart: {
    type: 'line',
    windowSeconds: 60,
    yRange: [0, 10],
  },

  size: '1x1',
  classification: 'wellness',
  channels: ['ppg'],
  tier: 0,

  params: [
    { name: 'DC Alpha', min: 0.001, max: 0.01, default: 0.005, step: 0.001, unit: '' },
  ],
};
