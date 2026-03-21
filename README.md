# OpenPulse — Sensor Dev Dashboard

> ⚠️ **This is a development tool** — part of the larger OpenPulse project. It serves as a real-time debugging and visualization dashboard for sensor data during hardware prototyping.

## Overview

A Web Bluetooth dashboard that connects to a **Seeed XIAO nRF52840** (or Sense variant) running custom BLE firmware. It reads and visualizes data from multiple I2C sensors in real time.

![Status](https://img.shields.io/badge/status-dev%20prototype-orange)
![Platform](https://img.shields.io/badge/platform-XIAO%20nRF52840-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Supported Sensors

| Sensor | Measures | I2C Address | Bus |
|--------|----------|-------------|-----|
| MAX30102 | Heart Rate, SpO2 | 0x57 | Wire (external) |
| BME280 | Temperature, Humidity, Pressure | 0x76/0x77 | Wire (external) |
| MCP9808 | Precision Temperature | 0x18 | Wire (external) |
| LSM6DS3TR-C | Accelerometer, Gyroscope | 0x6A | Wire1 (onboard, Sense only) |

## Project Structure

```
sensor-dashboard/
├── firmware/
│   ├── sensor_dashboard.ino    # Arduino firmware (BLE + sensor reads)
│   └── imu_test/
│       └── imu_test.ino        # Standalone IMU diagnostic sketch
└── dashboard/
    ├── index.html              # Dashboard UI
    ├── style.css               # Styling (light/dark theme)
    └── app.js                  # Web Bluetooth + data visualization
```

## Quick Start

### 1. Flash Firmware

**Requirements:**
- Arduino IDE with **Seeed nRF52 mbed-enabled Boards** package
- Libraries: `ArduinoBLE`, `SparkFun MAX3010x`, `Adafruit BME280`, `Adafruit MCP9808`, `Adafruit Unified Sensor`
- Optional (Sense variant only): `Seeed Arduino LSM6DS3` ([patch required](#lsm6ds3-library-patch))

**Steps:**
1. Open `firmware/sensor_dashboard.ino` in Arduino IDE
2. Select **Seeed XIAO nRF52840 Sense** (or non-Sense) board
3. Upload

### 2. Open Dashboard

1. Open `dashboard/index.html` in **Chrome/Edge/Brave** (Web Bluetooth required)
2. Click **Connect** → pair with "SensorDash"
3. Live data appears automatically

## Features

- **Real-time visualization** — sparkline charts for all sensor data (last 60 data points)
- **Light/Dark theme** — toggleable, persisted in localStorage
- **Closable debug panel** — raw BLE hex data with timestamps
- **Auto-reset on reconnect** — graphs and stats clear on each new connection
- **Finger detection** — HR only reports when finger is on the MAX30102 (IR threshold + 3s timeout)
- **BLE stability** — round-robin sensor reads with frequent `BLE.poll()` calls
- **IMU support** — 3-axis accelerometer/gyroscope with multi-color sparklines (Sense variant)

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

## Tech Stack

- **Firmware:** Arduino C++ (ArduinoBLE, I2C)
- **Dashboard:** Vanilla HTML/CSS/JS (no frameworks, no build step)
- **Communication:** Bluetooth Low Energy (GATT)
- **Visualization:** Canvas API sparklines

---

*Part of the OpenPulse project — this dashboard is a development/debugging tool, not the end-user interface.*
