# Sensor Validation Lookup Table

Quick-reference for the AI when selecting and validating sensor/channel assignments per algorithm type.

## Channel Reference

| Channel ID | Sensor Chip | Puck | Signal Type | Sample Rate |
|------------|-------------|------|-------------|-------------|
| CH_PPG | MAX86150 | Puck 1 | Optical blood volume (Red + IR LEDs) | 100–200 Hz |
| CH_ECG | MAX86150 | Puck 1 | Cardiac electrical activity (Lead I) | 200 Hz |
| CH_SKIN_TEMP | TMP117 | Puck 2 | Skin surface temperature | 1 Hz |
| CH_EDA | ADS1115 | Puck 2 | Electrodermal activity (galvanic skin response) | 10 Hz |
| CH_BIOZ | AD5933 | Puck 3 | Bioelectrical impedance | On-demand |
| CH_ACCEL | LSM6DS3TR | XIAO | 3-axis linear acceleration | 50 Hz |
| CH_GYRO | LSM6DS3TR | XIAO | 3-axis angular velocity | 50 Hz |
| CH_MIC | PDM | XIAO | Audio / acoustic | 16000 Hz |

## Algorithm → Channel Matrix

### Health-Biometric Algorithms

| Algorithm Type | Required | Recommended | Forbidden (with explanation) |
|---|---|---|---|
| Heart Rate (PPG) | CH_PPG | CH_ACCEL (motion rejection) | CH_MIC — audio cannot measure cardiac rhythm |
| HRV | CH_PPG | CH_ACCEL (motion rejection) | — |
| SpO2 | CH_PPG (Red+IR) | CH_ACCEL (motion rejection) | CH_MIC, CH_BIOZ — requires dual-wavelength optical |
| Blood Pressure (PTT) | CH_PPG + CH_ECG | CH_ACCEL (motion rejection) | CH_MIC — BP needs pulse transit time from PPG+ECG |
| ECG Rhythm Analysis | CH_ECG | CH_ACCEL (motion artifact flagging) | — |
| Respiratory Rate (PPG-derived) | CH_PPG | CH_ACCEL (motion rejection) | — |
| Respiratory Rate (IMU-derived) | CH_ACCEL | — | — |
| EDA / Stress Level | CH_EDA | CH_PPG (HRV fusion) | CH_MIC — stress is autonomic, not acoustic |
| Skin Temperature | CH_SKIN_TEMP | — | — |
| Fever Warning | CH_SKIN_TEMP | — | CH_MIC — fever is measured by thermistor |
| Circadian Rhythm | CH_SKIN_TEMP | CH_ACCEL (activity context) | — |
| Ovulation Tracking | CH_SKIN_TEMP | — | — |
| Body Fat % | CH_BIOZ | — | CH_MIC — body comp needs bioimpedance |
| Muscle Mass | CH_BIOZ | — | — |
| Hydration | CH_BIOZ | CH_SKIN_TEMP (thermal correction) | — |
| Vascular Age (PPG) | CH_PPG | — | — |
| Perfusion Index | CH_PPG | — | — |

### Sport-Motion Algorithms

| Algorithm Type | Required | Recommended | Notes |
|---|---|---|---|
| Step Counter | CH_ACCEL | — | Detect periodic acceleration peaks during gait |
| Activity Recognition | CH_ACCEL + CH_GYRO | — | 6-axis features classify walk/run/cycle/stairs/idle |
| Running Cadence | CH_ACCEL | CH_GYRO (stride analysis) | Autocorrelation of vertical accel axis |
| Workout Detection | CH_ACCEL | CH_PPG (HR for intensity) | Activity level threshold + duration |
| Calorie Burn | CH_ACCEL | CH_PPG (HR-based MET) | Hybrid: motion-based + HR-based estimation |
| Sport Technique (swing, form) | CH_ACCEL + CH_GYRO | — | Angular velocity + acceleration pattern matching |
| Gait / Stride Analysis | CH_ACCEL + CH_GYRO | — | Step length, asymmetry, ground contact time |
| Rep Counting | CH_ACCEL | CH_GYRO (rotation exercises) | Detect repetitive acceleration patterns |
| Posture Detection | CH_ACCEL | CH_GYRO (tilt measurement) | Gravity vector orientation |

### Acoustic Algorithms

| Algorithm Type | Required | Recommended | Notes |
|---|---|---|---|
| Snoring Detection | CH_MIC | CH_PPG (SpO2 for apnea) | PDM microphone frequency analysis |
| Cough Detection | CH_MIC | — | Acoustic event classification |
| Respiratory Sounds | CH_MIC | — | Breathing rate from audio |

### Composite / Cross-Sensor

| Algorithm Type | Required Sub-Algorithms | Channels (indirect) | Notes |
|---|---|---|---|
| Recovery Score | HR + HRV + Sleep + Temp | PPG, ACCEL, TEMP | Tier 3, runs in browser |
| Strain Score | HR + Activity + Duration | PPG, ACCEL | Tier 3 |
| Sleep Score | Sleep detection + HR + HRV + movement | ACCEL, PPG, TEMP, EDA | Tier 3 |
| Sleep Detection | Activity level + HR | ACCEL + PPG | Reduced motion + HR baseline detection |
| Sleep Phases | HR + HRV + Motion + Temp + EDA | PPG, ACCEL, TEMP, EDA | Tier 3, 30s epoch classification |
| Stress vs Exercise | EDA + HR + Motion | EDA, PPG, ACCEL | Disambiguate elevated HR source |
| Biological Age | Multiple vitals + activity | All available | Tier 3, composite score |
| Health Report | All algorithms | All | Tier 3, PDF generation |

## Puck Configuration Rules

```
Rule 1: ALWAYS start with Puck 1 + Puck 2 + XIAO
Rule 2: Only recommend Puck 3 when CH_BIOZ is required
Rule 3: Algorithm declares ONLY channels it reads — not all available
Rule 4: If CH_PPG or CH_ECG is used, ADD CH_ACCEL for motion rejection
Rule 5: If algorithm only needs IMU → document that only XIAO is needed
         (Puck 1+2 present by default but unused by this algorithm)
```

## Common Sensor Mistakes

| User Request | Wrong Channel | Correct Channel | Explanation |
|---|---|---|---|
| "Heart rate from microphone" | CH_MIC | CH_PPG | PPG measures blood volume changes via light. Microphone captures audio. |
| "Stress from accelerometer" | CH_ACCEL | CH_EDA + CH_PPG | Stress is autonomic (EDA galvanic response + HRV). Accelerometer measures motion, not nervous system activity. |
| "Body fat from temperature" | CH_SKIN_TEMP | CH_BIOZ | Body composition requires bioimpedance — electrical impedance through tissue. |
| "SpO2 from ECG" | CH_ECG | CH_PPG | SpO2 needs dual-wavelength optical (red + infrared). ECG is electrical, not optical. |
| "Tennis swing from PPG" | CH_PPG | CH_ACCEL + CH_GYRO | Movement patterns are captured by IMU (accelerometer + gyroscope), not optical blood flow sensor. |
| "Blood pressure from temperature" | CH_SKIN_TEMP | CH_PPG + CH_ECG | BP via PTT needs synchronized PPG + ECG to measure pulse transit time. |
| "Sleep from EDA alone" | CH_EDA only | CH_ACCEL + CH_PPG + CH_EDA | Sleep detection needs motion (actigraphy) as primary. EDA/HR are supplementary. |
