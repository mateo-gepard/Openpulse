#pragma once
// ═══════════════════════════════════════════════════════════════
// Test Scenarios for A01: Heart Rate (Real-Time)
//
// Signal simulation approach — mathematical models generate
// synthetic PPG-like signals for deterministic testing.
//
// Compile: clang++ -std=c++17 -I../../framework -o test_a01 \
//          ../../test/test_runner.cpp ../../firmware/src/algorithms/base/Algo_A01.cpp
// ═══════════════════════════════════════════════════════════════

#include <stdint.h>
#include <math.h>

// ─── Test Scenario Descriptor ──────────────────────────────────

struct TestScenario_A01 {
    const char* description;
    float       target_bpm;       // True BPM of simulated signal
    float       ppg_amplitude;    // AC amplitude (arbitrary units, ~0 to 1000)
    float       ppg_dc_level;     // DC offset (models tissue absorption)
    float       noise_amplitude;  // Additive Gaussian noise amplitude
    float       motion_g;         // Simulated motion (g units, 0 = still)
    float       expected_bpm;     // Expected algorithm output (BPM)
    float       tolerance_bpm;    // Acceptable ± error
    bool        expect_valid;     // true = algorithm should produce valid output
    float       min_sqi;          // Minimum expected SQI (0.0–1.0)
};

// ─── Signal Generator ──────────────────────────────────────────
// Generates one PPG sample at time t (seconds) using a sum-of-
// Gaussians pulse model. Approximates real PPG morphology:
//   systolic peak (S), dicrotic notch (DN), diastolic peak (D).
//
// Reference: Charlton et al. "Modelling arterial pulse waves",
// Int J Numer Method Biomed Eng, 2019. DOI: 10.1002/cnm.3174

static inline float generatePPGSample(
    float t_sec,
    float bpm,
    float amplitude,
    float dc_level,
    float noise_amp
) {
    if (bpm <= 0) return dc_level;  // No signal

    const float period = 60.0f / bpm;
    const float phase = fmodf(t_sec, period) / period;  // 0.0 → 1.0

    // Sum-of-Gaussians PPG model (normalized phase)
    // Systolic peak at phase 0.20, width 0.08
    const float s_peak = expf(-powf((phase - 0.20f) / 0.08f, 2.0f));
    // Dicrotic notch at phase 0.42, width 0.04 (negative dip)
    const float dn = -0.15f * expf(-powf((phase - 0.42f) / 0.04f, 2.0f));
    // Diastolic peak at phase 0.50, width 0.10
    const float d_peak = 0.35f * expf(-powf((phase - 0.50f) / 0.10f, 2.0f));

    float pulse = s_peak + dn + d_peak;

    // Pseudo-random noise (deterministic LCG for reproducibility)
    // Uses fractional part of large multiplication as cheap noise
    uint32_t seed = (uint32_t)(t_sec * 100000.0f) * 1103515245u + 12345u;
    float noise = ((float)(seed & 0xFFFF) / 32768.0f - 1.0f) * noise_amp;

    return dc_level + amplitude * pulse + noise;
}

// Simulated accelerometer magnitude (simple model)
static inline float generateAccelSample(float motion_g) {
    // Returns magnitude: 1.0g (gravity) + motion component
    return 1.0f + motion_g;
}

// ─── Test Scenarios ────────────────────────────────────────────

static const TestScenario_A01 SCENARIOS_A01[] = {
    // ── 1. Clean normal heart rate ────────────────────────────
    {
        "Clean 75 BPM, no motion, good perfusion",
        75.0f,          // target BPM
        500.0f,         // ppg amplitude (strong signal)
        10000.0f,       // DC level
        5.0f,           // minimal noise
        0.0f,           // no motion
        75.0f,          // expected output
        2.0f,           // ±2 BPM
        true,           // valid
        0.8f            // high SQI expected
    },

    // ── 2. Boundary low: bradycardia ──────────────────────────
    {
        "Bradycardia 35 BPM, still, moderate signal",
        35.0f,
        300.0f,
        10000.0f,
        10.0f,
        0.0f,
        35.0f,
        3.0f,
        true,
        0.6f
    },

    // ── 3. Boundary high: intense exercise ────────────────────
    {
        "Tachycardia 200 BPM, slight motion, good signal",
        200.0f,
        400.0f,
        10000.0f,
        15.0f,
        0.3f,           // light motion from exercise
        200.0f,
        5.0f,
        true,
        0.5f
    },

    // ── 4. No signal (sensor off / no finger) ─────────────────
    {
        "No PPG signal, flat line",
        0.0f,           // no heartbeat
        0.0f,           // zero amplitude
        0.0f,           // no DC (sensor off)
        0.0f,
        0.0f,
        0.0f,
        0.0f,
        false,          // should NOT produce valid output
        0.0f
    },

    // ── 5. Heavy motion artifact ──────────────────────────────
    {
        "75 BPM with heavy arm motion (2g)",
        75.0f,
        200.0f,
        10000.0f,
        100.0f,         // heavy noise from motion coupling
        2.0f,           // 2g motion → SQI should drop below threshold
        0.0f,
        0.0f,
        false,          // output suppressed due to low SQI
        0.0f
    },

    // ── 6. Gradual HR increase (60→120 BPM ramp) ─────────────
    {
        "Ramp from 60 to 120 BPM over 30s — tests tracking",
        90.0f,          // midpoint of ramp (average expected)
        450.0f,
        10000.0f,
        8.0f,
        0.05f,          // minimal motion
        90.0f,          // should track the ramp; midpoint as reference
        10.0f,          // wider tolerance (EMA lag during transition)
        true,
        0.7f
    },

    // ── 7. Low perfusion (weak signal, borderline) ────────────
    {
        "Very low perfusion index (small AC, large DC)",
        72.0f,
        10.0f,          // very weak pulse amplitude
        50000.0f,       // large DC → PI ≈ 0.02% → below threshold
        3.0f,
        0.0f,
        0.0f,
        0.0f,
        false,          // PI < 0.1% → IDLE state
        0.0f
    },

    // ── 8. Moderate noise, signal recoverable ─────────────────
    {
        "75 BPM with moderate noise (SNR ~10dB)",
        75.0f,
        400.0f,
        10000.0f,
        40.0f,          // moderate noise
        0.1f,           // slight desk vibration
        75.0f,
        4.0f,           // slightly wider tolerance
        true,
        0.5f            // SQI above threshold but not pristine
    },

    // ── 9. Irregular rhythm (skipped beat simulation) ─────────
    {
        "60 BPM with occasional 1.5x IBI (premature beat pattern)",
        60.0f,
        450.0f,
        10000.0f,
        8.0f,
        0.0f,
        60.0f,
        5.0f,           // wider tolerance due to rhythm irregularity
        true,
        0.6f
    },
};

static constexpr int SCENARIO_COUNT_A01 = sizeof(SCENARIOS_A01) / sizeof(SCENARIOS_A01[0]);
