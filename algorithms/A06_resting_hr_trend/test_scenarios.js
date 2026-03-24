// test_scenarios.js — Test scenarios for A06: Resting HR Trend
// Run: node test_scenarios.js (or import in browser test harness)

// Simulates Algo_A06 daily RHR processing
// Note: Requires localStorage polyfill for Node.js testing

const scenarios = [
  {
    description: "14 days stable RHR at 62 BPM",
    setup: (algo) => {
      algo.clearHistory();
      for (let d = 0; d < 14; d++) {
        const date = new Date(2024, 0, d + 1).toISOString().split('T')[0];
        algo.addDaily(date, 62 + (Math.random() - 0.5) * 0.5);
      }
    },
    expected: { resting_hr_bpm: 62, rhr_7d_trend: 0, status: 'valid' },
    tolerance: { resting_hr_bpm: 2, rhr_7d_trend: 0.2 },
  },
  {
    description: "Day 1 only — single RHR value 70 BPM",
    setup: (algo) => {
      algo.clearHistory();
      algo.addDaily('2024-01-01', 70);
    },
    expected: { resting_hr_bpm: 70, rhr_7d_trend: null, status: 'acquiring' },
    tolerance: { resting_hr_bpm: 0 },
  },
  {
    description: "7 days gradual rise (60→66 BPM, +1 BPM/day)",
    setup: (algo) => {
      algo.clearHistory();
      for (let d = 0; d < 7; d++) {
        const date = new Date(2024, 0, d + 1).toISOString().split('T')[0];
        algo.addDaily(date, 60 + d);
      }
    },
    expected: { resting_hr_bpm: 66, rhr_7d_trend: 1.0, status: 'preliminary' },
    tolerance: { resting_hr_bpm: 1, rhr_7d_trend: 0.3 },
  },
  {
    description: "Sudden spike: 14-day baseline 60, today 75",
    setup: (algo) => {
      algo.clearHistory();
      for (let d = 0; d < 13; d++) {
        const date = new Date(2024, 0, d + 1).toISOString().split('T')[0];
        algo.addDaily(date, 60 + (Math.random() - 0.5));
      }
      algo.addDaily('2024-01-14', 75);
    },
    expected: { anomaly_z_score_above: 2.0, status: 'valid' },
    tolerance: {},
  },
  {
    description: "3 consecutive missing days then new value",
    setup: (algo) => {
      algo.clearHistory();
      for (let d = 0; d < 10; d++) {
        const date = new Date(2024, 0, d + 1).toISOString().split('T')[0];
        algo.addDaily(date, 62);
      }
      // Gap: days 11-14 missing
      algo.addDaily('2024-01-15', 64);
    },
    expected: { resting_hr_bpm: 64, status: 'preliminary' },
    tolerance: { resting_hr_bpm: 1 },
  },
  {
    description: "Athlete: consistently 38 BPM",
    setup: (algo) => {
      algo.clearHistory();
      for (let d = 0; d < 14; d++) {
        const date = new Date(2024, 0, d + 1).toISOString().split('T')[0];
        algo.addDaily(date, 38 + (Math.random() - 0.5) * 0.5);
      }
    },
    expected: { resting_hr_bpm: 38, rhr_7d_trend: 0, status: 'valid' },
    tolerance: { resting_hr_bpm: 2, rhr_7d_trend: 0.2 },
  },
  {
    description: "No data at all",
    setup: (algo) => { algo.clearHistory(); },
    expected: { resting_hr_bpm: null, status: 'acquiring' },
    tolerance: {},
  },
  {
    description: "5 valid days + 2 missing in 7-day window",
    setup: (algo) => {
      algo.clearHistory();
      // Days 1,2,3,5,7 — gaps at 4 and 6
      [1, 2, 3, 5, 7].forEach(d => {
        const date = new Date(2024, 0, d).toISOString().split('T')[0];
        algo.addDaily(date, 65);
      });
    },
    expected: { resting_hr_bpm: 65, status: 'preliminary' },
    tolerance: { resting_hr_bpm: 1 },
  },
];

// Export for test runners
if (typeof module !== 'undefined' && module.exports) {
  module.exports = scenarios;
}
