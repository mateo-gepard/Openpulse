#pragma once
// AD5933 — Bioimpedance Analyzer | Wire 0x0D | On-demand | 12-bit
#include "../framework/SensorDriverBase.h"
#include <Wire.h>

class Driver_AD5933 : public BioimpedanceDriver {
public:
    bool init() override {
        Wire.beginTransmission(0x0D);
        if (Wire.endTransmission() != 0) { status_ = DriverStatus::NOT_FOUND; return false; }
        writeReg(0x80, 0xB0);  // Standby
        setFrequency_kHz(50.0f);
        status_ = DriverStatus::RUNNING;
        return true;
    }
    void update(uint32_t now_ms) override {
        if (status_ != DriverStatus::RUNNING || !sweepActive_) return;
        uint8_t st = readReg(0x8F);
        if (st & 0x02) {
            int16_t re = (int16_t)readReg16(0x94);
            int16_t im = (int16_t)readReg16(0x96);
            float mag = sqrtf((float)(re*re + im*im));
            impedance_ = mag > 0 ? gain_ / mag : 0;
            phase_ = atan2f((float)im, (float)re) * 57.2958f;
            sample_ = { impedance_, now_ms, true };
            if (st & 0x04) sweepActive_ = false;
            else writeReg(0x80, 0x30);
        }
    }
    void sleep() override { writeReg(0x80, 0xA0); status_ = DriverStatus::SLEEPING; }
    void wake()  override { writeReg(0x80, 0xB0); status_ = DriverStatus::RUNNING; }
    DriverStatus getStatus() const override     { return status_; }
    const char*  getName() const override       { return "AD5933"; }
    uint8_t      getI2CAddress() const override { return 0x0D; }
    SensorSample getLatest() const override     { return sample_; }
    float getSampleRate() const override        { return 0; }
    uint8_t getBitDepth() const override        { return 12; }
    uint16_t getBufferSize() const override     { return 1; }
    float getPowerConsumption_mA() const override { return 12.0f; }
    ChannelMask getChannels() const override    { return CH_BIOZ; }
    float getImpedance_Ohm() const override     { return impedance_; }
    float getPhase_deg() const override         { return phase_; }
    void setFrequency_kHz(float f) override {
        uint32_t code = (uint32_t)(f * 1000.0f / (16776000.0f/4.0f) * 134217728.0f);
        writeReg(0x82, (uint8_t)((code>>16)&0xFF));
        writeReg(0x83, (uint8_t)((code>>8)&0xFF));
        writeReg(0x84, (uint8_t)(code&0xFF));
    }
    void startSweep() override {
        writeReg(0x80, 0x10); delay(2);
        writeReg(0x80, 0x20); sweepActive_ = true;
    }
    bool isSweepDone() const override { return !sweepActive_; }
private:
    DriverStatus status_ = DriverStatus::NOT_FOUND;
    SensorSample sample_ = {};
    float impedance_ = 0, phase_ = 0, gain_ = 1.0f;
    bool sweepActive_ = false;
    void writeReg(uint8_t r, uint8_t v) {
        Wire.beginTransmission(0x0D); Wire.write(r); Wire.write(v); Wire.endTransmission();
    }
    uint8_t readReg(uint8_t r) {
        Wire.beginTransmission(0x0D); Wire.write(r); Wire.endTransmission(false);
        Wire.requestFrom((uint8_t)0x0D,(uint8_t)1);
        return Wire.available() ? Wire.read() : 0;
    }
    uint16_t readReg16(uint8_t r) {
        Wire.beginTransmission(0x0D); Wire.write(r); Wire.endTransmission(false);
        Wire.requestFrom((uint8_t)0x0D,(uint8_t)2);
        return Wire.available()>=2 ? ((uint16_t)Wire.read()<<8)|Wire.read() : 0;
    }
};
