#pragma once
// ═══════════════════════════════════════════════════════════════
// A03: Blood Oxygen Saturation (SpO2)
// Tier 2 (ON_DEMAND) — user-triggered, Red+IR LED mode switch
//
// Dual-wavelength ratio-of-ratios (R) with linear SpO2 lookup.
// 4-second averaging windows, median filter for outlier rejection.
//
// Consumes: CH_PPG (Red + IR LEDs), CH_ACCEL
// Outputs:  CalibratedOutput spo2_percent (%)
// Consumed by: X17 (Sleep Apnea), C01 (Recovery Score)
//
// Citation: Maxim AN6409 (2018), Jubran 2015
// ═══════════════════════════════════════════════════════════════

#include "../../framework/AlgorithmBase.h"
#include "../../framework/RingBuffer.h"
#include "../../framework/Channels.h"

class PPGECGDriver;
class IMUDriver;

class Algo_A03 : public AlgorithmBase {
public:
    void init() override;
    void update(uint32_t now_ms) override;
    AlgorithmOutput getOutput() const override;
    AlgoState getState() const override;

    const char* getID() const override { return "A03"; }
    const char* getName() const override { return "SpO2"; }
    const char* getUnit() const override { return "%"; }
    AlgoClassification getClassification() const override { return AlgoClassification::HEALTH_SCREENING; }
    AlgoTier getTier() const override { return AlgoTier::ON_DEMAND; }
    uint16_t ramUsage() const override { return sizeof(*this); }

    // Dependency injection
    void setPPGDriver(PPGECGDriver* drv) { ppg_ = drv; }
    void setIMUDriver(IMUDriver* drv)    { imu_ = drv; }

    // Public accessors
    float getSpO2() const { return spo2_; }
    CalibratedOutput getCalibratedOutput() const { return calibOut_; }
    float getRRatio() const { return rRatio_; }

private:
    PPGECGDriver* ppg_ = nullptr;
    IMUDriver*    imu_ = nullptr;

    AlgoState state_ = AlgoState::IDLE;
    AlgorithmOutput output_ = {0, 0, 0, false};
    CalibratedOutput calibOut_ = {0, 0, 0, 0, 0, false, false, 0};

    // AC bandpass filters (0.5–5.0 Hz, 2nd-order Butterworth) — one set per channel
    struct Biquad {
        float b0, b1, b2, a1, a2;
        float x1, x2, y1, y2;
        float process(float x) {
            float y = b0*x + b1*x1 + b2*x2 - a1*y1 - a2*y2;
            x2 = x1; x1 = x;
            y2 = y1; y1 = y;
            return y;
        }
        void reset() { x1 = x2 = y1 = y2 = 0; }
    };
    Biquad redBPF_[2];  // 2 biquad sections for red AC
    Biquad irBPF_[2];   // 2 biquad sections for IR AC

    // DC tracking (slow EMA)
    float dcRed_ = 0;
    float dcIR_  = 0;

    // AC amplitude windows
    static constexpr uint16_t AC_WIN = 400;  // 4s at 100 Hz
    RingBuffer<float, AC_WIN> acRedBuf_;
    RingBuffer<float, AC_WIN> acIRBuf_;

    // R-ratio and SpO2
    float rRatio_ = 0;
    float spo2_   = 0;

    // Median filter over successive windows
    static constexpr uint8_t MEDIAN_DEPTH = 3;
    float rHistory_[MEDIAN_DEPTH];
    uint8_t rHistIdx_ = 0;
    uint8_t rHistCount_ = 0;

    // Motion / settle
    float motionLevel_ = 0;
    uint32_t motionClearTs_ = 0;
    uint16_t sampleCount_ = 0;

    // Internal
    float computeSQI() const;
    void initFilters();
    float medianOfThree(float a, float b, float c) const;
};
