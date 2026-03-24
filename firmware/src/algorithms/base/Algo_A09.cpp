#include "Algo_A09.h"
#include "../../framework/SensorDriverBase.h"
// ═══════════════════════════════════════════════════════════════
// A09: Perfusion Index
// PI = (AC_amplitude / DC_level) × 100
//
// Category:       health-biometric
// Classification:  Wellness
// Tier:           0 (REALTIME)
// Consumes:       CH_PPG
// Citation:       Elgendi 2016 "Optimal SQI for PPG"
// ═══════════════════════════════════════════════════════════════

namespace {
    // DC EMA: alpha = 0.005 → ~0.08 Hz cutoff at 100 Hz
    constexpr float DC_ALPHA           = 0.005f;

    // AC bandpass: 0.5–5.0 Hz, 2nd-order Butterworth at 100 Hz
    // scipy.signal.butter(2, [0.5, 5.0], btype='band', fs=100, output='sos')
    constexpr float AC_S1_B0 =  0.06745527f;
    constexpr float AC_S1_B1 =  0.0f;
    constexpr float AC_S1_B2 = -0.06745527f;
    constexpr float AC_S1_A1 = -1.86689228f;
    constexpr float AC_S1_A2 =  0.87508946f;

    constexpr float AC_S2_B0 =  1.0f;
    constexpr float AC_S2_B1 =  0.0f;
    constexpr float AC_S2_B2 = -1.0f;
    constexpr float AC_S2_A1 = -1.72377617f;
    constexpr float AC_S2_A2 =  0.75788337f;

    // Gating
    constexpr float DC_MIN_THRESHOLD   = 1000.0f;   // Below = no tissue contact
    constexpr float PI_CLAMP_LOW       = 0.0f;
    constexpr float PI_CLAMP_HIGH      = 20.0f;     // %
    constexpr uint16_t MIN_SAMPLES     = 200;        // 2s warm-up at 100 Hz

    // SQI
    constexpr float SQI_THRESHOLD      = 0.3f;
}

// ─── Init ──────────────────────────────────────────────────────
void Algo_A09::init() {
    acBuf_.clear();
    state_ = AlgoState::ACQUIRING;
    output_ = {0, 0, 0, false};
    dcLevel_ = 0;
    acAmplitude_ = 0;
    acPeak_ = 0;
    acTrough_ = 0;
    pi_ = 0;
    sampleCount_ = 0;
    initFilters();
}

void Algo_A09::initFilters() {
    acFilter_[0] = {AC_S1_B0, AC_S1_B1, AC_S1_B2, AC_S1_A1, AC_S1_A2, 0,0,0,0};
    acFilter_[1] = {AC_S2_B0, AC_S2_B1, AC_S2_B2, AC_S2_A1, AC_S2_A2, 0,0,0,0};
}

// ─── SQI ───────────────────────────────────────────────────────
float Algo_A09::computeSQI() const {
    // PI itself is the quality measure. High PI = good signal.
    // PI > 2% → SQI 1.0, PI < 0.1% → SQI 0.0
    float sqi_pi = fminf(fmaxf((pi_ - 0.1f) / 1.9f, 0.0f), 1.0f);

    // DC stability: if DC is very low, signal is poor
    float sqi_dc = (dcLevel_ > DC_MIN_THRESHOLD) ? 1.0f : 0.0f;

    return 0.6f * sqi_pi + 0.4f * sqi_dc;
}

// ─── Update ────────────────────────────────────────────────────
void Algo_A09::update(uint32_t now_ms) {
    if (!ppg_) { state_ = AlgoState::IDLE; return; }

    SensorSample sample = ppg_->getLatest();
    if (!sample.valid) return;

    float raw = sample.value;
    sampleCount_++;

    // 1. DC tracking (very slow EMA)
    if (dcLevel_ == 0) {
        dcLevel_ = raw;
    } else {
        dcLevel_ = DC_ALPHA * raw + (1.0f - DC_ALPHA) * dcLevel_;
    }

    // 2. No tissue contact check
    if (dcLevel_ < DC_MIN_THRESHOLD) {
        state_ = AlgoState::IDLE;
        output_ = {0, 0, now_ms, false};
        pi_ = 0;
        return;
    }

    // 3. AC component extraction (bandpass filter)
    float ac = raw - dcLevel_;
    for (uint8_t i = 0; i < 2; i++) {
        ac = acFilter_[i].process(ac);
    }
    acBuf_.push(ac, now_ms);

    // 4. Warm-up
    if (sampleCount_ < MIN_SAMPLES) {
        state_ = AlgoState::ACQUIRING;
        output_ = {0, 0, now_ms, false};
        return;
    }

    // 5. AC amplitude: peak-to-trough over 4-second window
    acPeak_ = acBuf_.max();
    acTrough_ = acBuf_.min();
    acAmplitude_ = acPeak_ - acTrough_;

    // 6. Perfusion Index = (AC / DC) × 100
    pi_ = (acAmplitude_ / dcLevel_) * 100.0f;
    pi_ = fminf(fmaxf(pi_, PI_CLAMP_LOW), PI_CLAMP_HIGH);

    // 7. SQI and output
    float sqi = computeSQI();

    if (sqi < SQI_THRESHOLD) {
        state_ = AlgoState::LOW_QUALITY;
        output_ = {pi_, sqi, now_ms, false};
        return;
    }

    state_ = AlgoState::VALID;
    output_ = {pi_, sqi, now_ms, true};
}

// ─── Getters ───────────────────────────────────────────────────
AlgorithmOutput Algo_A09::getOutput() const { return output_; }
AlgoState Algo_A09::getState() const { return state_; }
