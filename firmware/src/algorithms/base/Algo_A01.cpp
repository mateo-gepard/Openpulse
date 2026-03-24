#include "Algo_A01.h"
#include "../../framework/SensorDriverBase.h"
// ═══════════════════════════════════════════════════════════════
// A01: Heart Rate (Real-Time)
// Adaptive peak detection with 8-beat EMA averaging.
//
// Category:       health-biometric
// Classification:  Wellness
// Tier:           0 (REALTIME)
// Consumes:       CH_PPG, CH_ACCEL
// Consumed by:    A02, A04, A06, A24, X01, C01
// Citation:       Elgendi 2013 "Optimal PPG peak detection"
// ═══════════════════════════════════════════════════════════════

// ─── Constants ─────────────────────────────────────────────────
namespace {
    // Bandpass filter: 0.5–4.0 Hz at 100 Hz (covers 30–240 BPM)
    // Pre-computed via scipy.signal.butter(4, [0.5, 4.0], btype='band', fs=100, output='sos')
    // Section 1
    constexpr float BPF_S1_B0 =  0.01223403f;
    constexpr float BPF_S1_B1 =  0.0f;
    constexpr float BPF_S1_B2 = -0.01223403f;
    constexpr float BPF_S1_A1 = -1.89532220f;
    constexpr float BPF_S1_A2 =  0.90975388f;
    // Section 2
    constexpr float BPF_S2_B0 =  1.0f;
    constexpr float BPF_S2_B1 =  0.0f;
    constexpr float BPF_S2_B2 = -1.0f;
    constexpr float BPF_S2_A1 = -1.97537668f;
    constexpr float BPF_S2_A2 =  0.97553797f;
    // Section 3
    constexpr float BPF_S3_B0 =  1.0f;
    constexpr float BPF_S3_B1 =  0.0f;
    constexpr float BPF_S3_B2 = -1.0f;
    constexpr float BPF_S3_A1 = -1.82269493f;
    constexpr float BPF_S3_A2 =  0.83783555f;
    // Section 4
    constexpr float BPF_S4_B0 =  1.0f;
    constexpr float BPF_S4_B1 =  0.0f;
    constexpr float BPF_S4_B2 = -1.0f;
    constexpr float BPF_S4_A1 = -1.96082877f;
    constexpr float BPF_S4_A2 =  0.96127076f;

    // Peak detection — Elgendi 2013
    constexpr float PEAK_THRESHOLD_K      = 0.6f;   // × stddev
    constexpr uint32_t REFRACTORY_MS      = 250;     // max 240 BPM
    constexpr uint16_t RUNNING_WINDOW     = 300;     // 3s at 100 Hz

    // IBI validation
    constexpr float MIN_IBI_MS            = 300.0f;  // max 200 BPM
    constexpr float MAX_IBI_MS            = 2000.0f; // min 30 BPM

    // Output
    constexpr float EMA_ALPHA             = 2.0f / (8.0f + 1.0f);  // 8-beat EMA
    constexpr uint16_t MIN_VALID_BEATS    = 4;
    constexpr float BPM_CLAMP_LOW         = 30.0f;
    constexpr float BPM_CLAMP_HIGH        = 220.0f;
    constexpr float OUTLIER_THRESHOLD     = 0.30f;   // 30% deviation

    // SQI
    constexpr float SQI_THRESHOLD         = 0.4f;    // §6.3 — HR is robust
    constexpr float PI_THRESHOLD          = 0.1f;    // % — min perfusion index

    // DC tracking (EMA for DC level)
    constexpr float DC_ALPHA              = 0.001f;  // ~0.016 Hz cutoff at 100 Hz
}

// ─── Init ──────────────────────────────────────────────────────
void Algo_A01::init() {
    ppgBuf_.clear();
    ibiBuf_.clear();
    peakAmpBuf_.clear();

    state_ = AlgoState::ACQUIRING;
    output_ = {0, 0, 0, false};
    emaBPM_ = 0;
    validBeatCount_ = 0;
    lastPeakTs_ = 0;
    lastIBI_ms_ = 0;
    refractoryEnd_ = 0;
    aboveThreshold_ = false;
    currentPeakVal_ = 0;
    currentPeakTs_ = 0;
    runningMean_ = 0;
    runningVar_ = 0;
    dcLevel_ = 0;
    acAmplitude_ = 0;
    perfusionIndex_ = 0;
    peakProminence_ = 0;
    motionLevel_ = 0;
    lastOutputTs_ = 0;

    initFilters();
}

void Algo_A01::initFilters() {
    bpf_[0] = {BPF_S1_B0, BPF_S1_B1, BPF_S1_B2, BPF_S1_A1, BPF_S1_A2, 0,0,0,0};
    bpf_[1] = {BPF_S2_B0, BPF_S2_B1, BPF_S2_B2, BPF_S2_A1, BPF_S2_A2, 0,0,0,0};
    bpf_[2] = {BPF_S3_B0, BPF_S3_B1, BPF_S3_B2, BPF_S3_A1, BPF_S3_A2, 0,0,0,0};
    bpf_[3] = {BPF_S4_B0, BPF_S4_B1, BPF_S4_B2, BPF_S4_A1, BPF_S4_A2, 0,0,0,0};
}

float Algo_A01::applyBandpass(float sample) {
    float y = sample;
    for (uint8_t i = 0; i < 4; i++) {
        y = bpf_[i].process(y);
    }
    return y;
}

// ─── DC Tracking & Perfusion Index ─────────────────────────────
void Algo_A01::updateDCTracking(float rawSample) {
    if (dcLevel_ == 0) {
        dcLevel_ = rawSample;  // seed on first sample
    } else {
        dcLevel_ = DC_ALPHA * rawSample + (1.0f - DC_ALPHA) * dcLevel_;
    }
}

// ─── Motion Level from IMU ─────────────────────────────────────
float Algo_A01::computeMotionLevel() {
    if (!imu_) return 0;
    float mag = imu_->getAccelMagnitude();
    float motion_g = fabsf(mag - 1.0f);  // Remove gravity
    return fminf(motion_g / 2.0f, 1.0f);  // 0.0=still, 1.0=heavy motion
}

// ─── SQI ───────────────────────────────────────────────────────
// Three components: perfusion index (40%), peak prominence (30%), motion (30%)
float Algo_A01::computeSQI() const {
    // 1. Perfusion Index: PI > 2% → 1.0, PI < 0% → 0.0
    float sqi_pi = fminf(fmaxf(perfusionIndex_ / 2.0f, 0.0f), 1.0f);

    // 2. Peak prominence: prominence > 5 → 1.0, < 1 → 0.0
    float sqi_prom = fminf(fmaxf((peakProminence_ - 1.0f) / 4.0f, 0.0f), 1.0f);

    // 3. Motion: 0.1g → 1.0, 1.0g → 0.0
    float sqi_motion = fminf(fmaxf(1.0f - (motionLevel_ * 2.0f - 0.1f) / 0.9f, 0.0f), 1.0f);
    if (motionLevel_ < 0.05f) sqi_motion = 1.0f;

    return 0.4f * sqi_pi + 0.3f * sqi_prom + 0.3f * sqi_motion;
}

// ─── Update (called every loop tick) ───────────────────────────
void Algo_A01::update(uint32_t now_ms) {
    if (!ppg_) { state_ = AlgoState::IDLE; return; }

    // 1. Read raw PPG sample
    SensorSample sample = ppg_->getLatest();
    if (!sample.valid) return;

    float raw = sample.value;
    updateDCTracking(raw);

    // 2. Bandpass filter
    float filtered = applyBandpass(raw);
    ppgBuf_.push(filtered, now_ms);

    // 3. Motion level
    motionLevel_ = computeMotionLevel();

    // 4. Running statistics for adaptive threshold (3s window)
    uint16_t n = ppgBuf_.count();
    if (n < RUNNING_WINDOW) {
        // Insufficient data — stay in ACQUIRING
        if (state_ != AlgoState::IDLE) state_ = AlgoState::ACQUIRING;
        return;
    }

    // Compute mean and stddev over recent window
    float sum = 0, sumSq = 0;
    for (uint16_t i = 0; i < RUNNING_WINDOW; i++) {
        float v = ppgBuf_.at(i);
        sum += v;
        sumSq += v * v;
    }
    runningMean_ = sum / RUNNING_WINDOW;
    runningVar_ = (sumSq / RUNNING_WINDOW) - (runningMean_ * runningMean_);
    float runningStd = sqrtf(fmaxf(runningVar_, 0.0f));

    // 5. Adaptive peak detection — Elgendi 2013
    float threshold = runningMean_ + PEAK_THRESHOLD_K * runningStd;
    float currentSample = ppgBuf_.at(0);

    if (now_ms < refractoryEnd_) return;  // Refractory period

    if (currentSample > threshold) {
        if (!aboveThreshold_) {
            // Just crossed above threshold
            aboveThreshold_ = true;
            currentPeakVal_ = currentSample;
            currentPeakTs_ = now_ms;
        } else if (currentSample > currentPeakVal_) {
            // Still above, track maximum
            currentPeakVal_ = currentSample;
            currentPeakTs_ = now_ms;
        }
    } else if (aboveThreshold_) {
        // Just fell below threshold — peak confirmed
        aboveThreshold_ = false;

        // Validate peak: slope check (preceding sample must be lower)
        float prevSample = ppgBuf_.at(1);
        if (currentPeakVal_ <= prevSample) return;  // Not a real peak

        // Calculate IBI
        if (lastPeakTs_ > 0) {
            float ibi_ms = (float)(currentPeakTs_ - lastPeakTs_);

            // Debounce: reject physiologically impossible IBIs
            if (ibi_ms < MIN_IBI_MS || ibi_ms > MAX_IBI_MS) {
                if (ibi_ms > MAX_IBI_MS) {
                    // Gap detected — finger repositioned, reset
                    validBeatCount_ = 0;
                    emaBPM_ = 0;
                }
                lastPeakTs_ = currentPeakTs_;
                refractoryEnd_ = now_ms + REFRACTORY_MS;
                return;
            }

            // Compute instantaneous BPM
            float instantBPM = 60000.0f / ibi_ms;

            // Outlier rejection
            if (emaBPM_ > 0) {
                float deviation = fabsf(instantBPM - emaBPM_) / emaBPM_;
                float sqi = computeSQI();
                if (deviation > OUTLIER_THRESHOLD && sqi < 0.7f) {
                    // Reject — likely artifact
                    lastPeakTs_ = currentPeakTs_;
                    refractoryEnd_ = now_ms + REFRACTORY_MS;
                    return;
                }
            }

            // Accept beat
            ibiBuf_.push(ibi_ms, currentPeakTs_);
            peakAmpBuf_.push(currentPeakVal_, currentPeakTs_);
            validBeatCount_++;
            lastIBI_ms_ = ibi_ms;

            // AC amplitude for perfusion index (peak-to-trough in recent window)
            acAmplitude_ = currentPeakVal_ - runningMean_;
            if (dcLevel_ > 0) {
                perfusionIndex_ = (acAmplitude_ / dcLevel_) * 100.0f;
            }

            // Peak prominence for SQI
            if (runningStd > 0) {
                peakProminence_ = (currentPeakVal_ - runningMean_) / runningStd;
            }

            // EMA BPM
            if (emaBPM_ == 0) {
                emaBPM_ = instantBPM;
            } else {
                emaBPM_ = EMA_ALPHA * instantBPM + (1.0f - EMA_ALPHA) * emaBPM_;
            }
        }

        lastPeakTs_ = currentPeakTs_;
        refractoryEnd_ = now_ms + REFRACTORY_MS;
    }

    // 6. Output gating
    if (perfusionIndex_ < PI_THRESHOLD) {
        // No finger detected
        state_ = AlgoState::IDLE;
        output_ = {0, 0, now_ms, false};
        if (now_ms - lastPeakTs_ > 3000) {
            validBeatCount_ = 0;
            emaBPM_ = 0;
        }
        return;
    }

    if (validBeatCount_ < MIN_VALID_BEATS) {
        state_ = AlgoState::ACQUIRING;
        output_ = {0, 0, now_ms, false};
        return;
    }

    // 7. Clamp and output
    float bpm = fminf(fmaxf(emaBPM_, BPM_CLAMP_LOW), BPM_CLAMP_HIGH);
    float sqi = computeSQI();

    if (sqi < SQI_THRESHOLD) {
        state_ = AlgoState::LOW_QUALITY;
        output_ = {bpm, sqi, now_ms, false};
        return;
    }

    state_ = AlgoState::VALID;
    output_ = {bpm, sqi, now_ms, true};
}

// ─── Getters ───────────────────────────────────────────────────
AlgorithmOutput Algo_A01::getOutput() const { return output_; }
AlgoState Algo_A01::getState() const { return state_; }
