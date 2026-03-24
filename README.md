# OpenPulse

> **Open-source biometric sensor platform** — real-time health monitoring with cross-sensor fusion.  
> 72 algorithms. 23 exclusive. No subscription. Your data. Open source.

![Status](https://img.shields.io/badge/status-dev%20prototype-orange)
![Platform](https://img.shields.io/badge/platform-XIAO%20nRF52840-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## What Is OpenPulse?

OpenPulse is the only consumer-grade health tracker that combines **synchronized PPG+ECG, EDA, precision skin temperature, bioimpedance, a 6-axis IMU, and a PDM microphone** in a single device. This unique sensor combination enables **23 cross-sensor fusion features** that no other tracker in the world can offer.

The platform consists of:
- **Firmware** — Arduino C++ running on a Seeed XIAO nRF52840 Sense
- **Web Dashboard** — real-time Bluetooth LE visualization (no app store, no account, no cloud)
- **Algorithm Catalog** — 72 biomedical algorithms built on top of the hardware

---

## Current Hardware (Dev Prototype)

| Sensor | Chip | Position | Measures | Interface |
|--------|------|----------|----------|-----------|
| PPG (Red + IR) | MAX30102 | External | Heart Rate, SpO2 | Wire, 0x57 |
| Temperature | BME280 | External | Temp, Humidity, Pressure | Wire, 0x76 |
| Precision Temp | MCP9808 | External | ±0.25°C Temperature | Wire, 0x18 |
| 6-Axis IMU | LSM6DS3TR-C | Onboard | Accelerometer, Gyroscope | Wire1, 0x6A |
| Microphone | PDM (integrated) | Onboard | Sound Level (dB) | Digital PDM |

### Planned Hardware (Next Generation)

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

## Project Structure

```
Openpulse/
├── firmware/
│   ├── sensor_dashboard.ino    # Main firmware (BLE + sensors + algorithms)
│   └── imu_test/
│       └── imu_test.ino        # Standalone IMU diagnostic sketch
├── dashboard/
│   ├── index.html              # Dashboard UI (9 sensor cards)
│   ├── style.css               # Styling (light/dark theme)
│   └── app.js                  # Web Bluetooth + data visualization
└── README.md
```

---

## Quick Start

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

## Current Features (v5)

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

## Algorithm Catalog — 72 Algorithms

The full OpenPulse algorithm set, designed for the next-generation multi-puck hardware. **23 are cross-sensor fusion features** that are only possible because of OpenPulse's unique sensor combination.

### Puck 1: Heart Algorithms (PPG + ECG via MAX86150)

| ID | Feature | Input | Description |
|----|---------|-------|-------------|
| A01 | Heart Rate (Real-Time) | PPG | Peak detection, moving average, outlier filtering |
| A02 | Heart Rate Variability (HRV) | PPG/ECG | R-R intervals → RMSSD, SDNN, pNN50, LF/HF ratio |
| A03 | Blood Oxygen (SpO2) | PPG Red+IR | Beer-Lambert law, calibration curve |
| A04 | Respiratory Rate | PPG modulation | Respiratory sinus arrhythmia, bandpass 0.1–0.5 Hz |
| A05 | ECG Rhythm Check | ECG | On-demand QRS detection, irregularity detection, PDF export |
| A06 | Resting HR Trend | PPG (night) | Lowest 5-min average during sleep over 7/30/90 days |
| A07 | PPG Waveform Analysis | PPG raw | Augmentation index, dicrotic notch, SDPPG vascular index |
| A08 | Vascular Age | PPG raw | SDPPG a/b-ratio → arterial stiffness vs. age norms |
| A09 | Perfusion Index (PI) | PPG amplitude | Pulsatile vs. non-pulsatile signal ratio |

### Cross-Sensor: PPG × ECG (Puck 1 Internal)

These algorithms exploit the **synchronized PPG+ECG** capture of the MAX86150 — the feature that separates OpenPulse from every competitor.

| ID | Feature | Input | Description |
|----|---------|-------|-------------|
| X01 | Blood Pressure (PTT) | ECG R-peak + PPG foot | Pulse Transit Time → SBP/DBP estimation. RMSE ~3–5 mmHg after calibration |
| X02 | Arterial Stiffness (PWV) | ECG + PPG sync | Pulse Wave Velocity from PTT + estimated path length |
| X03 | Pre-Ejection Period (PEP) | ECG Q-onset + PPG | Cardiac contractility and sympathetic activation marker |
| X04 | Cardiac Output Estimate | ECG + PPG morphology | HR × stroke volume estimate (PPG amplitude + PEP) |
| X05 | Autonomic Balance (SNS/PNS) | ECG HRV + PPG PTT | LF/HF ratio + PEP + PTT variability → sympathetic vs. parasympathetic |

### Puck 2: Temperature + Stress Algorithms

| ID | Feature | Input | Description |
|----|---------|-------|-------------|
| A10 | Skin Temperature Baseline | TMP117 | Personal 14-day average, deviations >0.3°C flagged |
| A11 | Fever Early Warning | TMP117 trend | Rising temp deviation + resting HR rise + HRV drop |
| A12 | Circadian Rhythm Score | TMP117 24h | Amplitude/timing of nighttime temperature dip |
| A13 | Ovulation Detection | TMP117 basal | 0.2–0.5°C post-ovulation rise, held 10+ days. ±0.1°C precision |
| A14 | EDA Stress Level (Real-Time) | ADS1115 | Tonic EDA baseline + phasic EDA peaks |
| A15 | EDA Stress Timeline | ADS1115 + time | Daily stress pattern recognition |
| A16 | Relaxation Biofeedback | ADS1115 live | Real-time EDA during breathing/meditation exercises |
| A17 | Sleep EDA Patterns | ADS1115 (night) | EDA storms correlate with emotional processing and deep sleep |

### Cross-Sensor: Heart × Temperature × Stress

**No competitor** has PPG+ECG+EDA+precision temperature simultaneously.

| ID | Feature | Input | Description |
|----|---------|-------|-------------|
| X06 | Stress vs. Exercise | EDA + HR + IMU | High HR + high EDA + no motion = mental stress. High HR + low EDA + motion = physical exertion. **No other tracker can distinguish these.** |
| X07 | Multi-Signal Illness Warning | Temp + HRV + resting HR + EDA | Four signals combined detect illness up to 48h before symptoms |
| X08 | Autonomic Nervous System Mapping | ECG HRV + EDA + Temp | Three independent windows into the ANS: parasympathetic, sympathetic, thermoregulatory |
| X09 | Recovery Score (Multi-Signal) | All Puck 1+2 + IMU | Night HRV (40%) + resting HR trend (15%) + sleep quality (20%) + temp rhythm (10%) + morning EDA (15%) |
| X10 | Strain Score (Multi-Signal) | HR + EDA + IMU + Temp | Physical + mental + thermoregulatory load — 3 dimensions vs. 1 |
| X11 | Sleep Phases (5-Signal) | IMU + HR + HRV + Temp + EDA | Most accurate consumer sleep staging: movement + HR dip + HRV patterns + temp dip + EDA storms |
| X12 | Biological Age | All sensors | 12+ biomarkers: vascular age, resting HR, HRV, PTT-BP, sleep, VO2max, stress resilience, temp rhythm, EDA, body composition |
| X13 | Chronotype Detection | Temp 24h + HRV 24h + IMU | Circadian rhythm timing → lark/owl/normal classification |
| X14 | Stress Resilience Score | EDA + HRV recovery speed | How fast EDA and HRV normalize after stress. Long-term trend |

### Puck 3: Bioimpedance + Cross-Sensor

| ID | Feature | Input | Description |
|----|---------|-------|-------------|
| A18 | Body Fat Percentage | AD5933 | Bioimpedance at 50 kHz + height/weight → total body water → fat-free mass |
| A19 | Muscle Mass Estimate | AD5933 | Fat-free mass proxy, trend over weeks |
| A20 | Hydration Level | AD5933 | Total body water trend, dehydration detection |
| X15 | Hydration + Temperature | AD5933 + TMP117 | Falling impedance + rising temp = dehydration warning |
| X16 | Body Composition + Activity | AD5933 + IMU + HR | Correlates body comp changes with training volume |

### XIAO Internal: IMU + Microphone

| ID | Feature | Input | Description |
|----|---------|-------|-------------|
| A21 | Step Counter | IMU Accel | Peak detection, bandpass 0.5–3 Hz, adaptive threshold |
| A22 | Activity Recognition | IMU 6-axis | Classification: standing, walking, running, cycling, lying |
| A23 | Sleep Detection | IMU + HR | Low movement + falling HR + lying position |
| A24 | Calorie Burn | IMU + HR | Activity minutes × HR-based energy expenditure |
| A25 | Snoring Detection | PDM Mic | Audio envelope analysis, 100–800 Hz frequency analysis |
| A26 | Workout Detection + HR Zones | IMU + Puck 1 | Auto start/stop, live HR zones, summary |
| A27 | Running Cadence | IMU Accel | Steps/minute during running (optimal: 170–180 spm) |
| X17 | Sleep Apnea Screening | Mic + SpO2 + HR | Snoring patterns + SpO2 drops + HR spikes = apnea event counting |

### Composite Algorithms (Highest Level)

These are systems of multiple algorithms working together — the reason a user opens the app.

| ID | Feature | Base Algorithms | Description |
|----|---------|-----------------|-------------|
| C01 | Recovery Score (0–100) | A02+A06+A10+A12+A14+A23 → X09 | 6 signal sources vs. 3 at Whoop |
| C02 | Strain Score (0–21) | A01+A14+A22+A24 → X10 | 3 dimensions vs. 1 at Whoop |
| C03 | Sleep Score (0–100) | A23+A02+A04+A12+A17 → X11 | 5-signal sleep phases |
| C04 | Biological Age | A07+A08+A02+A06+X01+A12+A14+A18 → X12 | 12+ biomarkers |
| C05 | Cardiovascular Age | A07+A08+X01+X02+X03+A06 | 6 cardiac metrics — no competitor has all |
| C06 | Training Recommendation | C01+C02+A22 | Full send / Normal / Light / Rest |
| C07 | Sleep Recommendation | C03+C02+A12 | Optimal bedtime + duration target |
| C08 | Health Report (PDF) | All C-scores + trends | Exportable 2-week/monthly report for doctors |
| C09 | Women's Health | A13+A12+C01+C03+A14 | Cycle phases + impact on recovery, sleep, stress |
| C10 | Personalized Insights | All + user profile | Context-aware: morning recovery, midday stress, evening sleep |

---

## Algorithm Factory — Development Strategy

Building 72 algorithms requires a systematic, repeatable process. Here's the architecture.

### Spec-First Development

Every algorithm is defined in a structured **spec file** before any code is written:

```
algorithms/A01_heart_rate/
├── spec.md          ← Contract: what to build
├── references.md    ← Literature, formulas, validation data
├── firmware.cpp     ← Generated implementation
├── firmware.h       ← Generated header
└── test_vectors.h   ← Known-good input→output pairs
```

The spec template forces decisions on: sensor input, sample rate, algorithm method, output format, edge cases, medical references, and test vectors — **before** any code is generated.

### Dependency Graph & Build Order

Algorithms must be built bottom-up in 4 phases:

| Phase | What | Count | Prerequisite |
|-------|------|-------|-------------|
| **P0: Drivers** | Raw sensor I2C/SPI read + ring buffers | 6 | Hardware on hand |
| **P1: Base** | Single-sensor algorithms (A01–A27) | 27 | Drivers working |
| **P2: Cross-Sensor** | Multi-sensor fusion (X01–X17) | 17 | Base algorithms stable |
| **P3: Composite** | Score systems (C01–C10) | 10 | Cross-sensor validated |

### Firmware Architecture: How 72 Algorithms Fit on nRF52840

The nRF52840 has 256KB RAM — not enough for 72 algorithms simultaneously. Solution: **tiered scheduling**.

| Tier | Execution | Examples | RAM |
|------|-----------|----------|-----|
| **Tier 0: Always On** | Every loop iteration | HR, SpO2, Steps | ~2 KB |
| **Tier 1: Periodic** | Round-robin, 1–5 Hz | HRV, Resp, Temp, EDA, PTT | ~4 KB |
| **Tier 2: On-Demand** | User triggered | ECG Check, Body Fat, Vascular Age | ~8 KB (alloc/free) |
| **Tier 3: Off-Device** | Phone/Dashboard | Composite scores, PDF reports, Bio Age | 0 KB |

### Cross-Sensor Timing

Sensors run at different rates (PPG@100Hz, EDA@10Hz, Temp@1Hz). Solution: **timestamped ring buffers** with interpolation.

```cpp
struct SensorSample {
    uint32_t timestamp_ms;
    float    value;
};
```

Cross-sensor algorithms interpolate to align data from different sample rates.

### Medical Validation Checklist

Every algorithm must pass:

| Check | Description |
|-------|-------------|
| Range clamping | Output never exceeds physiological limits |
| No-data handling | Explicit 0 / NaN / "--" when signal absent |
| Motion rejection | IMU gates PPG/ECG during movement |
| Literature reference | Every formula traced to a published paper |
| Disclaimer | "Not a medical device" on all user-facing output |
| Unit tests | At least 3 test vectors: normal, edge, failure |
| Saturation handling | Graceful behavior on ADC-clipped signals |

---

## What No Competitor Can Do

| Feature | OpenPulse | Others |
|---------|-----------|--------|
| Blood Pressure via PTT (sync PPG+ECG) | ✅ Exclusive | Impossible |
| True Stress vs. Physical Exertion (EDA+HR+IMU) | ✅ Exclusive | Impossible |
| Multi-Signal Illness Warning (4 signals) | ✅ Exclusive | 1–2 signals |
| 5-Signal Sleep Phases | ✅ Exclusive | 2–3 signals max |
| ANS Mapping (ECG+EDA+Temp) | ✅ Exclusive | No consumer device |
| Cardiovascular Age from 6 heart metrics | ✅ Exclusive | Incomplete inputs |
| Sleep Apnea Screening (Mic+SpO2+HR) | ✅ Exclusive | Missing signals |
| Hydration Warning (Bioimpedance+Temp) | ✅ Exclusive | No one has both |
| Biological Age from 12+ biomarkers | ✅ 12+ | Whoop: 9, Oura: ~5 |
| 3D Strain Score (physical+mental+thermo) | ✅ 3 dimensions | Physical only |

---

## Tech Stack

- **Firmware:** Arduino C++ (ArduinoBLE, I2C, PDM)
- **Dashboard:** Vanilla HTML/CSS/JS (no frameworks, no build step)
- **Communication:** Bluetooth Low Energy (GATT, 9 characteristics)
- **Visualization:** Canvas API sparklines
- **Target:** Seeed XIAO nRF52840 Sense

---

*72 algorithms. 23 exclusive. No subscription. Your data. Open source.*
