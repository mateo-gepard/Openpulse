#pragma once
// ═══════════════════════════════════════════════════════════════
// A08: Vascular Age
// Tier 2 (ON_DEMAND) — user-triggered 30s measurement session
//
// Compares PPG-derived arterial stiffness markers (from A07)
// against age/sex-normative reference curves via z-score mapping.
//
// Consumes: A07 (SI, AGI outputs), CH_ACCEL (stillness)
// Outputs:  CalibratedOutput vascular_age_years (years)
// Consumed by: C04 (Biological Age), C05 (Cardiovascular Age),
//              C08 (Health Report)
//
// Citation: Charlton 2022, Takazawa 1998, Millasseau 2006
// ═══════════════════════════════════════════════════════════════

#include "../../framework/AlgorithmBase.h"
#include "../../framework/RingBuffer.h"
#include "../../framework/Channels.h"

class IMUDriver;
class Algo_A07;

class Algo_A08 : public AlgorithmBase {
public:
    void init() override;
    void update(uint32_t now_ms) override;
    AlgorithmOutput getOutput() const override;
    AlgoState getState() const override;

    const char* getID() const override { return "A08"; }
    const char* getName() const override { return "Vascular Age"; }
    const char* getUnit() const override { return "years"; }
    AlgoClassification getClassification() const override { return AlgoClassification::HEALTH_SCREENING; }
    AlgoTier getTier() const override { return AlgoTier::ON_DEMAND; }
    uint16_t ramUsage() const override { return sizeof(*this); }

    // Dependency injection
    void setIMUDriver(IMUDriver* drv)   { imu_ = drv; }
    void setA07(Algo_A07* a07)          { a07_ = a07; }

    // User profile (required for computation)
    void setUserAge(uint8_t age)        { chronoAge_ = age; profileValid_ = checkProfile(); }
    void setUserSex(bool isMale)        { isMale_ = isMale; profileValid_ = checkProfile(); }
    void setUserHeight(float height_m)  { height_m_ = height_m; profileValid_ = checkProfile(); }

    // Public accessors
    float getVascularAge() const      { return vascAge_; }
    float getAgeOffset() const        { return ageOffset_; }
    float getZScore() const           { return zComposite_; }
    CalibratedOutput getCalibratedOutput() const { return calibOut_; }

private:
    Algo_A07* a07_ = nullptr;
    IMUDriver* imu_ = nullptr;

    AlgoState state_ = AlgoState::IDLE;
    AlgorithmOutput output_ = {0, 0, 0, false};
    CalibratedOutput calibOut_ = {0, 0, 0, 0, 0, false, false, 0};

    // User profile
    uint8_t chronoAge_ = 0;
    bool isMale_ = true;
    float height_m_ = 1.70f;
    bool profileValid_ = false;

    // Accumulation over 30s session
    static constexpr uint8_t MAX_WINDOWS = 8;
    float siSamples_[MAX_WINDOWS];
    float agiSamples_[MAX_WINDOWS];
    uint8_t windowCount_ = 0;
    uint32_t sessionStartTs_ = 0;

    // Results
    float vascAge_ = 0;
    float ageOffset_ = 0;
    float zComposite_ = 0;

    // Motion tracking
    float maxMotion_ = 0;

    // Normative lookup
    struct AgeNorm {
        float siMean, siSD;
        float agiMean, agiSD;
    };
    AgeNorm getNorm(uint8_t age, bool male) const;
    bool checkProfile() const;
    float computeSQI() const;
    float sortedMedian(float* arr, uint8_t n) const;
};
