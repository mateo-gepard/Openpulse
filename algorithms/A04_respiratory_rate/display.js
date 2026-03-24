// display.js for A04: Respiratory Rate
// Dashboard render module — declares layout, formatting, and visualization
export default {
  id: 'A04',
  name: 'Respiratory Rate',
  version: 1,

  layout: 'gauge',

  primary: {
    type: 'number',
    label: 'Resp Rate',
    unit: 'BrPM',
    decimals: 0,
    range: [4, 60],
    zones: [
      { min: 4, max: 10, color: '#3b82f6', label: 'Low' },
      { min: 10, max: 20, color: '#22c55e', label: 'Normal' },
      { min: 20, max: 30, color: '#f59e0b', label: 'Elevated' },
      { min: 30, max: 60, color: '#ef4444', label: 'High' },
    ],
  },

  secondary: [
    { type: 'sqi-bar', label: 'Signal Quality' },
    { type: 'number', key: 'activeModulations', label: 'Active Mods', unit: '/3', decimals: 0 },
  ],

  chart: {
    type: 'line',
    windowSeconds: 300,
    yRange: [8, 30],
  },

  size: '1x1',
  classification: 'health-indicator',
  channels: ['ppg'],
  tier: 1,

  params: [
    { name: 'Resp Band Low', min: 0.05, max: 0.2, default: 0.1, step: 0.01, unit: 'Hz' },
    { name: 'Resp Band High', min: 0.5, max: 1.5, default: 1.0, step: 0.1, unit: 'Hz' },
    { name: 'Window Length', min: 15, max: 60, default: 30, step: 5, unit: 's' },
  ],
};
