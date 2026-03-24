/*
 * Sensor Dashboard v5 — XIAO BLE Sense nRF52840
 * 
 * Reads I2C sensors + onboard IMU + onboard PDM microphone,
 * exposes data via BLE GATT + Serial.
 *   - MAX30102  (Heart-Rate / SpO2)       addr 0x57  [Wire - external]
 *   - BME280   (Temp / Humidity / Pressure) addr 0x76  [Wire - external]
 *   - MCP9808  (Precision Temperature)     addr 0x18  [Wire - external]
 *   - LSM6DS3TR-C (Accel / Gyro)           addr 0x6A  [Wire1 - onboard]
 *   - MSM261D3526H1CPM (PDM Microphone)              [onboard]
 *
 * v5 changes:
 *   - IMU: explicit power pin management for reliable init
 *   - Microphone: PDM → RMS → dB sound level via BLE
 *
 * Required libraries (install via Arduino Library Manager):
 *   - ArduinoBLE
 *   - SparkFun MAX3010x Pulse and Proximity Sensor Library
 *   - Adafruit BME280 Library
 *   - Adafruit MCP9808 Library
 *   - Adafruit Unified Sensor (dependency)
 *   - Seeed Arduino LSM6DS3 (install from ZIP: github.com/Seeed-Studio/Seeed_Arduino_LSM6DS3)
 *
 * NOTE: The Seeed LSM6DS3 library needs a one-line patch in LSM6DS3.cpp:
 *       Line ~108: change  #else  to  #elif !defined(ARDUINO_ARCH_MBED)
 *       (fixes SPI.setBitOrder compilation error on mbed boards)
 */

#include <Wire.h>
#include <ArduinoBLE.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <Adafruit_BME280.h>
#include <Adafruit_MCP9808.h>
#include "LSM6DS3.h"
#include <PDM.h>

// ─── BLE UUIDs ───────────────────────────────────────────────
#define SERVICE_UUID        "12345678-1234-5678-1234-56789abcdef0"
#define CHAR_HR_UUID        "12345678-1234-5678-1234-56789abcdef1"
#define CHAR_SPO2_UUID      "12345678-1234-5678-1234-56789abcdef2"
#define CHAR_TEMP_BME_UUID  "12345678-1234-5678-1234-56789abcdef3"
#define CHAR_HUMIDITY_UUID  "12345678-1234-5678-1234-56789abcdef4"
#define CHAR_PRESSURE_UUID  "12345678-1234-5678-1234-56789abcdef5"
#define CHAR_TEMP_MCP_UUID  "12345678-1234-5678-1234-56789abcdef6"
#define CHAR_ACCEL_UUID     "12345678-1234-5678-1234-56789abcdef7"
#define CHAR_GYRO_UUID      "12345678-1234-5678-1234-56789abcdef8"
#define CHAR_MIC_UUID       "12345678-1234-5678-1234-56789abcdef9"

// ─── IMU power pin (onboard LSM6DS3TR-C) ─────────────────────
#define IMU_POWER_PIN  15   // PIN_LSM6DS3TR_C_POWER on XIAO Sense

// ─── Sensor objects ──────────────────────────────────────────
MAX30105         particleSensor;
Adafruit_BME280  bme;
Adafruit_MCP9808 mcp = Adafruit_MCP9808();
LSM6DS3          imu(I2C_MODE, 0x6A);

// ─── BLE objects ─────────────────────────────────────────────
BLEService sensorService(SERVICE_UUID);

BLEFloatCharacteristic hrChar   (CHAR_HR_UUID,        BLERead | BLENotify);
BLEFloatCharacteristic spo2Char (CHAR_SPO2_UUID,      BLERead | BLENotify);
BLEFloatCharacteristic tempBChar(CHAR_TEMP_BME_UUID,   BLERead | BLENotify);
BLEFloatCharacteristic humChar  (CHAR_HUMIDITY_UUID,   BLERead | BLENotify);
BLEFloatCharacteristic presChar (CHAR_PRESSURE_UUID,   BLERead | BLENotify);
BLEFloatCharacteristic tempMChar(CHAR_TEMP_MCP_UUID,   BLERead | BLENotify);
BLECharacteristic accelChar(CHAR_ACCEL_UUID, BLERead | BLENotify, 12);
BLECharacteristic gyroChar (CHAR_GYRO_UUID,  BLERead | BLENotify, 12);
BLEFloatCharacteristic micChar  (CHAR_MIC_UUID,       BLERead | BLENotify);

// ─── Heart-rate algorithm state ──────────────────────────────
const byte RATE_SIZE = 8;
byte       rates[RATE_SIZE];
byte       rateSpot      = 0;
byte       validBeats    = 0;
long       lastBeat      = 0;
float      beatsPerMinute = 0;
int        beatAvg       = 0;
bool       fingerPresent = false;
unsigned long lastFingerTime = 0;
const long IR_THRESHOLD = 50000;
const long FINGER_TIMEOUT = 3000;
const long MIN_BEAT_INTERVAL = 300;
const long MAX_BEAT_INTERVAL = 2000;

// ─── SpO2 algorithm state ────────────────────────────────────
float dcRed   = 0, dcIR   = 0;
float acRedSum = 0, acIRSum = 0;
long  spo2SampleCount = 0;
float lastSpO2 = 0;
byte  spo2BeatCount = 0;
const float DC_ALPHA = 0.995;
const byte  SPO2_MIN_BEATS = 4;

// ─── PDM Microphone state ────────────────────────────────────
#define PDM_BUFFER_SIZE 256
short pdmBuffer[PDM_BUFFER_SIZE];
volatile bool pdmReady = false;
float cachedMicDB = 0;
bool  mic_ok = false;

// PDM callback — called by PDM library when buffer is full
void onPDMdata() {
  int bytesAvailable = PDM.available();
  if (bytesAvailable > 0) {
    int samplesToRead = min(bytesAvailable / 2, PDM_BUFFER_SIZE);
    PDM.read(pdmBuffer, samplesToRead * 2);
    pdmReady = true;
  }
}

// Compute RMS → dB from the PDM sample buffer
float computeSoundLevel() {
  long sumSquares = 0;
  int count = PDM_BUFFER_SIZE;

  for (int i = 0; i < count; i++) {
    long sample = pdmBuffer[i];
    sumSquares += sample * sample;
  }

  float rms = sqrt((float)sumSquares / count);
  if (rms < 1.0) rms = 1.0;   // floor to avoid log(0)

  // Convert to dBFS (decibels relative to full-scale)
  // 16-bit audio: full-scale = 32767
  float dB = 20.0 * log10(rms / 32767.0) + 120.0;  // offset so quiet ~30-40dB, loud ~90+
  if (dB < 0) dB = 0;
  return dB;
}

// ─── Flags ───────────────────────────────────────────────────
bool max30102_ok = false;
bool bme280_ok   = false;
bool mcp9808_ok  = false;
bool imu_ok      = false;

// ─── Timing ──────────────────────────────────────────────────
unsigned long lastBLEUpdate = 0;
const unsigned long BLE_INTERVAL = 750;
const unsigned long BLE_WRITE_DELAY = 5;

// ─── BLE watchdog ────────────────────────────────────────────
bool wasConnected = false;

// ─── Helpers ─────────────────────────────────────────────────
void writeFloat3(BLECharacteristic &ch, float x, float y, float z) {
  uint8_t buf[12];
  memcpy(buf,     &x, 4);
  memcpy(buf + 4, &y, 4);
  memcpy(buf + 8, &z, 4);
  ch.writeValue(buf, 12);
}

void scanI2C() {
  Serial.println("\n--- I2C Bus Scan (Wire) ---");
  byte count = 0;
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print("  0x");
      if (addr < 16) Serial.print("0");
      Serial.print(addr, HEX);
      if (addr == 0x57) Serial.print(" (MAX30102)");
      if (addr == 0x76) Serial.print(" (BME280)");
      if (addr == 0x77) Serial.print(" (BME280 alt)");
      if (addr == 0x18) Serial.print(" (MCP9808)");
      if (addr == 0x6A) Serial.print(" (LSM6DS3)");
      if (addr == 0x6B) Serial.print(" (LSM6DS3 alt)");
      Serial.println();
      count++;
    }
  }
  if (count == 0) Serial.println("  No devices found.");
  else { Serial.print("  "); Serial.print(count); Serial.println(" device(s)."); }
  Serial.println();
}

void resetHRState() {
  beatAvg = 0;
  beatsPerMinute = 0;
  rateSpot = 0;
  validBeats = 0;
  memset(rates, 0, sizeof(rates));
}

void resetSpO2State() {
  dcRed = 0;
  dcIR = 0;
  acRedSum = 0;
  acIRSum = 0;
  spo2SampleCount = 0;
  lastSpO2 = 0;
  spo2BeatCount = 0;
}

// ================================================================
void setup() {
  Serial.begin(115200);
  delay(3000);
  Serial.println("=== Sensor Dashboard v5 — XIAO BLE Sense ===\n");

  Wire.begin();
  scanI2C();

  // ── MAX30102 (external, Wire) ─────────────────────────────
  if (particleSensor.begin(Wire, I2C_SPEED_STANDARD)) {
    max30102_ok = true;
    particleSensor.setup(0x1F, 4, 2, 100, 411, 4096);
    particleSensor.setPulseAmplitudeRed(0x1F);
    particleSensor.setPulseAmplitudeGreen(0);
    Serial.println("[OK]  MAX30102 (Wire)");
  } else {
    Serial.println("[ERR] MAX30102 not found");
  }

  // ── BME280 (external, Wire) ───────────────────────────────
  if (bme.begin(0x76)) {
    bme280_ok = true;
    Serial.println("[OK]  BME280 @ 0x76 (Wire)");
  } else if (bme.begin(0x77)) {
    bme280_ok = true;
    Serial.println("[OK]  BME280 @ 0x77 (Wire)");
  } else {
    Serial.println("[ERR] BME280 not found");
  }

  // ── MCP9808 (external, Wire) ──────────────────────────────
  if (mcp.begin(0x18)) {
    mcp9808_ok = true;
    mcp.setResolution(3);
    Serial.println("[OK]  MCP9808 (Wire)");
  } else {
    Serial.println("[ERR] MCP9808 not found");
  }

  // ── LSM6DS3 IMU (onboard, Wire1) ──────────────────────────
  // v5: Explicitly power on IMU before init for reliable startup
  Serial.println("[...] Powering on IMU (pin 15)...");
  pinMode(IMU_POWER_PIN, OUTPUT);
  #if defined(NRF52840_XXAA)
    // High-drive GPIO config for reliable power delivery
    NRF_P1->PIN_CNF[8] = ((uint32_t)NRF_GPIO_PIN_DIR_OUTPUT << GPIO_PIN_CNF_DIR_Pos)
                        | ((uint32_t)NRF_GPIO_PIN_INPUT_DISCONNECT << GPIO_PIN_CNF_INPUT_Pos)
                        | ((uint32_t)NRF_GPIO_PIN_NOPULL << GPIO_PIN_CNF_PULL_Pos)
                        | ((uint32_t)NRF_GPIO_PIN_H0H1 << GPIO_PIN_CNF_DRIVE_Pos)
                        | ((uint32_t)NRF_GPIO_PIN_NOSENSE << GPIO_PIN_CNF_SENSE_Pos);
  #endif
  digitalWrite(IMU_POWER_PIN, HIGH);
  delay(100);  // give IMU time to boot

  if (imu.begin() == 0) {
    imu_ok = true;
    Serial.println("[OK]  LSM6DS3 IMU (onboard, Wire1)");
  } else {
    // Retry after power cycle
    Serial.println("[...] IMU first attempt failed, power cycling...");
    digitalWrite(IMU_POWER_PIN, LOW);
    delay(100);
    digitalWrite(IMU_POWER_PIN, HIGH);
    delay(500);
    if (imu.begin() == 0) {
      imu_ok = true;
      Serial.println("[OK]  LSM6DS3 IMU (onboard, Wire1) — after power cycle");
    } else {
      Serial.println("[ERR] LSM6DS3 IMU not found (is this the Sense variant?)");
    }
  }

  // ── PDM Microphone (onboard) ──────────────────────────────
  PDM.onReceive(onPDMdata);
  if (PDM.begin(1, 16000)) {  // mono, 16kHz
    mic_ok = true;
    PDM.setGain(20);  // moderate gain
    Serial.println("[OK]  PDM Microphone (onboard, 16kHz mono)");
  } else {
    Serial.println("[ERR] PDM Microphone init failed");
  }

  // ── BLE ───────────────────────────────────────────────────
  if (!BLE.begin()) {
    Serial.println("[ERR] BLE init failed!");
    while (1);
  }

  BLE.setLocalName("SensorDash");
  BLE.setAdvertisedService(sensorService);

  sensorService.addCharacteristic(hrChar);
  sensorService.addCharacteristic(spo2Char);
  sensorService.addCharacteristic(tempBChar);
  sensorService.addCharacteristic(humChar);
  sensorService.addCharacteristic(presChar);
  sensorService.addCharacteristic(tempMChar);
  sensorService.addCharacteristic(accelChar);
  sensorService.addCharacteristic(gyroChar);
  sensorService.addCharacteristic(micChar);

  BLE.addService(sensorService);

  hrChar.writeValue(0.0f);
  spo2Char.writeValue(0.0f);
  tempBChar.writeValue(0.0f);
  humChar.writeValue(0.0f);
  presChar.writeValue(0.0f);
  tempMChar.writeValue(0.0f);
  writeFloat3(accelChar, 0, 0, 0);
  writeFloat3(gyroChar,  0, 0, 0);
  micChar.writeValue(0.0f);

  BLE.setConnectionInterval(6, 40);
  BLE.advertise();
  Serial.println("[OK]  BLE advertising as 'SensorDash'");
  Serial.println("─────────────────────────────────────────\n");
}

// ─── Cached sensor values ────────────────────────────────────
float cachedHR = 0, cachedSpO2 = 0;
float cachedTempB = 0, cachedHum = 0, cachedPres = 0;
float cachedTempM = 0;
float cachedAX = 0, cachedAY = 0, cachedAZ = 0;
float cachedGX = 0, cachedGY = 0, cachedGZ = 0;

unsigned long lastSerialPrint = 0;
byte sensorSlot = 0;  // round-robin: 0=bme, 1=mcp, 2=imu, 3=mic

// ================================================================
void loop() {
  BLE.poll();

  // ── PDM Microphone — process when buffer is ready ──────────
  if (mic_ok && pdmReady) {
    pdmReady = false;
    cachedMicDB = computeSoundLevel();
  }

  // ── MAX30102 — every loop iteration (needs fast sampling) ──
  if (max30102_ok) {
    long irValue = particleSensor.getIR();
    long redValue = particleSensor.getRed();

    // ── Finger detection ──
    if (irValue > IR_THRESHOLD) {
      fingerPresent = true;
      lastFingerTime = millis();
    } else if (millis() - lastFingerTime > FINGER_TIMEOUT) {
      fingerPresent = false;
      resetHRState();
      resetSpO2State();
    }

    // ── SpO2: track DC baseline and AC amplitude ──
    if (fingerPresent && irValue > IR_THRESHOLD) {
      if (dcRed == 0) { dcRed = (float)redValue; dcIR = (float)irValue; }

      dcRed = DC_ALPHA * dcRed + (1.0 - DC_ALPHA) * (float)redValue;
      dcIR  = DC_ALPHA * dcIR  + (1.0 - DC_ALPHA) * (float)irValue;

      float acRed = fabs((float)redValue - dcRed);
      float acIR  = fabs((float)irValue  - dcIR);
      acRedSum += acRed;
      acIRSum  += acIR;
      spo2SampleCount++;
    }

    // ── Heart rate beat detection ──
    if (fingerPresent && checkForBeat(irValue)) {
      long now = millis();
      long delta = now - lastBeat;

      if (delta < MIN_BEAT_INTERVAL) {
        // Skip — noise
      }
      else if (lastBeat > 0 && delta > MAX_BEAT_INTERVAL) {
        resetHRState();
        lastBeat = now;
      }
      else {
        lastBeat = now;
        beatsPerMinute = 60.0 / (delta / 1000.0);

        if (beatsPerMinute >= 40 && beatsPerMinute <= 180) {
          rates[rateSpot % RATE_SIZE] = (byte)beatsPerMinute;
          rateSpot++;
          if (validBeats < RATE_SIZE) validBeats++;

          if (validBeats >= 4) {
            byte count = min(validBeats, RATE_SIZE);
            int sum = 0;
            for (byte x = 0; x < count; x++) sum += rates[x];
            beatAvg = sum / count;
          }

          spo2BeatCount++;
          if (spo2BeatCount >= SPO2_MIN_BEATS && spo2SampleCount > 50) {
            float avgACRed = acRedSum / spo2SampleCount;
            float avgACIR  = acIRSum  / spo2SampleCount;

            if (dcRed > 0 && dcIR > 0 && avgACIR > 0) {
              float ratioRed = avgACRed / dcRed;
              float ratioIR  = avgACIR  / dcIR;

              if (ratioIR > 0) {
                float R = ratioRed / ratioIR;
                float spo2 = 104.0 - 17.0 * R;
                if (spo2 >= 70.0 && spo2 <= 100.0) {
                  lastSpO2 = spo2;
                }
              }
            }
            acRedSum = 0;
            acIRSum  = 0;
            spo2SampleCount = 0;
            spo2BeatCount = 0;
          }
        }
      }
    }

    cachedHR = (fingerPresent && validBeats >= 4) ? (float)beatAvg : 0.0f;
    cachedSpO2 = (fingerPresent && lastSpO2 > 0) ? lastSpO2 : 0.0f;
  }

  BLE.poll();

  // ── Slow sensors — round-robin, one per loop ───────────────
  if (millis() - lastBLEUpdate >= BLE_INTERVAL) {
    lastBLEUpdate = millis();

    switch (sensorSlot) {
      case 0:
        if (bme280_ok) {
          cachedTempB = bme.readTemperature();
          BLE.poll();
          cachedHum = bme.readHumidity();
          BLE.poll();
          cachedPres = bme.readPressure() / 100.0F;
        }
        break;
      case 1:
        if (mcp9808_ok) {
          cachedTempM = mcp.readTempC();
        }
        break;
      case 2:
        if (imu_ok) {
          cachedAX = imu.readFloatAccelX();
          cachedAY = imu.readFloatAccelY();
          cachedAZ = imu.readFloatAccelZ();
          BLE.poll();
          cachedGX = imu.readFloatGyroX();
          cachedGY = imu.readFloatGyroY();
          cachedGZ = imu.readFloatGyroZ();
        }
        break;
      case 3:
        // Mic dB is updated asynchronously via PDM callback
        // Nothing extra to do here — cachedMicDB is already fresh
        break;
    }
    sensorSlot = (sensorSlot + 1) % 4;  // v5: 4 slots now

    BLE.poll();

    // ── BLE write (with spaced writes for stability) ────────
    BLEDevice central = BLE.central();
    if (central && central.connected()) {
      wasConnected = true;

      hrChar.writeValue(cachedHR);
      delay(BLE_WRITE_DELAY);
      BLE.poll();

      spo2Char.writeValue(cachedSpO2);
      delay(BLE_WRITE_DELAY);

      if (!central.connected()) goto bleWriteDone;

      tempBChar.writeValue(cachedTempB);
      delay(BLE_WRITE_DELAY);
      BLE.poll();

      humChar.writeValue(cachedHum);
      delay(BLE_WRITE_DELAY);

      presChar.writeValue(cachedPres);
      delay(BLE_WRITE_DELAY);
      BLE.poll();

      if (!central.connected()) goto bleWriteDone;

      tempMChar.writeValue(cachedTempM);
      delay(BLE_WRITE_DELAY);

      writeFloat3(accelChar, cachedAX, cachedAY, cachedAZ);
      delay(BLE_WRITE_DELAY);
      BLE.poll();

      writeFloat3(gyroChar, cachedGX, cachedGY, cachedGZ);
      delay(BLE_WRITE_DELAY);

      micChar.writeValue(cachedMicDB);
    }
    else if (wasConnected) {
      wasConnected = false;
      Serial.println("[BLE] Connection lost — restarting advertising");
      BLE.advertise();
    }
  }

  bleWriteDone:
  BLE.poll();

  // ── Serial output — once per second ────────────────────────
  if (millis() - lastSerialPrint >= 1000) {
    lastSerialPrint = millis();
    Serial.print("HR:");    Serial.print(cachedHR, 0);
    Serial.print(" SpO2:"); Serial.print(cachedSpO2, 1);
    Serial.print(" T:");    Serial.print(cachedTempB, 1);
    Serial.print(" H:");    Serial.print(cachedHum, 0);
    Serial.print(" P:");    Serial.print(cachedPres, 0);
    Serial.print(" Tm:");   Serial.print(cachedTempM, 2);
    Serial.print(" Mic:");  Serial.print(cachedMicDB, 1);
    Serial.print("dB");
    if (imu_ok) {
      Serial.print(" AX:"); Serial.print(cachedAX, 2);
      Serial.print(" AY:"); Serial.print(cachedAY, 2);
      Serial.print(" AZ:"); Serial.print(cachedAZ, 2);
    }
    Serial.println();
  }
}
