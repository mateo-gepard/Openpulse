// ═══════════════════════════════════════════════════════════════
// Tier 3 Dashboard Algorithm Template — algo_${id}.js
// ═══════════════════════════════════════════════════════════════
// For algorithms that run in the BROWSER, not on the MCU.
// Typical: composite scores, trend analysis, sleep scoring,
//          reports, biological age — anything needing multi-day
//          data or complex ML that won't fit on nRF52840.
//
// Place at: dev/dashboard/algorithms/algo_${id}.js
// ═══════════════════════════════════════════════════════════════

export default {
  id: '${ID}',
  name: '${NAME}',

  // ─── Required Data Channels ────────────────────────────
  // Keys into the IndexedDB time-series store
  requires: [${REQUIRED_CHANNELS}],
  // e.g., ['hr', 'hrv', 'skinTemp', 'accelRms', 'eda']

  // ─── Minimum Data ──────────────────────────────────────
  // How many days of data before first valid output
  minimumDays: ${MIN_DAYS},
  // 1 = can produce preliminary output on day 1
  // 14 = baseline-dependent (recovery score, biological age, etc.)

  // ─── Computation ───────────────────────────────────────
  // Called by dashboard when user opens the algorithm panel
  // or on schedule (e.g., morning summary)
  compute(data, userProfile) {
    // data = {
    //   hr:       [{ value, sqi, timestamp }, ...],  // time-series
    //   hrv:      [{ value, sqi, timestamp }, ...],
    //   skinTemp: [{ value, sqi, timestamp }, ...],
    //   ...
    // }
    // userProfile = {
    //   age: <number>,
    //   weight: <kg>,
    //   height: <cm>,
    //   sex: 'male' | 'female',
    //   restingHR: <bpm>,            // auto-derived baseline
    //   baselineTemp: <°C>,          // auto-derived baseline
    //   ...
    // }

    // ── 1. Validate data sufficiency ─────────────────────
    // const requiredKeys = this.requires;
    // for (const key of requiredKeys) {
    //   if (!data[key] || data[key].length === 0) {
    //     return { value: 0, sqi: 0, valid: false, timestamp: Date.now(),
    //              message: `Waiting for ${key} data...` };
    //   }
    // }

    // ── 2. Filter to quality data (SQI >= threshold) ────
    // const goodHR = data.hr.filter(d => d.sqi >= 0.3);

    // ── 3. Compute sub-scores ────────────────────────────
    // Each sub-score is 0-100 or a domain-specific metric
    // const subScore1 = computeSubScore1(goodHR, userProfile);
    // const subScore2 = computeSubScore2(data.hrv, userProfile);

    // ── 4. Weighted combination ──────────────────────────
    // const weights = { sub1: 0.4, sub2: 0.3, sub3: 0.3 };
    // const score = subScore1 * weights.sub1
    //             + subScore2 * weights.sub2
    //             + subScore3 * weights.sub3;

    // ── 5. Range-check output ────────────────────────────
    // const clamped = Math.max(${OUTPUT_MIN}, Math.min(${OUTPUT_MAX}, score));

    return {
      value: 0,
      sqi: 0,
      valid: false,
      timestamp: Date.now(),
      breakdown: {
        // Sub-score details for display module
        // sub1: { value: subScore1, label: 'Sub Score 1', weight: 0.4 },
        // sub2: { value: subScore2, label: 'Sub Score 2', weight: 0.3 },
      },
      // For baseline-dependent algorithms:
      // baselineStatus: 'collecting',  // 'collecting' | 'preliminary' | 'confident'
      // baselineDays: currentDays,
      // baselineRequired: ${MIN_DAYS},
    };
  },
};
