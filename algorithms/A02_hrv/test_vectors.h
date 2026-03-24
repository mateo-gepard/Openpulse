#pragma once
// Test scenarios for A02: HRV (RMSSD)
// Compile: clang++ -std=c++17 -I../../framework -o test_a02 ../../test/test_runner.cpp

struct TestScenario_A02 {
    const char* description;
    float ibiMean_ms;         // Mean IBI (ms)
    float ibiJitter_ms;       // Std-dev of IBI variation
    uint16_t beatCount;       // Number of beats to simulate
    float motionLevel_g;      // IMU motion
    float expectedRMSSD;
    float tolerance;
    bool  expectValid;
};

static const TestScenario_A02 SCENARIOS_A02[] = {
    { "Normal HRV (72 BPM, RMSSD ~42ms)",    833.0f, 42.0f,  60,  0.0f,  42.0f,  10.0f, true  },
    { "Low HRV (88 BPM, RMSSD ~15ms)",       682.0f, 15.0f,  60,  0.0f,  15.0f,  5.0f,  true  },
    { "High HRV athlete (52 BPM, ~80ms)",     1154.0f, 80.0f, 60,  0.0f,  80.0f,  15.0f, true  },
    { "Insufficient beats (10 only)",         833.0f, 42.0f,  10,  0.0f,  0.0f,   0.0f,  false },
    { "Heavy motion (0.8g)",                  833.0f, 42.0f,  60,  0.8f,  0.0f,   0.0f,  false },
    { "Very low variability (metronome)",     833.0f, 2.0f,   60,  0.0f,  2.0f,   2.0f,  true  },
    { "Very high variability (200ms jitter)", 833.0f, 200.0f, 60,  0.0f,  200.0f, 30.0f, true  },
    { "No A01 data (sensor off)",             0.0f,   0.0f,   0,   0.0f,  0.0f,   0.0f,  false },
};

static constexpr int SCENARIO_COUNT_A02 = sizeof(SCENARIOS_A02) / sizeof(SCENARIOS_A02[0]);
