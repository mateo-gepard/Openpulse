#include "Algo_U01.h"
#include "../../framework/SensorDriverBase.h"
// ═══════════════════════════════════════════════════════════════
// U01: Tennis Session Analytics
// Threshold + state machine stroke detection with gyro classification.
//
// Category:       sport-motion
// Classification:  Sport Performance (Wellness tier)
// Tier:           1 (PERIODIC)
// Consumes:       CH_ACCEL, CH_GYRO
// Consumed by:    none
// Citations:      Srivastava et al. 2015, Whiteside et al. 2017
// ═══════════════════════════════════════════════════════════════

// ─── Constants ─────────────────────────────────────────────────
namespace {
    // Stroke detection — Srivastava et al. 2015
    constexpr float STROKE_THRESHOLD_G     = 3.0f;   // Accel magnitude trigger
    constexpr uint32_t STROKE_COOLDOWN_MS  = 400;     // Prevent double-counting
    constexpr uint32_t SWING_WINDOW_MS     = 400;     // Peak tracking window

    // Stroke classification
    constexpr float SERVE_VERTICAL_G       = 2.5f;    // Y-axis overhead threshold
    constexpr uint32_t VOLLEY_MAX_DUR_MS   = 200;     // Short contact = volley
    constexpr float MIN_GYRO_FOR_CLASS     = 50.0f;   // Min °/s for FH/BH classification

    // Swing speed estimation — Whiteside et al. 2017
    // Maps peak angular velocity (°/s) to racket-head speed (km/h)
    constexpr float SPEED_SCALE            = 0.42f;   // km/h per °/s
    constexpr float SPEED_CLAMP_LOW        = 0.0f;
    constexpr float SPEED_CLAMP_HIGH       = 250.0f;  // Physical limit

    // Active/rest detection
    constexpr float ACTIVE_RMS_THRESHOLD   = 1.3f;    // accelMag RMS (gravity + 0.3g motion)
    constexpr uint32_t ACTIVITY_CHECK_MS   = 5000;    // 5-second evaluation window

    // Rate limiting
    constexpr float MAX_STROKES_PER_MIN    = 60.0f;   // Above = artifact
    constexpr uint32_t MIN_INTER_STROKE_MS = (uint32_t)(60000.0f / MAX_STROKES_PER_MIN);

    // Session
    constexpr uint32_t SESSION_TIMEOUT_MS  = 1800000;  // 30 min inactivity

    // SQI
    constexpr float SQI_THRESHOLD          = 0.3f;
}

// ─── Init ──────────────────────────────────────────────────────
void Algo_U01::init() {
    accelMagBuf_.clear();
    gyroZBuf_.clear();

    state_ = AlgoState::ACQUIRING;
    output_ = {0, 0, 0, false};

    swingState_ = SwingState::IDLE;
    swingStartTs_ = 0;
    swingPeakAccel_ = 0;
    swingPeakGyroZ_ = 0;
    swingPeakGyroMag_ = 0;
    swingPeakAccelY_ = 0;
    cooldownEnd_ = 0;

    totalStrokes_ = 0;
    forehandCount_ = 0;
    backhandCount_ = 0;
    serveCount_ = 0;
    volleyCount_ = 0;
    unclassifiedCount_ = 0;

    lastStrokeType_ = StrokeType::UNCLASSIFIED;
    lastSwingSpeed_ = 0;
    maxSwingSpeed_ = 0;
    speedSum_ = 0;

    strokeHistoryHead_ = 0;
    strokeHistoryCount_ = 0;

    sessionStartTs_ = 0;
    activeTime_ms_ = 0;
    lastActivityCheckTs_ = 0;
    isActive_ = false;
    restVariance_ = 0;
}

// ─── Update (called every ~10ms at 104 Hz IMU rate) ────────────
void Algo_U01::update(uint32_t now_ms) {
    if (!imu_ || imu_->getStatus() != DriverStatus::RUNNING) {
        state_ = AlgoState::IDLE;
        return;
    }

    // 1. Read IMU data
    float ax = imu_->getAccelX();
    float ay = imu_->getAccelY();
    float az = imu_->getAccelZ();
    float gz = imu_->getGyroZ();
    float gx = imu_->getGyroX();
    float gy = imu_->getGyroY();

    float accelMag = sqrtf(ax*ax + ay*ay + az*az);
    float gyroMag  = sqrtf(gx*gx + gy*gy + gz*gz);

    // 2. Push to ring buffers
    accelMagBuf_.push(accelMag, now_ms);
    gyroZBuf_.push(gz, now_ms);

    // 3. Initialize session timestamp
    if (sessionStartTs_ == 0) {
        sessionStartTs_ = now_ms;
        lastActivityCheckTs_ = now_ms;
    }

    // 4. Stroke detection state machine
    switch (swingState_) {
        case SwingState::IDLE: {
            // Check cooldown
            if (now_ms < cooldownEnd_) break;

            // Trigger: accel magnitude exceeds threshold
            if (accelMag > STROKE_THRESHOLD_G) {
                swingState_ = SwingState::IN_SWING;
                swingStartTs_ = now_ms;
                swingPeakAccel_ = accelMag;
                swingPeakGyroZ_ = gz;
                swingPeakGyroMag_ = gyroMag;
                swingPeakAccelY_ = ay;
            }
            break;
        }

        case SwingState::IN_SWING: {
            // Track peak values during swing window
            if (accelMag > swingPeakAccel_) {
                swingPeakAccel_ = accelMag;
            }
            if (fabsf(gz) > fabsf(swingPeakGyroZ_)) {
                swingPeakGyroZ_ = gz;
            }
            if (gyroMag > swingPeakGyroMag_) {
                swingPeakGyroMag_ = gyroMag;
            }
            if (fabsf(ay) > fabsf(swingPeakAccelY_)) {
                swingPeakAccelY_ = ay;
            }

            // End of swing window — classify and record
            uint32_t elapsed = now_ms - swingStartTs_;
            if (elapsed >= SWING_WINDOW_MS || accelMag < 1.5f) {
                processSwing(now_ms);
                swingState_ = SwingState::IDLE;
                cooldownEnd_ = now_ms + STROKE_COOLDOWN_MS;
            }
            break;
        }
    }

    // 5. Active/rest tracking
    updateActiveRest(now_ms);

    // 6. Update output
    float sqi = computeSQI();
    output_.value = (float)totalStrokes_;
    output_.sqi = sqi;
    output_.timestamp_ms = now_ms;
    output_.valid = (totalStrokes_ > 0);

    if (totalStrokes_ > 0) {
        state_ = AlgoState::VALID;
    } else {
        state_ = AlgoState::ACQUIRING;
    }
}

// ─── Process completed swing ───────────────────────────────────
void Algo_U01::processSwing(uint32_t now_ms) {
    // Rate-limit: reject if too soon after last stroke
    if (totalStrokes_ > 0) {
        uint8_t lastIdx = (strokeHistoryHead_ + STROKE_HISTORY_SIZE - 1) % STROKE_HISTORY_SIZE;
        uint32_t lastTs = strokeHistory_[lastIdx].timestamp_ms;
        if (now_ms - lastTs < MIN_INTER_STROKE_MS) return;
    }

    uint32_t duration_ms = now_ms - swingStartTs_;

    // Classify stroke type
    StrokeType type = classifyStroke(swingPeakGyroZ_, swingPeakAccelY_,
                                     swingPeakGyroMag_, duration_ms);

    // Estimate swing speed
    float speed = estimateSpeed(swingPeakGyroMag_);

    // Record the stroke
    recordStroke(type, speed, swingPeakAccel_, swingPeakGyroMag_, now_ms);
}

// ─── Stroke classification ─────────────────────────────────────
// State machine: serve > volley > forehand/backhand > unclassified
StrokeType Algo_U01::classifyStroke(float peakGyroZ, float peakAccelY,
                                     float peakGyroMag, uint32_t duration_ms) const {
    // Serve: high vertical acceleration + significant rotation
    // Source: Srivastava et al. 2015 — overhead motion signature
    if (fabsf(peakAccelY) > SERVE_VERTICAL_G && peakGyroMag > 400.0f) {
        return StrokeType::SERVE;
    }

    // Volley: short duration, quick contact
    if (duration_ms < VOLLEY_MAX_DUR_MS) {
        return StrokeType::VOLLEY;
    }

    // Forehand vs backhand: wrist rotation direction
    // Positive gyroZ = pronation (forehand), negative = supination (backhand)
    if (fabsf(peakGyroZ) > MIN_GYRO_FOR_CLASS) {
        return (peakGyroZ > 0) ? StrokeType::FOREHAND : StrokeType::BACKHAND;
    }

    return StrokeType::UNCLASSIFIED;
}

// ─── Speed estimation ──────────────────────────────────────────
// Maps peak angular velocity to racket-head speed
// Source: Whiteside et al. 2017 — wrist-mounted IMU calibration
float Algo_U01::estimateSpeed(float peakGyroMag) const {
    float speed = peakGyroMag * SPEED_SCALE;
    // Clamp to physical limits
    if (speed < SPEED_CLAMP_LOW) speed = SPEED_CLAMP_LOW;
    if (speed > SPEED_CLAMP_HIGH) speed = SPEED_CLAMP_HIGH;
    return speed;
}

// ─── Record stroke event ───────────────────────────────────────
void Algo_U01::recordStroke(StrokeType type, float speed, float peakAccel,
                             float peakGyro, uint32_t now_ms) {
    // Update counters
    totalStrokes_++;
    switch (type) {
        case StrokeType::FOREHAND:     forehandCount_++;     break;
        case StrokeType::BACKHAND:     backhandCount_++;     break;
        case StrokeType::SERVE:        serveCount_++;        break;
        case StrokeType::VOLLEY:       volleyCount_++;       break;
        case StrokeType::UNCLASSIFIED: unclassifiedCount_++; break;
    }

    lastStrokeType_ = type;
    lastSwingSpeed_ = speed;
    speedSum_ += speed;
    if (speed > maxSwingSpeed_) maxSwingSpeed_ = speed;

    // Push to event history ring
    StrokeEvent evt;
    evt.timestamp_ms = now_ms;
    evt.type = type;
    evt.speed_kmh = speed;
    evt.peakAccel_g = peakAccel;
    evt.peakGyro_dps = peakGyro;

    strokeHistory_[strokeHistoryHead_] = evt;
    strokeHistoryHead_ = (strokeHistoryHead_ + 1) % STROKE_HISTORY_SIZE;
    if (strokeHistoryCount_ < STROKE_HISTORY_SIZE) strokeHistoryCount_++;
}

// ─── Active/rest tracking ──────────────────────────────────────
void Algo_U01::updateActiveRest(uint32_t now_ms) {
    if (now_ms - lastActivityCheckTs_ < ACTIVITY_CHECK_MS) return;

    // Compute RMS of accel magnitude over buffer
    float rms = accelMagBuf_.rms();
    bool wasActive = isActive_;
    isActive_ = (rms > ACTIVE_RMS_THRESHOLD);

    // Accumulate active time
    if (wasActive) {
        activeTime_ms_ += (now_ms - lastActivityCheckTs_);
    }

    // Track rest variance for SQI
    if (!isActive_) {
        float var = accelMagBuf_.stddev();
        restVariance_ = var * var;
    }

    lastActivityCheckTs_ = now_ms;
}

// ─── SQI ───────────────────────────────────────────────────────
// Two components: stroke clarity (60%) + sensor stability (40%)
float Algo_U01::computeSQI() const {
    // 1. Stroke clarity: how clearly strokes stand out from baseline
    //    Use ratio of last peak accel to buffer mean
    float bufMean = accelMagBuf_.mean();
    float clarity = 0.0f;
    if (totalStrokes_ > 0 && bufMean > 0.01f) {
        uint8_t lastIdx = (strokeHistoryHead_ + STROKE_HISTORY_SIZE - 1) % STROKE_HISTORY_SIZE;
        float lastPeak = strokeHistory_[lastIdx].peakAccel_g;
        float zscore = (lastPeak - bufMean) / fmaxf(accelMagBuf_.stddev(), 0.01f);
        // Map: z >= 5 → 1.0, z <= 1.5 → 0.0
        clarity = fminf(fmaxf((zscore - 1.5f) / 3.5f, 0.0f), 1.0f);
    }

    // 2. Sensor stability: low variance during rest
    //    Map: variance <= 0.01 → 1.0, >= 0.1 → 0.0
    float stability = fminf(fmaxf(1.0f - (restVariance_ - 0.01f) / 0.09f, 0.0f), 1.0f);

    return 0.6f * clarity + 0.4f * stability;
}

// ─── Getters ───────────────────────────────────────────────────
AlgorithmOutput Algo_U01::getOutput() const { return output_; }
AlgoState Algo_U01::getState() const { return state_; }

float Algo_U01::getAvgSwingSpeed() const {
    return (totalStrokes_ > 0) ? (speedSum_ / (float)totalStrokes_) : 0.0f;
}

float Algo_U01::getActiveRatio() const {
    uint32_t total = getSessionDuration_ms();
    return (total > 0) ? ((float)activeTime_ms_ / (float)total) : 0.0f;
}

uint32_t Algo_U01::getSessionDuration_ms() const {
    if (sessionStartTs_ == 0) return 0;
    return output_.timestamp_ms - sessionStartTs_;
}

const StrokeEvent& Algo_U01::getStrokeAt(uint8_t index) const {
    // Index 0 = most recent
    static const StrokeEvent empty = {0, StrokeType::UNCLASSIFIED, 0, 0, 0};
    if (index >= strokeHistoryCount_) return empty;
    uint8_t pos = (strokeHistoryHead_ + STROKE_HISTORY_SIZE - 1 - index) % STROKE_HISTORY_SIZE;
    return strokeHistory_[pos];
}
