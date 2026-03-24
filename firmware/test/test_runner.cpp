// ═══════════════════════════════════════════════════════════════
// OpenPulse Test Harness — Desktop Algorithm Verification
//
// Compiles and runs on Mac/Linux (NOT Arduino).
// Tests algorithm logic in isolation without hardware.
//
// Usage:
//   clang++ -std=c++17 -I../src/framework -o test_runner test_runner.cpp
//   ./test_runner
//
// Add algorithm tests by including the algorithm header and
// calling run_test() with test vectors from the spec.
// ═══════════════════════════════════════════════════════════════

#include <cstdio>
#include <cstdlib>
#include <cmath>
#include <cstring>
#include <cstdint>

// ─── Minimal Arduino Shims ─────────────────────────────────────
// These let algorithm code compile on desktop without modification.

static uint32_t _millis_counter = 0;
uint32_t millis() { return _millis_counter; }
void advance_millis(uint32_t ms) { _millis_counter += ms; }
void reset_millis() { _millis_counter = 0; }

// Stub Serial for algorithms that use Serial.print
struct SerialStub {
    void print(const char*) {}
    void print(float) {}
    void println(const char*) {}
    void println(float) {}
} Serial;

// ─── Include Framework ─────────────────────────────────────────
// These are the same headers used on the Arduino — no modifications.

#include "AlgorithmBase.h"
#include "RingBuffer.h"

// ─── Test Infrastructure ───────────────────────────────────────

struct TestResult {
    const char* name;
    bool passed;
    float expected;
    float actual;
    float tolerance;
};

static int total_tests = 0;
static int passed_tests = 0;
static int failed_tests = 0;

void run_test(const char* name, float expected, float actual, float tolerance) {
    total_tests++;
    bool passed = fabs(actual - expected) <= tolerance;
    if (passed) {
        passed_tests++;
        printf("  ✅ PASS: %-40s  expected: %8.2f  got: %8.2f  (±%.2f)\n",
               name, expected, actual, tolerance);
    } else {
        failed_tests++;
        printf("  ❌ FAIL: %-40s  expected: %8.2f  got: %8.2f  (±%.2f)  Δ=%.4f\n",
               name, expected, actual, tolerance, fabs(actual - expected));
    }
}

void run_bool_test(const char* name, bool expected, bool actual) {
    total_tests++;
    if (expected == actual) {
        passed_tests++;
        printf("  ✅ PASS: %-40s  expected: %s  got: %s\n",
               name, expected ? "true" : "false", actual ? "true" : "false");
    } else {
        failed_tests++;
        printf("  ❌ FAIL: %-40s  expected: %s  got: %s\n",
               name, expected ? "true" : "false", actual ? "true" : "false");
    }
}

void print_section(const char* title) {
    printf("\n══════════════════════════════════════════════════\n");
    printf("  %s\n", title);
    printf("══════════════════════════════════════════════════\n");
}

// ─── Framework Self-Tests ──────────────────────────────────────

void test_ring_buffer() {
    print_section("RingBuffer<float, 8>");

    RingBuffer<float, 8> buf;

    // Empty buffer
    run_test("Empty count", 0, buf.count(), 0);
    run_test("Empty mean", 0, buf.mean(), 0);
    run_bool_test("Empty is empty", true, buf.empty());

    // Push values
    for (int i = 1; i <= 5; i++) {
        buf.push((float)i, i * 100);
    }

    run_test("Count after 5 pushes", 5, buf.count(), 0);
    run_test("Latest value", 5.0, buf.latest(), 0.001);
    run_test("Mean of 1-5", 3.0, buf.mean(), 0.001);
    run_test("Min of 1-5", 1.0, buf.min(), 0.001);
    run_test("Max of 1-5", 5.0, buf.max(), 0.001);

    // Stddev of [1,2,3,4,5] = sqrt(2.5) ≈ 1.5811
    run_test("Stddev of 1-5", 1.5811, buf.stddev(), 0.001);

    // Overflow (capacity 8)
    for (int i = 6; i <= 12; i++) {
        buf.push((float)i, i * 100);
    }

    run_test("Count after overflow", 8, buf.count(), 0);
    run_bool_test("Full after overflow", true, buf.full());
    run_test("Latest after overflow", 12.0, buf.latest(), 0.001);
    run_test("Oldest (at(7))", 5.0, buf.at(7), 0.001);

    // Interpolation
    // Buffer has [12,11,10,9,8,7,6,5] at timestamps [1200,1100,1000,900,800,700,600,500]
    run_test("Interpolate at t=950", 9.5, buf.interpolateAt(950), 0.001);
    run_test("Interpolate at t=1050", 10.5, buf.interpolateAt(1050), 0.001);

    // Clear
    buf.clear();
    run_test("Count after clear", 0, buf.count(), 0);
    run_bool_test("Empty after clear", true, buf.empty());
}

void test_algorithm_output() {
    print_section("AlgorithmOutput Struct");

    AlgorithmOutput out = {72.5f, 0.85f, 1000, true};
    run_test("Value", 72.5, out.value, 0.001);
    run_test("SQI", 0.85, out.sqi, 0.001);
    run_bool_test("Valid", true, out.valid);

    CalibratedOutput cal = {120.0f, 115.0f, 125.0f, 0.9f, 2000, true, true, 0};
    run_test("Calibrated value", 120.0, cal.value, 0.001);
    run_test("CI low", 115.0, cal.ci_low, 0.001);
    run_test("CI high", 125.0, cal.ci_high, 0.001);
    run_bool_test("Calibrated flag", true, cal.calibrated);
}

// ─── Algorithm Test Slots ──────────────────────────────────────
// Add algorithm tests here as they are implemented.
// Example:
//
// #include "algorithms/base/Algo_A01.h"
// void test_A01_heart_rate() {
//     print_section("A01: Heart Rate");
//     Algo_A01 hr;
//     hr.init();
//     // Feed synthetic PPG data...
//     // run_test("72 BPM clean signal", 72.0, hr.getOutput().value, 2.0);
// }

// ─── Main ──────────────────────────────────────────────────────

int main() {
    printf("\n");
    printf("╔══════════════════════════════════════════════════╗\n");
    printf("║     OpenPulse Algorithm Test Harness             ║\n");
    printf("║     Desktop verification — no hardware needed    ║\n");
    printf("╚══════════════════════════════════════════════════╝\n");

    reset_millis();

    // Framework tests
    test_ring_buffer();
    test_algorithm_output();

    // Algorithm tests (uncomment as implemented)
    // test_A01_heart_rate();
    // test_A02_hrv();
    // ...

    // Summary
    printf("\n══════════════════════════════════════════════════\n");
    printf("  RESULTS: %d/%d passed", passed_tests, total_tests);
    if (failed_tests > 0) {
        printf("  (%d FAILED)", failed_tests);
    }
    printf("\n══════════════════════════════════════════════════\n\n");

    return failed_tests > 0 ? 1 : 0;
}
