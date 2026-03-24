#pragma once
// Test scenarios for A03: SpO2
// Compile: clang++ -std=c++17 -I../../framework -o test_a03 ../../test/test_runner.cpp

struct TestScenario_A03 {
    const char* description;
    float rRatio;             // Simulated R = (AC_red/DC_red) / (AC_ir/DC_ir)
    float motionLevel_g;      // IMU motion
    float piRed_pct;          // Red channel perfusion index
    float expectedSpO2;
    float tolerance;
    bool  expectValid;
};

static const TestScenario_A03 SCENARIOS_A03[] = {
    { "Normal SpO2 (R=0.4 → ~99%)",      0.4f,  0.0f, 2.0f,  99.0f, 2.0f, true  },
    { "Mild hypoxemia (R=0.8 → ~90%)",    0.8f,  0.0f, 1.5f,  90.0f, 2.0f, true  },
    { "Moderate hypoxemia (R=1.2 → ~80%)",1.2f,  0.0f, 1.0f,  80.0f, 3.0f, true  },
    { "No tissue contact (DC=0)",          0.0f,  0.0f, 0.0f,  0.0f,  0.0f, false },
    { "Heavy motion (0.5g burst)",         0.5f,  0.5f, 2.0f,  0.0f,  0.0f, false },
    { "Low perfusion (PI=0.1%)",           0.5f,  0.0f, 0.1f,  0.0f,  0.0f, false },
    { "R out of range high (R=2.5)",       2.5f,  0.0f, 2.0f,  0.0f,  0.0f, false },
    { "R out of range low (R=0.1)",        0.1f,  0.0f, 2.0f,  0.0f,  0.0f, false },
    { "Gradual desat 99→88% over 2min",    0.88f, 0.0f, 1.5f,  88.0f, 2.0f, true  },
};

static constexpr int SCENARIO_COUNT_A03 = sizeof(SCENARIOS_A03) / sizeof(SCENARIOS_A03[0]);
