#include "Algo_A02.h"
#include "Algo_A01.h"
#include "../../framework/SensorDriverBase.h"
// ═══════════════════════════════════════════════════════════════
// A02: Heart Rate Variability (HRV)
// Time-domain: RMSSD, SDNN, pNN50 from inter-beat intervals.
//
// Category:       health-biometric
// Classification:  Health Indicator
// Tier:           1 (PERIODIC — every 5s)
// Consumes:       A01 (IBI buffer), CH_ACCEL
// Consumed by:    X05, X08, C01, C03
// Citation:       Task Force ESC/NASPE 1996
// ═══════════════════════════════════════════════════════════════

namespace {
    // Minimum R-R intervals for valid HRV
    constexpr uint16_t MIN_RR_COUNT       = 30;

    // IBI outlier rejection
    constexpr float IBI_OUTLIER_PCT       = 0.20f;   // 20% deviation from running median
    constexpr float IBI_MIN_MS            = 300.0f;   // >200 BPM artifact
    constexpr float IBI_MAX_MS            = 2000.0f;  // <30 BPM gap

    // pNN50 threshold
    constexpr float NN50_THRESHOLD_MS     = 50.0f;

    // Output clamping per §6.2
    constexpr float RMSSD_CLAMP_HIGH      = 300.0f;   // ms
    constexpr float SDNN_CLAMP_HIGH       = 300.0f;   // ms
    constexpr float PNN50_CLAMP_HIGH      = 100.0f;   // %

    // Motion
    constexpr float MOTION_THRESHOLD      = 0.5f;     // g — HRV less motion-sensitive than morphology

    // SQI
    constexpr float SQI_THRESHOLD         = 0.5f;
}

// ─── Init ──────────────────────────────────────────────────────
void Algo_A02::init() {
    localIBI_.clear();
    state_ = AlgoState::ACQUIRING;
    output_ = {0, 0, 0, false};
    rmssd_ = 0;
    sdnn_ = 0;
    pnn50_ = 0;
    lastProcessedBeatCount_ = 0;
    motionLevel_ = 0;
}

// ─── SQI ───────────────────────────────────────────────────────
float Algo_A02::computeSQI() const {
    // 1. IBI count coverage (40%) — more beats = more reliable
    // 30 beats → SQI 0.0, 120 beats → SQI 1.0
    float sqi_count = fminf(fmaxf(((float)localIBI_.count() - 30.0f) / 90.0f, 0.0f), 1.0f);

    // 2. A01 SQI (30%) — if upstream is low quality, HRV is degraded
    float a01_sqi = (a01_) ? a01_->getSQI() : 0;
    float sqi_upstream = fminf(fmaxf((a01_sqi - 0.3f) / 0.5f, 0.0f), 1.0f);

    // 3. Motion (30%)
    float sqi_motion = fminf(fmaxf(1.0f - motionLevel_ / MOTION_THRESHOLD, 0.0f), 1.0f);

    return 0.4f * sqi_count + 0.3f * sqi_upstream + 0.3f * sqi_motion;
}

// ─── Update ────────────────────────────────────────────────────
void Algo_A02::update(uint32_t now_ms) {
    if (!a01_) { state_ = AlgoState::IDLE; return; }

    // 1. Check A01 state
    if (a01_->getState() == AlgoState::IDLE) {
        state_ = AlgoState::IDLE;
        output_ = {0, 0, now_ms, false};
        return;
    }

    // 2. Motion check
    if (imu_) {
        float mag = imu_->getAccelMagnitude();
        motionLevel_ = fminf(fabsf(mag - 1.0f) / 2.0f, 1.0f);
    }
    if (motionLevel_ > MOTION_THRESHOLD) {
        // HRV during heavy motion is unreliable
        state_ = AlgoState::LOW_QUALITY;
        output_.valid = false;
        return;
    }

    // 3. Copy new IBIs from A01's buffer
    const auto& a01IBI = a01_->getIBIBuffer();
    uint16_t a01Count = a01IBI.count();
    if (a01Count <= lastProcessedBeatCount_) return;  // No new beats

    uint16_t newBeats = a01Count - lastProcessedBeatCount_;
    for (uint16_t i = 0; i < newBeats && i < a01IBI.count(); i++) {
        float ibi = a01IBI.at(newBeats - 1 - i);  // oldest new first
        // Basic outlier filtering
        if (ibi < IBI_MIN_MS || ibi > IBI_MAX_MS) continue;
        // Median-based outlier rejection
        if (localIBI_.count() > 5) {
            float med = localIBI_.median();
            if (fabsf(ibi - med) / med > IBI_OUTLIER_PCT) continue;
        }
        localIBI_.push(ibi, now_ms);
    }
    lastProcessedBeatCount_ = a01Count;

    // 4. Check minimum count
    uint16_t n = localIBI_.count();
    if (n < MIN_RR_COUNT) {
        state_ = AlgoState::ACQUIRING;
        output_ = {0, 0, now_ms, false};
        return;
    }

    // 5. Compute SDNN (standard deviation of all NN intervals)
    float sum = 0;
    for (uint16_t i = 0; i < n; i++) sum += localIBI_.at(i);
    float meanIBI = sum / n;

    float sumSqDev = 0;
    for (uint16_t i = 0; i < n; i++) {
        float d = localIBI_.at(i) - meanIBI;
        sumSqDev += d * d;
    }
    sdnn_ = sqrtf(sumSqDev / (n - 1));

    // 6. Compute RMSSD (root mean square of successive differences)
    float sumSqDiff = 0;
    uint16_t nn50Count = 0;
    for (uint16_t i = 0; i < n - 1; i++) {
        float diff = localIBI_.at(i) - localIBI_.at(i + 1);
        sumSqDiff += diff * diff;
        if (fabsf(diff) > NN50_THRESHOLD_MS) nn50Count++;
    }
    rmssd_ = sqrtf(sumSqDiff / (n - 1));

    // 7. Compute pNN50
    pnn50_ = ((float)nn50Count / (float)(n - 1)) * 100.0f;

    // 8. Clamp
    rmssd_ = fminf(rmssd_, RMSSD_CLAMP_HIGH);
    sdnn_  = fminf(sdnn_, SDNN_CLAMP_HIGH);
    pnn50_ = fminf(pnn50_, PNN50_CLAMP_HIGH);

    // 9. Output
    float sqi = computeSQI();
    if (sqi < SQI_THRESHOLD) {
        state_ = AlgoState::LOW_QUALITY;
        output_ = {rmssd_, sqi, now_ms, false};
        return;
    }

    state_ = AlgoState::VALID;
    output_ = {rmssd_, sqi, now_ms, true};
}

// ─── Getters ───────────────────────────────────────────────────
AlgorithmOutput Algo_A02::getOutput() const { return output_; }
AlgoState Algo_A02::getState() const { return state_; }
