/*
 * Deep IMU Diagnostic — XIAO BLE Sense nRF52840
 * 
 * Manually powers on the IMU and scans Wire1 multiple times.
 * Helps determine if IMU hardware is present or defective.
 */

#include "Wire.h"

// Pin definitions from board variant
#define IMU_POWER_PIN   15    // PIN_LSM6DS3TR_C_POWER
#define IMU_INT1_PIN    18    // PIN_LSM6DS3TR_C_INT1
#define IMU_I2C_ADDR    0x6A  // LSM6DS3TR-C default
#define WHO_AM_I_REG    0x0F  // Expected: 0x69 or 0x6A

void scanBus(TwoWire &bus, const char* name) {
  Serial.print("  Scanning ");
  Serial.print(name);
  Serial.print("... ");
  byte count = 0;
  for (byte addr = 1; addr < 127; addr++) {
    bus.beginTransmission(addr);
    if (bus.endTransmission() == 0) {
      if (count == 0) Serial.println();
      Serial.print("    0x");
      if (addr < 16) Serial.print("0");
      Serial.print(addr, HEX);
      if (addr == 0x6A) Serial.print(" <-- LSM6DS3!");
      if (addr == 0x6B) Serial.print(" <-- LSM6DS3 alt!");
      Serial.println();
      count++;
    }
  }
  if (count == 0) Serial.println("no devices found.");
  else { Serial.print("    "); Serial.print(count); Serial.println(" device(s)."); }
}

uint8_t readWhoAmI(TwoWire &bus, uint8_t addr) {
  bus.beginTransmission(addr);
  bus.write(WHO_AM_I_REG);
  bus.endTransmission(false);
  bus.requestFrom(addr, (uint8_t)1);
  if (bus.available()) return bus.read();
  return 0;
}

void setup() {
  Serial.begin(115200);
  while (!Serial);
  delay(500);
  
  Serial.println("╔══════════════════════════════════════╗");
  Serial.println("║   Deep IMU Diagnostic v1             ║");
  Serial.println("╚══════════════════════════════════════╝");
  Serial.println();

  // ── Step 1: Check board variant ──────────────────────────
  Serial.println("Step 1: Board identification");
  #ifdef TARGET_SEEED_XIAO_NRF52840_SENSE
  Serial.println("  Board: XIAO nRF52840 SENSE (correct)");
  #elif defined(TARGET_SEEED_XIAO_NRF52840)
  Serial.println("  Board: XIAO nRF52840 (NO IMU! Wrong board selected!)");
  #else
  Serial.println("  Board: Unknown variant");
  #endif
  Serial.println();

  // ── Step 2: Power on IMU manually ────────────────────────
  Serial.println("Step 2: Powering on IMU");
  Serial.print("  Setting pin ");
  Serial.print(IMU_POWER_PIN);
  Serial.println(" HIGH...");
  
  pinMode(IMU_POWER_PIN, OUTPUT);
  
  // Use direct nRF register for HIGH drive strength (same as library)
  #if defined(NRF52840_XXAA)
  Serial.println("  Using NRF52840 HIGH-drive register config on P1.08");
  NRF_P1->PIN_CNF[8] = ((uint32_t)NRF_GPIO_PIN_DIR_OUTPUT << GPIO_PIN_CNF_DIR_Pos)
                        | ((uint32_t)NRF_GPIO_PIN_INPUT_DISCONNECT << GPIO_PIN_CNF_INPUT_Pos)
                        | ((uint32_t)NRF_GPIO_PIN_NOPULL << GPIO_PIN_CNF_PULL_Pos)
                        | ((uint32_t)NRF_GPIO_PIN_H0H1 << GPIO_PIN_CNF_DRIVE_Pos)
                        | ((uint32_t)NRF_GPIO_PIN_NOSENSE << GPIO_PIN_CNF_SENSE_Pos);
  #endif
  
  digitalWrite(IMU_POWER_PIN, HIGH);
  Serial.println("  Power pin set HIGH");
  Serial.println("  Waiting 100ms for IMU to boot...");
  delay(100);
  Serial.println();

  // ── Step 3: Initialize I2C buses ─────────────────────────
  Serial.println("Step 3: Initializing I2C buses");
  Wire.begin();
  Serial.println("  Wire (external) initialized: SDA=D4, SCL=D5");
  Wire1.begin();
  Serial.println("  Wire1 (internal) initialized: SDA1=pin17, SCL1=pin16");
  Serial.println();
  
  // ── Step 4: Scan both buses ──────────────────────────────
  Serial.println("Step 4: I2C bus scan");
  scanBus(Wire,  "Wire (external)");
  scanBus(Wire1, "Wire1 (internal)");
  Serial.println();
  
  // ── Step 5: Direct WHO_AM_I read ─────────────────────────
  Serial.println("Step 5: Direct WHO_AM_I register read (0x0F)");
  
  uint8_t who;
  who = readWhoAmI(Wire, 0x6A);
  Serial.print("  Wire  @ 0x6A -> WHO_AM_I = 0x");
  Serial.println(who, HEX);
  
  who = readWhoAmI(Wire, 0x6B);
  Serial.print("  Wire  @ 0x6B -> WHO_AM_I = 0x");
  Serial.println(who, HEX);
  
  who = readWhoAmI(Wire1, 0x6A);
  Serial.print("  Wire1 @ 0x6A -> WHO_AM_I = 0x");
  Serial.println(who, HEX);
  
  who = readWhoAmI(Wire1, 0x6B);
  Serial.print("  Wire1 @ 0x6B -> WHO_AM_I = 0x");
  Serial.println(who, HEX);
  Serial.println();

  // ── Step 6: Retry after longer delay ─────────────────────
  Serial.println("Step 6: Power cycle and retry (500ms delay)");
  digitalWrite(IMU_POWER_PIN, LOW);
  delay(100);
  digitalWrite(IMU_POWER_PIN, HIGH);
  delay(500);
  
  scanBus(Wire1, "Wire1 after power cycle");
  who = readWhoAmI(Wire1, 0x6A);
  Serial.print("  Wire1 @ 0x6A -> WHO_AM_I = 0x");
  Serial.println(who, HEX);
  Serial.println();

  // ── Summary ──────────────────────────────────────────────
  Serial.println("═══════════════════════════════════════");
  if (who == 0x69 || who == 0x6A) {
    Serial.println("RESULT: IMU DETECTED! The sensor is working.");
  } else {
    Serial.println("RESULT: IMU NOT DETECTED.");
    Serial.println();
    Serial.println("Possible causes:");
    Serial.println("  1. Board is XIAO nRF52840 (non-Sense) - no IMU chip");
    Serial.println("  2. IMU chip is damaged or not soldered");
    Serial.println("  3. Solder bridge or short on IMU pins");
    Serial.println();
    Serial.println("Check: Does your board have a small chip labeled");
    Serial.println("'LSM6DS3TR' near the center of the PCB?");
    Serial.println("The Sense version has extra components the non-Sense lacks.");
  }
  Serial.println("═══════════════════════════════════════");
}

void loop() {
  // Nothing
  delay(10000);
}
