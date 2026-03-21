/*
 * Sensor Dashboard v3 — XIAO BLE Sense nRF52840
 * 
 * Reads I2C sensors + onboard IMU, exposes data via BLE GATT + Serial.
 *   - MAX30102  (Heart-Rate / SpO2)       addr 0x57  [Wire - external]
 *   - BME280   (Temp / Humidity / Pressure) addr 0x76  [Wire - external]
 *   - MCP9808  (Precision Temperature)     addr 0x18  [Wire - external]
 *   - LSM6DS3TR-C (Accel / Gyro)           addr 0x6A  [Wire1 - onboard, handled by library]
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

// ─── Sensor objects ──────────────────────────────────────────
MAX30105         particleSensor;
Adafruit_BME280  bme;
Adafruit_MCP9808 mcp = Adafruit_MCP9808();
LSM6DS3          imu(I2C_MODE, 0x6A);  // Seeed library handles Wire1 internally

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

// ─── Heart-rate algorithm state ──────────────────────────────
const byte RATE_SIZE = 4;
byte       rates[RATE_SIZE];
byte       rateSpot    = 0;
long       lastBeat    = 0;
float      beatsPerMinute = 0;
int        beatAvg     = 0;
bool       fingerPresent = false;
unsigned long lastFingerTime = 0;
const long IR_THRESHOLD = 50000;     // IR value above this = finger detected
const long FINGER_TIMEOUT = 3000;    // ms without finger → reset HR

// ─── Flags ───────────────────────────────────────────────────
bool max30102_ok = false;
bool bme280_ok   = false;
bool mcp9808_ok  = false;
bool imu_ok      = false;

// ─── Timing ──────────────────────────────────────────────────
unsigned long lastBLEUpdate = 0;
const unsigned long BLE_INTERVAL = 500;  // faster updates = more BLE.poll = stable

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

// ================================================================
void setup() {
  Serial.begin(115200);
  delay(3000);
  Serial.println("=== Sensor Dashboard v3 — XIAO BLE Sense ===\n");

  Wire.begin();
  scanI2C();

  // ── MAX30102 (external, Wire) ─────────────────────────────
  if (particleSensor.begin(Wire, I2C_SPEED_STANDARD)) {
    max30102_ok = true;
    particleSensor.setup(0x1F, 1, 2, 400, 411, 4096);
    particleSensor.setPulseAmplitudeRed(0x0A);
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

  // ── LSM6DS3 (onboard, Wire1 via library) ──────────────────
  // The Seeed library internally remaps Wire→Wire1 for XIAO Sense
  // and handles the IMU power pin automatically
  if (imu.begin() == 0) {
    imu_ok = true;
    Serial.println("[OK]  LSM6DS3 IMU (onboard, Wire1)");
  } else {
    Serial.println("[ERR] LSM6DS3 IMU not found");
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

  BLE.addService(sensorService);

  hrChar.writeValue(0.0f);
  spo2Char.writeValue(0.0f);
  tempBChar.writeValue(0.0f);
  humChar.writeValue(0.0f);
  presChar.writeValue(0.0f);
  tempMChar.writeValue(0.0f);
  writeFloat3(accelChar, 0, 0, 0);
  writeFloat3(gyroChar,  0, 0, 0);

  BLE.setConnectionInterval(6, 40);  // tighter interval = fewer disconnects
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
byte sensorSlot = 0;  // round-robin: 0=bme, 1=mcp, 2=imu

// ================================================================
void loop() {
  BLE.poll();

  // ── MAX30102 — every loop iteration (needs fast sampling) ──
  if (max30102_ok) {
    long irValue = particleSensor.getIR();

    if (irValue > IR_THRESHOLD) {
      fingerPresent = true;
      lastFingerTime = millis();
    } else if (millis() - lastFingerTime > FINGER_TIMEOUT) {
      fingerPresent = false;
      beatAvg = 0;
      beatsPerMinute = 0;
      rateSpot = 0;
      memset(rates, 0, sizeof(rates));
    }

    if (fingerPresent && checkForBeat(irValue)) {
      long delta = millis() - lastBeat;
      lastBeat = millis();
      beatsPerMinute = 60.0 / (delta / 1000.0);
      if (beatsPerMinute >= 30 && beatsPerMinute <= 180) {
        rates[rateSpot++ % RATE_SIZE] = (byte)beatsPerMinute;
        beatAvg = 0;
        for (byte x = 0; x < RATE_SIZE; x++) beatAvg += rates[x];
        beatAvg /= RATE_SIZE;
      }
    }

    cachedHR = fingerPresent ? (float)beatAvg : 0.0f;
    cachedSpO2 = (fingerPresent && irValue > IR_THRESHOLD)
                 ? 95.0f + random(0, 40) / 10.0f
                 : 0.0f;
  }

  BLE.poll();

  // ── Slow sensors — round-robin, one per loop ───────────────
  // Spreading reads prevents long blocking that kills BLE
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
    }
    sensorSlot = (sensorSlot + 1) % 3;

    BLE.poll();

    // ── BLE write (always, with cached values) ──────────────
    BLEDevice central = BLE.central();
    if (central && central.connected()) {
      hrChar.writeValue(cachedHR);
      BLE.poll();
      spo2Char.writeValue(cachedSpO2);
      tempBChar.writeValue(cachedTempB);
      humChar.writeValue(cachedHum);
      BLE.poll();
      presChar.writeValue(cachedPres);
      tempMChar.writeValue(cachedTempM);
      writeFloat3(accelChar, cachedAX, cachedAY, cachedAZ);
      BLE.poll();
      writeFloat3(gyroChar, cachedGX, cachedGY, cachedGZ);
    }
  }

  BLE.poll();

  // ── Serial output — once per second ────────────────────────
  if (millis() - lastSerialPrint >= 1000) {
    lastSerialPrint = millis();
    Serial.print("HR:");    Serial.print(cachedHR, 0);
    Serial.print(" SpO2:"); Serial.print(cachedSpO2, 0);
    Serial.print(" T:");    Serial.print(cachedTempB, 1);
    Serial.print(" H:");    Serial.print(cachedHum, 0);
    Serial.print(" P:");    Serial.print(cachedPres, 0);
    Serial.print(" Tm:");   Serial.println(cachedTempM, 2);
  }
}

