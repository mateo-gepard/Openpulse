#pragma once
// ═══════════════════════════════════════════════════════════════
// OpenPulse Sensor Driver Interface
//
// Every sensor driver implements this interface. Algorithms
// consume drivers via this API — they never touch I2C directly.
//
// This ensures algorithms are testable (mock drivers) and
// portable (swap MAX30102 for MAX86150 without touching algorithms).
// ═══════════════════════════════════════════════════════════════

#include <stdint.h>
#include "RingBuffer.h"

// ─── Driver Status ─────────────────────────────────────────────

enum class DriverStatus : uint8_t {
    NOT_FOUND,      // Sensor not detected on bus
    INITIALIZING,   // Power-on, awaiting first valid read
    RUNNING,        // Normal operation
    ERROR,          // Communication error (I2C NACK, timeout)
    SLEEPING        // Low-power mode (sensor powered down)
};

// ─── Sensor Sample ─────────────────────────────────────────────

struct SensorSample {
    float    value;
    uint32_t timestamp_ms;
    bool     valid;        // false = read failed or sensor saturated
};

// Multi-channel sample (PPG has Red+IR, IMU has 6 axes)
struct MultiSample {
    float    channels[6];  // Up to 6 channels (IMU: ax,ay,az,gx,gy,gz)
    uint8_t  channelCount;
    uint32_t timestamp_ms;
    bool     valid;
};

// ─── Sensor Driver Base ────────────────────────────────────────

class SensorDriverBase {
public:
    virtual ~SensorDriverBase() {}

    // ── Lifecycle ──
    virtual bool init() = 0;             // Returns true if sensor found
    virtual void update(uint32_t now_ms) = 0;  // Non-blocking read
    virtual void sleep() = 0;            // Enter low-power mode
    virtual void wake() = 0;             // Exit low-power mode

    // ── Status ──
    virtual DriverStatus getStatus() const = 0;
    virtual const char* getName() const = 0;     // "MAX86150", "TMP117"
    virtual uint8_t getI2CAddress() const = 0;

    // ── Data access ──
    // Single-channel sensors (temperature, EDA, microphone)
    virtual SensorSample getLatest() const = 0;

    // Multi-channel sensors (PPG: red+IR, IMU: 6-axis)
    virtual MultiSample getLatestMulti() const { return MultiSample{}; }

    // ── Configuration ──
    virtual float getSampleRate() const = 0;     // Hz
    virtual uint8_t getBitDepth() const = 0;     // bits
    virtual uint16_t getBufferSize() const = 0;  // samples

    // ── Power ──
    virtual float getPowerConsumption_mA() const = 0;  // Current draw
};

// ─── Specific Driver Interfaces ────────────────────────────────
// These extend the base with sensor-specific capabilities.

// PPG + ECG driver (MAX86150)
class PPGECGDriver : public SensorDriverBase {
public:
    // PPG channels
    virtual float getPPG_IR() const = 0;
    virtual float getPPG_Red() const = 0;
    virtual float getPPG_DC_IR() const = 0;   // DC level for PI calculation
    virtual float getPPG_DC_Red() const = 0;

    // ECG channel
    virtual float getECG() const = 0;

    // Synchronization: PPG and ECG share the same timestamp
    virtual uint32_t getSyncTimestamp() const = 0;

    // Configuration
    virtual void setPPGSampleRate(uint16_t hz) = 0;
    virtual void setECGSampleRate(uint16_t hz) = 0;
    virtual void setLEDCurrent(uint8_t red_mA, uint8_t ir_mA) = 0;
};

// Temperature driver (TMP117)
class TempDriver : public SensorDriverBase {
public:
    virtual float getTemperature_C() const = 0;
    virtual float getResolution() const = 0;  // ±0.1°C for TMP117
};

// EDA / GSR driver (ADS1115)
class EDADriver : public SensorDriverBase {
public:
    virtual float getConductance_uS() const = 0;  // Microsiemens
    virtual float getResistance_kOhm() const = 0;
    virtual bool isElectrodeContact() const = 0;   // Detect if skin touching
};

// Bioimpedance driver (AD5933)
class BioimpedanceDriver : public SensorDriverBase {
public:
    virtual float getImpedance_Ohm() const = 0;
    virtual float getPhase_deg() const = 0;
    virtual void setFrequency_kHz(float freq) = 0;
    virtual void startSweep() = 0;
    virtual bool isSweepDone() const = 0;
};

// IMU driver (LSM6DS3TR-C)
class IMUDriver : public SensorDriverBase {
public:
    virtual float getAccelX() const = 0;  // g
    virtual float getAccelY() const = 0;
    virtual float getAccelZ() const = 0;
    virtual float getGyroX() const = 0;   // deg/s
    virtual float getGyroY() const = 0;
    virtual float getGyroZ() const = 0;
    virtual float getAccelMagnitude() const = 0;
    virtual float getGyroMagnitude() const = 0;
};

// Microphone driver (PDM)
class MicDriver : public SensorDriverBase {
public:
    virtual float getRMS() const = 0;
    virtual float getDB() const = 0;
    virtual const int16_t* getRawBuffer() const = 0;
    virtual uint16_t getRawBufferSize() const = 0;
};
