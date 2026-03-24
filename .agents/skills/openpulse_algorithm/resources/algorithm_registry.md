# OpenPulse Algorithm Registry
# Master tracking file for all 72 algorithms
# Status: spec | implemented | tested | validated
# Update this file whenever an algorithm progresses

## Phase 0: Sensor Drivers
| ID | Name | Chip | Status | Spec | Code | Tests |
|----|------|------|--------|------|------|-------|
| D01 | MAX86150 PPG+ECG Driver | MAX86150 | ○ pending | — | — | — |
| D02 | TMP117 Temperature Driver | TMP117 | ○ pending | — | — | — |
| D03 | ADS1115 EDA Driver | ADS1115 | ○ pending | — | — | — |
| D04 | AD5933 Bioimpedance Driver | AD5933 | ○ pending | — | — | — |
| D05 | LSM6DS3 IMU Driver | LSM6DS3TR | ○ pending | — | — | — |
| D06 | PDM Microphone Driver | nRF52840 | ○ pending | — | — | — |

## Phase 1: Base Algorithms (Single Sensor)
| ID | Name | Sensor | Tier | Status | Spec | Code | Tests |
|----|------|--------|------|--------|------|------|-------|
| A01 | Heart Rate | PPG | 0 | ○ spec drafted | [spec](examples/A01_heart_rate_spec.md) | — | — |
| A02 | HRV | PPG/ECG | 1 | ○ pending | — | — | — |
| A03 | SpO2 | PPG Red+IR | 0 | ○ pending | — | — | — |
| A04 | Respiratory Rate | PPG | 1 | ○ pending | — | — | — |
| A05 | ECG Rhythm Check | ECG | 2 | ○ pending | — | — | — |
| A06 | Resting HR Trend | PPG | 3 | ○ pending | — | — | — |
| A07 | PPG Waveform Analysis | PPG | 2 | ○ pending | — | — | — |
| A08 | Vascular Age | PPG | 2 | ○ pending | — | — | — |
| A09 | Perfusion Index | PPG | 0 | ○ pending | — | — | — |
| A10 | Skin Temp Baseline | TMP117 | 3 | ○ pending | — | — | — |
| A11 | Fever Early Warning | TMP117 | 3 | ○ pending | — | — | — |
| A12 | Circadian Rhythm Score | TMP117 | 3 | ○ pending | — | — | — |
| A13 | Ovulation Detection | TMP117 | 3 | ○ pending | — | — | — |
| A14 | EDA Stress Level | ADS1115 | 1 | ○ pending | — | — | — |
| A15 | EDA Stress Timeline | ADS1115 | 3 | ○ pending | — | — | — |
| A16 | Relaxation Biofeedback | ADS1115 | 1 | ○ pending | — | — | — |
| A17 | Sleep EDA Patterns | ADS1115 | 3 | ○ pending | — | — | — |
| A18 | Body Fat Percentage | AD5933 | 2 | ○ pending | — | — | — |
| A19 | Muscle Mass Estimate | AD5933 | 2 | ○ pending | — | — | — |
| A20 | Hydration Level | AD5933 | 2 | ○ pending | — | — | — |
| A21 | Step Counter | IMU | 0 | ○ pending | — | — | — |
| A22 | Activity Recognition | IMU | 1 | ○ pending | — | — | — |
| A23 | Sleep Detection | IMU+HR | 1 | ○ pending | — | — | — |
| A24 | Calorie Burn | IMU+HR | 3 | ○ pending | — | — | — |
| A25 | Snoring Detection | PDM | 1 | ○ pending | — | — | — |
| A26 | Workout Detection | IMU+HR | 1 | ○ pending | — | — | — |
| A27 | Running Cadence | IMU | 1 | ○ pending | — | — | — |

## Phase 2: Cross-Sensor Fusion
| ID | Name | Inputs | Tier | Status | Spec | Code | Tests |
|----|------|--------|------|--------|------|------|-------|
| X01 | Blood Pressure (PTT) | ECG+PPG | 1 | ○ pending | — | — | — |
| X02 | Arterial Stiffness (PWV) | ECG+PPG | 2 | ○ pending | — | — | — |
| X03 | Pre-Ejection Period | ECG+PPG | 1 | ○ pending | — | — | — |
| X04 | Cardiac Output | ECG+PPG | 2 | ○ pending | — | — | — |
| X05 | Autonomic Balance | ECG+PPG | 1 | ○ pending | — | — | — |
| X06 | Stress vs. Exercise | EDA+HR+IMU | 1 | ○ pending | — | — | — |
| X07 | Illness Warning | Temp+HRV+HR+EDA | 3 | ○ pending | — | — | — |
| X08 | ANS Mapping | ECG+EDA+Temp | 3 | ○ pending | — | — | — |
| X09 | Recovery Score | All Puck 1+2+IMU | 3 | ○ pending | — | — | — |
| X10 | Strain Score | HR+EDA+IMU+Temp | 3 | ○ pending | — | — | — |
| X11 | Sleep Phases (5-Signal) | IMU+HR+HRV+Temp+EDA | 3 | ○ pending | — | — | — |
| X12 | Biological Age | All | 3 | ○ pending | — | — | — |
| X13 | Chronotype Detection | Temp+HRV+IMU | 3 | ○ pending | — | — | — |
| X14 | Stress Resilience | EDA+HRV | 3 | ○ pending | — | — | — |
| X15 | Hydration + Temp | AD5933+TMP117 | 2 | ○ pending | — | — | — |
| X16 | Body Comp + Activity | AD5933+IMU+HR | 3 | ○ pending | — | — | — |
| X17 | Sleep Apnea Screening | Mic+SpO2+HR | 1 | ○ pending | — | — | — |

## Phase 3: Composite Scores
| ID | Name | Base Algorithms | Tier | Status | Spec | Code | Tests |
|----|------|-----------------|------|--------|------|------|-------|
| C01 | Recovery Score (0-100) | X09 | 3 | ○ pending | — | — | — |
| C02 | Strain Score (0-21) | X10 | 3 | ○ pending | — | — | — |
| C03 | Sleep Score (0-100) | X11 | 3 | ○ pending | — | — | — |
| C04 | Biological Age | X12 | 3 | ○ pending | — | — | — |
| C05 | Cardiovascular Age | PPG+ECG fusion | 3 | ○ pending | — | — | — |
| C06 | Training Recommendation | C01+C02 | 3 | ○ pending | — | — | — |
| C07 | Sleep Recommendation | C03+C02 | 3 | ○ pending | — | — | — |
| C08 | Health Report (PDF) | All C-scores | 3 | ○ pending | — | — | — |
| C09 | Women's Health | A13+C01+C03 | 3 | ○ pending | — | — | — |
| C10 | Personalized Insights | All | 3 | ○ pending | — | — | — |

## Progress Summary
- **Total algorithms**: 72 (27 base + 17 cross-sensor + 10 composite + 6 drivers + 12 reserved)
- **Specs written**: 1
- **Implemented**: 0
- **Tested**: 0
- **Validated**: 0
