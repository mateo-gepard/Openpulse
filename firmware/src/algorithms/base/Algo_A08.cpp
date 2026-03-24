#include "Algo_A08.h"
#include "Algo_A07.h"
#include "../../framework/SensorDriverBase.h"
// ═══════════════════════════════════════════════════════════════
// A08: Vascular Age
// Z-score mapping of A07 waveform features vs. population norms.
//
// Category:       health-biometric
// Classification:  Health Screening
// Tier:           2 (ON_DEMAND)
// Consumes:       A07 (SI, AGI), CH_ACCEL (stillness)
// Consumed by:    C04, C05, C08
// Citation:       Charlton 2022, Takazawa 1998, Millasseau 2006
// ═══════════════════════════════════════════════════════════════

namespace {
    // Measurement
    constexpr uint32_t SESSION_TIMEOUT_MS = 30000;   // 30s session
    constexpr uint8_t  MIN_WINDOWS        = 4;       // 4 × 8-beat windows

    // Stillness
    constexpr float MOTION_THRESHOLD      = 0.1f;    // g — strictest

    // Z-score weights
    constexpr float SI_WEIGHT             = 0.6f;    // SI has stronger cfPWV correlation
    constexpr float AGI_WEIGHT            = 0.4f;

    // Offset mapping: 1 SD ≈ 10 years of vascular aging
    constexpr float SD_TO_YEARS           = 10.0f;

    // Clamping
    constexpr float OFFSET_CLAMP_LOW      = -20.0f;  // years younger
    constexpr float OFFSET_CLAMP_HIGH     = 30.0f;   // years older
    constexpr float Z_CLAMP               = 3.0f;    // ±3 SD

    // A07 SQI requirement
    constexpr float A07_SQI_MIN           = 0.5f;

    // Output SQI
    constexpr float SQI_THRESHOLD         = 0.5f;

    // Normative reference data (from aggregated literature)
    // Index by decade: 0=20s, 1=30s, 2=40s, 3=50s, 4=60s, 5=70s
    constexpr uint8_t NUM_DECADES = 6;
    constexpr uint8_t DECADE_START_AGE = 20;

    // SI norms — Male (m/s): mean, SD
    constexpr float SI_MALE_MEAN[NUM_DECADES]  = {6.0f, 6.8f, 7.8f, 9.0f, 10.5f, 12.0f};
    constexpr float SI_MALE_SD[NUM_DECADES]    = {0.8f, 1.0f, 1.2f, 1.4f, 1.6f,  1.8f};

    // SI norms — Female (m/s)
    constexpr float SI_FEMALE_MEAN[NUM_DECADES] = {5.8f, 6.5f, 7.4f, 8.5f, 10.0f, 11.5f};
    constexpr float SI_FEMALE_SD[NUM_DECADES]   = {0.7f, 0.9f, 1.1f, 1.3f, 1.5f,  1.7f};

    // AGI norms — unisex (a.u.)
    constexpr float AGI_MEAN[NUM_DECADES] = {-0.7f, -0.4f, -0.1f, 0.2f, 0.5f, 0.8f};
    constexpr float AGI_SD[NUM_DECADES]   = { 0.3f,  0.3f,  0.3f, 0.3f, 0.4f, 0.4f};
}

// ─── Normative Lookup ──────────────────────────────────────────
Algo_A08::AgeNorm Algo_A08::getNorm(uint8_t age, bool male) const {
    // Map age to decade index with linear interpolation
    int decIdx = ((int)age - DECADE_START_AGE) / 10;
    if (decIdx < 0) decIdx = 0;
    if (decIdx >= NUM_DECADES - 1) decIdx = NUM_DECADES - 2;

    float frac = ((float)age - (DECADE_START_AGE + decIdx * 10)) / 10.0f;
    frac = fminf(fmaxf(frac, 0.0f), 1.0f);

    AgeNorm norm;
    if (male) {
        norm.siMean = SI_MALE_MEAN[decIdx] + frac * (SI_MALE_MEAN[decIdx+1] - SI_MALE_MEAN[decIdx]);
        norm.siSD   = SI_MALE_SD[decIdx]   + frac * (SI_MALE_SD[decIdx+1]   - SI_MALE_SD[decIdx]);
    } else {
        norm.siMean = SI_FEMALE_MEAN[decIdx] + frac * (SI_FEMALE_MEAN[decIdx+1] - SI_FEMALE_MEAN[decIdx]);
        norm.siSD   = SI_FEMALE_SD[decIdx]   + frac * (SI_FEMALE_SD[decIdx+1]   - SI_FEMALE_SD[decIdx]);
    }
    norm.agiMean = AGI_MEAN[decIdx] + frac * (AGI_MEAN[decIdx+1] - AGI_MEAN[decIdx]);
    norm.agiSD   = AGI_SD[decIdx]   + frac * (AGI_SD[decIdx+1]   - AGI_SD[decIdx]);

    return norm;
}

bool Algo_A08::checkProfile() const {
    return (chronoAge_ >= 18 && chronoAge_ <= 85 && height_m_ > 0.5f && height_m_ < 2.5f);
}

float Algo_A08::sortedMedian(float* arr, uint8_t n) const {
    // Simple insertion sort + median for small arrays (n ≤ 8)
    for (uint8_t i = 1; i < n; i++) {
        float key = arr[i];
        int j = i - 1;
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key;
    }
    if (n % 2 == 0) return (arr[n/2 - 1] + arr[n/2]) / 2.0f;
    return arr[n/2];
}

// ─── SQI ───────────────────────────────────────────────────────
float Algo_A08::computeSQI() const {
    // 1. A07 input quality (40%) — mean SQI across collected windows
    float a07sqi = (a07_) ? a07_->getOutputSQI() : 0;
    float sqi_input = fminf(fmaxf((a07sqi - 0.5f) / 0.3f, 0.0f), 1.0f);

    // 2. Feature stability (35%) — CV of SI and AGI across windows
    float cv_combined = 0;
    if (windowCount_ >= 2) {
        // Compute SI mean/sd
        float siSum = 0, agiSum = 0;
        for (uint8_t i = 0; i < windowCount_; i++) {
            siSum += siSamples_[i];
            agiSum += agiSamples_[i];
        }
        float siMean = siSum / windowCount_;
        float agiMean = agiSum / windowCount_;
        float siVarSum = 0, agiVarSum = 0;
        for (uint8_t i = 0; i < windowCount_; i++) {
            float d = siSamples_[i] - siMean;
            siVarSum += d * d;
            d = agiSamples_[i] - agiMean;
            agiVarSum += d * d;
        }
        float siCV = (siMean > 0.1f) ? sqrtf(siVarSum / windowCount_) / fabsf(siMean) : 1.0f;
        float agiCV = (fabsf(agiMean) > 0.01f) ? sqrtf(agiVarSum / windowCount_) / fabsf(agiMean) : 1.0f;
        cv_combined = SI_WEIGHT * siCV + AGI_WEIGHT * agiCV;
    }
    float sqi_stability = fminf(fmaxf(1.0f - (cv_combined - 0.05f) / 0.10f, 0.0f), 1.0f);

    // 3. Stillness (25%)
    float sqi_still = fminf(fmaxf(1.0f - maxMotion_ / MOTION_THRESHOLD, 0.0f), 1.0f);

    return 0.40f * sqi_input + 0.35f * sqi_stability + 0.25f * sqi_still;
}

// ─── Init ──────────────────────────────────────────────────────
void Algo_A08::init() {
    windowCount_ = 0;
    sessionStartTs_ = 0;
    vascAge_ = 0;
    ageOffset_ = 0;
    zComposite_ = 0;
    maxMotion_ = 0;
    state_ = AlgoState::IDLE;
    output_ = {0, 0, 0, false};
    calibOut_ = {0, 0, 0, 0, 0, false, false, 0};
}

// ─── Update ────────────────────────────────────────────────────
void Algo_A08::update(uint32_t now_ms) {
    if (!a07_) { state_ = AlgoState::IDLE; return; }

    // 1. Profile check
    if (!profileValid_) {
        state_ = AlgoState::CALIBRATING;
        output_ = {0, 0, now_ms, false};
        return;
    }

    // 2. A07 state check
    if (a07_->getState() != AlgoState::VALID) {
        state_ = AlgoState::ACQUIRING;
        output_ = {0, 0, now_ms, false};
        return;
    }

    // 3. Motion check — strict stillness required
    if (imu_) {
        float mag = imu_->getAccelMagnitude();
        float motion = fabsf(mag - 1.0f);
        if (motion > maxMotion_) maxMotion_ = motion;
        if (motion > MOTION_THRESHOLD) {
            // Abort session — user moved
            windowCount_ = 0;
            sessionStartTs_ = 0;
            maxMotion_ = 0;
            state_ = AlgoState::LOW_QUALITY;
            output_ = {0, 0, now_ms, false};
            return;
        }
    }

    // 4. A07 SQI check
    if (a07_->getOutputSQI() < A07_SQI_MIN) {
        state_ = AlgoState::ACQUIRING;
        return;
    }

    // 5. Start or continue accumulation session
    if (sessionStartTs_ == 0) {
        sessionStartTs_ = now_ms;
        windowCount_ = 0;
        maxMotion_ = 0;
    }

    // Session timeout
    if ((now_ms - sessionStartTs_) > SESSION_TIMEOUT_MS && windowCount_ < MIN_WINDOWS) {
        // Didn't get enough clean data in 30s — failed
        state_ = AlgoState::LOW_QUALITY;
        output_ = {0, 0, now_ms, false};
        sessionStartTs_ = 0;
        windowCount_ = 0;
        return;
    }

    // 6. Collect A07 feature windows
    float si  = a07_->getStiffnessIndex();
    float agi = a07_->getAgingIndex();

    if (si > 0 && windowCount_ < MAX_WINDOWS) {
        siSamples_[windowCount_] = si;
        agiSamples_[windowCount_] = agi;
        windowCount_++;
    }

    // 7. Need at least MIN_WINDOWS before computing
    if (windowCount_ < MIN_WINDOWS) {
        state_ = AlgoState::ACQUIRING;
        output_ = {0, 0, now_ms, false};
        return;
    }

    // 8. Compute median features
    float siWork[MAX_WINDOWS], agiWork[MAX_WINDOWS];
    for (uint8_t i = 0; i < windowCount_; i++) {
        siWork[i] = siSamples_[i];
        agiWork[i] = agiSamples_[i];
    }
    float medSI  = sortedMedian(siWork, windowCount_);
    float medAGI = sortedMedian(agiWork, windowCount_);

    // 9. Z-score vs. normative data
    AgeNorm norm = getNorm(chronoAge_, isMale_);

    float zSI = (norm.siSD > 0.01f) ? (medSI - norm.siMean) / norm.siSD : 0;
    float zAGI = (norm.agiSD > 0.01f) ? (medAGI - norm.agiMean) / norm.agiSD : 0;

    // Clamp z-scores
    zSI  = fminf(fmaxf(zSI, -Z_CLAMP), Z_CLAMP);
    zAGI = fminf(fmaxf(zAGI, -Z_CLAMP), Z_CLAMP);

    // Composite z-score
    zComposite_ = SI_WEIGHT * zSI + AGI_WEIGHT * zAGI;

    // 10. Map to vascular age offset
    ageOffset_ = zComposite_ * SD_TO_YEARS;
    ageOffset_ = fminf(fmaxf(ageOffset_, OFFSET_CLAMP_LOW), OFFSET_CLAMP_HIGH);
    vascAge_ = (float)chronoAge_ + ageOffset_;

    // 11. SQI & output
    float sqi = computeSQI();
    if (sqi < SQI_THRESHOLD) {
        state_ = AlgoState::LOW_QUALITY;
        output_ = {vascAge_, sqi, now_ms, false};
        return;
    }

    state_ = AlgoState::VALID;
    output_ = {vascAge_, sqi, now_ms, true};

    // Build calibrated output
    float ciHalf = fabsf(ageOffset_) * 0.3f + 2.0f;  // ±(30% of offset + 2 years)
    calibOut_ = {
        vascAge_,                      // value
        vascAge_ - ciHalf,             // ci_low
        vascAge_ + ciHalf,             // ci_high
        sqi,                           // sqi
        now_ms,                        // timestamp_ms
        true,                          // valid
        false,                         // calibrated (literature norms only)
        0                              // calibration_age_ms
    };

    // Session complete — reset for next trigger
    sessionStartTs_ = 0;
    windowCount_ = 0;
}

// ─── Getters ───────────────────────────────────────────────────
AlgorithmOutput Algo_A08::getOutput() const { return output_; }
AlgoState Algo_A08::getState() const { return state_; }
