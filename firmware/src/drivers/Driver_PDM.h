#pragma once
// PDM Microphone — Onboard XIAO BLE Sense | Digital | 16kHz mono | 16-bit
#include "../framework/SensorDriverBase.h"
#include <PDM.h>

#define PDM_BUF_SIZE 256

class Driver_PDM : public MicDriver {
public:
    bool init() override {
        instance_ = this;
        PDM.onReceive(onPDMData);
        if (!PDM.begin(1, 16000)) { status_ = DriverStatus::NOT_FOUND; return false; }
        PDM.setGain(20);
        status_ = DriverStatus::RUNNING;
        return true;
    }
    void update(uint32_t now_ms) override {
        if (status_ != DriverStatus::RUNNING || !ready_) return;
        ready_ = false;
        long sumSq = 0;
        for (int i = 0; i < PDM_BUF_SIZE; i++) { long s = buf_[i]; sumSq += s*s; }
        rms_ = sqrtf((float)sumSq / PDM_BUF_SIZE);
        if (rms_ < 1.0f) rms_ = 1.0f;
        dB_ = 20.0f * log10f(rms_ / 32767.0f) + 120.0f;
        if (dB_ < 0) dB_ = 0;
        sample_ = { dB_, now_ms, true };
    }
    void sleep() override { PDM.end(); status_ = DriverStatus::SLEEPING; }
    void wake()  override { init(); }
    DriverStatus getStatus() const override     { return status_; }
    const char*  getName() const override       { return "PDM_Mic"; }
    uint8_t      getI2CAddress() const override { return 0; }
    SensorSample getLatest() const override     { return sample_; }
    float getSampleRate() const override        { return 16000.0f; }
    uint8_t getBitDepth() const override        { return 16; }
    uint16_t getBufferSize() const override     { return PDM_BUF_SIZE; }
    float getPowerConsumption_mA() const override { return 1.0f; }
    ChannelMask getChannels() const override    { return CH_MIC; }
    float getRMS() const override               { return rms_; }
    float getDB() const override                { return dB_; }
    const int16_t* getRawBuffer() const override{ return buf_; }
    uint16_t getRawBufferSize() const override  { return PDM_BUF_SIZE; }
private:
    DriverStatus status_ = DriverStatus::NOT_FOUND;
    SensorSample sample_ = {};
    float rms_ = 0, dB_ = 0;
    volatile bool ready_ = false;
    short buf_[PDM_BUF_SIZE] = {};
    static Driver_PDM* instance_;
    static void onPDMData() {
        if (!instance_) return;
        int b = PDM.available();
        if (b > 0) { PDM.read(instance_->buf_, (b/2 < PDM_BUF_SIZE ? b/2 : PDM_BUF_SIZE)*2); instance_->ready_ = true; }
    }
};
Driver_PDM* Driver_PDM::instance_ = nullptr;
