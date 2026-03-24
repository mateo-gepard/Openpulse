// ═══════════════════════════════════════════════════════════════
// OpenPulse Firmware — Channel-Based Orchestrator
//
// This file does ONLY wiring:
//   1. Init buses (I2C, PDM, BLE)
//   2. Detect which chips are connected → map to channels
//   3. Init only those drivers
//   4. Register channels with BLE service
//   5. Loop: read drivers → broadcast channels via BLE
//
// No sensor logic. No algorithm logic. No chip names in the
// main flow — everything references data channels.
// ═══════════════════════════════════════════════════════════════

#include <Wire.h>
#include <PDM.h>
#include <ArduinoBLE.h>

// Framework
#include "src/framework/Channels.h"
#include "src/framework/PuckDetector.h"
#include "src/framework/Scheduler.h"

// BLE
#include "src/ble/BLEService.h"

// Drivers — all known drivers are included; only detected ones init
#include "src/drivers/Driver_MAX86150.h"
#include "src/drivers/Driver_TMP117.h"
#include "src/drivers/Driver_ADS1115.h"
#include "src/drivers/Driver_AD5933.h"
#include "src/drivers/Driver_LSM6DS3.h"
#include "src/drivers/Driver_PDM.h"

// ─── Global State ─────────────────────────────────────────────
SensorConfig  sensorConfig;
OpenPulseBLE  ble;
Scheduler     scheduler;

// Driver instances — one per known chip
// Only the ones for detected chips get init'd
Driver_MAX86150  drv_max86150;
Driver_TMP117    drv_tmp117;
Driver_ADS1115   drv_ads1115;
Driver_AD5933    drv_ad5933;
Driver_LSM6DS3   drv_lsm6ds3;
Driver_PDM       drv_pdm;

// Driver table: maps PuckDetector chip indices → driver instances
// Order MUST match KNOWN_CHIPS[] in PuckDetector.h
SensorDriverBase* DRIVER_TABLE[] = {
    &drv_max86150,   // [0] MAX86150
    nullptr,         // [1] MAX30102 — TODO: write Driver_MAX30102.h
    &drv_tmp117,     // [2] TMP117
    nullptr,         // [3] MCP9808  — TODO: write Driver_MCP9808.h
    nullptr,         // [4] BME280   — TODO: write Driver_BME280.h
    &drv_ads1115,    // [5] ADS1115
    &drv_ad5933,     // [6] AD5933
    &drv_lsm6ds3,    // [7] LSM6DS3
    &drv_pdm,        // [8] PDM
};
static constexpr uint8_t DRIVER_COUNT = sizeof(DRIVER_TABLE) / sizeof(DRIVER_TABLE[0]);

// Active drivers (only the ones that init'd successfully)
SensorDriverBase* activeDrivers[DRIVER_COUNT] = {};
uint8_t activeDriverCount = 0;

// Timing
uint32_t lastBLE = 0;
const uint32_t BLE_INTERVAL = 100;  // 10 Hz

// ═══════════════════════════════════════════════════════════════
void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println(F("\n══════════════════════════════════"));
    Serial.println(F("  OpenPulse Firmware v6"));
    Serial.println(F("  Channel-Based Architecture"));
    Serial.println(F("══════════════════════════════════"));

    // ── Init buses ─────────────────────────────────────────
    Wire.begin();
    Wire.setClock(400000);
    Wire1.begin();
    Wire1.setClock(400000);

    // ── Detect hardware → channels ─────────────────────────
    sensorConfig = PuckDetector::scan();
    PuckDetector::printReport(sensorConfig);

    // ── Init detected drivers ──────────────────────────────
    for (uint8_t i = 0; i < DRIVER_COUNT; i++) {
        if (!sensorConfig.chipDetected[i]) continue;
        if (!DRIVER_TABLE[i]) {
            Serial.print(F("[SKIP] No driver for "));
            Serial.println(KNOWN_CHIPS[i].name);
            continue;
        }
        if (DRIVER_TABLE[i]->init()) {
            activeDrivers[activeDriverCount++] = DRIVER_TABLE[i];
            Serial.print(F("[OK] "));
            Serial.println(KNOWN_CHIPS[i].name);
        } else {
            Serial.print(F("[FAIL] "));
            Serial.println(KNOWN_CHIPS[i].name);
            // Disable channels from this chip
            for (uint8_t ch = 0; ch < (uint8_t)ChannelID::CHANNEL_COUNT; ch++) {
                if (sensorConfig.chipForChannel[ch] == i) {
                    sensorConfig.activeChannels &= ~(1 << ch);
                }
            }
        }
    }

    // ── Init BLE with active channels ──────────────────────
    if (!ble.init(sensorConfig)) {
        Serial.println(F("[FATAL] BLE init failed"));
        while (1) delay(1000);
    }
    Serial.print(F("[BLE] "));
    Serial.print(ble.characteristicCount());
    Serial.println(F(" channel(s) active"));
    Serial.println(F("──────────────────────────────────"));
    Serial.println(F("Ready. Waiting for connection..."));
}

// ═══════════════════════════════════════════════════════════════
void loop() {
    uint32_t now = millis();

    // ── Update all active drivers ──────────────────────────
    for (uint8_t i = 0; i < activeDriverCount; i++) {
        activeDrivers[i]->update(now);
    }

    // ── Update scheduler (algorithms) ──────────────────────
    scheduler.tick(now);

    // ── BLE broadcast by channel ───────────────────────────
    if (now - lastBLE >= BLE_INTERVAL && ble.isConnected()) {
        lastBLE = now;

        for (uint8_t i = 0; i < activeDriverCount; i++) {
            SensorDriverBase* drv = activeDrivers[i];
            if (drv->getStatus() != DriverStatus::RUNNING) continue;

            ChannelMask chs = drv->getChannels();

            // Scalar channels
            for (uint8_t ch = 0; ch < (uint8_t)ChannelID::CHANNEL_COUNT; ch++) {
                if (!(chs & (1 << ch))) continue;
                ChannelType ctype = CHANNEL_TABLE[ch].type;
                if (ctype == ChannelType::SCALAR || ctype == ChannelType::MULTI) {
                    ble.writeScalar((ChannelID)ch, drv->getLatest().value);
                } else if (ctype == ChannelType::VEC3) {
                    MultiSample ms = drv->getLatestMulti();
                    if (ms.valid) {
                        ble.writeVec3((ChannelID)ch, ms.channels[0], ms.channels[1], ms.channels[2]);
                    }
                }
            }
        }
    }

    ble.poll();
}
