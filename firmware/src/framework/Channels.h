#pragma once
// ═══════════════════════════════════════════════════════════════
// OpenPulse — Data Channel Definitions
//
// The abstraction that makes everything sensor-agnostic.
// Algorithms, BLE, dashboard, and firmware all reference
// channels — never specific chips.
//
// Must stay in sync with sensors.json at project root.
// ═══════════════════════════════════════════════════════════════

#include <stdint.h>

// ─── Channel IDs ──────────────────────────────────────────────
// Order matches sensors.json and BLE UUID suffix order.

enum class ChannelID : uint8_t {
    PPG        = 0,   // PPG IR+Red waveform
    ECG        = 1,   // ECG waveform
    SKIN_TEMP  = 2,   // Skin surface temperature
    EDA        = 3,   // Electrodermal activity / GSR
    BIOZ       = 4,   // Bioimpedance
    ENV_TEMP   = 5,   // Environmental temperature
    ACCEL      = 6,   // Accelerometer (3-axis)
    GYRO       = 7,   // Gyroscope (3-axis)
    MIC        = 8,   // Microphone (dB SPL)
    HUMIDITY   = 9,   // Relative humidity
    PRESSURE   = 10,  // Barometric pressure
    CHANNEL_COUNT = 11
};

// ─── Channel Type ─────────────────────────────────────────────

enum class ChannelType : uint8_t {
    SCALAR,    // Single float value
    VEC3,      // 3 floats (x, y, z)
    MULTI      // N named sub-channels (e.g. PPG IR + Red)
};

// ─── Channel Metadata ─────────────────────────────────────────

struct ChannelInfo {
    ChannelID   id;
    const char* name;
    const char* unit;
    ChannelType type;
};

// Channel registry — indexed by ChannelID
static const ChannelInfo CHANNEL_TABLE[] = {
    { ChannelID::PPG,       "PPG (IR+Red)",   "counts", ChannelType::MULTI  },
    { ChannelID::ECG,       "ECG",            "mV",     ChannelType::SCALAR },
    { ChannelID::SKIN_TEMP, "Skin Temp",      "°C",     ChannelType::SCALAR },
    { ChannelID::EDA,       "EDA / GSR",      "µS",     ChannelType::SCALAR },
    { ChannelID::BIOZ,      "Bioimpedance",   "Ω",      ChannelType::SCALAR },
    { ChannelID::ENV_TEMP,  "Env Temp",       "°C",     ChannelType::SCALAR },
    { ChannelID::ACCEL,     "Accelerometer",  "g",      ChannelType::VEC3   },
    { ChannelID::GYRO,      "Gyroscope",      "°/s",    ChannelType::VEC3   },
    { ChannelID::MIC,       "Microphone",     "dB",     ChannelType::SCALAR },
    { ChannelID::HUMIDITY,  "Humidity",       "%",      ChannelType::SCALAR },
    { ChannelID::PRESSURE,  "Pressure",       "hPa",    ChannelType::SCALAR },
};

// ─── Channel Bitmask ──────────────────────────────────────────
// Compact way to represent multiple channels (fits in uint16_t).

typedef uint16_t ChannelMask;

constexpr ChannelMask channelBit(ChannelID ch) {
    return (ChannelMask)(1 << (uint8_t)ch);
}

constexpr bool hasChannel(ChannelMask mask, ChannelID ch) {
    return (mask & channelBit(ch)) != 0;
}

// Convenience masks
constexpr ChannelMask CH_PPG       = channelBit(ChannelID::PPG);
constexpr ChannelMask CH_ECG       = channelBit(ChannelID::ECG);
constexpr ChannelMask CH_SKIN_TEMP = channelBit(ChannelID::SKIN_TEMP);
constexpr ChannelMask CH_EDA       = channelBit(ChannelID::EDA);
constexpr ChannelMask CH_BIOZ      = channelBit(ChannelID::BIOZ);
constexpr ChannelMask CH_ENV_TEMP  = channelBit(ChannelID::ENV_TEMP);
constexpr ChannelMask CH_ACCEL     = channelBit(ChannelID::ACCEL);
constexpr ChannelMask CH_GYRO      = channelBit(ChannelID::GYRO);
constexpr ChannelMask CH_MIC       = channelBit(ChannelID::MIC);
constexpr ChannelMask CH_HUMIDITY  = channelBit(ChannelID::HUMIDITY);
constexpr ChannelMask CH_PRESSURE  = channelBit(ChannelID::PRESSURE);
