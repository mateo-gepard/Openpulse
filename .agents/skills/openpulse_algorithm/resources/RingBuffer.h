#pragma once
// ═══════════════════════════════════════════════════════════════
// OpenPulse Algorithm Framework — Ring Buffer
//
// Timestamped circular buffer for sensor data. Used by every
// algorithm. Supports statistical helpers and cross-sensor
// timestamp interpolation.
//
// All memory is statically allocated (template parameter N).
// No dynamic allocation — safe for nRF52840 (256KB RAM).
// ═══════════════════════════════════════════════════════════════

#include <stdint.h>
#include <math.h>
#include <string.h>

template<typename T, uint16_t N>
class RingBuffer {
public:
    // ─── Core Operations ───────────────────────────────────
    void push(T sample, uint32_t timestamp_ms) {
        data_[head_] = sample;
        timestamps_[head_] = timestamp_ms;
        head_ = (head_ + 1) % N;
        if (count_ < N) count_++;
    }

    // Index 0 = most recent, 1 = second most recent, etc.
    T at(uint16_t index) const {
        if (index >= count_) return T(0);
        uint16_t pos = (head_ + N - 1 - index) % N;
        return data_[pos];
    }

    uint32_t timestampAt(uint16_t index) const {
        if (index >= count_) return 0;
        uint16_t pos = (head_ + N - 1 - index) % N;
        return timestamps_[pos];
    }

    T latest() const { return at(0); }
    uint32_t latestTimestamp() const { return timestampAt(0); }

    uint16_t count() const { return count_; }
    uint16_t capacity() const { return N; }
    bool full() const { return count_ >= N; }
    bool empty() const { return count_ == 0; }

    void clear() {
        head_ = 0;
        count_ = 0;
        memset(data_, 0, sizeof(data_));
        memset(timestamps_, 0, sizeof(timestamps_));
    }

    // ─── Statistical Helpers ───────────────────────────────

    float mean() const {
        if (count_ == 0) return 0;
        float sum = 0;
        for (uint16_t i = 0; i < count_; i++) sum += (float)at(i);
        return sum / count_;
    }

    float min() const {
        if (count_ == 0) return 0;
        float m = (float)at(0);
        for (uint16_t i = 1; i < count_; i++) {
            float v = (float)at(i);
            if (v < m) m = v;
        }
        return m;
    }

    float max() const {
        if (count_ == 0) return 0;
        float m = (float)at(0);
        for (uint16_t i = 1; i < count_; i++) {
            float v = (float)at(i);
            if (v > m) m = v;
        }
        return m;
    }

    float stddev() const {
        if (count_ < 2) return 0;
        float m = mean();
        float sumSq = 0;
        for (uint16_t i = 0; i < count_; i++) {
            float diff = (float)at(i) - m;
            sumSq += diff * diff;
        }
        return sqrtf(sumSq / (count_ - 1));
    }

    float rms() const {
        if (count_ == 0) return 0;
        float sumSq = 0;
        for (uint16_t i = 0; i < count_; i++) {
            float v = (float)at(i);
            sumSq += v * v;
        }
        return sqrtf(sumSq / count_);
    }

    float median() const {
        if (count_ == 0) return 0;
        // Copy to temp array for sorting (small N, acceptable)
        float temp[N];
        for (uint16_t i = 0; i < count_; i++) temp[i] = (float)at(i);
        // Simple insertion sort (N is small, typically < 512)
        for (uint16_t i = 1; i < count_; i++) {
            float key = temp[i];
            int16_t j = i - 1;
            while (j >= 0 && temp[j] > key) {
                temp[j + 1] = temp[j];
                j--;
            }
            temp[j + 1] = key;
        }
        if (count_ % 2 == 0)
            return (temp[count_ / 2 - 1] + temp[count_ / 2]) / 2.0f;
        else
            return temp[count_ / 2];
    }

    // ─── Cross-Sensor Interpolation ────────────────────────
    // Linear interpolation to find value at a target timestamp.
    // Used when aligning sensors at different sample rates.
    float interpolateAt(uint32_t target_ms) const {
        if (count_ < 2) return count_ == 1 ? (float)at(0) : 0;

        // Find the two samples bracketing target_ms
        for (uint16_t i = 0; i < count_ - 1; i++) {
            uint32_t t0 = timestampAt(i);      // newer
            uint32_t t1 = timestampAt(i + 1);  // older

            if (target_ms <= t0 && target_ms >= t1) {
                // Linear interpolation
                float frac = (float)(target_ms - t1) / (float)(t0 - t1);
                return (float)at(i + 1) + frac * ((float)at(i) - (float)at(i + 1));
            }
        }
        // Target outside buffer range — return nearest
        if (target_ms > timestampAt(0)) return (float)at(0);
        return (float)at(count_ - 1);
    }

    // ─── Memory Info ───────────────────────────────────────
    static constexpr uint16_t memoryBytes() {
        return sizeof(T) * N + sizeof(uint32_t) * N + sizeof(uint16_t) * 2;
    }

private:
    T        data_[N];
    uint32_t timestamps_[N];
    uint16_t head_ = 0;
    uint16_t count_ = 0;
};
