#pragma once
// Test scenarios for A08: Vascular Age
// Compile: clang++ -std=c++17 -I../../framework -o test_a08 ../../test/test_runner.cpp

struct TestScenario_A08 {
    const char* description;
    uint8_t chronoAge;        // User chronological age
    bool    isMale;           // User sex
    float   height_m;         // User height
    float   measuredSI;       // SI from A07 (m/s)
    float   measuredAGI;      // AGI from A07 (a.u.)
    float   motionLevel_g;    // Max motion during session
    float   a07SQI;           // Input SQI from A07
    float   expectedVascAge;
    float   tolerance;
    bool    expectValid;
};

static const TestScenario_A08 SCENARIOS_A08[] = {
    { "30-yr male, on-track (SI=6.8, AGI=-0.4)",    30, true,  1.78f, 6.8f,  -0.4f, 0.0f, 0.8f, 30.0f, 5.0f, true  },
    { "30-yr male, stiff (SI=9.0, AGI=0.0)",         30, true,  1.78f, 9.0f,  0.0f,  0.0f, 0.8f, 45.0f, 8.0f, true  },
    { "50-yr female, younger arteries (SI=7.0)",      50, false, 1.65f, 7.0f,  -0.2f, 0.0f, 0.7f, 40.0f, 8.0f, true  },
    { "Profile missing (no age set)",                 0,  true,  1.75f, 7.0f,  -0.3f, 0.0f, 0.8f, 0.0f,  0.0f, false },
    { "Motion during measurement (0.2g)",             40, true,  1.78f, 8.0f,  -0.1f, 0.2f, 0.8f, 0.0f,  0.0f, false },
    { "A07 SQI too low (0.3)",                        40, true,  1.78f, 8.0f,  -0.1f, 0.0f, 0.3f, 0.0f,  0.0f, false },
    { "Under 18 (no reference data)",                 16, true,  1.70f, 6.0f,  -0.7f, 0.0f, 0.8f, 0.0f,  0.0f, false },
    { "70-yr male, normal for age",                   70, true,  1.72f, 12.0f, 0.8f,  0.0f, 0.7f, 70.0f, 5.0f, true  },
};

static constexpr int SCENARIO_COUNT_A08 = sizeof(SCENARIOS_A08) / sizeof(SCENARIOS_A08[0]);
