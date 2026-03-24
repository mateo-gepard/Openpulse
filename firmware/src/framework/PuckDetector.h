#pragma once
// ═══════════════════════════════════════════════════════════════
// OpenPulse — Runtime Puck & Sensor Detection (Channel-Based)
//
// Scans I2C buses at startup. Maps detected chips → data
// channels. Firmware adapts to whatever hardware is plugged in.
// Algorithms and BLE only see channels, never chips.
// ═══════════════════════════════════════════════════════════════

#include <stdint.h>
#include <Wire.h>
#include "Channels.h"

// ─── Chip Registry ────────────────────────────────────────────
// Every known chip, its I2C address, and which channels it provides.
// Add new chips here — nothing else needs to change.

struct ChipDef {
    const char* name;
    uint8_t     addr;
    bool        useWire1;     // true = Wire1 (onboard), false = Wire (external)
    bool        isDigital;    // true = not I2C (e.g. PDM mic)
    ChannelMask channels;     // which data channels this chip provides
};

static const ChipDef KNOWN_CHIPS[] = {
    // ── External puck sensors (Wire) ──
    { "MAX86150", 0x5E, false, false, CH_PPG | CH_ECG },
    { "MAX30102", 0x57, false, false, CH_PPG },
    { "TMP117",   0x48, false, false, CH_SKIN_TEMP },
    { "MCP9808",  0x18, false, false, CH_SKIN_TEMP },
    { "BME280",   0x76, false, false, CH_ENV_TEMP | CH_HUMIDITY | CH_PRESSURE },
    { "ADS1115",  0x49, false, false, CH_EDA },
    { "AD5933",   0x0D, false, false, CH_BIOZ },
    // ── Onboard sensors (Wire1 / digital) ──
    { "LSM6DS3",  0x6A, true,  false, CH_ACCEL | CH_GYRO },
    { "PDM",      0x00, false, true,  CH_MIC },
};
static constexpr uint8_t KNOWN_CHIP_COUNT = sizeof(KNOWN_CHIPS) / sizeof(KNOWN_CHIPS[0]);

// ─── Scan Result ──────────────────────────────────────────────

struct SensorConfig {
    ChannelMask  activeChannels;                     // bitmask of available channels
    bool         chipDetected[KNOWN_CHIP_COUNT];     // which chips were found
    uint8_t      chipForChannel[(uint8_t)ChannelID::CHANNEL_COUNT]; // index into KNOWN_CHIPS

    bool hasChannel(ChannelID ch) const {
        return ::hasChannel(activeChannels, ch);
    }

    const char* chipNameForChannel(ChannelID ch) const {
        uint8_t idx = chipForChannel[(uint8_t)ch];
        if (idx == 0xFF) return "none";
        return KNOWN_CHIPS[idx].name;
    }

    uint8_t totalChannels() const {
        uint8_t count = 0;
        for (uint8_t i = 0; i < (uint8_t)ChannelID::CHANNEL_COUNT; i++) {
            if (activeChannels & (1 << i)) count++;
        }
        return count;
    }
};

// ─── Puck Detector ────────────────────────────────────────────

class PuckDetector {
public:
    static SensorConfig scan() {
        SensorConfig cfg = {};
        memset(cfg.chipForChannel, 0xFF, sizeof(cfg.chipForChannel));

        for (uint8_t i = 0; i < KNOWN_CHIP_COUNT; i++) {
            const ChipDef& chip = KNOWN_CHIPS[i];
            bool found = false;

            if (chip.isDigital) {
                found = true;  // Digital sensors assumed present; init() will confirm
            } else {
                TwoWire& bus = chip.useWire1 ? Wire1 : Wire;
                bus.beginTransmission(chip.addr);
                found = (bus.endTransmission() == 0);
            }

            cfg.chipDetected[i] = found;

            if (found) {
                // Map this chip's channels — first chip found wins each channel
                for (uint8_t ch = 0; ch < (uint8_t)ChannelID::CHANNEL_COUNT; ch++) {
                    if ((chip.channels & (1 << ch)) && cfg.chipForChannel[ch] == 0xFF) {
                        cfg.chipForChannel[ch] = i;
                        cfg.activeChannels |= (1 << ch);
                    }
                }
            }
        }
        return cfg;
    }

    static void printReport(const SensorConfig& cfg) {
        Serial.println(F("─── Puck Detection ───────────────────"));
        for (uint8_t i = 0; i < KNOWN_CHIP_COUNT; i++) {
            Serial.print(F("  "));
            Serial.print(KNOWN_CHIPS[i].name);
            if (!KNOWN_CHIPS[i].isDigital) {
                Serial.print(F(" @ 0x"));
                if (KNOWN_CHIPS[i].addr < 16) Serial.print('0');
                Serial.print(KNOWN_CHIPS[i].addr, HEX);
            }
            Serial.print(F(": "));
            Serial.println(cfg.chipDetected[i] ? F("[OK]") : F("[not found]"));
        }
        Serial.println(F("─── Active Channels ──────────────────"));
        for (uint8_t ch = 0; ch < (uint8_t)ChannelID::CHANNEL_COUNT; ch++) {
            if (cfg.activeChannels & (1 << ch)) {
                Serial.print(F("  "));
                Serial.print(CHANNEL_TABLE[ch].name);
                Serial.print(F(" → "));
                Serial.println(cfg.chipNameForChannel((ChannelID)ch));
            }
        }
        Serial.print(F("  Total: "));
        Serial.print(cfg.totalChannels());
        Serial.println(F(" channel(s)"));
        Serial.println(F("──────────────────────────────────────"));
    }
};
