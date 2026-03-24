// Compile test for algorithm templates
// clang++ -std=c++17 -fsyntax-only -I ../../src -I ../../src/framework template_compile_test.cpp
#include "framework/AlgorithmBase.h"
#include "framework/RingBuffer.h"
#include "framework/Channels.h"

// ═══ Instantiate a concrete algorithm from the template pattern ═══
namespace {
    constexpr float SAMPLE_RATE_HZ = 100.0f;
    constexpr float OUTPUT_MIN = 30.0f;
    constexpr float OUTPUT_MAX = 220.0f;
    constexpr float SQI_THRESHOLD = 0.3f;

    inline float clampOutput(float v) {
        return (v < OUTPUT_MIN) ? OUTPUT_MIN : (v > OUTPUT_MAX) ? OUTPUT_MAX : v;
    }
}

class Algo_TEST : public AlgorithmBase {
public:
    void init() override {
        ppg_buffer_.clear();
        state_ = AlgoState::ACQUIRING;
        output_ = {0, 0, 0, false};
    }

    void update(uint32_t now_ms) override {
        float sqi = computeSQI();
        if (sqi < SQI_THRESHOLD) {
            state_ = AlgoState::LOW_QUALITY;
            output_.sqi = sqi;
            output_.timestamp_ms = now_ms;
            output_.valid = false;
            return;
        }
        float result = 72.0f;
        result = clampOutput(result);
        output_.value = result;
        output_.sqi = sqi;
        output_.timestamp_ms = now_ms;
        output_.valid = true;
        state_ = AlgoState::VALID;
    }

    AlgorithmOutput getOutput() const override { return output_; }
    AlgoState getState() const override { return state_; }
    const char* getID() const override { return "TEST"; }
    const char* getName() const override { return "Template Test"; }
    const char* getUnit() const override { return "BPM"; }
    AlgoClassification getClassification() const override {
        return AlgoClassification::WELLNESS;
    }
    AlgoTier getTier() const override { return AlgoTier::REALTIME; }
    uint16_t ramUsage() const override { return sizeof(*this); }

private:
    AlgoState state_ = AlgoState::IDLE;
    RingBuffer<float, 512> ppg_buffer_;
    AlgorithmOutput output_ = {0, 0, 0, false};

    float computeSQI() const {
        float sqi = 1.0f;
        if (ppg_buffer_.count() < 100) sqi = 0.0f;
        return sqi;
    }
};

// ═══ Verify it instantiates and methods work ═══
void templateVerification() {
    Algo_TEST algo;
    algo.init();
    algo.update(1000);
    AlgorithmOutput out = algo.getOutput();
    AlgoState st = algo.getState();
    const char* id = algo.getID();
    const char* name = algo.getName();
    const char* unit = algo.getUnit();
    uint16_t ram = algo.ramUsage();
    (void)out; (void)st; (void)id; (void)name; (void)unit; (void)ram;

    // Verify channel masks work
    uint32_t mask = CH_PPG | CH_ACCEL;
    (void)mask;

    // Verify RingBuffer stats
    RingBuffer<float, 64> buf;
    buf.push(1.0f, 0);
    float m = buf.mean();
    (void)m;
}
