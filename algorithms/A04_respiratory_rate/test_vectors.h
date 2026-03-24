#pragma once
// Test scenarios for A04: Respiratory Rate
// Compile: clang++ -std=c++17 -I../../framework -o test_a04 ../../test/test_runner.cpp

struct TestScenario_A04 {
    const char* description;
    float trueRespRate_Hz;    // Simulated respiratory frequency
    uint8_t activeModulations;// How many of RIIV/RIFV/RIAV have clear signal
    float motionLevel_g;      // IMU motion
    uint16_t beatCount;       // Available beats in 30s window
    float expectedBrPM;
    float tolerance;
    bool  expectValid;
};

static const TestScenario_A04 SCENARIOS_A04[] = {
    { "Normal breathing 16 BrPM",             0.267f, 3, 0.0f, 40, 16.0f, 2.0f, true  },
    { "Slow deep breathing 8 BrPM",           0.133f, 3, 0.0f, 30, 8.0f,  2.0f, true  },
    { "Fast breathing 28 BrPM",               0.467f, 3, 0.0f, 50, 28.0f, 3.0f, true  },
    { "No tissue contact (DC=0)",             0.0f,   0, 0.0f, 0,  0.0f,  0.0f, false },
    { "Heavy motion (0.8g for 10s)",          0.267f, 0, 0.8f, 40, 0.0f,  0.0f, false },
    { "Only RIIV modulation present",         0.267f, 1, 0.0f, 35, 16.0f, 3.0f, true  },
    { "No clear respiratory peak",            0.0f,   0, 0.0f, 40, 0.0f,  0.0f, false },
    { "Very low rate 5 BrPM (meditation)",    0.083f, 2, 0.0f, 25, 5.0f,  2.0f, true  },
    { "Too few beats (< 15 in 30s window)",   0.267f, 3, 0.0f, 10, 0.0f,  0.0f, false },
};

static constexpr int SCENARIO_COUNT_A04 = sizeof(SCENARIOS_A04) / sizeof(SCENARIOS_A04[0]);
