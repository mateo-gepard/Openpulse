#include "Algo_A03.h"
#include "../../framework/SensorDriverBase.h"
// ═══════════════════════════════════════════════════════════════
// A03: Blood Oxygen Saturation (SpO2)
// Dual-wavelength ratio-of-ratios with 4s averaging windows.
//
// Category:       health-biometric
// Classification:  Health Screening
// Tier:           2 (ON_DEMAND)
// Consumes:       CH_PPG (Red + IR), CH_ACCEL
// Consumed by:    X17, C01
// Citation:       Maxim AN6409 (2018), Jubran 2015
// ═══════════════════════════════════════════════════════════════

namespace {
    // DC EMA — isolates non-pulsatile baseline
    constexpr float DC_ALPHA            = 0.005f;    // ~0.5 Hz at 100 Hz

    // AC bandpass 0.5–5.0 Hz at 100 Hz (2nd-order Butterworth)
    // scipy.signal.butter(2, [0.5, 5.0], btype='band', fs=100, output='sos')
    // Section 1
    constexpr float BPF_S1_B0 =  0.04658291f;
    constexpr float BPF_S1_B1 =  0.0f;
    constexpr float BPF_S1_B2 = -0.04658291f;
    constexpr float BPF_S1_A1 = -1.81254327f;
    constexpr float BPF_S1_A2 =  0.82724781f;
    // Section 2
    constexpr float BPF_S2_B0 =  1.0f;
    constexpr float BPF_S2_B1 =  0.0f;
    constexpr float BPF_S2_B2 = -1.0f;
    constexpr float BPF_S2_A1 = -1.96082877f;
    constexpr float BPF_S2_A2 =  0.96127076f;

    // R-ratio validity
    constexpr float R_MIN               = 0.2f;
    constexpr float R_MAX               = 2.0f;

    // SpO2 linear lookup: SpO2 = A + B × R (Maxim AN6409)
    constexpr float SPO2_COEFF_A        = 110.0f;
    constexpr float SPO2_COEFF_B        = -25.0f;

    // Output clamping
    constexpr float SPO2_CLAMP_LOW      = 70.0f;    // %
    constexpr float SPO2_CLAMP_HIGH     = 100.0f;   // %

    // Motion
    constexpr float MOTION_THRESHOLD    = 0.2f;     // g — extremely sensitive
    constexpr uint32_t SETTLE_TIME_MS   = 4000;     // 4s post-motion

    // Tissue contact
    constexpr float DC_CONTACT_MIN      = 1000.0f;  // Raw DC threshold
    constexpr float PI_RED_MIN          = 0.3f;     // % — red PI must be sufficient

    // SQI
    constexpr float SQI_THRESHOLD       = 0.6f;     // Strict for SpO2

    // Confidence interval
    constexpr float CI_HIGH_SQI         = 2.0f;     // ±2% at SQI > 0.8
    constexpr float CI_LOW_SQI          = 4.0f;     // ±4% at SQI 0.6–0.8
}

// ─── Filter Init ───────────────────────────────────────────────
void Algo_A03::initFilters() {
    // Identical bandpass for both red and IR channels
    auto initPair = [](Biquad* f) {
        f[0] = {BPF_S1_B0, BPF_S1_B1, BPF_S1_B2, BPF_S1_A1, BPF_S1_A2, 0,0,0,0};
        f[1] = {BPF_S2_B0, BPF_S2_B1, BPF_S2_B2, BPF_S2_A1, BPF_S2_A2, 0,0,0,0};
    };
    initPair(redBPF_);
    initPair(irBPF_);
}

// ─── Init ──────────────────────────────────────────────────────
void Algo_A03::init() {
    initFilters();
    acRedBuf_.clear();
    acIRBuf_.clear();
    dcRed_ = 0;
    dcIR_ = 0;
    rRatio_ = 0;
    spo2_ = 0;
    sampleCount_ = 0;
    motionLevel_ = 0;
    motionClearTs_ = 0;
    rHistIdx_ = 0;
    rHistCount_ = 0;
    state_ = AlgoState::ACQUIRING;
    output_ = {0, 0, 0, false};
    calibOut_ = {0, 0, 0, 0, 0, false, false, 0};
}

// ─── SQI ───────────────────────────────────────────────────────
float Algo_A03::computeSQI() const {
    // 1. Perfusion Index Red (25%) — PI > 1% good, < 0.3% bad
    float piRed = (dcRed_ > DC_CONTACT_MIN) ?
        (acRedBuf_.count() > 0 ? (acRedBuf_.max() - acRedBuf_.min()) / dcRed_ * 100.0f : 0) : 0;
    float sqi_pi = fminf(fmaxf((piRed - 0.3f) / 0.7f, 0.0f), 1.0f);

    // 2. AC Correlation Red vs IR (25%) — simplified: check both have energy
    float acRedRange = (acRedBuf_.count() > 100) ? (acRedBuf_.max() - acRedBuf_.min()) : 0;
    float acIRRange  = (acIRBuf_.count() > 100) ? (acIRBuf_.max() - acIRBuf_.min()) : 0;
    float minRange = fminf(acRedRange, acIRRange);
    float maxRange = fmaxf(acRedRange, acIRRange);
    float sqi_cc = (maxRange > 0) ? fminf(fmaxf(minRange / maxRange, 0.0f), 1.0f) : 0;

    // 3. R-ratio stability (25%) — within valid range and not at extremes
    float sqi_r = 0;
    if (rRatio_ >= R_MIN && rRatio_ <= R_MAX) {
        // Lower R is better (higher SpO2) — penalize extreme values
        float rCenter = (R_MIN + R_MAX) / 2.0f;
        float rDist = fabsf(rRatio_ - 0.5f);  // Ideal R around 0.4-0.6 for normal SpO2
        sqi_r = fminf(fmaxf(1.0f - rDist / 1.5f, 0.0f), 1.0f);
    }

    // 4. Motion (25%)
    float sqi_motion = fminf(fmaxf(1.0f - motionLevel_ / MOTION_THRESHOLD, 0.0f), 1.0f);

    return 0.25f * sqi_pi + 0.25f * sqi_cc + 0.25f * sqi_r + 0.25f * sqi_motion;
}

float Algo_A03::medianOfThree(float a, float b, float c) const {
    if (a > b) { float t = a; a = b; b = t; }
    if (b > c) { float t = b; b = c; c = t; }
    if (a > b) { float t = a; a = b; b = t; }
    return b;
}

// ─── Update ────────────────────────────────────────────────────
void Algo_A03::update(uint32_t now_ms) {
    if (!ppg_) { state_ = AlgoState::IDLE; return; }

    // 1. Read raw Red + IR
    float rawRed = ppg_->getPPG_Red();
    float rawIR  = ppg_->getPPG_IR();

    // 2. Tissue contact check
    if (rawIR < DC_CONTACT_MIN && rawRed < DC_CONTACT_MIN) {
        state_ = AlgoState::IDLE;
        output_ = {0, 0, now_ms, false};
        return;
    }

    // 3. Motion check
    if (imu_) {
        float mag = imu_->getAccelMagnitude();
        motionLevel_ = fminf(fabsf(mag - 1.0f) / 2.0f, 1.0f);
    }
    if (motionLevel_ > MOTION_THRESHOLD) {
        motionClearTs_ = now_ms + SETTLE_TIME_MS;
        state_ = AlgoState::LOW_QUALITY;
        output_.valid = false;
        return;
    }
    // Post-motion settle
    if (now_ms < motionClearTs_) {
        state_ = AlgoState::ACQUIRING;
        output_.valid = false;
        return;
    }

    // 4. DC tracking (slow EMA)
    if (dcRed_ < 1.0f) { dcRed_ = rawRed; dcIR_ = rawIR; }
    dcRed_ = DC_ALPHA * rawRed + (1.0f - DC_ALPHA) * dcRed_;
    dcIR_  = DC_ALPHA * rawIR  + (1.0f - DC_ALPHA) * dcIR_;

    // 5. AC extraction — bandpass filter cascaded sections
    float acRed = rawRed - dcRed_;
    for (int s = 0; s < 2; s++) acRed = redBPF_[s].process(acRed);
    float acIR = rawIR - dcIR_;
    for (int s = 0; s < 2; s++) acIR = irBPF_[s].process(acIR);

    acRedBuf_.push(acRed, now_ms);
    acIRBuf_.push(acIR, now_ms);
    sampleCount_++;

    // 6. Wait for full window (4 seconds at 100 Hz = 400 samples)
    if (sampleCount_ < AC_WIN) {
        state_ = AlgoState::ACQUIRING;
        output_ = {0, 0, now_ms, false};
        return;
    }

    // Only compute R every 200 samples (2s hop for 50% overlap)
    if (sampleCount_ % 200 != 0) return;

    // 7. AC amplitudes (peak-to-trough in window)
    float acAmpRed = acRedBuf_.max() - acRedBuf_.min();
    float acAmpIR  = acIRBuf_.max() - acIRBuf_.min();

    // Guard: DC must be valid, AC must have energy
    if (dcRed_ < DC_CONTACT_MIN || dcIR_ < DC_CONTACT_MIN) {
        state_ = AlgoState::LOW_QUALITY;
        output_.valid = false;
        return;
    }
    if (acAmpIR < 1.0f) {
        state_ = AlgoState::LOW_QUALITY;
        output_.valid = false;
        return;
    }

    // 8. R = (AC_red/DC_red) / (AC_ir/DC_ir)
    float ratioRed = acAmpRed / dcRed_;
    float ratioIR  = acAmpIR / dcIR_;
    float R = (ratioIR > 1e-6f) ? (ratioRed / ratioIR) : R_MAX;

    // Validate R range
    if (R < R_MIN || R > R_MAX) {
        state_ = AlgoState::LOW_QUALITY;
        output_.valid = false;
        return;
    }

    // 9. Median filter over successive R windows
    rHistory_[rHistIdx_] = R;
    rHistIdx_ = (rHistIdx_ + 1) % MEDIAN_DEPTH;
    if (rHistCount_ < MEDIAN_DEPTH) rHistCount_++;

    float Rmedian;
    if (rHistCount_ >= MEDIAN_DEPTH) {
        Rmedian = medianOfThree(rHistory_[0], rHistory_[1], rHistory_[2]);
    } else {
        Rmedian = R;  // Not enough history yet
    }
    rRatio_ = Rmedian;

    // 10. SpO2 = 110 - 25 × R
    float spo2Raw = SPO2_COEFF_A + SPO2_COEFF_B * Rmedian;
    spo2_ = fminf(fmaxf(spo2Raw, SPO2_CLAMP_LOW), SPO2_CLAMP_HIGH);

    // 11. SQI & output
    float sqi = computeSQI();
    if (sqi < SQI_THRESHOLD) {
        state_ = AlgoState::LOW_QUALITY;
        output_ = {spo2_, sqi, now_ms, false};
        return;
    }

    state_ = AlgoState::VALID;
    output_ = {spo2_, sqi, now_ms, true};

    // Build calibrated output with confidence interval
    float ci = (sqi > 0.8f) ? CI_HIGH_SQI : CI_LOW_SQI;
    calibOut_ = {
        spo2_,                              // value
        fmaxf(spo2_ - ci, SPO2_CLAMP_LOW), // ci_low
        fminf(spo2_ + ci, SPO2_CLAMP_HIGH),// ci_high
        sqi,                                // sqi
        now_ms,                             // timestamp_ms
        true,                               // valid
        false,                              // calibrated (linear approx only)
        0                                   // calibration_age_ms
    };
}

// ─── Getters ───────────────────────────────────────────────────
AlgorithmOutput Algo_A03::getOutput() const { return output_; }
AlgoState Algo_A03::getState() const { return state_; }
