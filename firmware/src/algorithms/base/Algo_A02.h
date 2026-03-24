#pragma once
// ═══════════════════════════════════════════════════════════════
// A02: Heart Rate Variability (HRV)
// Tier 1 (PERIODIC) — computed every 5 seconds from IBI history
//
// Time-domain HRV metrics: RMSSD, SDNN, pNN50.
// Uses IBI data from A01 peak detection.
//
// Consumes: A01 output (IBI buffer), CH_ACCEL (motion rejection)
// Outputs:  float rmssd_ms (primary), sdnn_ms, pnn50 (%)
// Consumed by: X05 (Autonomic Balance), X08 (ANS Mapping),
//              C01 (Recovery), C03 (Sleep Score)
//
// Citation: Task Force ESC/NASPE 1996
// ═══════════════════════════════════════════════════════════════

#include "../../framework/AlgorithmBase.h"
#include "../../framework/RingBuffer.h"
#include "../../framework/Channels.h"

class IMUDriver;
class Algo_A01;

class Algo_A02 : public AlgorithmBase {
public:
    void init() override;
    void update(uint32_t now_ms) override;
    AlgorithmOutput getOutput() const override;
    AlgoState getState() const override;

    const char* getID() const override { return "A02"; }
    const char* getName() const override { return "HRV"; }
    const char* getUnit() const override { return "ms"; }
    AlgoClassification getClassification() const override { return AlgoClassification::HEALTH_INDICATOR; }
    AlgoTier getTier() const override { return AlgoTier::PERIODIC; }
    uint16_t ramUsage() const override { return sizeof(*this); }

    // Dependency injection
    void setA01(Algo_A01* a01) { a01_ = a01; }
    void setIMUDriver(IMUDriver* drv) { imu_ = drv; }

    // Public accessors for downstream
    float getRMSSD() const { return rmssd_; }
    float getSDNN() const  { return sdnn_; }
    float getPNN50() const { return pnn50_; }

private:
    Algo_A01* a01_ = nullptr;
    IMUDriver* imu_ = nullptr;

    AlgoState state_ = AlgoState::IDLE;
    AlgorithmOutput output_ = {0, 0, 0, false};

    // Local IBI buffer (copied from A01 on each update)
    static constexpr uint16_t IBI_BUF_SIZE = 128;
    RingBuffer<float, IBI_BUF_SIZE> localIBI_;

    // Metrics
    float rmssd_ = 0;
    float sdnn_  = 0;
    float pnn50_ = 0;

    // Tracking
    uint16_t lastProcessedBeatCount_ = 0;
    float motionLevel_ = 0;

    float computeSQI() const;
};
