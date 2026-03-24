#pragma once
// ═══════════════════════════════════════════════════════════════
// OpenPulse — Channel-Based BLE GATT Service
//
// Creates BLE characteristics per active data channel (not per
// chip). The dashboard subscribes to channels by UUID — it
// never knows or cares which chip provides the data.
// ═══════════════════════════════════════════════════════════════

#include <ArduinoBLE.h>
#include "../framework/Channels.h"
#include "../framework/PuckDetector.h"

// ─── UUID Scheme ──────────────────────────────────────────────
// Base:    12345678-1234-5678-1234-56789abcdef0
// Channel: 12345678-1234-5678-1234-56789abcdef{1..B}
// Suffix matches ChannelID + 1 (PPG=1, ECG=2, ... PRESSURE=B)

#define OP_SERVICE_UUID "12345678-1234-5678-1234-56789abcdef0"

// BLE UUIDs for each channel (indexed by ChannelID)
static const char* CHANNEL_BLE_UUIDS[] = {
    "12345678-1234-5678-1234-56789abcdef1",  // PPG
    "12345678-1234-5678-1234-56789abcdef2",  // ECG
    "12345678-1234-5678-1234-56789abcdef3",  // SKIN_TEMP
    "12345678-1234-5678-1234-56789abcdef4",  // EDA
    "12345678-1234-5678-1234-56789abcdef5",  // BIOZ
    "12345678-1234-5678-1234-56789abcdef6",  // ENV_TEMP
    "12345678-1234-5678-1234-56789abcdef7",  // ACCEL
    "12345678-1234-5678-1234-56789abcdef8",  // GYRO
    "12345678-1234-5678-1234-56789abcdef9",  // MIC
    "12345678-1234-5678-1234-56789abcdefa",  // HUMIDITY
    "12345678-1234-5678-1234-56789abcdefb",  // PRESSURE
};

class OpenPulseBLE {
public:
    bool init(const SensorConfig& cfg) {
        cfg_ = cfg;
        if (!BLE.begin()) return false;

        BLE.setLocalName("OpenPulse");
        BLE.setAdvertisedService(service_);

        // Create a characteristic for each active channel
        for (uint8_t ch = 0; ch < (uint8_t)ChannelID::CHANNEL_COUNT; ch++) {
            if (!cfg.hasChannel((ChannelID)ch)) continue;
            ChannelType ctype = CHANNEL_TABLE[ch].type;
            if (ctype == ChannelType::VEC3) {
                chars_[ch] = new BLECharacteristic(CHANNEL_BLE_UUIDS[ch], BLERead | BLENotify, 12);
                uint8_t z[12] = {};
                chars_[ch]->writeValue(z, 12);
            } else {
                chars_[ch] = new BLECharacteristic(CHANNEL_BLE_UUIDS[ch], BLERead | BLENotify, 4);
                float zero = 0;
                chars_[ch]->writeValue(&zero, 4);
            }
            service_.addCharacteristic(*chars_[ch]);
            charCount_++;
        }

        BLE.addService(service_);
        BLE.setConnectionInterval(6, 40);
        BLE.advertise();
        return true;
    }

    // ─── Write by channel ─────────────────────────────────────

    void writeScalar(ChannelID ch, float value) {
        uint8_t idx = (uint8_t)ch;
        if (!chars_[idx] || !isConnected()) return;
        chars_[idx]->writeValue(&value, 4);
        spacedPoll();
    }

    void writeVec3(ChannelID ch, float x, float y, float z) {
        uint8_t idx = (uint8_t)ch;
        if (!chars_[idx] || !isConnected()) return;
        uint8_t buf[12];
        memcpy(buf, &x, 4);
        memcpy(buf + 4, &y, 4);
        memcpy(buf + 8, &z, 4);
        chars_[idx]->writeValue(buf, 12);
        spacedPoll();
    }

    // ─── Connection ───────────────────────────────────────────

    void poll() { BLE.poll(); }

    bool isConnected() {
        BLEDevice central = BLE.central();
        bool connected = central && central.connected();
        if (connected && !wasConnected_) {
            wasConnected_ = true;
            Serial.println(F("[BLE] Central connected"));
        } else if (!connected && wasConnected_) {
            wasConnected_ = false;
            Serial.println(F("[BLE] Disconnected — re-advertising"));
            BLE.advertise();
        }
        return connected;
    }

    uint8_t characteristicCount() const { return charCount_; }

private:
    SensorConfig cfg_ = {};
    bool wasConnected_ = false;
    uint8_t charCount_ = 0;
    BLEService service_{OP_SERVICE_UUID};
    BLECharacteristic* chars_[(uint8_t)ChannelID::CHANNEL_COUNT] = {};

    void spacedPoll() { delay(5); BLE.poll(); }
};
