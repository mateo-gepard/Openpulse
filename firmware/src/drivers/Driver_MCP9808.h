#pragma once
// ═══════════════════════════════════════════════════════════════
// MCP9808 Driver — High-Precision Temperature Sensor
// Wire, 0x18 | ~4 Hz | ±0.25°C (typical ±0.0625°C resolution)
// ═══════════════════════════════════════════════════════════════

#include "../framework/SensorDriverBase.h"
#include <Wire.h>

class Driver_MCP9808 : public TempDriver {
public:
    bool init() override {
        Wire.beginTransmission(0x18);
        if (Wire.endTransmission() != 0) {
            status_ = DriverStatus::NOT_FOUND;
            return false;
        }

        // Verify Manufacturer ID (0x0054) and Device ID (0x0400)
        uint16_t mfgId = readReg16(0x06);
        uint16_t devId = readReg16(0x07);
        Serial.print(F("  [MCP9808] Mfg=0x"));
        Serial.print(mfgId, HEX);
        Serial.print(F(" Dev=0x"));
        Serial.println(devId, HEX);

        if (mfgId != 0x0054) {
            status_ = DriverStatus::ERROR;
            return false;
        }

        // Configuration: continuous conversion, ~4 Hz
        // Reg 0x01: all defaults (continuous, no alerts)
        writeReg16(0x01, 0x0000);

        // Resolution: 0x03 = +0.0625°C (max precision, ~250ms conversion)
        writeReg8(0x08, 0x03);

        status_ = DriverStatus::RUNNING;
        return true;
    }

    void update(uint32_t now_ms) override {
        if (status_ != DriverStatus::RUNNING || now_ms - lastRead_ < 300) return;
        lastRead_ = now_ms;

        uint16_t raw = readReg16(0x05);  // Ambient temperature register
        // Upper 3 bits are flags (alert, crit, sign)
        float sign = 1.0f;
        if (raw & 0x1000) sign = -1.0f;  // Sign bit
        raw &= 0x0FFF;  // 12-bit magnitude
        temp_ = sign * (float)raw * 0.0625f;

        sample_ = { temp_, now_ms, (temp_ > -40.0f && temp_ < 125.0f) };

        if (debugCount_ < 5) {
            debugCount_++;
            Serial.print(F("  [MCP9808] raw=0x"));
            Serial.print(readReg16(0x05), HEX);
            Serial.print(F(" temp="));
            Serial.println(temp_);
        }
    }

    void sleep() override {
        uint16_t cfg = readReg16(0x01);
        writeReg16(0x01, cfg | 0x0100);  // SHDN bit
        status_ = DriverStatus::SLEEPING;
    }
    void wake() override {
        uint16_t cfg = readReg16(0x01);
        writeReg16(0x01, cfg & ~0x0100);
        status_ = DriverStatus::RUNNING;
    }

    DriverStatus getStatus() const override     { return status_; }
    const char*  getName() const override       { return "MCP9808"; }
    uint8_t      getI2CAddress() const override { return 0x18; }
    SensorSample getLatest() const override     { return sample_; }
    float getSampleRate() const override        { return 4.0f; }
    uint8_t getBitDepth() const override        { return 13; }
    uint16_t getBufferSize() const override     { return 16; }
    float getPowerConsumption_mA() const override { return 0.2f; }
    ChannelMask getChannels() const override    { return CH_SKIN_TEMP; }

    // TempDriver interface
    float getTemperature_C() const override     { return temp_; }
    float getResolution() const override        { return 0.0625f; }

private:
    DriverStatus status_ = DriverStatus::NOT_FOUND;
    SensorSample sample_ = {};
    float temp_ = 0;
    uint32_t lastRead_ = 0;
    uint8_t debugCount_ = 0;

    uint16_t readReg16(uint8_t reg) {
        Wire.beginTransmission(0x18);
        Wire.write(reg);
        Wire.endTransmission(false);
        Wire.requestFrom((uint8_t)0x18, (uint8_t)2);
        return Wire.available() >= 2 ? ((uint16_t)Wire.read() << 8) | Wire.read() : 0;
    }
    void writeReg16(uint8_t reg, uint16_t val) {
        Wire.beginTransmission(0x18);
        Wire.write(reg);
        Wire.write((uint8_t)(val >> 8));
        Wire.write((uint8_t)(val & 0xFF));
        Wire.endTransmission();
    }
    void writeReg8(uint8_t reg, uint8_t val) {
        Wire.beginTransmission(0x18);
        Wire.write(reg);
        Wire.write(val);
        Wire.endTransmission();
    }
};
