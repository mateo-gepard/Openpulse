#pragma once
// ═══════════════════════════════════════════════════════════════
// MAX86150 Driver — PPG (IR + Red) + ECG
// Wire, 0x5E | 100/200 Hz | 18-bit
//
// Implements PPGECGDriver interface from SensorDriverBase.h
// ═══════════════════════════════════════════════════════════════

#include "../framework/SensorDriverBase.h"
#include "../framework/RingBuffer.h"
#include <Wire.h>

class Driver_MAX86150 : public PPGECGDriver {
public:
    // ── Lifecycle ──────────────────────────────────────────────
    bool init() override {
        Wire.beginTransmission(0x5E);
        if (Wire.endTransmission() != 0) {
            status_ = DriverStatus::NOT_FOUND;
            return false;
        }
        // Reset
        writeReg(0x0D, 0x01);   // System Control: reset
        delay(100);
        // Configure PPG
        writeReg(0x09, 0x21);   // FIFO config: rollover, 4 sample avg
        writeReg(0x0E, 0x40);   // PPG config 1: IR + Red, 100Hz
        writeReg(0x0F, 0x06);   // PPG config 2: 18-bit, 411µs pulse
        writeReg(0x11, 0x1F);   // LED1 (IR) current: 6.2mA
        writeReg(0x12, 0x1F);   // LED2 (Red) current: 6.2mA
        // Enable FIFO
        writeReg(0x0D, 0x04);   // Start sampling
        status_ = DriverStatus::RUNNING;
        sampleRate_ = 100;
        return true;
    }

    void update(uint32_t now_ms) override {
        if (status_ != DriverStatus::RUNNING) return;
        // Read FIFO pointer to get available samples
        uint8_t wrPtr = readReg(0x04);
        uint8_t rdPtr = readReg(0x06);
        int available = (int)wrPtr - (int)rdPtr;
        if (available < 0) available += 32;
        if (available == 0) return;

        // Read up to 4 samples per call (non-blocking budget)
        int toRead = (available > 4) ? 4 : available;
        for (int i = 0; i < toRead; i++) {
            Wire.beginTransmission(0x5E);
            Wire.write(0x07);  // FIFO data register
            Wire.endTransmission(false);
            Wire.requestFrom((uint8_t)0x5E, (uint8_t)6);

            if (Wire.available() >= 6) {
                uint32_t ir_raw  = ((uint32_t)Wire.read() << 16) | ((uint32_t)Wire.read() << 8) | Wire.read();
                uint32_t red_raw = ((uint32_t)Wire.read() << 16) | ((uint32_t)Wire.read() << 8) | Wire.read();
                ir_raw  &= 0x03FFFF;  // 18-bit mask
                red_raw &= 0x03FFFF;
                ppgIR_  = (float)ir_raw;
                ppgRed_ = (float)red_raw;
                // Update DC baselines (exponential moving average)
                if (dcIR_ == 0) { dcIR_ = ppgIR_; dcRed_ = ppgRed_; }
                dcIR_  = 0.995f * dcIR_  + 0.005f * ppgIR_;
                dcRed_ = 0.995f * dcRed_ + 0.005f * ppgRed_;
                lastUpdate_ = now_ms;
                sample_ = { ppgIR_, now_ms, true };
            }
        }
    }

    void sleep() override { writeReg(0x0D, 0x02); status_ = DriverStatus::SLEEPING; }
    void wake()  override { writeReg(0x0D, 0x04); status_ = DriverStatus::RUNNING; }

    // ── Status ────────────────────────────────────────────────
    DriverStatus getStatus() const override { return status_; }
    const char*  getName() const override   { return "MAX86150"; }
    uint8_t      getI2CAddress() const override { return 0x5E; }

    // ── Data Access ───────────────────────────────────────────
    SensorSample getLatest() const override { return sample_; }

    float getSampleRate() const override    { return sampleRate_; }
    uint8_t getBitDepth() const override    { return 18; }
    uint16_t getBufferSize() const override { return 512; }
    float getPowerConsumption_mA() const override { return 0.6f; }
    ChannelMask getChannels() const override { return CH_PPG | CH_ECG; }

    // ── PPG-Specific ──────────────────────────────────────────
    float getPPG_IR() const override      { return ppgIR_; }
    float getPPG_Red() const override     { return ppgRed_; }
    float getPPG_DC_IR() const override   { return dcIR_; }
    float getPPG_DC_Red() const override  { return dcRed_; }

    // ECG not yet implemented (requires separate FIFO config mode)
    float getECG() const override         { return 0; }
    uint32_t getSyncTimestamp() const override { return lastUpdate_; }
    void setPPGSampleRate(uint16_t hz) override { sampleRate_ = hz; }
    void setECGSampleRate(uint16_t) override {}
    void setLEDCurrent(uint8_t red_mA, uint8_t ir_mA) override {
        writeReg(0x11, ir_mA & 0x3F);
        writeReg(0x12, red_mA & 0x3F);
    }

private:
    DriverStatus status_ = DriverStatus::NOT_FOUND;
    SensorSample sample_ = {};
    float ppgIR_ = 0, ppgRed_ = 0;
    float dcIR_ = 0, dcRed_ = 0;
    float sampleRate_ = 100;
    uint32_t lastUpdate_ = 0;

    void writeReg(uint8_t reg, uint8_t val) {
        Wire.beginTransmission(0x5E);
        Wire.write(reg);
        Wire.write(val);
        Wire.endTransmission();
    }

    uint8_t readReg(uint8_t reg) {
        Wire.beginTransmission(0x5E);
        Wire.write(reg);
        Wire.endTransmission(false);
        Wire.requestFrom((uint8_t)0x5E, (uint8_t)1);
        return Wire.available() ? Wire.read() : 0;
    }
};
