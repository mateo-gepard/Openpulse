# OpenPulse

> **Open-source biometric sensor platform** — modular health monitoring with cross-sensor fusion.  
> 51+ algorithm modules. No subscription. Your data. Open source.

![Status](https://img.shields.io/badge/status-dev%20prototype-orange)
![Platform](https://img.shields.io/badge/platform-XIAO%20nRF52840-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Algorithms](https://img.shields.io/badge/algorithms-72-brightgreen)
![Modules](https://img.shields.io/badge/modules-51+-brightgreen)

---

## What Is OpenPulse?

OpenPulse is the only consumer-grade health tracker that combines **synchronized PPG+ECG, EDA, precision skin temperature, bioimpedance, a 6-axis IMU, and a PDM microphone** in a single modular device.

Three puck slots. Six sensors. 51+ algorithm modules. Your configuration. No subscription. Your data.

The platform consists of:
- **Firmware** — Arduino C++ on Seeed XIAO nRF52840 Sense (pure data streaming, no algorithms on-device)
- **App** — Module engine that loads algorithms based on your profile and connected sensors
- **Algorithm Hub** — Open-source repository where anyone can publish verified health algorithms
- **Developer SDK** — JavaScript/Python API for building custom modules

---

## Competitive Analysis

| Feature | Whoop 5.0 | Oura 4 | Garmin | Fitbit | **OpenPulse** |
|---------|-----------|--------|--------|--------|---------------|
| Heart Rate (PPG) | ✓ | ✓ | ✓ | ✓ | **✓ Puck 1** |
| HRV | ✓ | ✓ | ✓ | ✓ | **✓ Puck 1** |
| SpO2 | ✓ | ✓ | ✓ | ✓ | **✓ Puck 1** |
| ECG | Only MG | ✓ | ✗ | ✓ | **✓ Puck 1** |
| Blood Pressure (PTT) | Beta | ✗ | ✗ | ✗ | **✓ Puck 1** |
| Respiratory Rate | ✓ | ✓ | ✓ | ✓ | **✓ Puck 1** |
| Skin Temperature | ±1°C | ✓ | ✓ | ✓ | **±0.1°C Puck 2** |
| EDA / Stress Sensor | ✗ | ✗ | ✗ | ✓ | **✓ Puck 2** |
| Real-Time Stress | HR only | HR only | HR only | EDA | **EDA+HR** |
| Accelerometer | ✓ | ✓ | ✓ | ✓ | **✓ XIAO** |
| Gyroscope | ✗ | ✗ | ✓ | ✗ | **✓ XIAO** |
| Bioimpedance | ✗ | ✗ | ✗ | ✗ | **✓ Puck 3** |
| VO2max Estimate | ✓ | ✓ | ✓ | ✗ | **✓ Algo** |
| Sleep Phases | ✓ | ✓ | ✓ | ✓ | **✓ 5-Signal** |
| Recovery Score | ✓ | ✓ | ✓ | ✓ | **✓ 6-Source** |
| Activity Recognition | ✓ | ✓ | ✓ | ✓ | **✓ IMU** |
| Cycle Tracking | ✓ | ✓ | ✓ | ✓ | **✓ ±0.1°C** |
| Biological Age | ✓ | ✗ | ✓ | ✗ | **✓ 12+ Biomarkers** |
| AI Coach | ✓ | ✓ | ✗ | ✗ | **Community Algos** |
| Raw Data Access | ✗ | ✗ | Limited | ✗ | **✓ Full** |
| Open Source | ✗ | ✗ | ✗ | ✗ | **✓** |
| Modular | ✗ | ✗ | ✗ | ✗ | **✓** |
| Subscription Required | 199€/yr | 72€/yr | ✗ | 120€/yr | **✗** |
| Price (Year 1) | 199–359€ | 421€ | 400€ | 370€ | **99–129€** |

**Result:** OpenPulse matches or exceeds every competitor in every category — and is superior in ECG, PTT blood pressure, EDA stress, bioimpedance, temperature precision, raw data access, open source, and modularity. No subscription, buy once.

---

## Hardware

### Current Dev Prototype

| Sensor | Chip | Position | Measures | Interface |
|--------|------|----------|----------|-----------|
| PPG (Red + IR) | MAX30102 | External | Heart Rate, SpO2 | Wire, 0x57 |
| Temperature | BME280 | External | Temp, Humidity, Pressure | Wire, 0x76 |
| Precision Temp | MCP9808 | External | ±0.25°C Temperature | Wire, 0x18 |
| 6-Axis IMU | LSM6DS3TR-C | Onboard | Accelerometer, Gyroscope | Wire1, 0x6A |
| Microphone | PDM (integrated) | Onboard | Sound Level (dB) | Digital PDM |

### Production Hardware (Next Generation)

| Sensor | Chip | Position | Measures | Interface |
|--------|------|----------|----------|-----------|
| PPG + ECG | MAX86150 | Puck 1 | Synchronized PPG+ECG, 100/200 Hz | I2C |
| Skin Temperature | TMP117 | Puck 2 | ±0.1°C absolute, 16-bit | I2C, 1 Hz |
| EDA / GSR | ADS1115 | Puck 2 | Galvanic Skin Response, 16-bit | I2C, 10 Hz |
| Bioimpedance | AD5933 | Puck 3 | Impedance Spectrum | I2C, on-demand |
| 6-Axis IMU | LSM6DS3TR-C | XIAO | Accel + Gyro | Wire1, 50 Hz |
| Microphone | PDM | XIAO | Audio Envelope, Snoring | Digital, 16 kHz |
| NFC | nRF52840 | XIAO | Tap-to-Pair, Context | Integrated |

---

## Algorithm Modules — The Complete Toolkit

Every module is a standalone building block that takes sensor data and produces a feature. Modules are auto-activated based on the user's profile and connected sensors. The user sees features on their dashboard — not modules.

All modules are open source. **Verified** modules come pre-installed. **Community** modules appear in the "For You" section. **Experimental** modules are visible only in developer mode.

### Heart & Circulation

| Feature | Sensor | Description |
|---------|--------|-------------|
| Heart Rate (Real-Time) | Puck 1 PPG | Continuous pulse, live display, HR zones |
| Heart Rate Variability (HRV) | Puck 1 PPG | R-R intervals, RMSSD, day vs. night comparison |
| Blood Oxygen (SpO2) | Puck 1 PPG | Red vs. IR light, continuous or on-demand |
| ECG / EKG | Puck 1 ECG | Single-lead ECG, rhythm check, exportable report |
| Blood Pressure (PTT) | Puck 1 PPG+ECG | Pulse Transit Time from synchronized PPG+ECG |
| Respiratory Rate | Puck 1 PPG | Derived from PPG waveform modulation |
| Resting HR Trend | Puck 1 PPG | 7/30/90-day trend, fitness development |

### Sleep

| Feature | Sensor | Description |
|---------|--------|-------------|
| Sleep Phase Detection | IMU + Puck 1 + Puck 2 | Light, Deep (SWS), REM, Awake — from movement, HR, HRV, temp |
| Sleep Score (0–100) | All | Weighted score: duration, efficiency, phases, consistency |
| Sleep Duration vs. Need | Algo | Dynamic calculation based on strain and sleep debt |
| Sleep Consistency | Algo | Deviation from usual sleep/wake times |
| Sleep Disturbances | IMU | Wake events, restlessness phases |
| Optimal Bedtime | Algo | Recommendation based on strain, debt, rhythm |
| Nap Detection | IMU + Puck 1 | Automatic detection of daytime sleep |

### Recovery & Readiness

| Feature | Sensor | Description |
|---------|--------|-------------|
| Recovery Score (0–100) | All | Morning readiness: HRV, resting HR, sleep, temp, stress |
| Strain Score | Puck 1 + IMU | Cumulative daily load from HR zones and activity |
| Training Recommendation | Algo | Based on recovery: Full Send / Normal / Light / Rest |
| Recovery Time Estimate | Algo | Estimated hours until full recovery |
| Overtraining Warning | Algo | Trend analysis: HRV drop + resting HR rise + sleep decline |

### Activity & Fitness

| Feature | Sensor | Description |
|---------|--------|-------------|
| Step Counter | IMU | Hardware pedometer, daily goal |
| Activity Recognition (Auto) | IMU + Puck 1 | Walking, running, cycling, swimming, strength |
| Calorie Burn | IMU + Puck 1 | Active + resting calories, HR-based |
| Heart Rate Zones | Puck 1 | 5 zones, personalized by max HR or HRR |
| VO2max Estimate | Puck 1 + IMU | From submaximal HR response during activity |
| Workout Summary | All | Duration, HR, zones, calories, strain per workout |
| Weekly Activity Trend | Algo | Minutes in zones, training volume over time |

### Temperature & Body

| Feature | Sensor | Description |
|---------|--------|-------------|
| Skin Temperature (±0.1°C) | Puck 2 TMP117 | Continuous, NIST-traceable, medical-grade |
| Temperature Baseline | Algo | Personal average, deviation detection |
| Fever Early Warning | Algo | Alert at +0.3°C above baseline |
| Circadian Rhythm | Algo | Temp dip in deep sleep as sleep quality marker |
| Cycle Tracking (Basal Temp) | Puck 2 | Ovulation detection via temperature rise |
| Body Composition | Puck 3 AD5933 | Bioimpedance: fat percentage, muscle mass, hydration |

### Stress & Mental Health

| Feature | Sensor | Description |
|---------|--------|-------------|
| EDA Stress Level (Real-Time) | Puck 2 ADS1115 | Galvanic Skin Response, sympathetic nervous system |
| Stress Score (0–100) | Puck 2 + Puck 1 | Combined: EDA + HRV + HR for holistic score |
| Stress Timeline | Algo | When was stress high, when low throughout the day |
| Breathing / Meditation Guide | Puck 1 + Puck 2 | Guided breathing with real-time HRV and EDA feedback |
| Stress Resilience Score | Algo | Long-term trend: how fast your body recovers from stress |

### Health & Longevity

| Feature | Sensor | Description |
|---------|--------|-------------|
| Biological Age | Algo | From 12+ metrics: HRV, VO2max, sleep, resting HR, temp, body comp |
| Cardiovascular Age | Puck 1 | Heart-specific age from ECG + HRV + resting HR + vascular stiffness |
| Health Report (PDF) | All | Exportable report for your doctor, customizable time range |
| Illness Early Warning | Algo | Combined: temp + HRV + resting HR deviations |
| Sleep Diary | Algo | Caffeine, alcohol, meals — correlation with sleep quality |

### Women's Health

| Feature | Sensor | Description |
|---------|--------|-------------|
| Menstrual Cycle Phases | Puck 2 + Algo | Follicular, Ovulatory, Luteal, Menstruation |
| Ovulation Estimate | Puck 2 | Basal temperature rise as marker |
| Cycle Influence on Metrics | Algo | How cycle phases affect recovery, sleep, stress |
| Pregnancy Insights | Algo | Adjusted metrics and recommendations |

---

## Onboarding: Profile → Module Selection

On first launch, the user chooses their goal. The app automatically activates the right modules. No user configures modules manually.

| Profile | Activated Modules |
|---------|-------------------|
| **Fitness & Sport** | HR, HRV, HR Zones, Steps, Activity Recognition, Calories, Strain Score, Recovery Score, Training Rec, VO2max, Sleep Phases, Sleep Score, Sleep Need, Optimal Bedtime |
| **Health & Sleep** | Resting HR Trend, HRV Trend, SpO2, Sleep Phases, Sleep Score, Sleep Consistency, Sleep Disturbances, Temp Baseline, Fever Warning, Illness Warning, Health Report, Bio Age |
| **Stress Management** | EDA Stress, Stress Score, Stress Timeline, Breathing Guide, Stress Resilience, HRV, Sleep Score, Recovery Score, Sleep Diary |
| **Weight Management** | Body Composition, Calories, Activity Goal, Sleep Score, Stress Score, Weekly Activity Trend, Recovery Score |
| **Women's Health** | Cycle Phases, Ovulation Estimate, Cycle Influence, Temp Baseline, Sleep Score, Stress Score, Recovery Score |

Every profile can be changed at any time. Modules are added/removed instantly. Previously collected sensor data is preserved.

---

## Technical Architecture

### Layer 1: Firmware (XIAO nRF52840)

Reads sensors, streams raw data over BLE. Knows nothing about modules, profiles, or features. Pure data proxy.

- Custom BLE GATT Service with one characteristic per sensor
- Sampling: PPG 100 Hz, ECG 200 Hz, Temperature 1 Hz, EDA 10 Hz, IMU 50 Hz

### Layer 2: App — Data Layer

Receives BLE raw data, stores locally in SQLite/Realm. No cloud. All data on device.

- Schema: timestamp + sensor_id + raw_data
- API for modules: time ranges, aggregations, streaming

### Layer 3: App — Module Engine

Loads modules based on user profile and detected sensors. Each module implements:

```
requiredSensors() → which pucks are needed
process(data)     → algorithm computation
output()          → card data for dashboard
```

Modules run locally, isolated, can be activated/deactivated at runtime.

### Layer 4: App — Presentation Layer

Dashboard with cards. Each card is the visualization of a module's output.

- **Order**: Most important on top, time-dependent (morning: Sleep Score, midday: Stress, evening: Training Rec)
- **"For You"**: Curated community modules based on profile
- **Developer Mode**: Raw data viewer, API docs, module upload

### Layer 5: Developer SDK & Algorithm Hub

- SDK in JavaScript/Python
- Access to all sensor data via documented API
- Module template with `requiredSensors()`, `process()`, `output()`
- Publication via GitHub PR to the OpenPulse Algorithm Hub
- Three trust levels:

| Level | Visibility | How to reach |
|-------|------------|-------------|
| **Verified** | Pre-installed | Core team reviewed + tested |
| **Community-Reviewed** | "For You" section | Community review + automated tests |
| **Experimental** | Developer mode only | Any published module |

---

## Project Structure

```
Openpulse/
├── .agents/skills/openpulse_algorithm/   # AI Algorithm Builder Skill
│   ├── SKILL.md                          # Master rules (medical, privacy, firmware)
│   ├── templates/
│   │   └── spec_template.md              # Blank algorithm spec template
│   ├── examples/
│   │   └── A01_heart_rate_spec.md        # Reference spec (shows expected detail)
│   └── resources/
│       ├── AlgorithmBase.h               # Shared types, state machine, base class
│       ├── RingBuffer.h                  # Timestamped circular buffer + stats
│       ├── SensorDriverBase.h            # Sensor driver interfaces (mockable)
│       └── algorithm_registry.md         # Master tracker for all 72 algorithms
├── firmware/
│   ├── sensor_dashboard.ino              # Main firmware (BLE + sensors + algorithms)
│   └── imu_test/
│       └── imu_test.ino                  # Standalone IMU diagnostic sketch
├── dashboard/
│   ├── index.html                        # Dashboard UI (9 sensor cards)
│   ├── style.css                         # Styling (light/dark theme)
│   └── app.js                            # Web Bluetooth + data visualization
└── README.md
```

---

## Quick Start (Dev Prototype)

### 1. Flash Firmware

**Requirements:**
- Arduino IDE with **Seeed nRF52 mbed-enabled Boards** package
- Libraries: `ArduinoBLE`, `SparkFun MAX3010x`, `Adafruit BME280`, `Adafruit MCP9808`, `Adafruit Unified Sensor`
- Sense variant: `Seeed Arduino LSM6DS3` ([patch required](#lsm6ds3-library-patch))

**Steps:**
1. Open `firmware/sensor_dashboard.ino` in Arduino IDE
2. Select **Seeed XIAO nRF52840 Sense** board
3. Upload

### 2. Open Dashboard

1. Open `dashboard/index.html` in **Chrome/Edge/Brave** (Web Bluetooth required)
2. Click **Connect** → pair with "SensorDash"
3. Live data appears automatically

---

## Current Features (v5 Dev Prototype)

### Firmware
- **Real SpO2** — AC/DC ratio algorithm using Red/IR channels (R-value → `SpO2 = 104 - 17·R`)
- **Stable Heart Rate** — 8-beat rolling average, 300ms beat debounce, outlier rejection (40–180 BPM), gap detection
- **IMU with Power Management** — explicit power pin (pin 15) with nRF52840 high-drive GPIO, retry with power cycle on init failure
- **PDM Microphone** — 16 kHz mono sampling, RMS → dB sound level calculation
- **BLE Stability** — 5ms delays between characteristic writes, 750ms update interval, connection watchdog, auto re-advertising
- **Round-Robin Sensor Reads** — 4-slot cycle (BME280 → MCP9808 → IMU → Mic) prevents I2C blocking

### Dashboard
- **9 Sensor Cards** — HR, SpO2, Temperature, Humidity, Pressure, Precision Temp, Accelerometer, Gyroscope, Sound Level
- **Real-time Sparklines** — Canvas API charts with 60-point history
- **Auto-Reconnect** — 3 retry attempts with 2s delay on BLE drop
- **Resilient Polling** — individual characteristic errors don't crash the polling loop
- **Light/Dark Theme** — toggleable, persisted in localStorage
- **Debug Panel** — raw BLE hex data with timestamps

---

## LSM6DS3 Library Patch

The Seeed Arduino LSM6DS3 library has a compilation error on mbed-based nRF52840 boards. Apply this one-line fix:

**File:** `LSM6DS3.cpp` (in your Arduino libraries folder)  
**Line ~107:** Change `#else` to `#elif !defined(ARDUINO_ARCH_MBED)`

```diff
 #ifdef ESP32
             SPI.setBitOrder(SPI_MSBFIRST);
 #elif defined(ARDUINO_XIAO_RA4M1)
             // noting
-#else
+#elif !defined(ARDUINO_ARCH_MBED)
             SPI.setBitOrder(MSBFIRST);
 #endif
```

---

## Algorithm Builder Skill

The `.agents/skills/openpulse_algorithm/` directory contains an AI skill that automates algorithm development while enforcing quality standards.

### What It Does

You write a **spec file** (structured markdown describing the algorithm). The skill reads the spec and generates medically-correct firmware code following strict rules.

### Skill Components

| File | Purpose |
|------|---------|
| `SKILL.md` | 10-section master rulebook: medical correctness, privacy, firmware engineering, signal processing, code generation, review checklist |
| `templates/spec_template.md` | Blank algorithm spec — fill in to define any new algorithm |
| `examples/A01_heart_rate_spec.md` | Complete reference spec (adaptive peak detection, SQI computation, 7 test vectors) |
| `resources/AlgorithmBase.h` | Shared C++ types: `AlgorithmOutput`, `CalibratedOutput`, `AlgoState`, `AlgoTier`, base class |
| `resources/RingBuffer.h` | Timestamped circular buffer with stats + cross-sensor interpolation |
| `resources/SensorDriverBase.h` | Typed driver interfaces: `PPGECGDriver`, `TempDriver`, `EDADriver`, `BioimpedanceDriver`, `IMUDriver`, `MicDriver` |
| `resources/algorithm_registry.md` | Master tracker for all 72 algorithms — status, specs, progress |

### Key Rules Enforced

**Medical Correctness**
- Every formula cites a peer-reviewed paper or manufacturer app note
- All outputs clamped to physiological ranges (HR: 30–220, SpO2: 70–100, etc.)
- Signal Quality Index (SQI, 0.0–1.0) on every output — below 0.4 = suppressed
- Health Screening algorithms require "not a medical device" disclaimer

**Privacy**
- All processing on-device — no cloud, no servers, no internet dependency
- No PII in BLE payloads — only computed float values
- User data in localStorage/SQLite only, deletable via single button

**Firmware Safety (nRF52840: 256KB RAM)**
- No `malloc`/`new` in loop — all buffers statically allocated
- No `delay()` — state machines only
- Motion artifact rejection for all PPG/ECG algorithms
- 5+ test vectors per algorithm

### How to Use

```bash
# 1. Copy spec template
cp .agents/skills/openpulse_algorithm/templates/spec_template.md \
   algorithms/A03_spo2/spec.md

# 2. Fill in every field (see examples/A01_heart_rate_spec.md for reference)

# 3. Tell AI: "Using the openpulse_algorithm_builder skill,
#    implement algorithm A03 from its spec"

# 4. Update algorithm_registry.md with new status

# 5. Flash, test, validate
```

---

## Implementation Roadmap

### Phase 1: MVP — Now → Q2 2026

BLE dashboard, raw data streaming, basic metrics live on screen.

| Task | Status |
|------|--------|
| BLE firmware (sensor read + stream) | ✅ Done (v5) |
| Web Dashboard (9 sensor cards) | ✅ Done |
| Real SpO2 + stable HR algorithms | ✅ Done |
| IMU + PDM microphone integration | ✅ Done |
| Algorithm Builder Skill | ✅ Done |
| Write driver specs for new sensors (MAX86150, TMP117, ADS1115, AD5933) | Pending |
| Implement + validate all drivers | Pending |
| Write specs for P0 base algorithms (HR, SpO2, Steps, EDA, Temp) | Pending |
| Implement P0 base algorithms | Pending |

### Phase 2: Base App — Q3 2026

React Native or Flutter app. Onboarding with profile selection. Automatic sensor detection.

| Task | Status |
|------|--------|
| Mobile app scaffold (React Native / Flutter) | Pending |
| Onboarding flow with 5 profiles | Pending |
| Auto sensor detection via BLE scan | Pending |
| Module engine (`requiredSensors`, `process`, `output`) | Pending |
| Local data storage (SQLite/Realm) | Pending |
| 15–20 verified modules integrated | Pending |
| Dashboard with time-dependent card ordering | Pending |
| PDF + CSV export | Pending |

### Phase 3: Algorithm SDK — Q4 2026

Module interface specified and documented. SDK for community developers.

| Task | Status |
|------|--------|
| Module interface specification | Pending |
| JavaScript SDK with documented API | Pending |
| 3 reference open-source modules (advanced sleep, running pace, sport plugin) | Pending |
| Developer mode in app (raw data viewer, API docs, module upload) | Pending |
| Module validation + automated testing pipeline | Pending |

### Phase 4: Algorithm Hub — 2027

GitHub repository for community algorithms. Review process for trust level progression.

| Task | Status |
|------|--------|
| Algorithm Hub GitHub repository | Pending |
| Review process: Experimental → Community-Reviewed → Verified | Pending |
| "For You" curation in app based on profile | Pending |
| Research mode with group dashboard and real-time streaming | Pending |

---

## Changelog

### v5 (March 2026)
- **IMU Power Fix**: explicit pin 15 management with nRF52840 high-drive GPIO register config, retry with full power cycle on init failure
- **PDM Microphone**: 16 kHz mono sampling via interrupt callback, RMS → dB sound level (`dB = 20·log10(rms/32767) + 120`), new BLE characteristic (UUID `...def9`)
- **Sound Level Card**: new dashboard card with microphone icon, rose accent color, sparkline, min/max/avg stats
- **4-Slot Round-Robin**: sensor cycle expanded to BME280 → MCP9808 → IMU → Mic
- **Algorithm Builder Skill**: created `.agents/skills/openpulse_algorithm/` with SKILL.md, spec template, example spec, AlgorithmBase.h, RingBuffer.h

### v4 (March 2026)
- **Real SpO2**: replaced simulated values with AC/DC ratio algorithm (Red/IR R-value → `SpO2 = 104 - 17·R`, clamped 70–100%)
- **Stable Heart Rate**: 8-beat rolling average (was 4), 300ms beat debounce, 2s gap detection, outlier rejection, requires 4 valid beats before reporting
- **BLE Stability**: 5ms delays between characteristic writes, 750ms update interval (was 500ms), mid-write connection checks, connection watchdog with auto re-advertising
- **Auto-Reconnect**: dashboard retries up to 3 times with 2s delay on BLE drop
- **Resilient Polling**: individual characteristic read failures no longer crash the entire polling loop

### v3 (March 2026)
- Initial sensor dashboard with MAX30102, BME280, MCP9808, LSM6DS3TR-C
- Web Bluetooth dashboard with 8 sensor cards
- Light/dark theme, debug panel, sparkline charts

---

## Tech Stack

- **Firmware:** Arduino C++ (ArduinoBLE, I2C, PDM)
- **Dashboard (Dev):** Vanilla HTML/CSS/JS (no frameworks, no build step)
- **App (Production):** React Native or Flutter
- **Database:** SQLite / Realm (local only, no cloud)
- **Communication:** Bluetooth Low Energy (GATT)
- **Algorithm Dev:** AI skill with medical validation rules
- **SDK:** JavaScript / Python
- **Target:** Seeed XIAO nRF52840 Sense

---

*Three slots. Six sensors. 51+ modules. Your configuration. No subscription. Your data. Open source.*
