# OpenPulse

> Open-source biometric sensor platform — modular hardware, AI-generated algorithms, real-time dashboard.

![Status](https://img.shields.io/badge/status-dev%20prototype-orange)
![Platform](https://img.shields.io/badge/platform-XIAO%20nRF52840-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Algorithms](https://img.shields.io/badge/algorithm%20slots-54-blue)
![Specs Done](https://img.shields.io/badge/specs%20done-8-brightgreen)
![Sensors](https://img.shields.io/badge/data%20channels-11-purple)

---

## What Is This?

OpenPulse is an open-source wearable health monitor built around the Seeed XIAO nRF52840 Sense. The firmware reads raw sensor data and streams it over BLE. A browser-based dashboard visualizes everything in real time. An AI skill generates new algorithm modules — spec, firmware code, dashboard visualization, and test vectors — from a natural language description.

**What's working today:**
- Hardware prototype with PPG (MAX30102), temperature (MCP9808 + BME280), 6-axis IMU, and PDM microphone
- Channel-based firmware orchestrator that auto-detects connected sensors
- Web dashboard with live BLE streaming, 54 algorithm panels, simulation mode, serial monitor, and AI-driven custom visualizations
- AI algorithm builder that produces medically-referenced specs and firmware code through a guided 6-round creation flow

**What's not built yet:**
- Mobile app (Phase 2)
- JavaScript/Python SDK (Phase 3)
- Production hardware with MAX86150 PPG+ECG, TMP117, ADS1115 EDA, AD5933 bioimpedance (Phase 1 next)
- Most of the 54 algorithm slots are empty — 8 have specs, 0 have validated firmware implementations

---

## Table of Contents

- [Hardware](#hardware)
- [Firmware](#firmware)
- [Dev Dashboard](#dev-dashboard)
- [Algorithms](#algorithms)
- [AI Algorithm Builder — Spec-Driven Development](#ai-algorithm-builder--spec-driven-development)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Tooling](#tooling)
- [Roadmap](#roadmap)
- [Competitive Landscape](#competitive-landscape)
- [Changelog](#changelog)
- [Tech Stack](#tech-stack)

---

## Hardware

### Dev Prototype (current)

| Sensor | Chip | Bus | Measures |
|--------|------|-----|----------|
| PPG (Red + IR) | MAX30102 | I2C 0x57 | Heart rate, SpO2 |
| Precision Temp | MCP9808 | I2C 0x18 | ±0.25°C skin temperature |
| Env Temp / Humidity / Pressure | BME280 | I2C 0x76 | Ambient conditions |
| 6-Axis IMU | LSM6DS3TR-C | I2C 0x6A (Wire1) | Accelerometer + gyroscope |
| Microphone | PDM (onboard) | Digital | Sound level (dB) |

### Production Target (next gen)

Three swappable puck slots on the XIAO nRF52840 controller:

| Puck | Chip | Measures | Sample Rate |
|------|------|----------|-------------|
| **Puck 1** | MAX86150 | Synchronized PPG + single-lead ECG | 100–200 Hz |
| **Puck 2** | TMP117 | ±0.1°C skin temperature | 1 Hz |
| **Puck 2** | ADS1115 | EDA / galvanic skin response (16-bit) | 10 Hz |
| **Puck 3** | AD5933 | Bioimpedance spectrum | On-demand |
| **XIAO** | LSM6DS3TR-C | Accel + gyro | 50 Hz |
| **XIAO** | PDM | Audio envelope, snoring | 16 kHz |
| **XIAO** | nRF52840 | NFC tap-to-pair | Integrated |

All sensor definitions live in `sensors.json` — the firmware and dashboard both read from this single source of truth.

---

## Firmware

Channel-based orchestrator on the XIAO nRF52840. No algorithms run on-device — the firmware is a pure sensor proxy.

**How it works:**
1. Init I2C buses (Wire for external chips, Wire1 for onboard IMU)
2. Probe I2C addresses → detect which sensors are physically connected
3. Init only the detected drivers
4. Register active data channels with BLE service
5. Loop: read drivers → broadcast channel data over BLE

**Key properties:**
- No `malloc`/`new` in loop — all buffers statically allocated
- No `delay()` — state-machine scheduling via `Scheduler`
- Dynamic BLE GATT — only creates characteristics for detected channels
- Round-robin sensor reads prevent I2C bus blocking
- 750ms BLE update interval with 5ms inter-characteristic delays

**Data channels** (11 total): `ppg`, `ecg`, `skinTemp`, `eda`, `bioz`, `envTemp`, `accel` (vec3), `gyro` (vec3), `mic`, `humidity`, `pressure`

Entry point: `firmware/openpulse.ino`

---

## Dev Dashboard

The development workbench is a single-page web app (`dev/dashboard/`) that connects to the firmware via Web Bluetooth. No build step — open `index.html` in Chrome.

### Live Sensor View

Real-time cards for every active data channel. Each card shows the current value, sparkline history (60 points), and min/max/avg stats. An **active channels strip** at the top shows which channels are online.

### Algorithm Panels

54 algorithms are registered in the dashboard. Each one declares which data channels it needs. The dashboard shows availability state based on what's currently connected:

| State | Visual | Meaning |
|-------|--------|---------|
| **Available** | Green border | All required channels are online |
| **Partial** | Orange border, dimmed | Some channels present, can't run |
| **Unavailable** | Grayed out | No required channels detected |

Available algorithms sort to the top. Clicking an algorithm opens its panel — which renders using a fully custom visualization powered by the `display.js` module for that algorithm.

### AI-Driven Visualization

Algorithm panels are not limited to templates. Each algorithm's `display.js` exports `render(container, state)` and `update(container, state)` functions that have full DOM access. The dashboard evaluates these via scoped `new Function()` and injects utilities (`drawSparkline`, `drawHeatmap`, `sizeCanvas`).

**State object available to render/update:**
- `output` — current algorithm value
- `sqi` — signal quality index (0–1)
- `history` — array of past outputs (max 60)
- `sensorData` — map of channel → {latest, online, history}
- `elapsed` — ms since panel opened
- `params` — current tunable parameter values
- `algo` — {id, name, unit, range}
- `util` — {drawSparkline, drawHeatmap, sizeCanvas}

This means a tennis algorithm can render a court heatmap, an ECG algorithm can draw a scrolling waveform, and a recovery score can show a radar chart — all without touching dashboard code.

### Simulation Mode

Two modes for testing algorithms without hardware:

| Mode | What it does |
|------|-------------|
| **Time-span** | Generate N seconds of synthetic data at accelerated speed (1×–100×). Presets: 10s, 1m, 5m, 1h. |
| **Live** | Stream synthetic data in real-time at 10 Hz. Continuous until stopped. |

Both modes let you select which channels to simulate. Algorithm panels react to simulated data the same way they react to real BLE data.

### Serial Monitor

Web Serial API console for direct firmware debugging:
- Connect at configurable baud rate
- Real-time line-buffered output display
- Send commands to firmware via text input
- System vs. device message styling

### Other Features
- Light / dark theme (persisted)
- Custom algorithm import — drop a `display.js` file to register a new algorithm
- Tunable parameters per algorithm (min/max/step sliders)
- All custom algorithms + parameters persist in localStorage
- Collapsible sidebar

---

## Algorithms

### The Registry

54 algorithm slots organized in three layers:

| Layer | Range | Count | Description |
|-------|-------|-------|-------------|
| **Base (A)** | A01–A27 | 27 | Single-sensor algorithms (HR, SpO2, steps, EDA, temp, etc.) |
| **Fusion (X)** | X01–X17 | 17 | Cross-sensor algorithms (blood pressure, sleep phases, autonomic balance) |
| **Composite (C)** | C01–C10 | 10 | Multi-algorithm scores (recovery, strain, sleep score, biological age) |

Each algorithm has a tier indicating complexity:

| Tier | Meaning | Example |
|------|---------|---------|
| **0** | Pass-through / scaling | Raw PPG display |
| **1** | Single signal, basic math | Heart rate from peak detection |
| **2** | Signal processing, filtering | HRV from R-R intervals |
| **3** | Multi-signal, ML, or calibration | Blood pressure from PTT |

### Current Status

**8 algorithms have complete specs + display modules:**

| ID | Algorithm | Key Output |
|----|-----------|-----------|
| A01 | Heart Rate | BPM (real-time) |
| A02 | HRV | RMSSD, SDNN, pNN50 |
| A03 | SpO2 | Blood oxygen % |
| A04 | Respiratory Rate | Breaths/min from PPG modulation |
| A06 | Resting HR Trend | 7/30/90-day baseline |
| A07 | PPG Waveform | Morphology features |
| A08 | Vascular Age | Arterial stiffness estimate |
| A09 | Perfusion Index | Pulsatile vs. non-pulsatile ratio |

The remaining 46 slots are defined in the dashboard registry (name, channels, unit, range, parameters) but don't have specs or firmware implementations yet.

Master tracker: `.agents/skills/openpulse_algorithm/resources/algorithm_registry.md`

### Algorithm File Structure

Each algorithm lives in `algorithms/<ID>_<name>/`:

```
algorithms/A01_heart_rate/
├── spec.md           # Algorithm specification (method, parameters, edge cases, references)
├── display.js        # Dashboard visualization module (render/update functions)
└── test_vectors.h    # C++ test inputs and expected outputs
```

---

## AI Algorithm Builder — Spec-Driven Development

This is the core of OpenPulse. An AI skill (`.agents/skills/openpulse_algorithm/SKILL.md`) that lets **anyone** — a fitness coach, a sleep researcher, a student, a hobbyist — describe a health algorithm in plain English and get back medically-referenced, firmware-ready, tested code with a custom dashboard visualization. No biomedical engineering degree required.

The approach is **spec-driven**: before any code is generated, the AI builds a complete specification document that captures every detail — the math, the citations, the edge cases, the signal processing pipeline, the validation targets. The spec is the contract. The code follows from it mechanically. This means the quality of the output isn't dependent on the user's programming ability. It's determined by the rules baked into the skill.

### Why This Matters

Traditional wearable algorithm development requires:
- A biomedical engineer who knows signal processing
- Familiarity with DSP libraries, filter design, peak detection
- Access to peer-reviewed literature for validated formulas
- Knowledge of embedded systems (RAM constraints, no heap allocation, real-time scheduling)
- Understanding of regulatory classifications (Wellness vs. Health Screening)
- Test harness design with physiological signal models

OpenPulse's spec-driven skill handles all of this automatically. The user provides intent ("I want to detect tennis serve speed using the IMU"). The AI provides the science, the engineering, and the safety rails.

### What Gets Generated

From a single description, the skill produces a complete algorithm package:

| File | What It Is |
|------|-----------|
| `spec.md` | Full algorithm specification — method, math with citations, parameters, SQI computation, edge cases, validation targets, physiological references |
| `display.js` | Custom dashboard visualization — `render()` and `update()` functions with full DOM/Canvas access, scoped CSS |
| `firmware .h` | C++ algorithm header following `AlgorithmBase` |
| `firmware .cpp` | C++ implementation — static buffers, no heap, state-machine driven |
| `test_vectors.h` | 7+ test scenarios with mathematical signal models — normal, boundary, no-signal, artifact, gradual transition, edge cases |

### The 6-Round Guided Creation Flow

The skill walks the user through six interactive rounds. At each step, the AI does the heavy lifting and the user validates. No technical knowledge required — the AI explains everything it's doing and why.

**Round 1 — Intent & Scope**
> *"What do you want to measure or detect?"*

The user describes their idea in plain English. The AI classifies it automatically:
- **Category**: health-biometric, sport-motion, or hybrid
- **Layer**: base (single sensor), cross-sensor (fusion), or composite (multi-algorithm)
- **Tier**: 0 (real-time), 1 (periodic), 2 (on-demand), 3 (offline)
- **Regulatory**: Wellness, Health Indicator, Health Screening, or Sport Performance

Built-in classification heuristics handle common phrases: "heart rate" → health-biometric/base/Tier 0. "recovery score" → hybrid/composite/Tier 3. "tennis forehand" → sport-motion/base/Tier 1. The user confirms or corrects.

**Round 2 — Visualization**

Before any technical decisions, the AI proposes what the dashboard panel will look like. This is where creative freedom matters — a tennis algorithm gets a court heatmap, not a generic gauge. A sleep algorithm gets a hypnogram, not a bar chart. The AI sketches the concept:

```
┌─────────────────────────────────────────────────┐
│  A28: Tennis Serve Speed        gauge · T1      │
│  ─────────────────────────────────────────────── │
│                                                 │
│         ┌──────────────┐    Last 10 serves:     │
│         │   142 km/h   │    ████████░░ 138      │
│         │  ◢████████◣  │    █████████░ 142      │
│         │  100   180   │    ██████░░░░ 127      │
│         └──────────────┘                        │
│                                                 │
│  Concept: Large speed gauge with color arc      │
│  (green→yellow→red by speed range) + scrolling  │
│  bar chart of recent serves with speed labels.  │
│                                                 │
│  Panel size: 2x1 — needs width for serve list   │
│                                                 │
│  Does this look right? Want a different style?  │
└─────────────────────────────────────────────────┘
```

The user approves, tweaks, or asks for something completely different. Once agreed, this concept drives the `display.js` that gets generated later.

**Round 3 — Sensors & Hardware**

The AI maps the algorithm to OpenPulse data channels based on what it needs to measure. It explains *why* each sensor is needed:

```
Channels: CH_ACCEL + CH_GYRO
Reason: Serve speed requires peak angular velocity (gyro)
        and linear acceleration at impact (accel).
        No PPG/ECG/EDA needed — this is pure motion.
```

If the user suggests a sensor that doesn't make sense (e.g., "use PPG for step counting"), the AI explains why and proposes the correct alternative.

**Round 4 — Algorithm Method**

The AI proposes 2–3 proven methods with trade-offs. For health algorithms, every method must come from peer-reviewed literature. For sport algorithms, validated biomechanical techniques are accepted.

```
Method A: Peak Angular Velocity Detection
  How: Detect serve impact as max gyroscope magnitude,
       convert angular velocity to racquet-head speed.
  Source: Camomilla et al. (2018), Sensors.
  Pros: Simple, low latency, proven for racquet sports.
  Cons: Requires calibration for racquet length.
  ★ Recommended

Method B: IMU Sensor Fusion (Madgwick + Kinematic Chain)
  How: Full orientation tracking → derive hand speed
       from quaternion differentiation.
  Source: Madgwick (2010), ICORR.
  Pros: More accurate absolute speed.
  Cons: Higher compute, drift over time, needs magnetometer.

Which method?
```

The user picks one. No need to read the papers — the AI has already evaluated the trade-offs.

**Round 5 — Parameters & Edge Cases**

The AI pre-fills all algorithm parameters from the chosen method and presents them for review:

```
Parameter Table:
  | Parameter       | Default | Range    | Why                          |
  |-----------------|---------|----------|------------------------------|
  | Impact threshold| 8 g     | 4–15 g  | Minimum accel for serve hit  |
  | Window size     | 200 ms  | 50–500  | Capture duration around peak |
  | Cooldown        | 2000 ms | 500–5000| Prevent double-counting      |

Edge Cases:
  | Condition           | Behavior                              |
  |---------------------|---------------------------------------|
  | Sensor not worn     | SQI = 0, suppress output ("--")       |
  | Walking with racquet| Below threshold → no detection        |
  | Double-bounce serve | Cooldown prevents duplicate           |
  | Extreme temperature | No effect on IMU accuracy             |
```

If the user sets extreme values, the AI warns: *"SQI threshold of 0.95 means the algorithm will suppress output almost always — most algorithms use 0.3–0.6."*

**Round 6 — Review & Confirm**

The complete `spec.md` is presented. The user reviews everything — method, parameters, edge cases, references, validation targets — and confirms. Only then does code generation begin.

### Medical Correctness — Built Into Every Algorithm

The skill enforces medical-grade rigor regardless of who's building the algorithm. These rules are non-negotiable:

**Every formula must cite a source.**
Not a blog post. Not Stack Overflow. Peer-reviewed journals (IEEE, JBHI, Physiological Measurement), chip manufacturer app notes (Maxim, Analog Devices), validated open-source libraries (PhysioNet, HeartPy, NeuroKit2), or textbooks (Webster, Bronzino). The citation goes inline with the code:

```cpp
// SpO2 = 110 - 25 * R
// Source: Maxim AN6409 "Guidelines for SpO2 Measurement Using MAX30101/2"
// Validated range: R ∈ [0.4, 1.0] → SpO2 ∈ [85%, 100%]
```

**Every output is hard-clamped to physiological limits.**

| Metric | Clamped Range |
|--------|--------------|
| Heart Rate | 30–220 BPM |
| SpO2 | 70–100% |
| Respiratory Rate | 4–60 breaths/min |
| Blood Pressure | SBP 60–250, DBP 30–150 mmHg |
| Skin Temperature | 25–42°C |
| HRV RMSSD | 0–300 ms |
| EDA | 0.01–100 µS |

An algorithm can never output "heart rate: 350 BPM" or "SpO2: -12%". The clamping is enforced in the generated firmware code.

**Every real-time algorithm produces a Signal Quality Index (SQI).**

```cpp
struct AlgorithmOutput {
    float    value;           // The measurement
    float    sqi;             // 0.0 = garbage, 1.0 = perfect
    uint32_t timestamp_ms;
    bool     valid;           // false → suppress display
};
```

When SQI drops below the algorithm-specific threshold, the output is suppressed entirely — the dashboard shows `--` instead of bad data. SpO2 requires SQI ≥ 0.6 (extremely motion-sensitive). Heart rate is more forgiving at SQI ≥ 0.3. The skill auto-selects appropriate thresholds based on the algorithm type.

**Calibration is transparent, never silent.**

Algorithms requiring calibration (blood pressure, body composition) use an extended output struct:

```cpp
struct CalibratedOutput {
    float value;                // Point estimate
    float ci_low, ci_high;     // 95% confidence interval
    float sqi;
    bool  calibrated;           // false → "Calibration needed"
    uint32_t calibration_age_ms; // Prompt recalibration after 14 days
};
```

An uncalibrated algorithm will never silently output clinical-grade numbers. It shows "Calibration needed" until properly calibrated, and tracks how old the calibration is.

**Health Screening algorithms carry a mandatory disclaimer.**

Any algorithm classified as Health Screening (SpO2, blood pressure, ECG rhythm analysis) displays: *"This is not a medical device. Consult a healthcare provider for medical decisions."* The skill adds this automatically.

### Dependency Resolution

Before generating a composite or cross-sensor algorithm, the skill traces the full dependency tree:

```
C01_recovery_score
├── A01_heart_rate ──── exists? ✓
├── A02_hrv ─────────── exists? ✓ (spec only)
├── A23_sleep_detection ── exists? ✗
└── X05_autonomic_balance ── exists? ✗
    └── A02_hrv ──── (already checked)
```

If dependencies are missing, the user gets three options:
1. **Build the chain** — generate missing dependencies bottom-up (recommended)
2. **Build with stubs** — placeholder code for fast prototyping
3. **Start with a leaf** — build the deepest missing dependency first

The skill never silently skips a dependency. If a composite calls `getHRV()`, it verifies A02 exists and output types match.

### Validation — Not Afterthoughts, Requirements

Every algorithm spec includes validation targets against established datasets:

| Metric | Reference Dataset | Target |
|--------|------------------|--------|
| Heart Rate | MIT-BIH Arrhythmia DB | MAE < 2 BPM vs. ECG |
| HRV (RMSSD) | MIT-BIH NSR | Correlation r ≥ 0.95 |
| SpO2 | MIMIC-III Waveform | Bias < 2% vs. CO-Oximetry |
| Sleep Staging | Sleep-EDF | Cohen's κ ≥ 0.6 (4-class) |
| Blood Pressure | MIMIC-III (ECG+PPG+ABP) | RMSE < 5 mmHg (AAMI standard) |
| Activity Recognition | UCI HAR Dataset | F1 ≥ 0.90 (6-class) |
| Step Counting | PAMAP2 | Error < 5% per 100 steps |

Test vectors use **mathematical signal models**, not hardcoded arrays. Each algorithm gets a minimum of 7 scenarios: normal operation, boundary low, boundary high, no signal, heavy artifact, gradual transition, and low-quality edge case.

### Privacy — Enforced at the Architecture Level

- All processing on-device. No algorithm can phone home, beacon, or send data to a server.
- BLE payloads contain only computed float values (4 bytes per metric). No PII, no raw waveforms.
- Device name is generic ("OpenPulse"). No user identifiers in broadcast.
- All user data in browser localStorage, deletable via a single button.
- No internet required for any algorithm to function.

### Firmware Safety — Embedded Constraints Built In

The generated C++ code follows strict embedded rules for the nRF52840 (256KB RAM):

- **No `malloc`/`new` in the main loop** — all buffers are statically allocated at compile time
- **No `delay()`** — everything runs as a state machine via the Scheduler
- **Motion artifact rejection** for all PPG/ECG algorithms — the SQI computation accounts for accelerometer data
- **Static RAM budget** declared in every spec — the generated code stays within it
- **Power mode declared** — continuous, duty-cycled, or on-demand — so the firmware can manage battery life

### What This Means in Practice

A fitness coach who wants a "tennis serve speed detector" describes it in English. The AI:

1. Classifies it (sport-motion/base/Tier 1)
2. Proposes a court heatmap + speed gauge visualization
3. Maps it to IMU channels (accel + gyro)
4. Proposes peak angular velocity detection from Camomilla et al. (2018)
5. Pre-fills parameters (8g threshold, 200ms window, 2s cooldown)
6. Generates a complete spec with 7 test scenarios
7. Produces firmware C++ with static buffers and no heap allocation
8. Produces a custom `display.js` with the court heatmap the user approved

The result is the same quality you'd get from a biomedical engineering team — cited formulas, clamped outputs, signal quality gating, motion artifact rejection, embedded safety, and validated test vectors. The difference is it takes minutes instead of weeks, and it's accessible to anyone who can describe what they want to measure.

### Skill Files Reference

| File | Purpose |
|------|---------|
| `SKILL.md` | 12-section master rulebook covering medical correctness, privacy, firmware safety, signal processing, code generation |
| `templates/spec_template.md` | Blank algorithm spec — every field required, no blanks, no TODOs |
| `templates/firmware_header_template.h` | C++ `.h` template using `AlgorithmBase` |
| `templates/firmware_impl_template.cpp` | C++ `.cpp` template with static buffers and state machines |
| `templates/display_module_template.js` | Dashboard display module with `render()`/`update()` API |
| `templates/tier3_dashboard_template.js` | Tier 3 browser-side test scenario template |
| `examples/A01_heart_rate_spec.md` | Complete reference spec — adaptive peak detection, SQI, 7 test vectors |
| `resources/algorithm_registry.md` | Master status tracker for all 54 algorithm slots |
| `resources/sensor_validation.md` | Channel-to-sensor hardware truth tables |
| `resources/AlgorithmBase.h` | Shared C++ types: `AlgorithmOutput`, `CalibratedOutput`, base class |
| `resources/RingBuffer.h` | Timestamped circular buffer with stats and cross-sensor interpolation |
| `resources/SensorDriverBase.h` | Typed driver interfaces per sensor type |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User / Browser                        │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Sensor Cards │  │ Algo Panels  │  │ Serial Monitor│  │
│  │ (live data)  │  │ (render/     │  │ (Web Serial)  │  │
│  │              │  │  update API) │  │               │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┘  │
│         │                 │                              │
│         └────────┬────────┘                              │
│                  │                                       │
│         ┌────────▼────────┐                              │
│         │   Dashboard     │  dev/dashboard/app.js        │
│         │  (vanilla JS)   │  Web Bluetooth + Web Serial  │
│         └────────┬────────┘                              │
└──────────────────┼──────────────────────────────────────┘
                   │ BLE GATT
┌──────────────────┼──────────────────────────────────────┐
│         ┌────────▼────────┐                              │
│         │  OpenPulseBLE   │  Dynamic GATT service        │
│         └────────┬────────┘                              │
│                  │                                       │
│         ┌────────▼────────┐                              │
│         │   Scheduler     │  Round-robin sensor reads    │
│         └────────┬────────┘                              │
│                  │                                       │
│  ┌───────┬───────┼───────┬────────┬──────────┐          │
│  │MAX30102│MCP9808│BME280│LSM6DS3 │   PDM    │          │
│  │ (PPG)  │(Temp) │(Env) │ (IMU)  │  (Mic)   │          │
│  └───────┘└──────┘└──────┘└───────┘└─────────┘          │
│                                                         │
│              XIAO nRF52840 Sense                        │
│              firmware/openpulse.ino                      │
└─────────────────────────────────────────────────────────┘
```

**Design principles:**
- Firmware is a dumb pipe — no algorithms, no profiles, no feature logic
- Everything references data channels (e.g., `ppg`, `skinTemp`), not chip names
- Algorithms declare channel dependencies; the dashboard resolves availability at runtime
- All data stays local — no cloud, no accounts, no telemetry

### Future Layers (not built yet)

| Layer | Purpose | Status |
|-------|---------|--------|
| Mobile App | React Native/Flutter, profile-based module activation, local DB | Phase 2 |
| Module Engine | Dynamic load/unload of algorithm modules at runtime | Phase 2 |
| SDK | JavaScript/Python API for community algorithm development | Phase 3 |
| Algorithm Hub | GitHub-based publishing with trust levels (Verified / Community / Experimental) | Phase 4 |

---

## Getting Started

### Prerequisites

- **Arduino IDE** with [Seeed nRF52 mbed-enabled Boards](https://wiki.seeedstudio.com/XIAO_BLE/) package
- **Libraries:** `ArduinoBLE`, `SparkFun MAX3010x`, `Adafruit MCP9808`, `Adafruit BME280`, `Adafruit Unified Sensor`
- **LSM6DS3 patch:** The Seeed Arduino LSM6DS3 library needs a [one-line fix](#lsm6ds3-library-patch) to compile on mbed nRF52840

### Flash Firmware

1. Open `firmware/openpulse.ino` in Arduino IDE
2. Select **Seeed XIAO nRF52840 Sense** board
3. Upload

### Open Dashboard

1. Open `dev/dashboard/index.html` in **Chrome / Edge / Brave** (Web Bluetooth required)
2. Click **Connect** → pair with the device
3. Sensor cards populate automatically as data streams in

### Test Without Hardware

1. Open the dashboard
2. Click **Simulate** → choose **Time-span** or **Live** mode
3. Select channels to simulate
4. Algorithm panels respond to synthetic data

### Build an Algorithm

```
Tell AI: "@OpenpulseAlgomaster build a tennis serve speed algorithm"
```

The AI walks through the 6-round guided flow (intent → visualization → sensors → method → parameters → review), then generates spec.md, display.js, firmware code, and test vectors.

---

## Project Structure

```
Openpulse/
├── firmware/
│   ├── openpulse.ino                     # Main firmware orchestrator
│   ├── src/
│   │   ├── framework/                    # AlgorithmBase, RingBuffer, Scheduler
│   │   ├── drivers/                      # Per-chip I2C drivers
│   │   ├── algorithms/base/             # A01–A27 firmware implementations
│   │   ├── algorithms/fusion/           # X01–X17 firmware implementations
│   │   └── ble/                          # BLE GATT service
│   └── test/                             # Desktop test harness (clang++)
│
├── dev/dashboard/                        # Web DevWorkbench
│   ├── index.html                        # Single-page app shell
│   ├── app.js                            # ~2100 lines: BLE, panels, sim, serial
│   └── style.css                         # Layout + 10 built-in viz styles
│
├── algorithms/                           # Algorithm packages (54 slots)
│   ├── A01_heart_rate/                   # spec.md + display.js + test_vectors.h
│   ├── A02_hrv/                          # spec.md + display.js + test_vectors.h
│   ├── ...                               # 46 empty slots awaiting specs
│   ├── X01_blood_pressure/
│   └── C01_recovery_score/
│
├── .agents/skills/openpulse_algorithm/   # AI Algorithm Builder Skill
│   ├── SKILL.md                          # Master rulebook (12 sections)
│   ├── templates/                        # Spec, firmware, display, test templates
│   ├── examples/                         # A01 reference spec
│   └── resources/                        # Registry, base classes, sensor mapping
│
├── app/src/                              # Mobile app scaffold (Phase 2)
├── sdk/                                  # JS/Python SDK scaffold (Phase 3)
├── tools/                                # filter_designer.py, run_tests.sh
├── sensors.json                          # Single source of truth for all sensors
└── README.md
```

---

## Tooling

### Filter Designer

`tools/filter_designer.py` — generates IIR Butterworth filter coefficients as C++ code.

```bash
python3 tools/filter_designer.py ppg     # 0.5–4.0 Hz bandpass for heart rate
python3 tools/filter_designer.py ecg     # 5.0–15.0 Hz bandpass for QRS detection
python3 tools/filter_designer.py resp    # 0.1–0.5 Hz for respiratory rate
python3 tools/filter_designer.py eda_lp  # 0.05 Hz lowpass for tonic EDA
python3 tools/filter_designer.py step    # 0.5–3.0 Hz for step detection
```

### Test Runner

`tools/run_tests.sh` — compiles and runs desktop unit tests using clang++. Tests validate algorithm logic without hardware.

### Algorithm Validator

`tools/validate_algorithm.py` — checks algorithm spec completeness and cross-references against the registry.

---

## Roadmap

### Phase 1: Hardware + Dashboard MVP (now → Q2 2026)

| Task | Status |
|------|--------|
| BLE firmware with auto-detect sensor orchestrator | ✅ Done |
| Web dashboard with live sensor cards | ✅ Done |
| Real SpO2 + stable HR on dev hardware | ✅ Done |
| IMU + PDM microphone integration | ✅ Done |
| AI algorithm builder skill (12-section, 6-round guided) | ✅ Done |
| Dashboard: simulation mode, serial monitor, custom viz | ✅ Done |
| 8 algorithm specs (A01–A04, A06–A09) | ✅ Done |
| Driver stubs for production sensors (MAX86150, TMP117, ADS1115, AD5933) | ✅ Headers exist |
| Validate + test production sensor drivers | 🔲 Next |
| Implement P0 base algorithms in firmware (A01–A09) | 🔲 Next |
| Spec remaining base algorithms (A10–A27) | 🔲 Planned |

### Phase 2: Mobile App (Q3 2026)

| Task | Status |
|------|--------|
| React Native / Flutter app scaffold | 🔲 |
| Profile-based onboarding (5 profiles) | 🔲 |
| Auto sensor detection via BLE | 🔲 |
| Module engine (load/unload algorithms at runtime) | 🔲 |
| Local data storage (SQLite/Realm, no cloud) | 🔲 |
| 15–20 verified modules integrated | 🔲 |
| PDF / CSV health report export | 🔲 |

### Phase 3: SDK + Community (Q4 2026)

| Task | Status |
|------|--------|
| Module interface specification | 🔲 |
| JavaScript SDK | 🔲 |
| Python SDK | 🔲 |
| 3 reference community modules | 🔲 |
| Module validation pipeline | 🔲 |

### Phase 4: Algorithm Hub (2027)

Open community algorithm repository with trust levels:

| Level | Visibility | Requirements |
|-------|-----------|-------------|
| **Experimental** | Developer mode only | Published module |
| **Community** | "For You" section | Community review + auto tests pass |
| **Verified** | Pre-installed | Core team review + clinical validation |

---

## Competitive Landscape

How OpenPulse's sensor coverage compares to consumer wearables (production hardware target):

| Capability | Whoop 5.0 | Oura 4 | Garmin | Fitbit | **OpenPulse** |
|-----------|-----------|--------|--------|--------|---------------|
| PPG Heart Rate | ✓ | ✓ | ✓ | ✓ | ✓ |
| HRV | ✓ | ✓ | ✓ | ✓ | ✓ |
| SpO2 | ✓ | ✓ | ✓ | ✓ | ✓ |
| ECG | Limited | ✓ | ✗ | ✓ | **MAX86150** |
| Blood Pressure (PTT) | Beta | ✗ | ✗ | ✗ | **PPG+ECG** |
| Skin Temp (±0.1°C) | ±1°C | ✓ | ✓ | ✓ | **TMP117** |
| EDA / Stress | ✗ | ✗ | ✗ | ✓ | **ADS1115** |
| Bioimpedance | ✗ | ✗ | ✗ | ✗ | **AD5933** |
| Gyroscope | ✗ | ✗ | ✓ | ✗ | **LSM6DS3** |
| Raw Data Access | ✗ | ✗ | Limited | ✗ | **Full** |
| Open Source | ✗ | ✗ | ✗ | ✗ | **✓** |
| Modular Hardware | ✗ | ✗ | ✗ | ✗ | **3 puck slots** |
| Subscription | $240/yr | $70/yr | Free | $120/yr | **Free** |

**Key differentiators:** synchronized PPG+ECG for pulse transit time, EDA+HRV combined stress, bioimpedance body composition, full raw data access, modular puck system, and community algorithm development. No subscription.

---

## LSM6DS3 Library Patch

The Seeed Arduino LSM6DS3 library has a compilation error on mbed-based nRF52840 boards. One-line fix:

**File:** `LSM6DS3.cpp` (Arduino libraries folder), **line ~107:**

```diff
-#else
+#elif !defined(ARDUINO_ARCH_MBED)
             SPI.setBitOrder(MSBFIRST);
```

---

## Changelog

### v6.4 (AI-Driven Visualization + Guided Creation)
- **Visualization Suggestion Round**: Algorithm creation skill now includes a dedicated Round 2 where the AI proposes creative panel concepts (ASCII sketches, key elements, rationale) before any technical decisions. User approves or iterates.
- **Auto Mode Checkpoint**: Spec review checkpoint now also presents the visualization concept alongside the spec for user approval.
- **6-Round Guided Flow**: Intent → Visualization → Sensors → Method → Parameters → Review.

### v6.3 (Flexible Panel System)
- **AI-Driven Visualization**: Replaced hardcoded layout types with open-ended `render(container, state)` / `update(container, state)` API. Each algorithm's `display.js` has full DOM access.
- **Display Module Evaluation**: `parseDisplayModule` uses scoped `new Function()` — not eval. Injects `drawSparkline`, `drawHeatmap`, `sizeCanvas` utilities.
- **CSS Injection**: Scoped `<style data-algo-css="ID">` per algorithm panel.
- **State API**: Exposes output, SQI, history, sensor data, elapsed time, tunable params.
- **localStorage Preservation**: Custom algorithm source text saved (not serialized JSON) to preserve render/update functions across sessions.

### v6.2 (Dashboard Intelligence + Skill Hardening)
- **Channel-Based Algorithm Awareness**: Per-channel requirement pills with three availability states (available/partial/unavailable). Available-first sorting.
- **Active Channels Strip**: Summary bar showing live data channels.
- **Custom Algorithm Import**: Drop `display.js` files to register fully interactive algorithm panels (multi-metric grids, score bars, SQI gauge, waveform canvas, tunable parameters).
- **SKILL.md Hardening**: 9 fixes across registry lookup, dependency resolution, category routing, hardware truth tables, multi-output algorithms, SpO2 processing, sensor fusion, and Tier 3 test scenarios.
- **New Templates**: display module, firmware header/impl, Tier 3 dashboard test.

### v6.1 (Algorithm Skill Upgrade)
- **Oura-Style Baselines**: Dual-horizon baseline model (short-term vs long-term) with exponential smoothing.
- **Improved SQI & Motion Artifacts**: Continuous motion penalty (0.0–1.0g) with per-algorithm configurable thresholds.
- **Signal Processing**: Multi-method peak detection, pyPPG nomenclature, cvxEDA for 30s epoch sleep staging.
- **Hardware Orchestration**: Sensor Manager API to prevent mode conflicts.
- **Validation Simulator**: Dynamic Test Scenarios replacing static test vectors (MIT-BIH, Sleep-EDF, MIMIC-III databases).

### v6 (March 2026)
- **Data Channel Architecture**: Algorithms depend on data channels (`CH_PPG`, `CH_ECG`) not chip names.
- **Runtime Puck Discovery**: Firmware probes I2C, configures dynamically via `sensors.json`.
- **Dynamic BLE Service**: GATT characteristics created only for detected channels.
- **Firmware Orchestrator**: Replaced 800-line monolith with ~130-line `openpulse.ino` using `SensorDriverBase` abstraction.
- **Dashboard Refactor**: Channel-based `CHANNEL_DEFS`, hardware-agnostic algorithm registry.

### v5 (March 2026)
- IMU power fix (pin 15, high-drive GPIO, retry with power cycle)
- PDM microphone (16 kHz, RMS→dB)
- Sound level card, 4-slot round-robin
- Algorithm Builder Skill (SKILL.md, spec template, example, AlgorithmBase.h, RingBuffer.h)

### v4 (March 2026)
- Real SpO2 (AC/DC ratio, R-value → `SpO2 = 104 - 17·R`)
- Stable HR (8-beat rolling average, 300ms debounce, outlier rejection)
- BLE stability (5ms delays, 750ms interval, connection watchdog)
- Dashboard auto-reconnect (3 retries, 2s delay)

### v3 (March 2026)
- Initial dashboard: MAX30102, BME280, MCP9808, LSM6DS3TR-C
- Web Bluetooth, 8 sensor cards, light/dark theme, debug panel

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Firmware** | Arduino C++ (ArduinoBLE, I2C, PDM) on XIAO nRF52840 Sense |
| **Dashboard** | Vanilla HTML / CSS / JS — no frameworks, no build step |
| **Mobile App** | React Native or Flutter (Phase 2, not started) |
| **Database** | SQLite / Realm (local only, no cloud) |
| **Communication** | Bluetooth Low Energy (GATT) |
| **Algorithm Dev** | AI skill with medical validation rules, 6-round guided flow |
| **SDK** | JavaScript / Python (Phase 3, not started) |

---

*Open hardware. Open algorithms. Your data. No subscription.*
