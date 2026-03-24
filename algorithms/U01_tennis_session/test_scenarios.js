// test_scenarios.js — Test scenarios for U01: Tennis Session Analytics
// Run: node test_scenarios.js
// Tests the Tier 3 browser-side session aggregation logic

// Inline mock of localStorage for Node.js testing
const storage = {};
const localStorageMock = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = val; },
  removeItem: (key) => { delete storage[key]; },
};
if (typeof localStorage === 'undefined') {
  global.localStorage = localStorageMock;
}

// Load the algorithm module
const Algo_U01 = require('./algo_u01.js');

const scenarios = [
  {
    description: 'Empty session — no strokes added',
    setup: () => {},
    expected: { valid: false, totalStrokes: 0 },
  },
  {
    description: 'Single forehand stroke',
    setup: () => {
      Algo_U01.addStroke(0, 120, 5.0, Date.now());
    },
    expected: { valid: true, totalStrokes: 1, typeCounts0: 1 },
  },
  {
    description: '10-stroke mixed rally (5 FH, 3 BH, 1 SV, 1 VO)',
    setup: () => {
      const base = Date.now();
      const strokes = [
        [0, 110], [1, 95], [0, 115], [0, 108], [1, 90],
        [2, 180], [0, 112], [1, 88], [0, 105], [3, 65],
      ];
      strokes.forEach(([type, speed], i) => {
        Algo_U01.addStroke(type, speed, 4.0 + Math.random(), base + i * 5000);
      });
    },
    expected: { valid: true, totalStrokes: 11, avgSpeedMin: 80, avgSpeedMax: 130 },
  },
  {
    description: 'Speed clamping — stroke above 250 km/h clamped',
    setup: () => {
      Algo_U01.addStroke(2, 300, 8.0, Date.now()); // 300 → clamped to 250
    },
    expected: { valid: true, maxSpeedClamped: 250 },
  },
  {
    description: 'Invalid type rejected',
    setup: () => {
      const before = Algo_U01.compute().totalStrokes;
      Algo_U01.addStroke(7, 100, 4.0, Date.now()); // type 7 is invalid
      const after = Algo_U01.compute().totalStrokes;
      return { before, after };
    },
    expected: { countUnchanged: true },
    customCheck: (result) => result.before === result.after,
  },
  {
    description: 'Fatigue detection — speed drops over session',
    setup: () => {
      // Clear and start fresh session
      localStorage.removeItem('openpulse_tennis_sessions');
      const base = Date.now();
      // First third: fast
      for (let i = 0; i < 10; i++) {
        Algo_U01.addStroke(0, 140 + Math.random() * 10, 5.0, base + i * 3000);
      }
      // Middle third: medium
      for (let i = 10; i < 20; i++) {
        Algo_U01.addStroke(0, 110 + Math.random() * 10, 4.5, base + i * 3000);
      }
      // Last third: slow (fatigue)
      for (let i = 20; i < 30; i++) {
        Algo_U01.addStroke(0, 80 + Math.random() * 10, 4.0, base + i * 3000);
      }
    },
    expected: { valid: true, fatiguePctPositive: true },
  },
];

// ── Run tests ─────────────────────────────────────────────────

let passed = 0;
let failed = 0;

for (const s of scenarios) {
  // Reset storage between independent tests
  if (s.description.includes('Empty') || s.description.includes('Fatigue')) {
    localStorage.removeItem('openpulse_tennis_sessions');
  }

  const setupResult = s.setup();
  const result = Algo_U01.compute();

  let pass = true;
  const checks = [];

  if (s.customCheck) {
    pass = s.customCheck(setupResult);
    checks.push(`custom: ${pass}`);
  } else {
    if (s.expected.valid !== undefined && result.valid !== s.expected.valid) {
      pass = false;
      checks.push(`valid: got ${result.valid}, want ${s.expected.valid}`);
    }
    if (s.expected.totalStrokes !== undefined && result.totalStrokes !== s.expected.totalStrokes) {
      pass = false;
      checks.push(`totalStrokes: got ${result.totalStrokes}, want ${s.expected.totalStrokes}`);
    }
    if (s.expected.typeCounts0 !== undefined && result.typeCounts && result.typeCounts[0] !== s.expected.typeCounts0) {
      pass = false;
      checks.push(`typeCounts[0]: got ${result.typeCounts?.[0]}, want ${s.expected.typeCounts0}`);
    }
    if (s.expected.avgSpeedMin !== undefined && (result.avgSpeed < s.expected.avgSpeedMin || result.avgSpeed > s.expected.avgSpeedMax)) {
      pass = false;
      checks.push(`avgSpeed: got ${result.avgSpeed}, want ${s.expected.avgSpeedMin}–${s.expected.avgSpeedMax}`);
    }
    if (s.expected.maxSpeedClamped !== undefined && result.maxSpeed > s.expected.maxSpeedClamped) {
      pass = false;
      checks.push(`maxSpeed: got ${result.maxSpeed}, want ≤${s.expected.maxSpeedClamped}`);
    }
    if (s.expected.fatiguePctPositive && result.fatiguePct <= 0) {
      pass = false;
      checks.push(`fatiguePct: got ${result.fatiguePct}, want > 0`);
    }
  }

  if (pass) {
    console.log(`PASS: ${s.description}`);
    passed++;
  } else {
    console.log(`FAIL: ${s.description} — ${checks.join(', ')}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${scenarios.length} scenarios`);
process.exit(failed > 0 ? 1 : 0);
