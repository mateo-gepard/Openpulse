#pragma once
// Test scenarios for A01: Heart Rate
// Compile: clang++ -std=c++17 -I../../framework -o test_a01 ../../test/test_runner.cpp

struct TestScenario_A01 {
    const char* description;
    float simulatedHR_bpm;     // True simulated heart rate
    float motionLevel_g;       // IMU acceleration offset from 1g
    float perfusionIndex_pct;  // Simulated PI
    float expectedBPM;
    float tolerance;
    bool  expectValid;
};

static const TestScenario_A01 SCENARIOS_A01[] = {
    { "Clean resting HR 72 BPM",           72.0f,  0.0f,  3.0f,  72.0f,  3.0f,  true  },
    { "Boundary low: 35 BPM (athlete)",    35.0f,  0.0f,  2.0f,  35.0f,  3.0f,  true  },
    { "Boundary high: 200 BPM (exercise)", 200.0f, 0.0f,  1.5f,  200.0f, 5.0f,  true  },
    { "No tissue contact (DC = 0)",        0.0f,   0.0f,  0.0f,  0.0f,   0.0f,  false },
    { "Heavy motion artifact (2g)",        72.0f,  2.0f,  1.0f,  0.0f,   0.0f,  false },
    { "Gradual HR rise 60→90 over 60s",    75.0f,  0.0f,  2.5f,  75.0f,  5.0f,  true  },
    { "Low perfusion (PI = 0.1%)",         72.0f,  0.0f,  0.1f,  0.0f,   0.0f,  false },
    { "Moderate motion (0.3g)",            72.0f,  0.3f,  2.0f,  72.0f,  5.0f,  true  },
    { "Below clamp: 25 BPM signal",        25.0f,  0.0f,  2.0f,  0.0f,   0.0f,  false },
    { "Above clamp: 230 BPM signal",       230.0f, 0.0f,  2.0f,  0.0f,   0.0f,  false },
};

static constexpr int SCENARIO_COUNT_A01 = sizeof(SCENARIOS_A01) / sizeof(SCENARIOS_A01[0]);
