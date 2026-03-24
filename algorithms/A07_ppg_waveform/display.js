// display.js for A07: PPG Waveform Analysis
// Dashboard render module — declares layout, formatting, and visualization
export default {
  id: 'A07',
  name: 'PPG Waveform',
  version: 1,

  layout: 'waveform',

  primary: {
    type: 'number',
    label: 'Stiffness Index',
    unit: 'm/s',
    decimals: 1,
    range: [4, 16],
    zones: [
      { min: 4, max: 7, color: '#22c55e', label: 'Normal' },
      { min: 7, max: 10, color: '#f59e0b', label: 'Elevated' },
      { min: 10, max: 16, color: '#ef4444', label: 'High' },
    ],
  },

  secondary: [
    { type: 'sqi-bar', label: 'Signal Quality' },
    { type: 'number', key: 'reflectionIndex', label: 'RI', unit: '%', decimals: 0 },
    { type: 'number', key: 'agingIndex', label: 'AGI', unit: 'a.u.', decimals: 2 },
    { type: 'number', key: 'augmentationIndex', label: 'AIx', unit: '%', decimals: 0 },
  ],

  chart: {
    type: 'line',
    windowSeconds: 30,
    yRange: [0, 1],
  },

  size: '2x1',
  classification: 'health-indicator',
  channels: ['ppg'],
  tier: 1,

  params: [],
};
