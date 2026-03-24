#pragma once
// ═══════════════════════════════════════════════════════════════
// A09: Perfusion Index
// Tier 0 (REALTIME) — computed every PPG sample
//
// AC/DC ratio of PPG signal expressed as percentage.
// Indicates peripheral blood flow and signal quality.
//
// Consumes: CH_PPG
// Outputs:  float perfusion_index (%)
// Consumed by: A01 (SQI component), A03 (SQI component),
//              A07 (gating), C01 (Recovery Score)
//
// Citation: Elgendi 2016 "Optimal SQI for PPG Signals"
// ═══════════════════════════════════════════════════════════════

#include "../../framework/AlgorithmBase.h"
#include "../../framework/RingBuffer.h"
#include "../../framework/Channels.h"

class PPGECGDriver;

class Algo_A09 : public AlgorithmBase {
public:
    void init() override;
    void update(uint32_t now_ms) override;
    AlgorithmOutput getOutput() const override;
    AlgoState getState() const override;

    const char* getID() const override { return "A09"; }
    const char* getName() const override { return "Perfusion Index"; }
    const char* getUnit() const override { return "%"; }
    AlgoClassification getClassification() const override { return AlgoClassification::WELLNESS; }
    AlgoTier getTier() const override { return AlgoTier::REALTIME; }
    uint16_t ramUsage() const override { return sizeof(*this); }

    // Dependency injection
    void setPPGDriver(PPGECGDriver* drv) { ppg_ = drv; }

    // Public accessors
    float getPI() const { return pi_; }
    float getDCLevel() const { return dcLevel_; }
    float getACAmplitude() const { return acAmplitude_; }

private:
    PPGECGDriver* ppg_ = nullptr;
    AlgoState state_ = AlgoState::IDLE;
    AlgorithmOutput output_ = {0, 0, 0, false};

    // DC tracking (very slow EMA — isolates non-pulsatile baseline)
    float dcLevel_ = 0;

    // AC bandpass filter state (0.5–5.0 Hz, 2nd-order Butterworth)
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
    Biquad acFilter_[2];  // 2 biquad sections

    // AC amplitude tracking
    float acAmplitude_ = 0;
    float acPeak_ = 0;
    float acTrough_ = 0;
    static constexpr uint16_t AC_WINDOW = 400;  // 4s at 100 Hz
    RingBuffer<float, AC_WINDOW> acBuf_;

    // Output
    float pi_ = 0;
    uint16_t sampleCount_ = 0;

    float computeSQI() const;
    void initFilters();
};
