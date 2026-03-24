#pragma once
// ═══════════════════════════════════════════════════════════════
// U01: Tennis Session Analytics
// Tier 1 (PERIODIC) — stroke detection from 6-axis IMU
//
// Threshold + state machine detects tennis strokes, classifies
// type (forehand/backhand/serve/volley) via gyroscope rotation
// pattern, estimates swing speed from peak angular velocity.
//
// Consumes: CH_ACCEL, CH_GYRO
// Outputs:  float stroke_count (primary), type + speed (secondary)
// Consumed by: none
//
// Citations: Srivastava et al. 2015 "Wearable sensor stroke classification"
//            Whiteside et al. 2017 "Monitoring hitting load in tennis"
// ═══════════════════════════════════════════════════════════════

#include "../../framework/AlgorithmBase.h"
#include "../../framework/RingBuffer.h"
#include "../../framework/Channels.h"

// Forward declaration — driver injected via pointer
class IMUDriver;

// ─── Stroke Type Enum ──────────────────────────────────────────

enum class StrokeType : uint8_t {
    FOREHAND     = 0,
    BACKHAND     = 1,
    SERVE        = 2,
    VOLLEY       = 3,
    UNCLASSIFIED = 4
};

// ─── Stroke Event Record ───────────────────────────────────────

struct StrokeEvent {
    uint32_t   timestamp_ms;
    StrokeType type;
    float      speed_kmh;      // Estimated swing speed
    float      peakAccel_g;    // Peak acceleration magnitude
    float      peakGyro_dps;   // Peak gyro magnitude (°/s)
};

// ═══════════════════════════════════════════════════════════════

class Algo_U01 : public AlgorithmBase {
public:
    void init() override;
    void update(uint32_t now_ms) override;
    AlgorithmOutput getOutput() const override;
    AlgoState getState() const override;

    const char* getID() const override { return "U01"; }
    const char* getName() const override { return "Tennis Session"; }
    const char* getUnit() const override { return "strokes"; }
    AlgoClassification getClassification() const override { return AlgoClassification::WELLNESS; }
    AlgoTier getTier() const override { return AlgoTier::PERIODIC; }
    uint16_t ramUsage() const override { return sizeof(*this); }

    // ── Dependency injection ──
    void setIMUDriver(IMUDriver* drv) { imu_ = drv; }

    // ── Public accessors (multi-output pattern A) ──
    uint16_t getTotalStrokes() const { return totalStrokes_; }
    uint16_t getForehandCount() const { return forehandCount_; }
    uint16_t getBackhandCount() const { return backhandCount_; }
    uint16_t getServeCount() const { return serveCount_; }
    uint16_t getVolleyCount() const { return volleyCount_; }
    uint16_t getUnclassifiedCount() const { return unclassifiedCount_; }
    StrokeType getLastStrokeType() const { return lastStrokeType_; }
    float getLastSwingSpeed() const { return lastSwingSpeed_; }
    float getAvgSwingSpeed() const;
    float getMaxSwingSpeed() const { return maxSwingSpeed_; }
    float getActiveRatio() const;
    uint32_t getSessionDuration_ms() const;
    uint32_t getActiveTime_ms() const { return activeTime_ms_; }

    // Stroke event history (for BLE batching / dashboard)
    static constexpr uint8_t STROKE_HISTORY_SIZE = 32;
    const StrokeEvent& getStrokeAt(uint8_t index) const;
    uint8_t getStrokeHistoryCount() const { return strokeHistoryCount_; }

private:
    IMUDriver* imu_ = nullptr;

    AlgoState state_ = AlgoState::IDLE;
    AlgorithmOutput output_ = {0, 0, 0, false};

    // ── Swing detection state machine ──
    enum class SwingState : uint8_t {
        IDLE,        // Waiting for stroke trigger
        IN_SWING,    // Tracking peak values during swing window
    };
    SwingState swingState_ = SwingState::IDLE;
    uint32_t swingStartTs_ = 0;
    float swingPeakAccel_ = 0;
    float swingPeakGyroZ_ = 0;
    float swingPeakGyroMag_ = 0;
    float swingPeakAccelY_ = 0;
    uint32_t cooldownEnd_ = 0;

    // ── Ring buffers ──
    static constexpr uint16_t BUF_SIZE = 64;  // ~615ms at 104 Hz
    RingBuffer<float, BUF_SIZE> accelMagBuf_;
    RingBuffer<float, BUF_SIZE> gyroZBuf_;

    // ── Stroke statistics ──
    uint16_t totalStrokes_ = 0;
    uint16_t forehandCount_ = 0;
    uint16_t backhandCount_ = 0;
    uint16_t serveCount_ = 0;
    uint16_t volleyCount_ = 0;
    uint16_t unclassifiedCount_ = 0;

    StrokeType lastStrokeType_ = StrokeType::UNCLASSIFIED;
    float lastSwingSpeed_ = 0;
    float maxSwingSpeed_ = 0;
    float speedSum_ = 0;   // For computing average

    // ── Stroke event history ring ──
    StrokeEvent strokeHistory_[STROKE_HISTORY_SIZE];
    uint8_t strokeHistoryHead_ = 0;
    uint8_t strokeHistoryCount_ = 0;

    // ── Active/rest tracking ──
    uint32_t sessionStartTs_ = 0;
    uint32_t activeTime_ms_ = 0;
    uint32_t lastActivityCheckTs_ = 0;
    bool isActive_ = false;

    // ── SQI components ──
    float restVariance_ = 0;

    // ── Internal methods ──
    void processSwing(uint32_t now_ms);
    StrokeType classifyStroke(float peakGyroZ, float peakAccelY,
                              float peakGyroMag, uint32_t duration_ms) const;
    float estimateSpeed(float peakGyroMag) const;
    void recordStroke(StrokeType type, float speed, float peakAccel,
                      float peakGyro, uint32_t now_ms);
    void updateActiveRest(uint32_t now_ms);
    float computeSQI() const;
};
