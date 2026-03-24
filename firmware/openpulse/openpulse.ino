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
#include "src/drivers/Driver_MAX30102.h"
#include "src/drivers/Driver_TMP117.h"
#include "src/drivers/Driver_MCP9808.h"
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
Driver_MAX30102  drv_max30102;
Driver_TMP117    drv_tmp117;
Driver_MCP9808   drv_mcp9808;
Driver_ADS1115   drv_ads1115;
Driver_AD5933    drv_ad5933;
Driver_LSM6DS3   drv_lsm6ds3;
Driver_PDM       drv_pdm;

// Driver table: maps PuckDetector chip indices → driver instances
// Order MUST match KNOWN_CHIPS[] in PuckDetector.h
SensorDriverBase* DRIVER_TABLE[] = {
    &drv_max86150,   // [0] MAX86150
    &drv_max30102,   // [1] MAX30102
    &drv_tmp117,     // [2] TMP117
    &drv_mcp9808,    // [3] MCP9808
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
uint32_t lastStatusLog = 0;
const uint32_t STATUS_LOG_INTERVAL = 3000;  // 3s heartbeat
bool bootSummaryPrinted = false;

// ═══════════════════════════════════════════════════════════════
void setup() {
    Serial.begin(115200);
    // Wait for USB CDC serial (up to 3s, then continue anyway)
    uint32_t serialWait = millis();
    while (!Serial && (millis() - serialWait < 3000)) { delay(10); }
    delay(200);
    Serial.println(F("\n══════════════════════════════════"));
    Serial.println(F("  OpenPulse Firmware v6"));
    Serial.println(F("  Channel-Based Architecture"));
    Serial.println(F("══════════════════════════════════"));

    // ── Init buses ─────────────────────────────────────────
    Wire.begin();
    Wire.setClock(100000);   // 100kHz — safe for prototype wiring
    Wire1.begin();
    Wire1.setClock(100000);  // 100kHz — onboard IMU

    // ── Power on onboard IMU before scanning ───────────────
    // LSM6DS3 requires its power pin HIGH to respond on Wire1
    pinMode(15, OUTPUT);
    #if defined(NRF52840_XXAA)
    NRF_P1->PIN_CNF[8] = ((uint32_t)NRF_GPIO_PIN_DIR_OUTPUT << GPIO_PIN_CNF_DIR_Pos)
        | ((uint32_t)NRF_GPIO_PIN_INPUT_DISCONNECT << GPIO_PIN_CNF_INPUT_Pos)
        | ((uint32_t)NRF_GPIO_PIN_NOPULL << GPIO_PIN_CNF_PULL_Pos)
        | ((uint32_t)NRF_GPIO_PIN_H0H1 << GPIO_PIN_CNF_DRIVE_Pos)
        | ((uint32_t)NRF_GPIO_PIN_NOSENSE << GPIO_PIN_CNF_SENSE_Pos);
    #endif
    digitalWrite(15, HIGH);
    delay(200);
    Serial.println(F("[BOOT] IMU power ON, scanning I2C..."));

    // ── I2C bus scan (diagnostic) ──────────────────────────
    Serial.print(F("[I2C] Wire  devices:"));
    for (uint8_t a = 1; a < 127; a++) {
        Wire.beginTransmission(a);
        if (Wire.endTransmission() == 0) {
            Serial.print(F(" 0x"));
            if (a < 16) Serial.print('0');
            Serial.print(a, HEX);
        }
    }
    Serial.println();
    Serial.print(F("[I2C] Wire1 devices:"));
    for (uint8_t a = 1; a < 127; a++) {
        Wire1.beginTransmission(a);
        if (Wire1.endTransmission() == 0) {
            Serial.print(F(" 0x"));
            if (a < 16) Serial.print('0');
            Serial.print(a, HEX);
        }
    }
    Serial.println();

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
void printDiagnostics() {
    Serial.println(F("\n── Diagnostics ───────────────────"));
    Serial.print(F("[I2C] Wire  devices:"));
    for (uint8_t a = 1; a < 127; a++) {
        Wire.beginTransmission(a);
        if (Wire.endTransmission() == 0) {
            Serial.print(F(" 0x"));
            if (a < 16) Serial.print('0');
            Serial.print(a, HEX);
        }
    }
    Serial.println();
    Serial.print(F("[I2C] Wire1 devices:"));
    for (uint8_t a = 1; a < 127; a++) {
        Wire1.beginTransmission(a);
        if (Wire1.endTransmission() == 0) {
            Serial.print(F(" 0x"));
            if (a < 16) Serial.print('0');
            Serial.print(a, HEX);
        }
    }
    Serial.println();

    Serial.print(F("[DRV] Active: "));
    Serial.println(activeDriverCount);
    for (uint8_t i = 0; i < DRIVER_COUNT; i++) {
        if (!sensorConfig.chipDetected[i]) continue;
        Serial.print(F("  "));
        Serial.print(KNOWN_CHIPS[i].name);
        Serial.print(F(" detected=Y  init="));
        // Check if this driver is in activeDrivers
        bool inited = false;
        for (uint8_t j = 0; j < activeDriverCount; j++) {
            if (activeDrivers[j] == DRIVER_TABLE[i]) { inited = true; break; }
        }
        Serial.println(inited ? F("OK") : F("FAIL"));
    }

    Serial.print(F("[CH]  Active mask: 0x"));
    Serial.println((uint16_t)sensorConfig.activeChannels, HEX);
    Serial.print(F("[BLE] Connected: "));
    Serial.println(ble.isConnected() ? F("Y") : F("N"));
    Serial.println(F("──────────────────────────────────"));
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

    // ── Auto-print diagnostics when serial connects late ───
    if (Serial && !bootSummaryPrinted) {
        bootSummaryPrinted = true;
        printDiagnostics();
    }
    if (!Serial) bootSummaryPrinted = false;

    // ── Serial command: type '?' for diagnostics ───────────
    if (Serial.available()) {
        char c = Serial.read();
        if (c == '?' || c == 'd' || c == '\n') {
            printDiagnostics();
        }
        // Flush remaining
        while (Serial.available()) Serial.read();
    }

    // ── Periodic status heartbeat ──────────────────────────
    if (now - lastStatusLog >= STATUS_LOG_INTERVAL) {
        lastStatusLog = now;
        Serial.print(F("[STATUS] t="));
        Serial.print(now / 1000);
        Serial.print(F("s  drv="));
        Serial.print(activeDriverCount);
        Serial.print(F("  BLE="));
        Serial.print(ble.isConnected() ? F("Y") : F("N"));
        for (uint8_t i = 0; i < activeDriverCount; i++) {
            SensorDriverBase* drv = activeDrivers[i];
            Serial.print(F("  "));
            Serial.print(drv->getName());
            Serial.print(F("="));
            Serial.print(drv->getLatest().value, 1);
        }
        Serial.println();
    }
}
