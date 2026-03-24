/* ═══════════════════════════════════════════════════════════════
   A06: Resting Heart Rate Trend (Tier 3 — off-device)

   Computes daily RHR baseline, 7-day trend, and anomaly z-scores
   from accumulated daily resting HR values stored in localStorage.

   Input:  Daily RHR values from firmware (via BLE → localStorage)
   Output: resting_hr_bpm, rhr_7d_trend, rhr_baseline, anomaly_z

   Citation: Quer et al. 2021, Mishra et al. 2020
   ═══════════════════════════════════════════════════════════════ */

const Algo_A06 = (() => {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────
  const STORAGE_KEY          = 'openpulse_rhr_history';
  const BASELINE_SHORT_ALPHA = 0.15;     // ~7-day effective window
  const BASELINE_LONG_DAYS   = 60;
  const TREND_WINDOW_DAYS    = 7;
  const MIN_DAYS_FIRST       = 3;        // Before any trend output
  const MIN_DAYS_CONFIDENT   = 14;       // Before confident baseline
  const MIN_VALID_FOR_TREND  = 5;        // Min valid days in 7-day window
  const ANOMALY_Z_THRESHOLD  = 2.0;
  const MAX_CONSECUTIVE_MISS = 3;        // Reset short baseline after gap
  const BPM_CLAMP_LOW        = 30;
  const BPM_CLAMP_HIGH       = 120;

  // ─── Storage ─────────────────────────────────────────────────
  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  /**
   * Add a new daily RHR observation.
   * @param {string} dateStr — ISO date 'YYYY-MM-DD'
   * @param {number} rhr — Resting HR in BPM (median of lowest 5-min rest window)
   * @param {number} restMinutes — Duration of rest window used (for SQI)
   * @param {number} cvHR — CV of HR during rest window (for SQI)
   */
  function addDaily(dateStr, rhr, restMinutes = 30, cvHR = 0.04) {
    if (typeof rhr !== 'number' || rhr < BPM_CLAMP_LOW || rhr > BPM_CLAMP_HIGH) return;
    const history = loadHistory();

    // Prevent duplicates for same date
    const existing = history.findIndex(d => d.date === dateStr);
    const entry = { date: dateStr, rhr, restMinutes, cvHR };
    if (existing >= 0) {
      history[existing] = entry;
    } else {
      history.push(entry);
    }

    // Keep max 365 days
    if (history.length > 365) history.shift();
    saveHistory(history);
  }

  // ─── Core Computation ────────────────────────────────────────
  function compute() {
    const history = loadHistory();
    const n = history.length;

    const result = {
      resting_hr_bpm: null,
      rhr_7d_trend: null,
      rhr_baseline_short: null,
      rhr_baseline_long: null,
      anomaly_z_score: null,
      data_days: n,
      status: 'acquiring',
      sqi: 0,
      message: ''
    };

    if (n === 0) {
      result.message = 'No data yet';
      return result;
    }

    // Sort by date
    history.sort((a, b) => a.date.localeCompare(b.date));

    // Most recent value
    const today = history[n - 1];
    result.resting_hr_bpm = today.rhr;

    if (n < MIN_DAYS_FIRST) {
      result.status = 'acquiring';
      result.message = `Gathering baseline... (${n}/${MIN_DAYS_FIRST} days)`;
      return result;
    }

    // ── Short-term baseline (EMA) ────────────────────────────
    // Check for gaps > MAX_CONSECUTIVE_MISS
    let baselineShort = history[0].rhr;
    let prevDate = new Date(history[0].date);

    for (let i = 1; i < n; i++) {
      const curDate = new Date(history[i].date);
      const gapDays = Math.round((curDate - prevDate) / 86400000);

      if (gapDays > MAX_CONSECUTIVE_MISS) {
        // Reset baseline
        baselineShort = history[i].rhr;
      } else {
        baselineShort = BASELINE_SHORT_ALPHA * history[i].rhr +
                        (1 - BASELINE_SHORT_ALPHA) * baselineShort;
      }
      prevDate = curDate;
    }
    result.rhr_baseline_short = Math.round(baselineShort * 10) / 10;

    // ── Long-term baseline (median of last 60 days) ──────────
    const longWindow = history.slice(-BASELINE_LONG_DAYS).map(d => d.rhr);
    longWindow.sort((a, b) => a - b);
    const mid = Math.floor(longWindow.length / 2);
    result.rhr_baseline_long = longWindow.length % 2 === 0
      ? (longWindow[mid - 1] + longWindow[mid]) / 2
      : longWindow[mid];

    // ── 7-day trend (linear regression) ──────────────────────
    const recent = history.slice(-TREND_WINDOW_DAYS);
    if (recent.length >= MIN_VALID_FOR_TREND) {
      // Least-squares slope: y = HR values, x = 0,1,2,...,n-1
      const m = recent.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < m; i++) {
        sumX  += i;
        sumY  += recent[i].rhr;
        sumXY += i * recent[i].rhr;
        sumX2 += i * i;
      }
      const denom = m * sumX2 - sumX * sumX;
      if (denom !== 0) {
        result.rhr_7d_trend = Math.round(((m * sumXY - sumX * sumY) / denom) * 100) / 100;
      }
    }

    // ── Anomaly detection (z-score vs 14-day window) ─────────
    const shortWindow = history.slice(-MIN_DAYS_CONFIDENT);
    if (shortWindow.length >= MIN_DAYS_FIRST) {
      const values = shortWindow.map(d => d.rhr);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
      const sd = Math.sqrt(variance);
      if (sd > 0.5) {
        result.anomaly_z_score = Math.round(((today.rhr - mean) / sd) * 100) / 100;
      } else {
        result.anomaly_z_score = 0;
      }
    }

    // ── SQI ──────────────────────────────────────────────────
    // Duration (40%)
    const sqiDuration = Math.min(Math.max((today.restMinutes - 5) / 25, 0), 1);
    // Stability (30%)
    const sqiStability = Math.min(Math.max(1 - (today.cvHR - 0.03) / 0.07, 0), 1);
    // Completeness (30%)
    const validDays7 = history.slice(-7).length;
    const sqiComplete = Math.min(Math.max((validDays7 - 3) / 4, 0), 1);
    result.sqi = Math.round((0.4 * sqiDuration + 0.3 * sqiStability + 0.3 * sqiComplete) * 100) / 100;

    // ── Status ───────────────────────────────────────────────
    if (n < MIN_DAYS_CONFIDENT) {
      result.status = 'preliminary';
      result.message = `Preliminary (${n}/${MIN_DAYS_CONFIDENT} days)`;
    } else {
      result.status = 'valid';
      result.message = '';
    }

    return result;
  }

  // ─── Public API ──────────────────────────────────────────────
  return {
    id: 'A06',
    name: 'Resting HR Trend',
    tier: 3,
    unit: 'BPM',
    addDaily,
    compute,
    clearHistory: () => localStorage.removeItem(STORAGE_KEY),
    getHistory: loadHistory
  };
})();

// Export for module systems (optional, works as plain <script> too)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Algo_A06;
}
