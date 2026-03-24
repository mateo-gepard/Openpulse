---
name: openpulse_algorithm_builder
description: Builds medically-correct, privacy-first biomedical sensor algorithms for the OpenPulse platform from structured spec files.
---

# OpenPulse Algorithm Builder

You are building a biomedical algorithm for the **OpenPulse** wearable health platform. OpenPulse runs on a **Seeed XIAO nRF52840 Sense** (ARM Cortex-M4, 256KB RAM, 1MB flash) and communicates via BLE GATT to a web dashboard.

This skill ensures every algorithm is **medically defensible**, **privacy-first**, **memory-safe**, and **production-quality** — exceeding the engineering standards of Whoop, Oura, and Garmin.

---

## 1. BEFORE YOU WRITE ANY CODE

### 1.1 Read the Spec

Every algorithm has a **spec file** at `algorithms/<ID>_<name>/spec.md`. Read it completely.
The spec is the contract. If the spec is ambiguous, **stop and ask** — do not guess on medical algorithms.

If no spec exists yet, create one using the template at `.agents/skills/openpulse_algorithm/templates/spec_template.md`.

### 1.2 Read All Dependencies

Check the `Dependencies` field in the spec. For each dependency:
1. Read its spec file
2. Read its `firmware.h` header
3. Understand its output format, update rate, and edge cases

Never access a dependency's internal state — only use its public API.

### 1.3 Verify Hardware Assumptions

Cross-reference the spec against this hardware truth table. If the spec claims data the hardware cannot provide, **flag it immediately**.

```
┌────────────────┬────────────┬────────────┬─────────────┬──────────┐
│ Sensor         │ Chip       │ Bus        │ Max Rate    │ Bits     │
├────────────────┼────────────┼────────────┼─────────────┼──────────┤
│ PPG + ECG      │ MAX86150   │ Wire, 0x5E │ 100/200 Hz  │ 18-bit   │
│ Skin Temp      │ TMP117     │ Wire, 0x48 │ 1 Hz        │ 16-bit   │
│ EDA / GSR      │ ADS1115    │ Wire, 0x49 │ 10 Hz       │ 16-bit   │
│ Bioimpedance   │ AD5933     │ Wire, 0x0D │ On-demand   │ 12-bit   │
│ IMU            │ LSM6DS3TR  │ Wire1,0x6A │ 50 Hz       │ 16-bit   │
│ Microphone     │ PDM        │ Digital    │ 16000 Hz    │ 16-bit   │
│ NFC            │ nRF52840   │ Internal   │ On-demand   │ —        │
└────────────────┴────────────┴────────────┴─────────────┴──────────┘
```

---

## 2. MEDICAL CORRECTNESS RULES

These rules are **non-negotiable**. Every algorithm must satisfy all of them.

### 2.1 Every Formula Must Have a Citation

No formula appears in code without a comment citing its source:

```cpp
// SpO2 = 110 - 25 * R
// Source: Maxim AN6409 "Guidelines for SpO2 Measurement Using MAX30101/2"
// Validated range: R ∈ [0.4, 1.0] → SpO2 ∈ [85%, 100%]
// Note: Linear approximation. Clinical accuracy requires empirical
// calibration curve per device batch. Not a medical device.
```

Acceptable citation sources (in order of preference):
1. **Peer-reviewed journal papers** (IEEE, JBHI, Physiological Measurement)
2. **Chip manufacturer application notes** (Maxim/Analog Devices ANs)
3. **Textbooks** (Webster "Medical Instrumentation", Bronzino "Biomedical Engineering")
4. **Validated open-source implementations** (PhysioNet, HeartPy, NeuroKit2)

**Unacceptable sources:** Blog posts, Stack Overflow, ChatGPT-generated formulas, uncited "common knowledge."

### 2.2 Physiological Range Clamping

Every output MUST be hard-clamped to physiologically possible ranges. If a calculation produces a value outside these ranges, the algorithm MUST discard it and either hold the last valid value or output zero/NaN.

```
Heart Rate:        30–220 BPM     (below 30 = asystole, above 220 = age-dependent max)
SpO2:              70–100 %       (below 70 = severe hypoxemia, usually sensor error)
Respiratory Rate:  4–60 breaths/min
Blood Pressure:    SBP 60–250, DBP 30–150 mmHg
Skin Temperature:  25–42 °C       (below = hypothermia, above = severe fever)
HRV RMSSD:         0–300 ms       (above 300 = likely artifact)
EDA:               0.01–100 µS    (above = electrode error)
SpO2 R-ratio:      0.2–2.0        (outside = sensor saturation)
PTT:               100–500 ms     (outside = motion artifact or electrode issue)
```

### 2.3 Signal Quality Index (SQI)

Every real-time algorithm MUST compute a Signal Quality Index (0.0 – 1.0) alongside its output. The SQI gates downstream algorithms:

```cpp
struct AlgorithmOutput {
    float value;       // The computed metric
    float sqi;         // 0.0 = garbage, 1.0 = perfect signal
    uint32_t timestamp_ms;
    bool valid;        // false = suppress display, show "--"
};
```

**SQI computation methods by sensor:**
- **PPG**: Perfusion index > threshold + waveform morphology check + motion energy < threshold
- **ECG**: R-peak SNR > 3dB + baseline wander < 0.5mV + electrode impedance < 50kΩ
- **EDA**: Signal variance within expected range + no rail-to-rail saturation
- **IMU**: Sensor self-test pass + no clipping at ±16g
- **Temperature**: Rate of change < 2°C/min (faster = sensor detached)

When SQI < 0.4: **suppress the output entirely** (show "--"). Don't show bad data — this is where consumer trackers fail. Whoop shows "recovering" when signal is bad; we show nothing, which is more honest.

### 2.4 Confidence Intervals

Where applicable, report not just a point estimate but a confidence range:

```cpp
struct CalibratedOutput {
    float value;       // Point estimate (e.g., SBP = 120)
    float ci_low;      // 95% CI lower (e.g., 115)
    float ci_high;     // 95% CI upper (e.g., 125)
    float sqi;
    bool calibrated;   // false = needs user calibration
};
```

This applies to: Blood pressure (X01), SpO2 (A03), VO2max estimation, biological age (X12).
This does NOT apply to: Heart rate, step count, temperature (direct measurements).

### 2.5 Calibration Transparency

Some algorithms require user calibration (e.g., blood pressure PTT needs a reference cuff reading). The algorithm MUST:

1. **Clearly state** in its output whether it is calibrated or uncalibrated
2. **Refuse to output** clinical-grade values when uncalibrated (show "Calibration needed")
3. **Track calibration age** — recalibrate prompt after 14 days or significant body change
4. **Never silently degrade** — if calibration data is stale, say so

### 2.6 Regulatory Awareness

OpenPulse is NOT a medical device. Every algorithm MUST be classified:

| Classification | Meaning | UI Treatment |
|---|---|---|
| **Wellness** | General fitness metric (steps, calories, sleep) | Show normally |
| **Health Indicator** | Physiological insight (HRV, EDA stress) | Show with context |
| **Health Screening** | Clinical-adjacent (SpO2, BP, ECG rhythm) | Show with disclaimer |

For **Health Screening** algorithms, the firmware output struct includes a `disclaimer` flag, and the dashboard MUST display: *"This is not a medical device. Consult a healthcare provider for medical decisions."*

---

## 3. PRIVACY & DATA RULES

### 3.1 On-Device Processing

**ALL signal processing and algorithm computation happens on-device** (nRF52840 or dashboard browser). Never:
- Send raw sensor data to any server
- Include PII (name, age, weight) in BLE payloads
- Require an internet connection for any algorithm to function
- Phone-home, beacon, or transmit analytics

### 3.2 BLE Payload Rules

- BLE characteristics contain **only computed float values** (4 bytes per metric)
- No user identifiers in BLE advertising data
- Device name is generic ("SensorDash"), not personalized
- No location data transmitted

### 3.3 Data At Rest

- User calibration data (height, weight, age, cuff BP) is stored in **browser localStorage only**
- No cookies, no server-side storage, no cloud sync
- User can delete all data via a single "Clear Data" button
- Exported PDFs contain only the data the user explicitly chose to export

### 3.4 Informed Consent

The dashboard MUST explain what each sensor measures before first use. No silent data collection.

---

## 4. FIRMWARE ENGINEERING RULES

### 4.1 Memory Safety (nRF52840: 256KB RAM)

```
HARD RULES:
- No dynamic allocation (malloc/new) in loop() — ALL buffers allocated at compile time
- No String class — use char[] with bounds checking
- No recursion — stack is only 8KB
- No double — use float (saves 50% RAM on Cortex-M4)
- No printf/sprintf — use Serial.print() chains
- Maximum total algorithm RAM budget: 16KB (rest for BLE stack + drivers)
```

### 4.2 Ring Buffer Pattern

Every sensor and algorithm uses the shared ring buffer type:

```cpp
template<typename T, uint16_t N>
class RingBuffer {
public:
    void push(T sample, uint32_t timestamp_ms);
    T    latest() const;
    T    at(uint16_t index) const;       // 0 = newest
    uint32_t timestampAt(uint16_t index) const;
    uint16_t count() const;
    bool full() const;
    void clear();

    // Statistical helpers
    float mean() const;
    float min() const;
    float max() const;
    float rms() const;

    // Cross-sensor interpolation
    float interpolateAt(uint32_t target_ms) const;

private:
    T        data_[N];
    uint32_t timestamps_[N];
    uint16_t head_ = 0;
    uint16_t count_ = 0;
};
```

Buffer sizes are determined by the algorithm's window requirement:
- Heart rate peak detection: 512 samples (5.12s at 100 Hz) = 2KB
- HRV R-R intervals: 128 intervals (~2 minutes) = 1KB
- EDA: 64 samples (6.4s at 10 Hz) = 256B
- Temperature: 16 samples (16s at 1 Hz) = 64B

### 4.3 Algorithm Base Class

Every algorithm inherits from this interface:

```cpp
enum class AlgoState : uint8_t {
    IDLE,           // Not started, no data
    ACQUIRING,      // Collecting initial data, not yet valid
    VALID,          // Outputting valid data
    LOW_QUALITY,    // Signal poor, output suppressed
    CALIBRATING,    // Awaiting user calibration
    ERROR           // Hardware fault
};

class AlgorithmBase {
public:
    virtual void init() = 0;
    virtual void update(uint32_t now_ms) = 0;   // Called by scheduler
    virtual AlgorithmOutput getOutput() const = 0;
    virtual AlgoState getState() const = 0;
    virtual const char* getName() const = 0;
    virtual const char* getUnit() const = 0;

    // Memory reporting for debug
    virtual uint16_t ramUsage() const = 0;
};
```

### 4.4 Execution Tiers

Algorithms are assigned to tiers at compile time:

```cpp
// Tier 0: ALWAYS ON — called every loop() iteration
// Budget: < 200µs per call, < 2KB RAM total
// Examples: HR peak detect, step counter accel sampling
#define ALGO_TIER_REALTIME    0

// Tier 1: PERIODIC — called by scheduler at fixed intervals
// Budget: < 1ms per call, < 4KB RAM total
// Examples: HRV (every R-R), SpO2 (every beat), EDA (100ms)
#define ALGO_TIER_PERIODIC    1

// Tier 2: ON-DEMAND — user-initiated, allocated/freed dynamically
// Budget: < 10ms per call, < 8KB RAM (freed after use)
// Examples: ECG rhythm check, bioimpedance scan, vascular age
#define ALGO_TIER_ONDEMAND    2

// Tier 3: OFF-DEVICE — computed in dashboard/app, not on MCU
// Budget: unlimited (browser JS)
// Examples: Composite scores, biological age, PDF reports
#define ALGO_TIER_OFFDEVICE   3
```

### 4.5 Non-Blocking Execution

No algorithm call may block for more than **1ms**. Specifically:

- No `delay()` inside any algorithm
- No `while()` waiting for sensor data — use state machines
- I2C reads must be split: request in one call, read in the next
- BLE.poll() must be called between any two sensor reads

### 4.6 Motion Artifact Rejection

Any algorithm using PPG or ECG MUST check IMU data before trusting the signal:

```cpp
// Called before processing PPG/ECG sample
bool isMotionFree(uint32_t now_ms) {
    float accelMag = sqrt(ax*ax + ay*ay + az*az);
    float gyroMag  = sqrt(gx*gx + gy*gy + gz*gz);

    // Thresholds from: Tamura et al., "Wearable Photoplethysmographic
    // Sensors", Electronics 2014
    return (accelMag < 1.5f) && (gyroMag < 50.0f);  // g's and deg/s
}
```

When motion is detected:
- **HR**: Hold last valid value for up to 5 seconds, then show "--"
- **SpO2**: Suppress immediately (SpO2 is extremely motion-sensitive)
- **ECG**: Mark segment as "motion artifact" in rhythm analysis
- **PTT/Blood Pressure**: Suppress entirely during motion

---

## 5. SIGNAL PROCESSING RULES

### 5.1 Filter Design

All filters must respect Nyquist:

```
Filter cutoff must be < (sample_rate / 2)
Anti-aliasing: Apply low-pass BEFORE downsampling
DC removal: High-pass at 0.1 Hz for PPG, 0.5 Hz for ECG
Powerline: Optional notch at 50/60 Hz for ECG (auto-detect from spectrum)
```

Use **IIR filters** (Butterworth) for real-time on MCU — FIR filters use too much RAM.

Coefficients must be pre-computed (not computed at runtime). Include the design parameters in comments:

```cpp
// 4th-order Butterworth bandpass, 0.5–4.0 Hz
// Designed for 100 Hz sample rate (PPG)
// Generated with scipy.signal.butter(4, [0.5, 4.0], btype='band', fs=100)
const float b[] = { ... };
const float a[] = { ... };
```

### 5.2 Peak Detection

For PPG and ECG peak detection, use **adaptive thresholding**:

```
1. Compute running mean and standard deviation over window
2. Threshold = mean + k * stddev  (k = 0.6 for PPG, 0.4 for ECG)
3. Require minimum distance between peaks (refractory period)
4. Validate peak morphology (slope before and after)
5. Track detection confidence based on peak prominence
```

Do NOT use fixed thresholds — they fail when signal amplitude changes (e.g., different skin tones, sensor placement).

### 5.3 Cross-Sensor Timestamp Alignment

When combining data from sensors at different rates, **always interpolate to the fastest clock**:

```cpp
// Example: Aligning EDA (10 Hz) with PPG (100 Hz)
// For each PPG sample timestamp, find the closest EDA value
float alignedEDA = edaBuffer.interpolateAt(ppgTimestamp);
```

Never assume sensors are synchronized — always use `millis()` timestamps.

### 5.4 Baseline Estimation

For metrics that need a personal baseline (temperature, EDA, resting HR):

```
1. Collect 14 nights of data minimum before establishing baseline
2. Use MEDIAN, not mean (resistant to outliers)
3. Update baseline with exponential moving average (α = 0.05)
4. Detect baseline shifts (e.g., fitness improvement) and re-anchor
5. Report deviation from baseline, not absolute values, for alerts
```

---

## 6. CODE GENERATION PROCEDURE

When generating code for an algorithm, follow this exact sequence:

### Step 1: Generate `firmware.h`

```cpp
#pragma once
#include "AlgorithmBase.h"
#include "RingBuffer.h"
// Include dependency headers

class Algo_<ID> : public AlgorithmBase {
public:
    void init() override;
    void update(uint32_t now_ms) override;
    AlgorithmOutput getOutput() const override;
    AlgoState getState() const override;
    const char* getName() const override { return "<HumanName>"; }
    const char* getUnit() const override { return "<unit>"; }
    uint16_t ramUsage() const override { return sizeof(*this); }

private:
    // State machine
    AlgoState state_ = AlgoState::IDLE;

    // Ring buffers (sized from spec)
    RingBuffer<float, BUFFER_SIZE> buffer_;

    // Algorithm-specific state
    // ...

    // Output cache
    AlgorithmOutput output_ = {0, 0, 0, false};

    // Signal quality
    float computeSQI() const;
};
```

### Step 2: Generate `firmware.cpp`

Structure every implementation file identically:

```cpp
#include "Algo_<ID>.h"
// ═══════════════════════════════════════════════════════
// <ID>: <Name>
// <One-line description>
//
// Classification: <Wellness | Health Indicator | Health Screening>
// Tier: <0-3>
// Dependencies: <list or "none">
// Citation: <primary reference>
// ═══════════════════════════════════════════════════════

// ─── Constants ─────────────────────────────────────────
// All thresholds and parameters here, NEVER magic numbers in code
namespace {
    constexpr float PARAM_NAME = value;  // What it means, citation
}

// ─── Init ──────────────────────────────────────────────
void Algo_<ID>::init() {
    buffer_.clear();
    state_ = AlgoState::ACQUIRING;
    // ... reset all state
}

// ─── Update (called by scheduler) ──────────────────────
void Algo_<ID>::update(uint32_t now_ms) {
    // 1. Read input (from sensor driver or dependency output)
    // 2. Check SQI — if too low, set state LOW_QUALITY, return
    // 3. Push to ring buffer
    // 4. If not enough data yet, stay ACQUIRING, return
    // 5. Run algorithm
    // 6. Clamp output to physiological range
    // 7. Update output struct with value + SQI + timestamp
    // 8. Set state = VALID
}

// ─── SQI Computation ───────────────────────────────────
float Algo_<ID>::computeSQI() const {
    // Signal-specific quality assessment
    // Returns 0.0 (garbage) to 1.0 (perfect)
}

// ─── Output ────────────────────────────────────────────
AlgorithmOutput Algo_<ID>::getOutput() const {
    return output_;
}

AlgoState Algo_<ID>::getState() const {
    return state_;
}
```

### Step 3: Generate `test_vectors.h`

At minimum 5 test cases:

```cpp
// Test vectors for <ID>: <Name>
// Source: <where the expected values come from>
struct TestVector {
    const float* input;
    uint16_t inputLen;
    float expectedOutput;
    float tolerance;
    const char* description;
};

static const TestVector TEST_VECTORS_<ID>[] = {
    // 1. Normal physiological signal
    { normalData, 512, expected, ±tolerance, "Clean 72 BPM signal" },

    // 2. Boundary low
    { bradyData, 512, expected, ±tolerance, "Bradycardia 40 BPM" },

    // 3. Boundary high
    { tachyData, 512, expected, ±tolerance, "Tachycardia 180 BPM" },

    // 4. No signal / sensor off
    { zeroData, 512, 0.0, 0.0, "No finger — expect 0" },

    // 5. Motion artifact
    { motionData, 512, HOLD_LAST, 0.0, "Motion — expect hold or suppress" },
};
```

### Step 4: Verify Against Checklist

Before marking the algorithm complete, verify:

- [ ] Every formula has a citation comment
- [ ] Output is clamped to physiological range (see §2.2)
- [ ] SQI is computed and gates output (see §2.3)
- [ ] State machine handles: IDLE → ACQUIRING → VALID → LOW_QUALITY
- [ ] No dynamic memory allocation
- [ ] No blocking calls (no delay(), no while-wait)
- [ ] Motion rejection used if PPG/ECG-based (see §4.6)
- [ ] Buffer sizes match spec window requirements
- [ ] Total RAM < tier budget
- [ ] Disclaimer flag set for Health Screening classification
- [ ] No PII in any output struct
- [ ] Edge cases from spec handled explicitly
- [ ] Test vectors cover: normal, boundary, no-signal, artifact

---

## 7. DASHBOARD-SIDE ALGORITHMS (Tier 3)

Composite algorithms (C01–C10) and long-baseline algorithms (trends, biological age) run in the **browser dashboard**, not on the MCU.

### 7.1 Data Flow

```
nRF52840 (firmware)                    Browser (dashboard)
─────────────────                      ────────────────────
Tier 0-2 algorithms                    Receives BLE values
    │                                       │
    ├── HR, SpO2, PTT ──── BLE ────►──── Store in IndexedDB
    ├── EDA, Temp    ──── BLE ────►──── time-series history
    ├── IMU, Mic     ──── BLE ────►──── 14+ day rolling window
    │                                       │
    │                                  Tier 3 algorithms
    │                                       │
    │                                  ├── Recovery Score (C01)
    │                                  ├── Sleep Score (C03)
    │                                  ├── Biological Age (C04)
    │                                  └── PDF Report (C08)
```

### 7.2 Dashboard Algorithm Rules

- Store time-series in **IndexedDB** (not localStorage — too small)
- Baselines require **14 days minimum** before reporting scores
- Show "Collecting data (Day 3 of 14)" during baseline period
- All score algorithms use the **same 0–100 scale** with consistent semantics:
  - 0–29: Poor
  - 30–49: Below Average
  - 50–69: Average
  - 70–89: Good
  - 90–100: Excellent
- Composite scores use **weighted averages** with weights defined in the spec
- Every composite shows which sub-scores contributed and their individual values

### 7.3 Trend Analysis

For all trended metrics (resting HR, HRV, temperature baseline):

```javascript
// 7-day trend: simple linear regression
// 30-day trend: exponential moving average
// 90-day trend: rolling median with outlier rejection (IQR method)

function computeTrend(data, windowDays) {
    // Remove outliers: values outside 1.5×IQR
    // Compute slope via least-squares regression
    // Return: { direction: 'improving'|'stable'|'declining', magnitude: float }
}
```

---

## 8. ALGORITHM SPEC TEMPLATE

When creating a new algorithm, use this template for the spec file. Save it at `algorithms/<ID>_<snake_case_name>/spec.md`.

A complete example spec is available at `.agents/skills/openpulse_algorithm/examples/A01_heart_rate_spec.md`.

```markdown
# <ID>: <Algorithm Name>

## Classification
- **Layer**: Base | Cross-Sensor | Composite
- **Tier**: 0 (realtime) | 1 (periodic) | 2 (on-demand) | 3 (off-device)
- **Regulatory**: Wellness | Health Indicator | Health Screening
- **Puck**: 1 | 2 | 3 | XIAO | Dashboard
- **Priority**: P0 (MVP) | P1 (v1.0) | P2 (v2.0)
- **Dependencies**: [none] | [A01, A02, ...]

## Sensor Input
- **Chip**: <chip name>
- **Channel**: <which channel/register>
- **Sample Rate**: <Hz>
- **Bit Depth**: <bits>
- **Buffer Size**: <samples> (<duration at sample rate>)

## Algorithm
### Method
<Describe the algorithm step by step. Be specific about:>
1. Preprocessing (filters, DC removal)
2. Feature extraction (peaks, intervals, amplitudes)
3. Computation (the actual formula)
4. Post-processing (averaging, outlier rejection)
5. Output gating (SQI threshold, minimum data requirement)

### Parameters
| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| <name> | <value> | <unit> | <citation> |

### SQI Computation
<How signal quality is assessed for this specific algorithm>

## Output
- **Type**: float32 | CalibratedOutput | AlgorithmOutput
- **Unit**: <BPM, %, °C, mmHg, ...>
- **Valid Range**: <min>–<max>
- **Update Rate**: <how often a new value is produced>
- **BLE Characteristic**: UUID 12345678-1234-5678-1234-56789abcdef<X>

## Edge Cases
| Condition | Behavior |
|-----------|----------|
| No signal | <what happens> |
| Motion artifact | <what happens> |
| Sensor saturation | <what happens> |
| < minimum data | <what happens> |
| Out of range result | <what happens> |

## Medical References
1. <Author>, "<Title>", <Journal>, <Year>. DOI: <doi>
2. ...

## Test Vectors
| # | Input Scenario | Expected Output | Tolerance | Source |
|---|---------------|-----------------|-----------|--------|
| 1 | <normal case> | <value> | ±<tol> | <where expected value comes from> |
| 2 | <edge case> | <value> | ±<tol> | |
| 3 | <failure case> | <value> | — | |
```

---

## 9. NAMING CONVENTIONS

```
Files:          Algo_A01.h, Algo_A01.cpp, Algo_X06.h, Algo_X06.cpp
Classes:        Algo_A01, Algo_X06, Algo_C01
Constants:      A01_FILTER_CUTOFF_HZ, X06_EDA_THRESHOLD_US
Buffers:        a01_ppg_buffer_, x06_eda_buffer_
BLE UUIDs:      Sequential from ...def1 (A01) through ...deXX
Spec files:     algorithms/A01_heart_rate/spec.md
Test vectors:   algorithms/A01_heart_rate/test_vectors.h
```

---

## 10. REVIEW CHECKLIST (Run Before Every PR)

```
MEDICAL CORRECTNESS
  □ Every formula has a citation
  □ Output clamped to physiological range
  □ SQI computed and gates output at threshold 0.4
  □ Confidence intervals reported where applicable
  □ Calibration state tracked and displayed
  □ Regulatory classification correct
  □ Disclaimer present for Health Screening algorithms

SIGNAL PROCESSING
  □ Filters respect Nyquist
  □ Adaptive thresholds (no magic numbers)
  □ Motion artifact rejection for PPG/ECG algorithms
  □ Timestamps used for cross-sensor alignment
  □ Baseline uses median, not mean

FIRMWARE ENGINEERING
  □ No malloc/new in loop
  □ No delay() in algorithm code
  □ No double (float only)
  □ Total RAM within tier budget
  □ State machine covers all AlgoState transitions
  □ Non-blocking (< 1ms per update call)

PRIVACY
  □ No PII in BLE payloads
  □ No network calls
  □ All processing on-device or in-browser
  □ Calibration data in localStorage only

TESTING
  □ ≥ 5 test vectors per algorithm
  □ Covers: normal, boundary low, boundary high, no signal, artifact
  □ Expected values sourced (not invented)
```
