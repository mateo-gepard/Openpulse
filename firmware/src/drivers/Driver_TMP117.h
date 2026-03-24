#pragma once
// TMP117 — High-Precision Skin Temperature | Wire 0x48 | 1Hz | ±0.1°C
#include "../framework/SensorDriverBase.h"
#include <Wire.h>

class Driver_TMP117 : public TempDriver {
public:
    bool init() override {
        Wire.beginTransmission(0x48);
        if (Wire.endTransmission() != 0) { status_ = DriverStatus::NOT_FOUND; return false; }
        uint16_t id = readReg16(0x0F);
        if ((id & 0x0FFF) != 0x0117) { status_ = DriverStatus::ERROR; return false; }
        writeReg16(0x01, 0x0220);
        status_ = DriverStatus::RUNNING;
        return true;
    }
    void update(uint32_t now_ms) override {
        if (status_ != DriverStatus::RUNNING || now_ms - lastRead_ < 1000) return;
        lastRead_ = now_ms;
        temp_ = (int16_t)readReg16(0x00) * 0.0078125f;
        sample_ = { temp_, now_ms, (temp_ > -40.0f && temp_ < 125.0f) };
    }
    void sleep() override { writeReg16(0x01, 0x0420); status_ = DriverStatus::SLEEPING; }
    void wake()  override { writeReg16(0x01, 0x0220); status_ = DriverStatus::RUNNING; }
    DriverStatus getStatus() const override     { return status_; }
    const char*  getName() const override       { return "TMP117"; }
    uint8_t      getI2CAddress() const override { return 0x48; }
    SensorSample getLatest() const override     { return sample_; }
    float getSampleRate() const override        { return 1.0f; }
    uint8_t getBitDepth() const override        { return 16; }
    uint16_t getBufferSize() const override     { return 16; }
    float getPowerConsumption_mA() const override { return 0.003f; }
    ChannelMask getChannels() const override    { return CH_SKIN_TEMP; }
    float getTemperature_C() const override     { return temp_; }
    float getResolution() const override        { return 0.0078125f; }
private:
    DriverStatus status_ = DriverStatus::NOT_FOUND;
    SensorSample sample_ = {};
    float temp_ = 0;
    uint32_t lastRead_ = 0;
    uint16_t readReg16(uint8_t r) {
        Wire.beginTransmission(0x48); Wire.write(r); Wire.endTransmission(false);
        Wire.requestFrom((uint8_t)0x48,(uint8_t)2);
        return Wire.available()>=2 ? ((uint16_t)Wire.read()<<8)|Wire.read() : 0;
    }
    void writeReg16(uint8_t r, uint16_t v) {
        Wire.beginTransmission(0x48); Wire.write(r);
        Wire.write((uint8_t)(v>>8)); Wire.write((uint8_t)(v&0xFF));
        Wire.endTransmission();
    }
};
