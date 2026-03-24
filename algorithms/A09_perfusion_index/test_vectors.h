#pragma once
// Test scenarios for A09: Perfusion Index
// Compile: clang++ -std=c++17 -I../../framework -o test_a09 ../../test/test_runner.cpp

struct TestScenario_A09 {
    const char* description;
    float dcLevel;            // Simulated DC component
    float acAmplitude;        // Simulated AC peak-to-trough
    float expectedPI;         // Expected PI (%)
    float tolerance;
    bool  expectValid;
};

static const TestScenario_A09 SCENARIOS_A09[] = {
    { "Normal perfusion (PI ~3%)",         100000.0f, 3000.0f, 3.0f,  0.5f, true  },
    { "High perfusion (PI ~8%)",           100000.0f, 8000.0f, 8.0f,  1.0f, true  },
    { "Low perfusion (PI ~0.5%)",          100000.0f, 500.0f,  0.5f,  0.2f, true  },
    { "Very low perfusion (PI ~0.1%)",     100000.0f, 100.0f,  0.1f,  0.1f, true  },
    { "No tissue contact (DC < 1000)",     500.0f,    10.0f,   0.0f,  0.0f, false },
    { "Saturated AC (PI > 20%)",           100000.0f, 25000.0f,20.0f, 0.0f, true  },
    { "Zero AC (no pulsatile flow)",       100000.0f, 0.0f,    0.0f,  0.0f, false },
    { "Cold fingers (low DC, low AC)",     5000.0f,   50.0f,   1.0f,  0.5f, true  },
};

static constexpr int SCENARIO_COUNT_A09 = sizeof(SCENARIOS_A09) / sizeof(SCENARIOS_A09[0]);
