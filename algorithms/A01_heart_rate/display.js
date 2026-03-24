// display.js for A01: Heart Rate
// Dashboard render module — declares layout, formatting, and visualization
export default {
  id: 'A01',
  name: 'Heart Rate',
  version: 1,

  layout: 'gauge',

  primary: {
    type: 'number',
    label: 'Heart Rate',
    unit: 'BPM',
    decimals: 0,
    range: [30, 220],
    zones: [
      { min: 30, max: 50, color: '#3b82f6', label: 'Low' },
      { min: 50, max: 100, color: '#22c55e', label: 'Normal' },
      { min: 100, max: 150, color: '#f59e0b', label: 'Elevated' },
      { min: 150, max: 220, color: '#ef4444', label: 'High' },
    ],
  },

  secondary: [
    { type: 'sqi-bar', label: 'Signal Quality' },
    { type: 'number', key: 'perfusionIndex', label: 'Perfusion', unit: '%', decimals: 1 },
  ],

  chart: {
    type: 'line',
    windowSeconds: 120,
    yRange: [40, 180],
  },

  size: '1x1',
  classification: 'wellness',
  channels: ['ppg'],
  tier: 0,

  params: [
    { name: 'Bandpass Low', min: 0.3, max: 1.0, default: 0.5, step: 0.1, unit: 'Hz' },
    { name: 'Bandpass High', min: 2.0, max: 6.0, default: 4.0, step: 0.5, unit: 'Hz' },
    { name: 'Peak Threshold k', min: 0.3, max: 1.0, default: 0.6, step: 0.05, unit: '×σ' },
    { name: 'EMA Window', min: 4, max: 16, default: 8, step: 1, unit: 'beats' },
    { name: 'Refractory Period', min: 150, max: 400, default: 250, step: 10, unit: 'ms' },
    { name: 'SQI Threshold', min: 0.2, max: 0.8, default: 0.4, step: 0.05, unit: '' },
  ],
};
