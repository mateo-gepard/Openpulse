// ═══════════════════════════════════════════════════════════════
// display.js — Dashboard Render Module Template
// ═══════════════════════════════════════════════════════════════
// Each algorithm ships a display.js declaring how it renders on
// the dashboard. The dashboard imports this module to build the
// algorithm's UI panel.
//
// LAYOUT TYPE SELECTION (cascade — pick first match):
//   1. Unit is BPM, %, °C, mmHg, µS     → 'gauge'
//   2. Unit is 'score', range [0, 100]   → 'score'
//   3. Unit is steps, kcal, reps         → 'counter'
//   4. Range [0, 1] boolean              → 'status'
//   5. Spec says "waveform/morphology"   → 'waveform'
//   6. Spec says "phases/stages"         → 'phases'
//   7. Episodic event detection          → 'event-log'
//   8. Sport-motion with sub-outputs     → 'multi-metric'
//   9. Tier 3 trended metric             → 'timeline'
//  10. Default                           → 'gauge'
//
// CARD SIZES:
//   '1x1' — Single metric (HR, SpO2, Temp)
//   '2x1' — Metric + chart (HRV, EDA timeline)
//   '2x2' — Complex display (sleep phases, sport technique)
//   '1x2' — Tall card (event log, score with breakdown)
// ═══════════════════════════════════════════════════════════════

export default {
  // ─── Identity ──────────────────────────────────────────
  id: '${ID}',
  name: '${NAME}',
  version: 1,

  // ─── Layout Type ───────────────────────────────────────
  // One of: gauge | waveform | score | counter | multi-metric
  //         timeline | phases | event-log | status
  layout: '${LAYOUT}',

  // ─── Primary Display ──────────────────────────────────
  // The main visualization in the panel
  primary: {
    type: '${PRIMARY_TYPE}',  // 'number' | 'waveform' | 'gauge' | 'status' | 'bar'
    label: '${PRIMARY_LABEL}',
    unit: '${UNIT}',
    decimals: ${DECIMALS},
    range: [${RANGE_MIN}, ${RANGE_MAX}],
    // Color zones (optional — for gauge/number displays)
    // zones: [
    //   { min: 0,  max: 30,  color: '#ef4444', label: 'Low' },
    //   { min: 30, max: 60,  color: '#f59e0b', label: 'Moderate' },
    //   { min: 60, max: 100, color: '#22c55e', label: 'Good' },
    // ],
  },

  // ─── Secondary Displays ───────────────────────────────
  // Additional info shown alongside primary
  secondary: [
    { type: 'sqi-bar', label: 'Signal Quality' },
    // { type: 'number', key: '${SUB_METRIC}', label: '${SUB_LABEL}', unit: '${SUB_UNIT}', decimals: 1 },
    // { type: 'status', key: 'state', label: 'State' },
  ],

  // ─── Chart Configuration ──────────────────────────────
  chart: {
    type: '${CHART_TYPE}',       // 'line' | 'bar' | 'scatter' | 'segments' | 'none'
    windowSeconds: ${WINDOW_S},  // History window to display
    yRange: [${RANGE_MIN}, ${RANGE_MAX}],
  },

  // ─── Card Size ────────────────────────────────────────
  size: '${SIZE}',  // '1x1' | '2x1' | '2x2' | '1x2'

  // ─── Multi-Metric (for algorithms with 2+ output values) ─
  // Uncomment and fill when layout is 'multi-metric' or algorithm
  // produces multiple outputs (e.g., sport technique, running form).
  // metrics: [
  //   { key: '${METRIC_KEY}', label: '${METRIC_LABEL}', unit: '${METRIC_UNIT}', range: [${M_MIN}, ${M_MAX}] },
  // ],
  // primary: '${PRIMARY_METRIC_KEY}',  // Which metric key is the headline number

  // ─── Score Breakdown (for composite scores) ──────────
  // Uncomment and fill when layout is 'score' and algorithm is
  // a composite (C-series) that aggregates sub-algorithm outputs.
  // breakdown: [
  //   { key: '${SUB_KEY}', label: '${SUB_LABEL}', weight: ${WEIGHT} },
  // ],

  // ─── Metadata ─────────────────────────────────────────
  classification: '${CLASSIFICATION}',  // wellness | health-indicator | health-screening | sport-performance
  channels: [${CHANNELS}],              // Required sensor channels
  tier: ${TIER},                        // 0-3

  // ─── Tunable Parameters (dev dashboard only) ──────────
  params: [
    // { name: 'Param Name', min: 0, max: 10, default: 5, step: 0.1, unit: 'Hz' },
  ],
};
