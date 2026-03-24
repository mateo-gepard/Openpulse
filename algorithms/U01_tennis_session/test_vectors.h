#pragma once
// ═══════════════════════════════════════════════════════════════
// Test Scenarios for U01: Tennis Session Analytics
//
// Signal simulation approach — mathematical models generate
// synthetic IMU signals for deterministic stroke testing.
//
// Compile: clang++ -std=c++17 -I../../framework -o test_u01 \
//          ../../test/test_runner.cpp ../../firmware/src/algorithms/base/Algo_U01.cpp
// ═══════════════════════════════════════════════════════════════

#include <stdint.h>
#include <math.h>

// ─── Test Scenario Descriptor ──────────────────────────────────

struct TestScenario_U01 {
    const char* description;
    float       peak_accel_g;       // Peak acceleration magnitude during swing
    float       peak_accel_y_g;     // Peak Y-axis (vertical) acceleration
    float       peak_gyro_z_dps;    // Peak gyro Z-axis (wrist rotation, °/s)
    float       peak_gyro_mag_dps;  // Peak gyro magnitude (°/s)
    uint32_t    swing_duration_ms;  // Duration of threshold crossing
    uint8_t     expected_type;      // 0=FH, 1=BH, 2=SV, 3=VO, 4=UNC
    float       expected_speed_kmh; // Expected swing speed estimate
    float       speed_tolerance;    // Acceptable ± error (km/h)
    bool        expect_valid;       // true = stroke should be detected
    float       min_sqi;            // Minimum expected SQI
};

// ─── Signal Generator ──────────────────────────────────────────
// Generates one IMU sample at time t during a simulated stroke.
// Models a Gaussian acceleration pulse centered at swing midpoint
// with gyroscopic rotation pattern.
//
// Reference: Whiteside et al. 2017 "Monitoring hitting load using
// inertial sensors", JSSM. Camomilla et al. 2018.

struct IMUSample {
    float ax, ay, az;  // Accelerometer (g)
    float gx, gy, gz;  // Gyroscope (°/s)
};

static inline IMUSample generateIMUSample(
    float t_sec,                // Time within scenario
    float swing_start_sec,      // When swing begins
    float swing_duration_sec,   // Swing total duration
    float peak_accel_g,         // Peak accel magnitude
    float peak_accel_y_g,       // Vertical component (for serve)
    float peak_gyro_z_dps,      // Peak wrist rotation
    float peak_gyro_mag_dps,    // Peak total angular velocity
    float noise_amp             // Noise amplitude (g for accel, °/s for gyro)
) {
    IMUSample s;

    // Gravity baseline
    s.ax = 0.0f;
    s.ay = 0.0f;
    s.az = 1.0f;  // Gravity along Z when wrist is horizontal
    s.gx = 0.0f;
    s.gy = 0.0f;
    s.gz = 0.0f;

    // Swing pulse — Gaussian envelope centered at swing midpoint
    float mid = swing_start_sec + swing_duration_sec / 2.0f;
    float sigma = swing_duration_sec / 4.0f;
    float phase = (t_sec - mid) / sigma;
    float envelope = expf(-0.5f * phase * phase);

    if (t_sec >= swing_start_sec && t_sec <= swing_start_sec + swing_duration_sec) {
        // Acceleration: distribute magnitude across axes
        // Y-axis gets the vertical component (serve detection)
        float remaining_g = sqrtf(peak_accel_g * peak_accel_g - peak_accel_y_g * peak_accel_y_g);
        s.ax += remaining_g * 0.7f * envelope;
        s.ay += peak_accel_y_g * envelope;
        s.az += remaining_g * 0.3f * envelope;

        // Gyroscope: Z-axis is primary (wrist rotation)
        s.gz += peak_gyro_z_dps * envelope;
        // Distribute remaining gyro across X and Y
        float gz_contrib = fabsf(peak_gyro_z_dps);
        float remaining_dps = sqrtf(fmaxf(peak_gyro_mag_dps * peak_gyro_mag_dps - gz_contrib * gz_contrib, 0.0f));
        s.gx += remaining_dps * 0.6f * envelope;
        s.gy += remaining_dps * 0.4f * envelope;
    }

    // Pseudo-random noise (deterministic LCG)
    uint32_t seed = (uint32_t)(t_sec * 100000.0f) * 1103515245u + 12345u;
    float n1 = ((float)(seed & 0xFFFF) / 32768.0f - 1.0f) * noise_amp;
    seed = seed * 1103515245u + 12345u;
    float n2 = ((float)(seed & 0xFFFF) / 32768.0f - 1.0f) * noise_amp;
    s.ax += n1;
    s.ay += n2;
    seed = seed * 1103515245u + 12345u;
    s.gx += ((float)(seed & 0xFFFF) / 32768.0f - 1.0f) * noise_amp * 10;
    seed = seed * 1103515245u + 12345u;
    s.gz += ((float)(seed & 0xFFFF) / 32768.0f - 1.0f) * noise_amp * 10;

    return s;
}

// ─── Test Scenarios ────────────────────────────────────────────

static const TestScenario_U01 SCENARIOS_U01[] = {
    // ── 1. Clean forehand ─────────────────────────────────────
    {
        "Clean forehand: 5g peak, +400°/s gyroZ (pronation)",
        5.0f,           // peak accel mag
        1.0f,           // peak accel Y (low vertical = not a serve)
        400.0f,         // peak gyro Z (positive = forehand)
        450.0f,         // peak gyro magnitude
        300,            // swing duration ms
        0,              // expected: FOREHAND
        189.0f,         // 450 × 0.42
        20.0f,          // tolerance
        true,
        0.5f
    },

    // ── 2. Clean backhand ─────────────────────────────────────
    {
        "Clean backhand: 4.5g peak, -350°/s gyroZ (supination)",
        4.5f,
        0.8f,
        -350.0f,        // Negative = backhand
        400.0f,
        280,
        1,              // expected: BACKHAND
        168.0f,         // 400 × 0.42
        20.0f,
        true,
        0.5f
    },

    // ── 3. Serve ──────────────────────────────────────────────
    {
        "Serve: 6g peak, high vertical (3g Y), fast rotation",
        6.0f,
        3.0f,           // High vertical = overhead serve motion
        300.0f,
        600.0f,         // Very fast rotation
        350,
        2,              // expected: SERVE
        250.0f,         // 600 × 0.42 = 252 → clamped to 250
        0.0f,           // Exact clamp
        true,
        0.6f
    },

    // ── 4. Volley ─────────────────────────────────────────────
    {
        "Volley: 3.5g peak, short duration 150ms",
        3.5f,
        0.5f,
        100.0f,
        180.0f,
        150,            // Very short swing = volley
        3,              // expected: VOLLEY
        75.6f,          // 180 × 0.42
        20.0f,
        true,
        0.4f
    },

    // ── 5. No motion (idle) ───────────────────────────────────
    {
        "Idle: resting, gravity only, no swing",
        1.0f,           // Just gravity
        0.0f,
        0.0f,
        0.0f,
        0,
        4,              // No stroke expected
        0.0f,
        0.0f,
        false,          // No stroke detected
        0.0f
    },

    // ── 6. Walking between courts ─────────────────────────────
    {
        "Walking: 1.5g peaks, below stroke threshold",
        1.5f,
        0.3f,
        20.0f,
        30.0f,
        500,
        4,              // No stroke
        0.0f,
        0.0f,
        false,
        0.0f
    },

    // ── 7. Boundary: just above threshold ─────────────────────
    {
        "Boundary: 3.1g, barely above threshold, weak rotation",
        3.1f,
        0.5f,
        60.0f,
        80.0f,
        300,
        0,              // Weak but positive gyroZ → forehand
        33.6f,          // 80 × 0.42
        15.0f,
        true,
        0.3f
    },

    // ── 8. Heavy impact (sensor approaching saturation) ───────
    {
        "Heavy impact: 14g peak (powerful serve), high speed",
        14.0f,
        4.0f,           // Overhead
        500.0f,
        700.0f,
        300,
        2,              // SERVE (high vertical + fast)
        250.0f,         // 700 × 0.42 = 294 → clamped to 250
        0.0f,
        true,
        0.5f
    },
};

static constexpr int SCENARIO_COUNT_U01 = sizeof(SCENARIOS_U01) / sizeof(SCENARIOS_U01[0]);
