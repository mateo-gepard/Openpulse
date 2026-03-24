#pragma once
// ADS1115 — EDA / Galvanic Skin Response | Wire 0x49 | 10Hz | 16-bit
#include "../framework/SensorDriverBase.h"
#include <Wire.h>

class Driver_ADS1115 : public EDADriver {
public:
    bool init() override {
        Wire.beginTransmission(0x49);
        if (Wire.endTransmission() != 0) { status_ = DriverStatus::NOT_FOUND; return false; }
        writeReg16(0x01, 0xC2E3);  // AIN0, ±4.096V, 128SPS, continuous
        status_ = DriverStatus::RUNNING;
        return true;
    }
    void update(uint32_t now_ms) override {
        if (status_ != DriverStatus::RUNNING || now_ms - lastRead_ < 100) return;
        lastRead_ = now_ms;
        float voltage = (int16_t)readReg16(0x00) * 0.000125f;
        conductance_ = (voltage > 0.01f) ? (3.3f - voltage) / (voltage * 100000.0f) * 1e6f : 0;
        contact_ = (voltage > 0.05f && voltage < 3.25f);
        sample_ = { conductance_, now_ms, contact_ };
    }
    void sleep() override { writeReg16(0x01, 0xC2E1); status_ = DriverStatus::SLEEPING; }
    void wake()  override { writeReg16(0x01, 0xC2E3); status_ = DriverStatus::RUNNING; }
    DriverStatus getStatus() const override     { return status_; }
    const char*  getName() const override       { return "ADS1115"; }
    uint8_t      getI2CAddress() const override { return 0x49; }
    SensorSample getLatest() const override     { return sample_; }
    float getSampleRate() const override        { return 10.0f; }
    uint8_t getBitDepth() const override        { return 16; }
    uint16_t getBufferSize() const override     { return 64; }
    float getPowerConsumption_mA() const override { return 0.15f; }
    ChannelMask getChannels() const override    { return CH_EDA; }
    float getConductance_uS() const override    { return conductance_; }
    float getResistance_kOhm() const override   { return conductance_ > 0 ? 1000.0f/conductance_ : 0; }
    bool  isElectrodeContact() const override   { return contact_; }
private:
    DriverStatus status_ = DriverStatus::NOT_FOUND;
    SensorSample sample_ = {};
    float conductance_ = 0;
    bool contact_ = false;
    uint32_t lastRead_ = 0;
    uint16_t readReg16(uint8_t r) {
        Wire.beginTransmission(0x49); Wire.write(r); Wire.endTransmission(false);
        Wire.requestFrom((uint8_t)0x49,(uint8_t)2);
        return Wire.available()>=2 ? ((uint16_t)Wire.read()<<8)|Wire.read() : 0;
    }
    void writeReg16(uint8_t r, uint16_t v) {
        Wire.beginTransmission(0x49); Wire.write(r);
        Wire.write((uint8_t)(v>>8)); Wire.write((uint8_t)(v&0xFF));
        Wire.endTransmission();
    }
};
