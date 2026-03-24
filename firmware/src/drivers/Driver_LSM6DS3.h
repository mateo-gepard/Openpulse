#pragma once
// LSM6DS3TR-C — 6-axis IMU (Onboard XIAO BLE Sense)
// Wire1, 0x6A | 50Hz | 16-bit
#include "../framework/SensorDriverBase.h"
#include "LSM6DS3.h"
#include <Wire.h>

#ifndef IMU_POWER_PIN
#define IMU_POWER_PIN 15
#endif

class Driver_LSM6DS3 : public IMUDriver {
public:
    bool init() override {
        pinMode(IMU_POWER_PIN, OUTPUT);
        #if defined(NRF52840_XXAA)
        NRF_P1->PIN_CNF[8] = ((uint32_t)NRF_GPIO_PIN_DIR_OUTPUT << GPIO_PIN_CNF_DIR_Pos)
            | ((uint32_t)NRF_GPIO_PIN_INPUT_DISCONNECT << GPIO_PIN_CNF_INPUT_Pos)
            | ((uint32_t)NRF_GPIO_PIN_NOPULL << GPIO_PIN_CNF_PULL_Pos)
            | ((uint32_t)NRF_GPIO_PIN_H0H1 << GPIO_PIN_CNF_DRIVE_Pos)
            | ((uint32_t)NRF_GPIO_PIN_NOSENSE << GPIO_PIN_CNF_SENSE_Pos);
        #endif
        digitalWrite(IMU_POWER_PIN, HIGH);
        delay(100);
        if (imu_.begin() == 0) { status_ = DriverStatus::RUNNING; return true; }
        // Power-cycle retry
        digitalWrite(IMU_POWER_PIN, LOW); delay(100);
        digitalWrite(IMU_POWER_PIN, HIGH); delay(500);
        if (imu_.begin() == 0) { status_ = DriverStatus::RUNNING; return true; }
        status_ = DriverStatus::NOT_FOUND;
        return false;
    }
    void update(uint32_t now_ms) override {
        if (status_ != DriverStatus::RUNNING || now_ms - lastRead_ < 20) return;
        lastRead_ = now_ms;
        ax_ = imu_.readFloatAccelX(); ay_ = imu_.readFloatAccelY(); az_ = imu_.readFloatAccelZ();
        gx_ = imu_.readFloatGyroX();  gy_ = imu_.readFloatGyroY();  gz_ = imu_.readFloatGyroZ();
        multi_ = { {ax_,ay_,az_,gx_,gy_,gz_}, 6, now_ms, true };
        sample_ = { getAccelMagnitude(), now_ms, true };
    }
    void sleep() override { digitalWrite(IMU_POWER_PIN, LOW); status_ = DriverStatus::SLEEPING; }
    void wake()  override { digitalWrite(IMU_POWER_PIN, HIGH); delay(100); if(imu_.begin()==0) status_=DriverStatus::RUNNING; }
    DriverStatus getStatus() const override     { return status_; }
    const char*  getName() const override       { return "LSM6DS3"; }
    uint8_t      getI2CAddress() const override { return 0x6A; }
    SensorSample getLatest() const override     { return sample_; }
    MultiSample  getLatestMulti() const override{ return multi_; }
    float getSampleRate() const override        { return 50.0f; }
    uint8_t getBitDepth() const override        { return 16; }
    uint16_t getBufferSize() const override     { return 256; }
    float getPowerConsumption_mA() const override { return 0.9f; }
    ChannelMask getChannels() const override    { return CH_ACCEL | CH_GYRO; }
    float getAccelX() const override            { return ax_; }
    float getAccelY() const override            { return ay_; }
    float getAccelZ() const override            { return az_; }
    float getGyroX() const override             { return gx_; }
    float getGyroY() const override             { return gy_; }
    float getGyroZ() const override             { return gz_; }
    float getAccelMagnitude() const override    { return sqrtf(ax_*ax_+ay_*ay_+az_*az_); }
    float getGyroMagnitude() const override     { return sqrtf(gx_*gx_+gy_*gy_+gz_*gz_); }
private:
    LSM6DS3 imu_{I2C_MODE, 0x6A};
    DriverStatus status_ = DriverStatus::NOT_FOUND;
    SensorSample sample_ = {};
    MultiSample multi_ = {};
    float ax_=0,ay_=0,az_=0,gx_=0,gy_=0,gz_=0;
    uint32_t lastRead_ = 0;
};
