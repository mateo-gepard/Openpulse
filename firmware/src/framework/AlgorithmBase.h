#pragma once
// ═══════════════════════════════════════════════════════════════
// OpenPulse Algorithm Framework — Shared Types & Base Class
//
// Every algorithm inherits from AlgorithmBase and uses these
// shared types. See SKILL.md §4.3 for full documentation.
// ═══════════════════════════════════════════════════════════════

#include <stdint.h>
#include <math.h>

// ─── Algorithm Output ──────────────────────────────────────────

struct AlgorithmOutput {
    float    value;          // The computed metric
    float    sqi;            // Signal Quality Index: 0.0 (garbage) → 1.0 (perfect)
    uint32_t timestamp_ms;   // millis() at computation time
    bool     valid;          // false = suppress display, show "--"
};

// Extended output for algorithms that require calibration (BP, SpO2)
struct CalibratedOutput {
    float    value;          // Point estimate
    float    ci_low;         // 95% confidence interval lower bound
    float    ci_high;        // 95% confidence interval upper bound
    float    sqi;
    uint32_t timestamp_ms;
    bool     valid;
    bool     calibrated;     // false = "Calibration needed" in UI
    uint32_t calibration_age_ms;  // Time since last calibration
};

// ─── Algorithm State Machine ───────────────────────────────────

enum class AlgoState : uint8_t {
    IDLE,           // Not started or no sensor input (e.g., no finger)
    ACQUIRING,      // Collecting initial data, not enough for valid output
    VALID,          // Producing valid, trustworthy output
    LOW_QUALITY,    // Signal too poor — output suppressed
    CALIBRATING,    // Awaiting user calibration input
    ERROR           // Hardware fault or unrecoverable condition
};

// ─── Regulatory Classification ─────────────────────────────────

enum class AlgoClassification : uint8_t {
    WELLNESS,           // Steps, calories, sleep duration
    HEALTH_INDICATOR,   // HRV, EDA stress, circadian rhythm
    HEALTH_SCREENING    // SpO2, BP estimate, ECG rhythm — requires disclaimer
};

// ─── Execution Tier ────────────────────────────────────────────

enum class AlgoTier : uint8_t {
    REALTIME  = 0,   // Called every loop()      — budget: <200µs, <2KB RAM
    PERIODIC  = 1,   // Called at fixed interval  — budget: <1ms,  <4KB RAM
    ON_DEMAND = 2,   // User-triggered            — budget: <10ms, <8KB RAM
    OFF_DEVICE = 3   // Computed in dashboard JS  — no MCU budget
};

// ─── Algorithm Base Class ──────────────────────────────────────

class AlgorithmBase {
public:
    virtual ~AlgorithmBase() {}

    // Lifecycle
    virtual void init() = 0;                          // Reset all state
    virtual void update(uint32_t now_ms) = 0;         // Called by scheduler

    // Output
    virtual AlgorithmOutput getOutput() const = 0;
    virtual AlgoState getState() const = 0;

    // Metadata
    virtual const char* getID() const = 0;            // "A01", "X06", etc.
    virtual const char* getName() const = 0;          // "Heart Rate"
    virtual const char* getUnit() const = 0;          // "BPM"
    virtual AlgoClassification getClassification() const = 0;
    virtual AlgoTier getTier() const = 0;

    // Memory reporting (for debug dashboard)
    virtual uint16_t ramUsage() const = 0;            // sizeof(*this)
};
