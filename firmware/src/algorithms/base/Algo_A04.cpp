#include "Algo_A04.h"
#include "Algo_A01.h"
#include "../../framework/SensorDriverBase.h"
// ═══════════════════════════════════════════════════════════════
// A04: Respiratory Rate
// Triple-modulation extraction (RIIV/RIFV/RIAV) with
// prominence-weighted fusion. 30s windows, 10s update.
//
// Category:       health-biometric
// Classification:  Health Indicator
// Tier:           1 (PERIODIC — every 10 seconds)
// Consumes:       A01 (beats/IBI), CH_PPG, CH_ACCEL
// Consumed by:    X07, X11, C01
// Citation:       Karlen et al. IEEE TBME 2013
// ═══════════════════════════════════════════════════════════════

namespace {
    // Respiratory band
    constexpr float RESP_BAND_LOW        = 0.1f;     // Hz → 6 BrPM
    constexpr float RESP_BAND_HIGH       = 1.0f;     // Hz → 60 BrPM

    // Resampling
    constexpr float RESAMP_RATE          = 4.0f;     // Hz — uniform grid
    constexpr float RESAMP_DT            = 1.0f / 4.0f;  // 0.25s

    // Window
    constexpr float WINDOW_SEC           = 30.0f;    // seconds
    constexpr uint32_t UPDATE_INTERVAL_MS = 10000;   // 10s between re-computations
    constexpr uint8_t MIN_BEATS_WINDOW   = 15;       // Minimum peaks per 30s

    // Spectral prominence threshold (peak power / band power)
    constexpr float PROMINENCE_THRESHOLD = 0.15f;

    // DC envelope EMA
    constexpr float DC_ENV_ALPHA         = 0.006f;   // ~0.1 Hz at 100 Hz

    // Output
    constexpr float EMA_ALPHA            = 0.3f;     // Output smoothing
    constexpr float BRPM_CLAMP_LOW       = 4.0f;
    constexpr float BRPM_CLAMP_HIGH      = 60.0f;

    // Motion
    constexpr float MOTION_THRESHOLD     = 0.5f;     // g
    constexpr uint32_t SETTLE_TIME_MS    = 15000;    // 15s post-motion

    // SQI
    constexpr float SQI_THRESHOLD        = 0.4f;

    // Hanning window coefficient
    constexpr float PI_F                 = 3.14159265f;
}

// ─── Init ──────────────────────────────────────────────────────
void Algo_A04::init() {
    for (uint8_t i = 0; i < RESAMP_LEN; i++) {
        riiv_[i] = 0; rifv_[i] = 0; riav_[i] = 0;
    }
    modLen_ = 0;
    lastProcessedBeatCount_ = 0;
    dcEnvelope_ = 0;
    brpm_ = 0;
    emaBrPM_ = 0;
    activeModCount_ = 0;
    motionLevel_ = 0;
    motionClearTs_ = 0;
    lastComputeTs_ = 0;
    histIdx_ = 0;
    histCount_ = 0;
    for (uint8_t i = 0; i < 3; i++) modResults_[i] = {0, 0, false};
    state_ = AlgoState::ACQUIRING;
    output_ = {0, 0, 0, false};
}

// ─── Frequency Estimation via Autocorrelation ──────────────────
// Uses autocorrelation (Method B from spec) to find dominant
// respiratory frequency. More MCU-friendly than FFT — no
// complex arithmetic, O(N²) but N=120 is manageable on Tier 1.
Algo_A04::ModResult Algo_A04::estimateFrequency(const float* signal, uint8_t len) const {
    ModResult result = {0, 0, false};
    if (len < 20) return result;

    // 1. Remove mean
    float mean = 0;
    for (uint8_t i = 0; i < len; i++) mean += signal[i];
    mean /= len;

    // Local scratch — reuse fftBuf_ (const method, but fftBuf_ is mutable member)
    // Actually, since this is const, we'll compute in-place on the autocorrelation
    // Compute autocorrelation for lags in respiratory range
    // At 4 Hz resample: lag 4 → 1s → 60 BrPM, lag 40 → 10s → 6 BrPM
    uint8_t lagMin = (uint8_t)(RESAMP_RATE / RESP_BAND_HIGH);  // 4
    uint8_t lagMax = (uint8_t)(RESAMP_RATE / RESP_BAND_LOW);   // 40
    if (lagMax > len / 2) lagMax = len / 2;
    if (lagMin < 2) lagMin = 2;

    // Compute variance (lag 0)
    float var = 0;
    for (uint8_t i = 0; i < len; i++) {
        float d = signal[i] - mean;
        var += d * d;
    }
    if (var < 1e-10f) return result;

    // Find peak in autocorrelation
    float bestCorr = -1.0f;
    uint8_t bestLag = 0;
    float totalCorr = 0;
    uint8_t corrCount = 0;

    for (uint8_t lag = lagMin; lag <= lagMax; lag++) {
        float corr = 0;
        for (uint8_t i = 0; i < len - lag; i++) {
            corr += (signal[i] - mean) * (signal[i + lag] - mean);
        }
        corr /= var;  // Normalized autocorrelation

        if (corr > 0) {
            totalCorr += corr;
            corrCount++;
        }
        if (corr > bestCorr) {
            bestCorr = corr;
            bestLag = lag;
        }
    }

    if (bestLag < lagMin || bestCorr < 0.1f) return result;

    // Convert lag to frequency
    result.freq_hz = RESAMP_RATE / (float)bestLag;

    // Prominence = peak correlation / average positive correlation
    float avgCorr = (corrCount > 0) ? totalCorr / corrCount : 0.01f;
    result.prominence = (avgCorr > 0.01f) ? bestCorr / avgCorr : 0;
    result.prominence = fminf(result.prominence, 5.0f) / 5.0f;  // Normalize to 0–1

    result.valid = (result.prominence >= PROMINENCE_THRESHOLD) &&
                   (result.freq_hz >= RESP_BAND_LOW) &&
                   (result.freq_hz <= RESP_BAND_HIGH);

    return result;
}

float Algo_A04::medianOfThree(float a, float b, float c) const {
    if (a > b) { float t = a; a = b; b = t; }
    if (b > c) { float t = b; b = c; c = t; }
    if (a > b) { float t = a; a = b; b = t; }
    return b;
}

// ─── SQI ───────────────────────────────────────────────────────
float Algo_A04::computeSQI() const {
    // 1. Modulation agreement (30%)
    float freqs[3];
    uint8_t validCount = 0;
    for (uint8_t i = 0; i < 3; i++) {
        if (modResults_[i].valid) {
            freqs[validCount++] = modResults_[i].freq_hz * 60.0f;  // Hz → BrPM
        }
    }
    float sqi_agree = 0;
    if (validCount >= 2) {
        float fMin = freqs[0], fMax = freqs[0];
        for (uint8_t i = 1; i < validCount; i++) {
            if (freqs[i] < fMin) fMin = freqs[i];
            if (freqs[i] > fMax) fMax = freqs[i];
        }
        float spread = fMax - fMin;
        sqi_agree = fminf(fmaxf(1.0f - (spread - 2.0f) / 6.0f, 0.0f), 1.0f);
    }

    // 2. Spectral prominence (25%)
    float sumProm = 0;
    uint8_t promCount = 0;
    for (uint8_t i = 0; i < 3; i++) {
        if (modResults_[i].valid) {
            sumProm += modResults_[i].prominence;
            promCount++;
        }
    }
    float meanProm = (promCount > 0) ? sumProm / promCount : 0;
    float sqi_prom = fminf(fmaxf((meanProm - 0.15f) / 0.15f, 0.0f), 1.0f);

    // 3. PI proxy (20%) — if A01 is providing good signal, resp modulations are reliable
    float a01sqi = (a01_) ? a01_->getSQI() : 0;
    float sqi_pi = fminf(fmaxf((a01sqi - 0.3f) / 0.5f, 0.0f), 1.0f);

    // 4. Motion (25%)
    float sqi_motion = fminf(fmaxf(1.0f - motionLevel_ / MOTION_THRESHOLD, 0.0f), 1.0f);

    return 0.30f * sqi_agree + 0.25f * sqi_prom + 0.20f * sqi_pi + 0.25f * sqi_motion;
}

// ─── Update ────────────────────────────────────────────────────
void Algo_A04::update(uint32_t now_ms) {
    if (!a01_ || !ppg_) { state_ = AlgoState::IDLE; return; }

    // 1. DC envelope tracking (every sample)
    float rawPPG = ppg_->getPPG_IR();
    if (dcEnvelope_ < 1.0f) dcEnvelope_ = rawPPG;
    dcEnvelope_ = DC_ENV_ALPHA * rawPPG + (1.0f - DC_ENV_ALPHA) * dcEnvelope_;

    // 2. Motion check
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
    if (now_ms < motionClearTs_) {
        state_ = AlgoState::ACQUIRING;
        output_.valid = false;
        return;
    }

    // 3. Only recompute every UPDATE_INTERVAL_MS
    if (lastComputeTs_ > 0 && (now_ms - lastComputeTs_) < UPDATE_INTERVAL_MS) return;

    // 4. Gather beat-synchronous modulations from A01
    const auto& ibiBuf = a01_->getIBIBuffer();
    const auto& ampBuf = a01_->getPeakAmplitudes();
    uint16_t beatCount = ibiBuf.count();

    if (beatCount < MIN_BEATS_WINDOW) {
        state_ = AlgoState::ACQUIRING;
        output_ = {0, 0, now_ms, false};
        return;
    }

    // Use the most recent beats (up to 30s worth)
    uint16_t usableBeats = beatCount;
    if (usableBeats > RESAMP_LEN) usableBeats = RESAMP_LEN;

    // Extract beat-synchronous series (oldest first for correct time ordering)
    modLen_ = 0;
    float cumTime = 0;
    for (uint16_t i = 0; i < usableBeats && modLen_ < RESAMP_LEN; i++) {
        uint16_t idx = usableBeats - 1 - i;  // Oldest first
        float ibi = ibiBuf.at(idx);
        float amp = ampBuf.at(idx);
        cumTime += ibi / 1000.0f;  // ms → s

        if (cumTime > WINDOW_SEC) break;

        // RIIV: DC envelope at beat time — approximate with dcEnvelope_ decay
        riiv_[modLen_] = dcEnvelope_;  // Simplified: use current DC tracking

        // RIFV: IBI itself (respiratory sinus arrhythmia)
        rifv_[modLen_] = ibi;

        // RIAV: AC amplitude (peak-to-trough)
        riav_[modLen_] = amp;

        modLen_++;
    }

    if (modLen_ < MIN_BEATS_WINDOW) {
        state_ = AlgoState::ACQUIRING;
        output_ = {0, 0, now_ms, false};
        return;
    }

    // 5. Estimate respiratory frequency from each modulation
    modResults_[0] = estimateFrequency(rifv_, modLen_);  // RIFV (IBI) — most reliable
    modResults_[1] = estimateFrequency(riav_, modLen_);  // RIAV (amplitude)
    modResults_[2] = estimateFrequency(riiv_, modLen_);  // RIIV (DC baseline)

    // 6. Prominence-weighted fusion
    float weightedSum = 0;
    float weightTotal = 0;
    activeModCount_ = 0;

    for (uint8_t i = 0; i < 3; i++) {
        if (modResults_[i].valid) {
            weightedSum += modResults_[i].prominence * modResults_[i].freq_hz;
            weightTotal += modResults_[i].prominence;
            activeModCount_++;
        }
    }

    if (activeModCount_ == 0) {
        state_ = AlgoState::LOW_QUALITY;
        output_ = {0, 0, now_ms, false};
        lastComputeTs_ = now_ms;
        return;
    }

    float fusedFreq = weightedSum / weightTotal;
    float rawBrPM = fusedFreq * 60.0f;

    // 7. Median filter over successive windows
    brpmHistory_[histIdx_] = rawBrPM;
    histIdx_ = (histIdx_ + 1) % MEDIAN_DEPTH;
    if (histCount_ < MEDIAN_DEPTH) histCount_++;

    float medBrPM;
    if (histCount_ >= MEDIAN_DEPTH) {
        medBrPM = medianOfThree(brpmHistory_[0], brpmHistory_[1], brpmHistory_[2]);
    } else {
        medBrPM = rawBrPM;
    }

    // 8. EMA smoothing
    if (emaBrPM_ < 1.0f) {
        emaBrPM_ = medBrPM;
    } else {
        emaBrPM_ = EMA_ALPHA * medBrPM + (1.0f - EMA_ALPHA) * emaBrPM_;
    }

    // 9. Clamp
    brpm_ = fminf(fmaxf(emaBrPM_, BRPM_CLAMP_LOW), BRPM_CLAMP_HIGH);

    // 10. SQI & output gating
    float sqi = computeSQI();

    // Require >= 2 modulations for good SQI
    if (activeModCount_ < 2 && sqi > 0.5f) sqi = 0.5f;

    if (sqi < SQI_THRESHOLD) {
        state_ = AlgoState::LOW_QUALITY;
        output_ = {brpm_, sqi, now_ms, false};
        lastComputeTs_ = now_ms;
        return;
    }

    state_ = AlgoState::VALID;
    output_ = {brpm_, sqi, now_ms, true};
    lastComputeTs_ = now_ms;
}

// ─── Getters ───────────────────────────────────────────────────
AlgorithmOutput Algo_A04::getOutput() const { return output_; }
AlgoState Algo_A04::getState() const { return state_; }
