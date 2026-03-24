#pragma once
// ═══════════════════════════════════════════════════════════════
// A04: Respiratory Rate
// Tier 1 (PERIODIC) — computed every 10 seconds from 30s windows
//
// Extracts respiratory modulation from PPG via three methods
// (RIIV, RIFV, RIAV), estimates dominant frequency per method,
// and fuses with prominence-weighted average.
//
// Consumes: CH_PPG, CH_ACCEL, A01 (beat timestamps / IBI)
// Outputs:  float breaths_per_minute (BrPM)
// Consumed by: X07 (Illness Warning), X11 (Sleep Phases),
//              C01 (Recovery Score)
//
// Citation: Karlen et al. 2013
// ═══════════════════════════════════════════════════════════════

#include "../../framework/AlgorithmBase.h"
#include "../../framework/RingBuffer.h"
#include "../../framework/Channels.h"

class PPGECGDriver;
class IMUDriver;
class Algo_A01;

class Algo_A04 : public AlgorithmBase {
public:
    void init() override;
    void update(uint32_t now_ms) override;
    AlgorithmOutput getOutput() const override;
    AlgoState getState() const override;

    const char* getID() const override { return "A04"; }
    const char* getName() const override { return "Resp Rate"; }
    const char* getUnit() const override { return "BrPM"; }
    AlgoClassification getClassification() const override { return AlgoClassification::HEALTH_INDICATOR; }
    AlgoTier getTier() const override { return AlgoTier::PERIODIC; }
    uint16_t ramUsage() const override { return sizeof(*this); }

    // Dependency injection
    void setPPGDriver(PPGECGDriver* drv) { ppg_ = drv; }
    void setIMUDriver(IMUDriver* drv)    { imu_ = drv; }
    void setA01(Algo_A01* a01)           { a01_ = a01; }

    // Public accessors
    float getBrPM() const { return brpm_; }
    uint8_t getActiveModulations() const { return activeModCount_; }

private:
    PPGECGDriver* ppg_ = nullptr;
    IMUDriver*    imu_ = nullptr;
    Algo_A01*     a01_ = nullptr;

    AlgoState state_ = AlgoState::IDLE;
    AlgorithmOutput output_ = {0, 0, 0, false};

    // Beat-synchronous modulation buffers (resampled to 4 Hz, 30s = 120 samples)
    static constexpr uint8_t RESAMP_LEN = 120;
    float riiv_[RESAMP_LEN];  // DC envelope at each beat
    float rifv_[RESAMP_LEN];  // IBI at each beat
    float riav_[RESAMP_LEN];  // AC amplitude at each beat
    uint8_t modLen_ = 0;       // Current filled length

    // FFT scratch buffer (real-only, Hanning-windowed)
    float fftBuf_[RESAMP_LEN];

    // Per-modulation frequency estimates
    struct ModResult {
        float freq_hz;      // Dominant frequency in respiratory band
        float prominence;   // Peak power / total band power
        bool  valid;
    };
    ModResult modResults_[3];

    // Beat tracking from A01
    uint16_t lastProcessedBeatCount_ = 0;

    // Raw PPG DC envelope tracking
    float dcEnvelope_ = 0;

    // Output
    float brpm_ = 0;
    uint8_t activeModCount_ = 0;

    // Median filter over successive windows
    static constexpr uint8_t MEDIAN_DEPTH = 3;
    float brpmHistory_[MEDIAN_DEPTH];
    uint8_t histIdx_ = 0;
    uint8_t histCount_ = 0;
    float emaBrPM_ = 0;

    // Motion
    float motionLevel_ = 0;
    uint32_t motionClearTs_ = 0;

    // Timing
    uint32_t lastComputeTs_ = 0;

    // Internal methods
    float computeSQI() const;
    ModResult estimateFrequency(const float* signal, uint8_t len) const;
    float medianOfThree(float a, float b, float c) const;
};
