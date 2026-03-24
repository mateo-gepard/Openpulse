#pragma once
// Test scenarios for A07: PPG Waveform Analysis
// Compile: clang++ -std=c++17 -I../../framework -o test_a07 ../../test/test_runner.cpp

struct TestScenario_A07 {
    const char* description;
    float simulatedHR_bpm;    // Heart rate of simulated PPG
    float bodyHeight_m;       // User height for SI calculation
    float motionLevel_g;      // IMU motion
    bool  hasNotch;           // Dicrotic notch present in waveform
    float expectedSI;         // Stiffness Index (m/s)
    float tolerance;
    bool  expectValid;
};

static const TestScenario_A07 SCENARIOS_A07[] = {
    { "Young adult (SI ~6.5 m/s)",           72.0f, 1.75f, 0.0f, true,  6.5f,  1.5f, true  },
    { "Elderly (SI ~11 m/s)",                76.0f, 1.70f, 0.0f, true,  11.0f, 2.0f, true  },
    { "No tissue contact",                   0.0f,  1.75f, 0.0f, false, 0.0f,  0.0f, false },
    { "Heavy motion (>0.3g)",                72.0f, 1.75f, 0.5f, true,  0.0f,  0.0f, false },
    { "Low perfusion (PI < 0.5%)",           72.0f, 1.75f, 0.0f, false, 0.0f,  0.0f, false },
    { "High HR > 120 BPM (morphology off)",  140.0f,1.75f, 0.0f, true,  0.0f,  0.0f, false },
    { "No dicrotic notch — reduced features",72.0f, 1.75f, 0.0f, false, 0.0f,  0.0f, false },
    { "Short user (1.55m, lower SI)",        72.0f, 1.55f, 0.0f, true,  5.8f,  1.5f, true  },
};

static constexpr int SCENARIO_COUNT_A07 = sizeof(SCENARIOS_A07) / sizeof(SCENARIOS_A07[0]);
