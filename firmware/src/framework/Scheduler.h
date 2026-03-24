#pragma once
// ═══════════════════════════════════════════════════════════════
// OpenPulse — Algorithm Scheduler
//
// Manages algorithm execution across tiers:
//   Tier 0 (REALTIME):  every loop() — budget <200µs
//   Tier 1 (PERIODIC):  fixed interval — budget <1ms
//   Tier 2 (ON_DEMAND): user-triggered — budget <10ms
//   Tier 3 (OFF_DEVICE): dashboard-only — never called here
//
// Algorithms register at startup. The scheduler calls update()
// per tier rules and enforces timing budgets.
// ═══════════════════════════════════════════════════════════════

#include <stdint.h>
#include "AlgorithmBase.h"

class Scheduler {
public:
    static constexpr uint8_t MAX_ALGORITHMS = 32;

    // ─── Registration ─────────────────────────────────────────

    bool registerAlgorithm(AlgorithmBase* algo) {
        if (count_ >= MAX_ALGORITHMS) return false;
        algorithms_[count_] = algo;
        tiers_[count_] = algo->getTier();
        intervals_[count_] = defaultInterval(algo->getTier());
        lastRun_[count_] = 0;
        count_++;
        return true;
    }

    // Set custom interval for a specific algorithm (overrides tier default)
    void setInterval(uint8_t index, uint32_t interval_ms) {
        if (index < count_) intervals_[index] = interval_ms;
    }

    // ─── Init ─────────────────────────────────────────────────

    void initAll() {
        for (uint8_t i = 0; i < count_; i++) {
            algorithms_[i]->init();
        }
    }

    // ─── Tick (call every loop) ───────────────────────────────

    void tick(uint32_t now_ms) {
        for (uint8_t i = 0; i < count_; i++) {
            AlgoTier tier = tiers_[i];

            // Tier 3 = off-device, skip entirely
            if (tier == AlgoTier::OFF_DEVICE) continue;

            // Tier 0 = every tick
            if (tier == AlgoTier::REALTIME) {
                algorithms_[i]->update(now_ms);
                continue;
            }

            // Tier 1 = periodic at configured interval
            if (tier == AlgoTier::PERIODIC) {
                if (now_ms - lastRun_[i] >= intervals_[i]) {
                    lastRun_[i] = now_ms;
                    algorithms_[i]->update(now_ms);
                }
                continue;
            }

            // Tier 2 = on-demand: only runs when triggered
            if (tier == AlgoTier::ON_DEMAND && triggered_[i]) {
                algorithms_[i]->update(now_ms);
                triggered_[i] = false;
            }
        }
    }

    // ─── On-Demand Trigger ────────────────────────────────────

    void trigger(uint8_t index) {
        if (index < count_) triggered_[index] = true;
    }

    void triggerByID(const char* id) {
        for (uint8_t i = 0; i < count_; i++) {
            // Simple string compare (IDs are short: "A01", "X06")
            const char* aid = algorithms_[i]->getID();
            if (aid[0] == id[0] && aid[1] == id[1] && aid[2] == id[2]) {
                triggered_[i] = true;
                return;
            }
        }
    }

    // ─── Accessors ────────────────────────────────────────────

    uint8_t count() const { return count_; }
    AlgorithmBase* getAlgorithm(uint8_t index) const {
        return (index < count_) ? algorithms_[index] : nullptr;
    }

    // Total RAM used by all registered algorithms
    uint32_t totalRAM() const {
        uint32_t total = 0;
        for (uint8_t i = 0; i < count_; i++) {
            total += algorithms_[i]->ramUsage();
        }
        return total;
    }

private:
    AlgorithmBase* algorithms_[MAX_ALGORITHMS] = {};
    AlgoTier       tiers_[MAX_ALGORITHMS] = {};
    uint32_t       intervals_[MAX_ALGORITHMS] = {};
    uint32_t       lastRun_[MAX_ALGORITHMS] = {};
    bool           triggered_[MAX_ALGORITHMS] = {};
    uint8_t        count_ = 0;

    static uint32_t defaultInterval(AlgoTier tier) {
        switch (tier) {
            case AlgoTier::REALTIME:   return 0;     // every tick
            case AlgoTier::PERIODIC:   return 100;   // 10 Hz default
            case AlgoTier::ON_DEMAND:  return 0;
            case AlgoTier::OFF_DEVICE: return 0;
            default: return 1000;
        }
    }
};
