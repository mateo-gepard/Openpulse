#pragma once
// ═══════════════════════════════════════════════════════════════
// A01: Heart Rate (Real-Time)
// Tier 0 (REALTIME) — called every loop()
//
// Adaptive peak detection on bandpass-filtered PPG with 8-beat
// EMA averaging. Includes SQI from perfusion index, peak
// prominence, and motion energy.
//
// Consumes: CH_PPG, CH_ACCEL (motion rejection)
// Outputs:  float bpm
// Consumed by: A02 (HRV), A04 (Resp Rate), A06 (RHR Trend),
//              A24 (Calories), X01 (PTT-BP), C01 (Recovery)
//
// Citation: Elgendi 2013 "Optimal PPG peak detection"
// ═══════════════════════════════════════════════════════════════

#include "../../framework/AlgorithmBase.h"
#include "../../framework/RingBuffer.h"
#include "../../framework/Channels.h"

// Forward declarations — drivers are injected via pointers
class PPGECGDriver;
class IMUDriver;

class Algo_A01 : public AlgorithmBase {
public:
    void init() override;
    void update(uint32_t now_ms) override;
    AlgorithmOutput getOutput() const override;
    AlgoState getState() const override;

    const char* getID() const override { return "A01"; }
    const char* getName() const override { return "Heart Rate"; }
    const char* getUnit() const override { return "BPM"; }
    AlgoClassification getClassification() const override { return AlgoClassification::WELLNESS; }
    AlgoTier getTier() const override { return AlgoTier::REALTIME; }
    uint16_t ramUsage() const override { return sizeof(*this); }

    // ── Dependency injection ──
    void setPPGDriver(PPGECGDriver* drv) { ppg_ = drv; }
    void setIMUDriver(IMUDriver* drv)    { imu_ = drv; }

    // ── Public accessors for downstream algorithms ──
    float getBPM() const { return output_.value; }
    float getSQI() const { return output_.sqi; }
    float getLastIBI_ms() const { return lastIBI_ms_; }
    uint32_t getLastPeakTimestamp() const { return lastPeakTs_; }
    float getPerfusionIndex() const { return perfusionIndex_; }
    uint16_t getValidBeatCount() const { return validBeatCount_; }

    // Peak timestamps ring buffer — used by A02 (HRV), A04 (Resp Rate)
    static constexpr uint16_t PEAK_HISTORY = 128;
    const RingBuffer<float, PEAK_HISTORY>& getIBIBuffer() const { return ibiBuf_; }
    const RingBuffer<float, PEAK_HISTORY>& getPeakAmplitudes() const { return peakAmpBuf_; }

private:
    PPGECGDriver* ppg_ = nullptr;
    IMUDriver*    imu_ = nullptr;

    AlgoState state_ = AlgoState::IDLE;
    AlgorithmOutput output_ = {0, 0, 0, false};

    // ── PPG signal buffer ──
    static constexpr uint16_t PPG_BUF_SIZE = 512;  // 5.12s at 100 Hz
    RingBuffer<float, PPG_BUF_SIZE> ppgBuf_;

    // ── Bandpass filter state (4th-order Butterworth, 0.5–4.0 Hz) ──
    // Implemented as two cascaded biquad sections
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
    Biquad bpf_[4];  // 4 biquad sections for 4th-order bandpass

    // ── Peak detection state ──
    float runningMean_ = 0;
    float runningVar_  = 0;
    bool  aboveThreshold_ = false;
    float currentPeakVal_ = 0;
    uint32_t currentPeakTs_ = 0;
    uint32_t lastPeakTs_ = 0;
    uint32_t refractoryEnd_ = 0;

    // ── IBI + beat averaging ──
    float lastIBI_ms_ = 0;
    RingBuffer<float, PEAK_HISTORY> ibiBuf_;       // IBI history (ms)
    RingBuffer<float, PEAK_HISTORY> peakAmpBuf_;   // Peak amplitudes
    float emaBPM_ = 0;
    uint16_t validBeatCount_ = 0;
    uint32_t lastOutputTs_ = 0;

    // ── SQI components ──
    float perfusionIndex_ = 0;       // AC/DC ratio × 100
    float peakProminence_ = 0;
    float motionLevel_ = 0;          // 0.0–1.0 from IMU

    // ── DC tracking for perfusion index ──
    float dcLevel_ = 0;
    float acAmplitude_ = 0;

    // ── Internal methods ──
    float computeSQI() const;
    void  initFilters();
    float applyBandpass(float sample);
    void  updateDCTracking(float rawSample);
    float computeMotionLevel();
};
