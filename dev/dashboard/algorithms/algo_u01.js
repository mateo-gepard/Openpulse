/* ═══════════════════════════════════════════════════════════════
   U01: Tennis Session Analytics (Tier 3 — session aggregation)

   Browser-side companion to the firmware stroke detector.
   Aggregates BLE stroke events into session statistics,
   stroke breakdown, speed analytics, and court zone distribution.

   Input:  Stroke events from firmware (via BLE → localStorage)
   Output: Session summary, breakdown, speed stats, zone heatmap

   Citations: Srivastava et al. 2015, Whiteside et al. 2017
   ═══════════════════════════════════════════════════════════════ */

const Algo_U01 = (() => {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────
  const STORAGE_KEY        = 'openpulse_tennis_sessions';
  const SPEED_CLAMP_HIGH   = 250;   // km/h
  const SPEED_CLAMP_LOW    = 0;
  const MAX_STROKES_SESSION = 2000;  // Safety cap
  const SESSION_GAP_MS     = 1800000; // 30 min gap = new session
  const TYPE_NAMES         = ['Forehand', 'Backhand', 'Serve', 'Volley', 'Unclassified'];

  // ─── Storage ─────────────────────────────────────────────────

  function loadSessions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveSessions(sessions) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }

  function getCurrentSession() {
    const sessions = loadSessions();
    if (sessions.length === 0) return null;
    return sessions[sessions.length - 1];
  }

  // ─── Event Ingestion ─────────────────────────────────────────

  /**
   * Add a stroke event from BLE.
   * @param {number} type — 0=FH, 1=BH, 2=SV, 3=VO, 4=UNC
   * @param {number} speed_kmh — Estimated swing speed
   * @param {number} peakAccel_g — Peak acceleration
   * @param {number} timestamp_ms — Device timestamp
   */
  function addStroke(type, speed_kmh, peakAccel_g, timestamp_ms) {
    if (typeof type !== 'number' || type < 0 || type > 4) return;
    if (typeof speed_kmh !== 'number') return;

    const speed = Math.min(Math.max(speed_kmh, SPEED_CLAMP_LOW), SPEED_CLAMP_HIGH);
    const sessions = loadSessions();
    const now = Date.now();

    // Check if we need a new session
    let session;
    if (sessions.length === 0 ||
        now - sessions[sessions.length - 1].lastEventTime > SESSION_GAP_MS) {
      session = {
        id: now,
        startTime: now,
        lastEventTime: now,
        strokes: [],
        typeCounts: [0, 0, 0, 0, 0],
        totalStrokes: 0,
        activeTime_ms: 0,
        restTime_ms: 0,
      };
      sessions.push(session);
    } else {
      session = sessions[sessions.length - 1];
    }

    // Safety cap
    if (session.strokes.length >= MAX_STROKES_SESSION) return;

    // Add stroke
    session.strokes.push({
      type,
      speed,
      peakAccel_g: peakAccel_g || 0,
      timestamp_ms: timestamp_ms || now,
      wallTime: now,
    });

    session.typeCounts[type]++;
    session.totalStrokes++;
    session.lastEventTime = now;

    // Keep max 50 sessions
    if (sessions.length > 50) sessions.shift();
    saveSessions(sessions);
  }

  // ─── Session Analysis ────────────────────────────────────────

  function analyzeSession(session) {
    if (!session || session.strokes.length === 0) {
      return {
        valid: false,
        totalStrokes: 0,
        message: 'No stroke data',
      };
    }

    const strokes = session.strokes;
    const speeds = strokes.map(s => s.speed);
    const n = strokes.length;

    // Speed statistics
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / n;
    const maxSpeed = Math.max(...speeds);
    const minSpeed = Math.min(...speeds);

    // Speed by type
    const speedByType = [[], [], [], [], []];
    for (const s of strokes) {
      speedByType[s.type].push(s.speed);
    }
    const avgSpeedByType = speedByType.map(arr =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
    );

    // Session duration
    const duration_ms = session.lastEventTime - session.startTime;
    const duration_min = duration_ms / 60000;

    // Stroke rate (strokes per minute of active play)
    const strokeRate = duration_min > 0 ? n / duration_min : 0;

    // Consistency: coefficient of variation of speeds per type
    const consistency = {};
    for (let t = 0; t < 4; t++) {
      const arr = speedByType[t];
      if (arr.length < 3) {
        consistency[TYPE_NAMES[t]] = null;
        continue;
      }
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      const variance = arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
      consistency[TYPE_NAMES[t]] = Math.max(0, 1 - cv); // 0–1, higher = more consistent
    }

    // Speed trend (split session into thirds)
    const third = Math.floor(n / 3);
    const speedTrend = {
      first: third > 0 ? speeds.slice(0, third).reduce((a, b) => a + b, 0) / third : 0,
      middle: third > 0 ? speeds.slice(third, 2 * third).reduce((a, b) => a + b, 0) / third : 0,
      last: third > 0 ? speeds.slice(2 * third).reduce((a, b) => a + b, 0) / (n - 2 * third) : 0,
    };

    // Fatigue indicator: speed drop from first third to last third
    const fatiguePct = speedTrend.first > 0
      ? ((speedTrend.first - speedTrend.last) / speedTrend.first) * 100
      : 0;

    return {
      valid: true,
      totalStrokes: n,
      typeCounts: session.typeCounts.slice(),
      avgSpeed: Math.round(avgSpeed),
      maxSpeed: Math.round(maxSpeed),
      minSpeed: Math.round(minSpeed),
      avgSpeedByType: avgSpeedByType.map(v => Math.round(v)),
      duration_min: Math.round(duration_min * 10) / 10,
      strokeRate: Math.round(strokeRate * 10) / 10,
      consistency,
      speedTrend,
      fatiguePct: Math.round(fatiguePct),
      startTime: session.startTime,
      sqi: 1.0,
      timestamp: Date.now(),
    };
  }

  // ─── Public API ──────────────────────────────────────────────

  return {
    id: 'U01',
    name: 'Tennis Session Analytics',
    requires: ['accel', 'gyro'],
    minimumDays: 0,

    addStroke,
    analyzeSession,
    getCurrentSession,
    loadSessions,

    compute() {
      const session = getCurrentSession();
      return analyzeSession(session);
    },
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Algo_U01;
}
