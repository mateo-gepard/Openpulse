#pragma once
// ═══════════════════════════════════════════════════════════════
// MAX30102 Driver — PPG (IR + Red), no ECG
// Wire, 0x57 | 100 Hz | 18-bit
//
// Implements PPGECGDriver interface from SensorDriverBase.h
// (ECG methods return 0 — this chip has no ECG)
// ═══════════════════════════════════════════════════════════════

#include "../framework/SensorDriverBase.h"
#include <Wire.h>

class Driver_MAX30102 : public PPGECGDriver {
public:
    bool init() override {
        Wire.beginTransmission(0x57);
        if (Wire.endTransmission() != 0) {
            status_ = DriverStatus::NOT_FOUND;
            return false;
        }

        // Reset
        writeReg(0x09, 0x40);  // MODE: reset bit
        delay(100);
        for (uint8_t i = 0; i < 10; i++) {
            if ((readReg(0x09) & 0x40) == 0) break;
            delay(10);
        }

        // Verify Part ID (0x15 for MAX30102)
        uint8_t partID = readReg(0xFF);
        Serial.print(F("  [MAX30102] Part ID: 0x"));
        Serial.println(partID, HEX);

        // Clear FIFO pointers
        writeReg(0x04, 0x00);  // FIFO_WR_PTR
        writeReg(0x05, 0x00);  // OVF_COUNTER
        writeReg(0x06, 0x00);  // FIFO_RD_PTR

        // FIFO Configuration
        // [7:5] SMP_AVE = 010 (4 samples averaged)
        // [4]   FIFO_ROLLOVER_EN = 1
        // [3:0] FIFO_A_FULL = 0 (trigger at 32-0=32 unread)
        writeReg(0x08, 0x50);

        // Mode Configuration — SpO2 mode (Red + IR)
        writeReg(0x09, 0x03);  // MODE = 011 (SpO2)

        // SpO2 Configuration
        // [6:5] SPO2_ADC_RGE = 11 (16384 nA full scale)
        // [4:2] SPO2_SR = 001 (100 Hz)
        // [1:0] LED_PW = 11 (411µs, 18-bit)
        writeReg(0x0A, 0x67);

        // LED Currents (each step = 0.2 mA)
        writeReg(0x0C, 0x47);  // LED1 (Red): 14.2 mA
        writeReg(0x0D, 0x47);  // LED2 (IR):  14.2 mA

        status_ = DriverStatus::RUNNING;
        sampleRate_ = 100;
        return true;
    }

    void update(uint32_t now_ms) override {
        if (status_ != DriverStatus::RUNNING) return;

        // Check for overflow
        uint8_t ovf = readReg(0x05);
        if (ovf > 0) {
            overflowCount_++;
            // Clear FIFO and restart clean
            writeReg(0x04, 0x00);
            writeReg(0x05, 0x00);
            writeReg(0x06, 0x00);
            if (now_ms - lastDebug_ > 5000) {
                lastDebug_ = now_ms;
                Serial.print(F("  [MAX30102] FIFO overflow #"));
                Serial.println(overflowCount_);
            }
            return;
        }

        uint8_t wrPtr = readReg(0x04) & 0x1F;
        uint8_t rdPtr = readReg(0x06) & 0x1F;
        int available = (int)wrPtr - (int)rdPtr;
        if (available < 0) available += 32;
        if (available == 0) {
            if (now_ms - lastDebug_ > 5000) {
                lastDebug_ = now_ms;
                Serial.print(F("  [MAX30102] FIFO empty  wr="));
                Serial.print(wrPtr);
                Serial.print(F(" rd="));
                Serial.print(rdPtr);
                Serial.print(F(" mode=0x"));
                Serial.println(readReg(0x09), HEX);
            }
            return;
        }

        // Drain all available samples (up to 16 per call to stay responsive)
        int toRead = (available > 16) ? 16 : available;
        for (int i = 0; i < toRead; i++) {
            Wire.beginTransmission(0x57);
            Wire.write(0x07);  // FIFO data register
            Wire.endTransmission(false);
            Wire.requestFrom((uint8_t)0x57, (uint8_t)6);  // 3 bytes Red + 3 bytes IR

            if (Wire.available() >= 6) {
                uint32_t red_raw = ((uint32_t)Wire.read() << 16) | ((uint32_t)Wire.read() << 8) | Wire.read();
                uint32_t ir_raw  = ((uint32_t)Wire.read() << 16) | ((uint32_t)Wire.read() << 8) | Wire.read();
                red_raw &= 0x03FFFF;  // 18-bit mask
                ir_raw  &= 0x03FFFF;

                ppgIR_  = (float)ir_raw;
                ppgRed_ = (float)red_raw;

                // Skin proximity detection: IR below threshold = no contact
                bool onSkin = (ir_raw > SKIN_THRESHOLD);
                if (onSkin != onSkin_) {
                    onSkin_ = onSkin;
                    Serial.print(F("  [MAX30102] Skin: "));
                    Serial.println(onSkin ? F("ON") : F("OFF"));
                    if (onSkin) {
                        // Reset DC baselines on new contact
                        dcIR_ = ppgIR_;
                        dcRed_ = ppgRed_;
                    }
                }

                if (!onSkin) {
                    sample_ = { 0, now_ms, false };
                    continue;
                }

                // DC baselines (EMA)
                if (dcIR_ == 0) { dcIR_ = ppgIR_; dcRed_ = ppgRed_; }
                dcIR_  = 0.995f * dcIR_  + 0.005f * ppgIR_;
                dcRed_ = 0.995f * dcRed_ + 0.005f * ppgRed_;

                lastUpdate_ = now_ms;
                sample_ = { ppgIR_, now_ms, true };
            }
        }
    }

    void sleep() override { writeReg(0x09, 0x80); status_ = DriverStatus::SLEEPING; }
    void wake()  override { writeReg(0x09, 0x03); status_ = DriverStatus::RUNNING; }

    DriverStatus getStatus() const override { return status_; }
    const char*  getName() const override   { return "MAX30102"; }
    uint8_t      getI2CAddress() const override { return 0x57; }
    bool isSkinContact() const { return onSkin_; }

    SensorSample getLatest() const override { return sample_; }

    float getSampleRate() const override    { return sampleRate_; }
    uint8_t getBitDepth() const override    { return 18; }
    uint16_t getBufferSize() const override { return 512; }
    float getPowerConsumption_mA() const override { return 0.6f; }
    ChannelMask getChannels() const override { return CH_PPG; }  // No ECG

    // PPG
    float getPPG_IR() const override      { return ppgIR_; }
    float getPPG_Red() const override     { return ppgRed_; }
    float getPPG_DC_IR() const override   { return dcIR_; }
    float getPPG_DC_Red() const override  { return dcRed_; }

    // ECG — not available on MAX30102
    float getECG() const override         { return 0; }
    uint32_t getSyncTimestamp() const override { return lastUpdate_; }
    void setPPGSampleRate(uint16_t hz) override { sampleRate_ = hz; }
    void setECGSampleRate(uint16_t) override {}
    void setLEDCurrent(uint8_t red_mA, uint8_t ir_mA) override {
        // Each step = 0.2 mA, so mA / 0.2 = register value
        writeReg(0x0C, (red_mA * 5) & 0xFF);
        writeReg(0x0D, (ir_mA * 5) & 0xFF);
    }

private:
    // IR below this = no skin contact. 18-bit ADC, ~10k–50k is ambient, >50k is on-skin.
    static constexpr uint32_t SKIN_THRESHOLD = 50000;

    DriverStatus status_ = DriverStatus::NOT_FOUND;
    SensorSample sample_ = {};
    float ppgIR_ = 0, ppgRed_ = 0;
    float dcIR_ = 0, dcRed_ = 0;
    float sampleRate_ = 100;
    uint32_t lastUpdate_ = 0;
    uint32_t lastDebug_ = 0;
    uint32_t overflowCount_ = 0;
    bool onSkin_ = false;

    void writeReg(uint8_t reg, uint8_t val) {
        Wire.beginTransmission(0x57);
        Wire.write(reg);
        Wire.write(val);
        Wire.endTransmission();
    }

    uint8_t readReg(uint8_t reg) {
        Wire.beginTransmission(0x57);
        Wire.write(reg);
        Wire.endTransmission(false);
        Wire.requestFrom((uint8_t)0x57, (uint8_t)1);
        return Wire.available() ? Wire.read() : 0;
    }
};
