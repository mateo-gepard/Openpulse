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
- [AI Algorithm Builder](#ai-algorithm-builder)
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

## AI Algorithm Builder

An AI skill (`.agents/skills/openpulse_algorithm/SKILL.md`) that generates complete algorithm packages from a description. It enforces medical correctness, firmware safety, and privacy rules throughout.

### What It Produces

From a natural language request like *"build a tennis serve speed algorithm using the IMU"*, the skill generates:

1. **spec.md** — Algorithm specification with method, parameters, edge cases, physiological references
2. **display.js** — Custom dashboard visualization (the AI proposes the visual concept and the user approves it)
3. **firmware .h/.cpp** — C++ implementation following AlgorithmBase patterns
4. **test_vectors.h** — 5+ test cases with expected outputs

### Creation Flow (Guided Mode — 6 Rounds)

| Round | Topic | What Happens |
|-------|-------|-------------|
| 1 | **Intent & Scope** | User describes what they want. AI classifies algorithm layer/tier. |
| 2 | **Visualization** | AI proposes a creative panel concept (ASCII sketch, key elements, rationale). User approves or iterates. |
| 3 | **Sensors & Hardware** | AI maps algorithm to data channels, confirms sensor requirements. |
| 4 | **Algorithm Method** | AI proposes 2–3 proven methods with tradeoffs. User picks one. |
| 5 | **Parameters & Edge Cases** | AI pre-fills parameters from chosen method. User adjusts. |
| 6 | **Review & Confirm** | Complete spec presented for final approval before code generation. |

There's also an **Auto Mode** where the AI runs all steps autonomously and presents the spec + visualization at a single checkpoint.

### Rules Enforced

- **Medical:** Every formula cites a peer-reviewed paper. Outputs clamped to physiological ranges. SQI (0–1) on every output. Health screening requires "not a medical device" disclaimer.
- **Privacy:** All processing on-device. No cloud. No PII in BLE payloads.
- **Firmware safety:** No heap allocation in loop. No `delay()`. Static buffers. Motion artifact rejection.
- **Dependencies:** Registry lookup validates algorithm ID. Prerequisite algorithms must exist (e.g., X01 blood pressure needs A01 heart rate + A05 ECG rhythm).

### Skill Files

| File | Purpose |
|------|---------|
| `SKILL.md` | 12-section master rulebook |
| `templates/spec_template.md` | Blank algorithm spec template |
| `templates/firmware_header_template.h` | C++ `.h` template |
| `templates/firmware_impl_template.cpp` | C++ `.cpp` template |
| `templates/display_module_template.js` | Dashboard display module template |
| `templates/tier3_dashboard_template.js` | Tier 3 test scenario template |
| `examples/A01_heart_rate_spec.md` | Complete reference spec |
| `resources/algorithm_registry.md` | Master status tracker (54 algorithms) |
| `resources/sensor_validation.md` | Channel-to-sensor mapping rules |
| `resources/AlgorithmBase.h` | Shared C++ types and base class |
| `resources/RingBuffer.h` | Timestamped circular buffer |
| `resources/SensorDriverBase.h` | Driver interfaces per sensor type |

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
