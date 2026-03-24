#include "Algo_A07.h"
#include "Algo_A01.h"
#include "../../framework/SensorDriverBase.h"
// ═══════════════════════════════════════════════════════════════
// A07: PPG Waveform Analysis
// Extract arterial stiffness markers from PPG morphology.
//
// Category:       health-biometric
// Classification:  Health Indicator
// Tier:           1 (PERIODIC)
// Consumes:       CH_PPG (200 Hz), CH_ACCEL
// Citation:       Takazawa 1998, Millasseau 2006, Charlton 2022
// ═══════════════════════════════════════════════════════════════

namespace {
    // Motion threshold — morphology is sensitive
    constexpr float MOTION_THRESHOLD     = 0.3f;   // g

    // HR limit for morphology analysis
    constexpr float MAX_HR_FOR_MORPHO    = 120.0f;  // BPM

    // Min beat length at 200 Hz (max HR 120 BPM → 500ms → 100 samples)
    constexpr uint16_t MIN_BEAT_SAMPLES  = 100;

    // Perfusion threshold
    constexpr float PI_THRESHOLD         = 0.2f;   // %

    // Feature ranges
    constexpr float SI_CLAMP_LOW         = 5.0f;
    constexpr float SI_CLAMP_HIGH        = 20.0f;
    constexpr float RI_CLAMP_LOW         = 0.0f;
    constexpr float RI_CLAMP_HIGH        = 100.0f;
    constexpr float AGI_CLAMP_LOW        = -1.5f;
    constexpr float AGI_CLAMP_HIGH       = 1.5f;
    constexpr float AIX_CLAMP_LOW        = -20.0f;
    constexpr float AIX_CLAMP_HIGH       = 60.0f;

    constexpr float SQI_THRESHOLD        = 0.5f;
    constexpr float SAMPLE_RATE          = 200.0f;
}

// ─── Init ──────────────────────────────────────────────────────
void Algo_A07::init() {
    ppgBuf200_.clear();
    state_ = AlgoState::ACQUIRING;
    output_ = {0, 0, 0, false};
    si_ = 0; ri_ = 0; agi_ = 0; aix_ = 0;
    notchAbsent_ = true;
    beatIdx_ = 0;
    lastProcessedPeakTs_ = 0;
    motionLevel_ = 0;
    beatLen_ = 0;
    memset(si_accum_, 0, sizeof(si_accum_));
    memset(ri_accum_, 0, sizeof(ri_accum_));
    memset(agi_accum_, 0, sizeof(agi_accum_));
    memset(aix_accum_, 0, sizeof(aix_accum_));
}

// ─── Motion ────────────────────────────────────────────────────
float Algo_A07::computeMotionLevel() {
    if (!imu_) return 0;
    float mag = imu_->getAccelMagnitude();
    return fminf(fabsf(mag - 1.0f) / 2.0f, 1.0f);
}

// ─── SQI ───────────────────────────────────────────────────────
float Algo_A07::computeSQI() const {
    // 1. Perfusion Index (30%)
    float pi = 0;
    if (a01_) pi = a01_->getPerfusionIndex();
    float sqi_pi = fminf(fmaxf((pi - 0.2f) / 0.8f, 0.0f), 1.0f);

    // 2. Waveform consistency — beat-to-beat SI variability (40%)
    if (beatIdx_ < 2) return 0.3f;  // Not enough beats yet
    float si_mean = 0, si_var = 0;
    uint8_t n = (beatIdx_ < BEAT_AVG) ? beatIdx_ : BEAT_AVG;
    for (uint8_t i = 0; i < n; i++) si_mean += si_accum_[i];
    si_mean /= n;
    for (uint8_t i = 0; i < n; i++) {
        float d = si_accum_[i] - si_mean;
        si_var += d * d;
    }
    si_var = sqrtf(si_var / n);
    float cv = (si_mean > 0) ? si_var / si_mean : 1.0f;
    float sqi_cc = fminf(fmaxf(1.0f - (cv - 0.05f) / 0.20f, 0.0f), 1.0f);

    // 3. Motion (30%)
    float sqi_motion = fminf(fmaxf(1.0f - motionLevel_ / 0.3f, 0.0f), 1.0f);

    return 0.3f * sqi_pi + 0.4f * sqi_cc + 0.3f * sqi_motion;
}

// ─── Compute Derivatives ───────────────────────────────────────
void Algo_A07::computeDerivatives() {
    float dt = 1.0f / SAMPLE_RATE;
    // First derivative (VPG) — central difference
    beatVPG_[0] = 0;
    beatVPG_[beatLen_ - 1] = 0;
    for (uint16_t i = 1; i < beatLen_ - 1; i++) {
        beatVPG_[i] = (beatWave_[i + 1] - beatWave_[i - 1]) / (2.0f * dt);
    }
    // Second derivative (APG/SDPPG) — central difference of VPG
    beatAPG_[0] = 0;
    beatAPG_[beatLen_ - 1] = 0;
    for (uint16_t i = 1; i < beatLen_ - 1; i++) {
        beatAPG_[i] = (beatVPG_[i + 1] - beatVPG_[i - 1]) / (2.0f * dt);
    }
}

// ─── Find SDPPG Waves (a, b, c, d, e) — Takazawa 1998 ─────
void Algo_A07::findSDPPGWaves(float& a, float& b, float& c, float& d, float& e) {
    // a = first positive peak of APG (early systole)
    // b = first negative trough (systolic deceleration)
    // c = second positive peak (late systole)
    // d = second negative trough (early diastole)
    // e = third positive peak (diastolic)
    a = b = c = d = e = 0;

    uint16_t half = beatLen_ / 2;
    // Find 'a' — max positive in first quarter
    uint16_t q1 = beatLen_ / 4;
    for (uint16_t i = 1; i < q1; i++) {
        if (beatAPG_[i] > a) a = beatAPG_[i];
    }

    // Find 'b' — min in first half (after a)
    for (uint16_t i = q1; i < half; i++) {
        if (beatAPG_[i] < b) b = beatAPG_[i];
    }

    // Find 'c' — max positive from half-beatLen * 0.6
    uint16_t p60 = (uint16_t)(beatLen_ * 0.6f);
    for (uint16_t i = half; i < p60; i++) {
        if (beatAPG_[i] > c) c = beatAPG_[i];
    }

    // Find 'd' — min from 60%-80%
    uint16_t p80 = (uint16_t)(beatLen_ * 0.8f);
    for (uint16_t i = p60; i < p80; i++) {
        if (beatAPG_[i] < d) d = beatAPG_[i];
    }

    // Find 'e' — max positive from 80% to end
    for (uint16_t i = p80; i < beatLen_; i++) {
        if (beatAPG_[i] > e) e = beatAPG_[i];
    }
}

// ─── Analyze Single Beat ───────────────────────────────────────
void Algo_A07::analyzeBeat() {
    if (beatLen_ < MIN_BEAT_SAMPLES) return;

    // Normalize beat to unit amplitude
    float bMax = beatWave_[0], bMin = beatWave_[0];
    for (uint16_t i = 1; i < beatLen_; i++) {
        if (beatWave_[i] > bMax) bMax = beatWave_[i];
        if (beatWave_[i] < bMin) bMin = beatWave_[i];
    }
    float bRange = bMax - bMin;
    if (bRange < 1.0f) return;  // Flat signal

    for (uint16_t i = 0; i < beatLen_; i++) {
        beatWave_[i] = (beatWave_[i] - bMin) / bRange;
    }

    // Compute derivatives on normalized waveform
    computeDerivatives();

    // ── Find Dicrotic Notch (DN) ──
    // DN = first local minimum in VPG after systolic peak, then find
    // the corresponding point in the original waveform
    uint16_t systolicIdx = 0;
    for (uint16_t i = 1; i < beatLen_; i++) {
        if (beatWave_[i] > beatWave_[systolicIdx]) systolicIdx = i;
    }

    // Search for notch: first VPG zero-crossing after systolic peak
    uint16_t dnIdx = 0;
    bool foundNotch = false;
    for (uint16_t i = systolicIdx + 5; i < beatLen_ - 5; i++) {
        if (beatVPG_[i] < 0 && beatVPG_[i + 1] >= 0) {
            dnIdx = i;
            foundNotch = true;
            break;
        }
    }

    // ── Find Diastolic Peak (D) — local max after DN ──
    uint16_t diastolicIdx = dnIdx;
    float diastolicVal = 0;
    if (foundNotch) {
        for (uint16_t i = dnIdx + 1; i < beatLen_ - 1; i++) {
            if (beatWave_[i] > beatWave_[i - 1] && beatWave_[i] > beatWave_[i + 1]) {
                diastolicIdx = i;
                diastolicVal = beatWave_[i];
                break;
            }
        }
    }

    notchAbsent_ = !foundNotch || (diastolicVal < 0.05f);

    // ── Stiffness Index: SI = height / ΔTSD ──
    // ΔTSD = time from systolic peak to diastolic peak
    float si_beat = 0;
    if (!notchAbsent_ && diastolicIdx > systolicIdx) {
        float delta_t = (float)(diastolicIdx - systolicIdx) / SAMPLE_RATE;
        if (delta_t > 0.05f) {
            si_beat = bodyHeight_ / delta_t;
            si_beat = fminf(fmaxf(si_beat, SI_CLAMP_LOW), SI_CLAMP_HIGH);
        }
    }

    // ── Reflection Index: RI = Diastolic / Systolic × 100 ──
    float systolicVal = beatWave_[systolicIdx];
    float ri_beat = 0;
    if (!notchAbsent_ && systolicVal > 0.01f) {
        ri_beat = (diastolicVal / systolicVal) * 100.0f;
        ri_beat = fminf(fmaxf(ri_beat, RI_CLAMP_LOW), RI_CLAMP_HIGH);
    }

    // ── SDPPG Aging Index: AGI = (b - c - d - e) / a ──
    float wa, wb, wc, wd, we;
    findSDPPGWaves(wa, wb, wc, wd, we);
    float agi_beat = 0;
    if (fabsf(wa) > 0.001f) {
        agi_beat = (wb - wc - wd - we) / wa;
        agi_beat = fminf(fmaxf(agi_beat, AGI_CLAMP_LOW), AGI_CLAMP_HIGH);
    }

    // ── Augmentation Index: AIx = (P2 - P1) / PP × 100 ──
    // P1 = first systolic shoulder, P2 = peak systolic
    // Simplified: P1 = inflection point in rising systole (VPG local max before systolic peak)
    float aix_beat = 0;
    uint16_t p1Idx = 0;
    for (uint16_t i = 1; i < systolicIdx; i++) {
        if (beatVPG_[i] > beatVPG_[i - 1] && beatVPG_[i] > beatVPG_[i + 1]) {
            p1Idx = i;
            break;
        }
    }
    if (p1Idx > 0 && bRange > 0.01f) {
        float P1 = beatWave_[p1Idx];
        float P2 = systolicVal;
        aix_beat = ((P2 - P1) / 1.0f) * 100.0f;  // Already normalized to unit amplitude
        aix_beat = fminf(fmaxf(aix_beat, AIX_CLAMP_LOW), AIX_CLAMP_HIGH);
    }

    // Store in accumulator
    uint8_t idx = beatIdx_ % BEAT_AVG;
    si_accum_[idx] = si_beat;
    ri_accum_[idx] = ri_beat;
    agi_accum_[idx] = agi_beat;
    aix_accum_[idx] = aix_beat;
    beatIdx_++;
}

// ─── Extract Beat from Buffer ──────────────────────────────────
bool Algo_A07::extractBeat(uint32_t peakTs, uint32_t prevPeakTs) {
    if (peakTs <= prevPeakTs) return false;
    uint32_t duration_ms = peakTs - prevPeakTs;
    uint16_t expectedSamples = (uint16_t)(duration_ms * SAMPLE_RATE / 1000.0f);
    if (expectedSamples < MIN_BEAT_SAMPLES || expectedSamples > MAX_BEAT_LEN) return false;

    // Copy from ring buffer — find samples between prevPeakTs and peakTs
    beatLen_ = 0;
    for (uint16_t i = 0; i < ppgBuf200_.count() && beatLen_ < MAX_BEAT_LEN; i++) {
        uint32_t ts = ppgBuf200_.timestampAt(i);
        if (ts >= prevPeakTs && ts <= peakTs) {
            beatWave_[beatLen_++] = ppgBuf200_.at(i);
        }
    }
    // Reverse — ring buffer is newest-first, beat should be oldest-first
    for (uint16_t i = 0; i < beatLen_ / 2; i++) {
        float tmp = beatWave_[i];
        beatWave_[i] = beatWave_[beatLen_ - 1 - i];
        beatWave_[beatLen_ - 1 - i] = tmp;
    }

    return beatLen_ >= MIN_BEAT_SAMPLES;
}

// ─── Update ────────────────────────────────────────────────────
void Algo_A07::update(uint32_t now_ms) {
    if (!ppg_ || !a01_) { state_ = AlgoState::IDLE; return; }

    // 1. Buffer raw PPG at 200 Hz
    SensorSample sample = ppg_->getLatest();
    if (sample.valid) {
        ppgBuf200_.push(sample.value, now_ms);
    }

    // 2. Check motion
    motionLevel_ = computeMotionLevel();
    if (motionLevel_ > MOTION_THRESHOLD) {
        // Hold last valid for 10s, then suppress
        if (output_.valid && (now_ms - output_.timestamp_ms) > 10000) {
            state_ = AlgoState::LOW_QUALITY;
            output_.valid = false;
        }
        return;
    }

    // 3. Check HR limit
    float currentBPM = a01_->getBPM();
    if (currentBPM > MAX_HR_FOR_MORPHO) {
        // HR too high for morphology — beat too short
        return;
    }

    // 4. Check for new peak from A01
    uint32_t latestPeakTs = a01_->getLastPeakTimestamp();
    if (latestPeakTs == lastProcessedPeakTs_ || latestPeakTs == 0) return;

    uint32_t prevPeakTs = lastProcessedPeakTs_;
    lastProcessedPeakTs_ = latestPeakTs;
    if (prevPeakTs == 0) return;  // Need two peaks

    // 5. Extract and analyze beat
    if (!extractBeat(latestPeakTs, prevPeakTs)) return;
    analyzeBeat();

    // 6. Average over BEAT_AVG beats and output
    uint8_t n = (beatIdx_ < BEAT_AVG) ? beatIdx_ : BEAT_AVG;
    if (n < 2) {
        state_ = AlgoState::ACQUIRING;
        output_ = {0, 0, now_ms, false};
        return;
    }

    float sum_si = 0, sum_ri = 0, sum_agi = 0, sum_aix = 0;
    for (uint8_t i = 0; i < n; i++) {
        sum_si  += si_accum_[i];
        sum_ri  += ri_accum_[i];
        sum_agi += agi_accum_[i];
        sum_aix += aix_accum_[i];
    }
    si_  = sum_si / n;
    ri_  = sum_ri / n;
    agi_ = sum_agi / n;
    aix_ = sum_aix / n;

    float sqi = computeSQI();
    if (sqi < SQI_THRESHOLD) {
        state_ = AlgoState::LOW_QUALITY;
        output_ = {si_, sqi, now_ms, false};
        return;
    }

    state_ = AlgoState::VALID;
    output_ = {si_, sqi, now_ms, true};
}

// ─── Getters ───────────────────────────────────────────────────
AlgorithmOutput Algo_A07::getOutput() const { return output_; }
AlgoState Algo_A07::getState() const { return state_; }
