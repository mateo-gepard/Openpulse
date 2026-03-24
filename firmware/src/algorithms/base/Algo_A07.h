#pragma once
// ═══════════════════════════════════════════════════════════════
// A07: PPG Waveform Analysis
// Tier 1 (PERIODIC) — computed once per 8-beat window
//
// Extracts waveform morphology features: Stiffness Index,
// Reflection Index, SDPPG Aging Index, Augmentation Index.
//
// Consumes: CH_PPG (200 Hz), CH_ACCEL
// Outputs:  float stiffness_index (m/s) [primary]
// Secondaries: reflection_index (%), aging_index (a.u.),
//              augmentation_index (%)
// Consumed by: A08 (Vascular Age), X02 (Arterial Stiffness),
//              C05 (Cardiovascular Age)
//
// Citation: Takazawa 1998, Millasseau 2006, Charlton 2022
// ═══════════════════════════════════════════════════════════════

#include "../../framework/AlgorithmBase.h"
#include "../../framework/RingBuffer.h"
#include "../../framework/Channels.h"

class PPGECGDriver;
class IMUDriver;
class Algo_A01;  // For peak timestamps

class Algo_A07 : public AlgorithmBase {
public:
    void init() override;
    void update(uint32_t now_ms) override;
    AlgorithmOutput getOutput() const override;
    AlgoState getState() const override;

    const char* getID() const override { return "A07"; }
    const char* getName() const override { return "PPG Waveform"; }
    const char* getUnit() const override { return "m/s"; }
    AlgoClassification getClassification() const override { return AlgoClassification::HEALTH_INDICATOR; }
    AlgoTier getTier() const override { return AlgoTier::PERIODIC; }
    uint16_t ramUsage() const override { return sizeof(*this); }

    // Dependency injection
    void setPPGDriver(PPGECGDriver* drv) { ppg_ = drv; }
    void setIMUDriver(IMUDriver* drv)    { imu_ = drv; }
    void setA01(Algo_A01* a01)           { a01_ = a01; }

    // Public accessors for downstream (A08, X02)
    float getStiffnessIndex() const  { return si_; }
    float getReflectionIndex() const { return ri_; }
    float getAgingIndex() const      { return agi_; }
    float getAugmentationIndex() const { return aix_; }
    bool  isNotchAbsent() const      { return notchAbsent_; }
    float getOutputSQI() const       { return output_.sqi; }

    void setBodyHeight(float height_m) { bodyHeight_ = height_m; }

private:
    PPGECGDriver* ppg_ = nullptr;
    IMUDriver*    imu_ = nullptr;
    Algo_A01*     a01_ = nullptr;

    AlgoState state_ = AlgoState::IDLE;
    AlgorithmOutput output_ = {0, 0, 0, false};

    // Raw high-rate PPG buffer (200 Hz, 2 beat window)
    static constexpr uint16_t PPG_BUF_200 = 600;  // 3s at 200 Hz
    RingBuffer<float, PPG_BUF_200> ppgBuf200_;

    // Beat-segmented features
    static constexpr uint8_t BEAT_AVG = 8;
    float si_accum_[BEAT_AVG];
    float ri_accum_[BEAT_AVG];
    float agi_accum_[BEAT_AVG];
    float aix_accum_[BEAT_AVG];
    uint8_t beatIdx_ = 0;

    // Current output features (averaged over BEAT_AVG beats)
    float si_  = 0;   // Stiffness Index (m/s)
    float ri_  = 0;   // Reflection Index (%)
    float agi_ = 0;   // SDPPG Aging Index (a.u.)
    float aix_ = 0;   // Augmentation Index (%)
    bool notchAbsent_ = true;

    // User profile
    float bodyHeight_ = 1.70f;  // Default height (m)

    // Motion tracking
    float motionLevel_ = 0;

    // Internal beat analysis buffer (single beat)
    static constexpr uint16_t MAX_BEAT_LEN = 400;  // 2s at 200 Hz
    float beatWave_[MAX_BEAT_LEN];
    float beatVPG_[MAX_BEAT_LEN];   // First derivative
    float beatAPG_[MAX_BEAT_LEN];   // Second derivative
    uint16_t beatLen_ = 0;

    // Last peak timestamp from A01
    uint32_t lastProcessedPeakTs_ = 0;

    // Internal methods
    float computeSQI() const;
    float computeMotionLevel();
    bool  extractBeat(uint32_t peakTs, uint32_t prevPeakTs);
    void  analyzeBeat();
    void  computeDerivatives();
    void  findSDPPGWaves(float& a, float& b, float& c, float& d, float& e);
};
