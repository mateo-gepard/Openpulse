# A03: Blood Oxygen Saturation (SpO2)

## Classification
- **Category**: health-biometric
- **Layer**: Base
- **Tier**: 2 (on-demand — requires Red+IR LED mode switch, higher power)
- **Regulatory**: Health Screening
- **Priority**: P0 (MVP)
- **Consumes**: CH_PPG (Red + IR LEDs), CH_ACCEL
- **Outputs**: float spo2_percent (%)
- **Consumed by**: X17 (Sleep Apnea Screening), C01 (Recovery Score — oxygen component)

## Channel Input

| Channel | Sample Rate | Bit Depth | Purpose in This Algorithm |
|---------|-------------|-----------|---------------------------|
| CH_PPG (Red LED) | 100 Hz | 18-bit | Red wavelength (660nm) PPG for SpO2 ratio |
| CH_PPG (IR LED) | 100 Hz | 18-bit | Infrared wavelength (880nm) PPG for SpO2 ratio |
| CH_ACCEL | 50 Hz | 16-bit | Motion artifact rejection — SpO2 is extremely motion-sensitive |

- **PPG Mode**: Red+IR

## Algorithm

### Method

1. **LED Mode Switch**: Request PPG driver to operate in Red+IR mode (not Green LED mode). Red (660nm) and IR (880nm) LEDs alternate per sample. Deinterleave the raw FIFO data into separate red[] and ir[] arrays.
   - Citation: Maxim Integrated, "AN6409: Guidelines for SpO2 Measurement Using the MAX30101/MAX30102", 2018.

2. **AC/DC Separation** (per channel):
   - **DC component**: Low-pass filter at 0.5 Hz (first-order EMA, α ≈ 0.005 at 100 Hz). Represents non-pulsatile tissue absorption.
   - **AC component**: Bandpass filter 0.5–5.0 Hz (4th-order Butterworth). Represents pulsatile arterial blood volume changes.
   - `DC_red[n] = α × red[n] + (1-α) × DC_red[n-1]`
   - `AC_red[n] = bandpass(red[n] - DC_red[n])`
   - Same for IR channel.

3. **R-Ratio Calculation**:
   - Compute AC amplitude (peak-to-trough) for each channel over a window of 4–8 seconds (4–8 cardiac cycles):
     `AC_amp_red = max(AC_red) - min(AC_red)` over the window
     `AC_amp_ir = max(AC_ir) - min(AC_ir)`
   - `R = (AC_amp_red / DC_red_mean) / (AC_amp_ir / DC_ir_mean)`
   - R is the ratio of ratios — the fundamental SpO2 measurement.
   - Valid R range: 0.2–2.0. Outside this range = sensor error.

4. **SpO2 Lookup**:
   - Linear approximation: `SpO2 = 110 - 25 × R`
   - Citation: Maxim AN6409. Valid for R ∈ [0.4, 1.0] → SpO2 ∈ [85%, 100%].
   - For production, use empirical calibration curve (2nd-order polynomial fit from clinical validation):
     `SpO2 = a × R² + b × R + c` where coefficients from device-specific calibration.
   - **Note**: Linear approximation is used until clinical calibration data is available. Not a medical device.

5. **Window Averaging**:
   - Average R over 4-second sliding windows (overlap 50%).
   - Report the median of the last 3 window averages to reject outliers.
   - Single-beat SpO2 is too noisy — always use multi-beat windows.

6. **Motion Rejection**:
   - SpO2 is extremely sensitive to motion artifacts (finger movement creates false AC signals).
   - If IMU motion_level > 0.2g, **suppress output entirely** — do not report inaccurate SpO2.
   - After motion subsides, require 4 seconds of clean data before resuming output.
   - Citation: Jubran 2015, "Pulse Oximetry" — motion is the #1 source of SpO2 error.

7. **Output Gating**:
   - Clamp to 70–100%. Below 70% is sensor error, not physiological (even severe hypoxia rarely drops below 70% in awake subjects).
   - If R < 0.2 or R > 2.0 → sensor error, output invalid.
   - Require SQI > 0.6 to emit output (stricter than HR).
   - Show medical disclaimer: "This is not a medical device. Consult a healthcare provider."

### Alternative Methods
- **Method A**: AC Peak-to-Peak per Beat (Maxim AN6409). Compute R from each individual cardiac cycle using A01 beat timestamps. Most precise but requires beat synchronization. **Recommended when A01 is running.**
- **Method B**: Sliding Window Envelope (no beat sync). Use min/max of AC over fixed 4s windows. Simpler, works without HR, but slightly noisier. Good fallback.
- **Method C**: Frequency-Domain (FFT at cardiac fundamental). Extract AC power at the heart rate frequency for each LED channel. Theoretically more robust to harmonics but computationally heavier on MCU.

### Parameters

| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| Red wavelength | 660 | nm | Standard SpO2 wavelength (Maxim AN6409) |
| IR wavelength | 880 | nm | Standard SpO2 wavelength (Maxim AN6409) |
| Bandpass low | 0.5 | Hz | Below cardiac range |
| Bandpass high | 5.0 | Hz | Covers up to 300 BPM + harmonics |
| DC EMA alpha | 0.005 | — | Cutoff ~0.5 Hz at 100 Hz sample rate |
| SpO2 linear coeff A | 110 | — | Maxim AN6409 |
| SpO2 linear coeff B | -25 | — | Maxim AN6409 |
| R valid range | 0.2–2.0 | — | Outside = sensor error |
| SpO2 clamp low | 70 | % | Below = sensor error in awake subjects |
| SpO2 clamp high | 100 | % | Physical maximum |
| Averaging window | 4 | s | 4–8 cardiac cycles at typical HR |
| Motion threshold | 0.2 | g | SpO2 extremely motion-sensitive (Jubran 2015) |
| Post-motion settle time | 4 | s | Time after motion before trusting data |
| SQI suppress threshold | 0.6 | — | SpO2 needs high-quality signal |
| Median filter depth | 3 | windows | Reject outlier windows |

### SQI Computation

SQI for SpO2 is computed from four factors:

1. **Perfusion Index Red** (25%): PI of the red channel. PI > 1% → SQI 1.0, PI < 0.3% → SQI 0.0.
   - `sqi_pi = clamp((pi_red - 0.3) / 0.7, 0.0, 1.0)`

2. **AC Correlation** (25%): Cross-correlation between red and IR AC waveforms. Both should modulate with cardiac rhythm in sync. CC > 0.9 → SQI 1.0, CC < 0.6 → SQI 0.0.
   - `sqi_cc = clamp((cc - 0.6) / 0.3, 0.0, 1.0)`

3. **R-Ratio Stability** (25%): CV of R values over the averaging window. CV < 5% → SQI 1.0, CV > 20% → SQI 0.0.
   - `sqi_r = clamp(1.0 - (cv_r - 0.05) / 0.15, 0.0, 1.0)`

4. **Motion Level** (25%): From IMU. 0g → SQI 1.0, 0.2g → SQI 0.0.
   - `sqi_motion = clamp(1.0 - motion_g / 0.2, 0.0, 1.0)`

```
SQI = 0.25 * sqi_pi + 0.25 * sqi_cc + 0.25 * sqi_r + 0.25 * sqi_motion
```
- **SQI Threshold**: 0.6 (Strict — SpO2 errors can cause clinical concern)

### Power & Resources
- **Power Mode**: on-demand (Red+IR LEDs draw more current than Green; activate when user requests or during sleep monitoring)
- **Expected Current Draw**: ~1.2 mA active (Red+IR LEDs), 0.1 mA idle
- **RAM Budget**: ~2 KB (512 samples for two channels + AC/DC filters + R accumulators)

## Validation
- **Validation Dataset**: MIMIC-III Waveform Database (PPG + simultaneous ABG/CO-oximetry)
- **Accuracy Target**: Bias < 2% (ARMS ≤ 3%) vs. CO-oximetry reference in range 70–100% (ISO 80601-2-61)

## Output
- **Type**: CalibratedOutput (value + ci_low + ci_high + sqi + timestamp + valid + calibrated + calibration_age_ms)
- **Unit**: % (SpO2 percentage)
- **Valid Range**: 70–100%
- **Update Rate**: Every 4 seconds (averaging window)
- **BLE Characteristic**: UUID `12345678-1234-5678-1234-56789abcdef3`
- **Zero means**: Sensor error, insufficient signal, or motion interference
- **Confidence Interval**: ±2% at SQI > 0.8, ±4% at SQI 0.6–0.8

## Display
- **Layout**: gauge
- **Primary**: number, "SpO2", "%", decimals 0, range [70, 100]
- **Zones**: [{ min: 70, max: 90, color: "#ef4444", label: "Low" }, { min: 90, max: 94, color: "#f59e0b", label: "Below Normal" }, { min: 94, max: 100, color: "#22c55e", label: "Normal" }]
- **Secondary**: [SQI bar, R-ratio number (dev mode only)]
- **Chart**: line, 120 seconds, yRange [85, 100]
- **Card Size**: 1x1
- **Disclaimer**: "This is not a medical device. Consult a healthcare provider for medical decisions."

## Edge Cases

| Condition | Behavior |
|-----------|----------|
| No tissue contact (DC < 1000) | Output 0, state = IDLE |
| Motion artifact (>0.2g) | Suppress immediately; require 4s clean data to resume |
| Very low perfusion (PI < 0.3%) | Suppress — Red channel too noisy for reliable R ratio |
| R > 2.0 or R < 0.2 | Flag as sensor error, output invalid |
| Ambient light interference | DC shifts but R-ratio (AC/DC ratio of ratios) is self-normalizing |
| Nail polish / dark skin pigmentation | May reduce signal amplitude; PI-based SQI catches this |
| SpO2 < 70% reported | Clamp to 70%, flag "Sensor error likely — verify placement" |
| Red and IR channels desynchronized | Cross-correlation drops → SQI drops → suppress |
| User removes finger during measurement | DC drops to near-zero within 1-2s → IDLE |
| Cold extremities (vasoconstriction) | Low PI → extended averaging window (8s instead of 4s) |

## Medical References

1. Maxim Integrated, "AN6409: Guidelines for SpO2 Measurement Using the MAX30101/MAX30102", 2018.
2. Jubran A, "Pulse Oximetry", Critical Care, 2015. DOI: 10.1186/s13054-015-0984-8
3. Tamura T et al., "Wearable Photoplethysmographic Sensors — Past and Present", Electronics, 2014. DOI: 10.3390/electronics3020282
4. Nitzan M et al., "Pulse oximetry: fundamentals and technology update", Medical Devices: Evidence and Research, 2014. DOI: 10.2147/MDER.S47319
5. ISO 80601-2-61:2017, "Particular requirements for basic safety and essential performance of pulse oximeter equipment".
6. Chan ED, Chan MM, Chan MM, "Pulse oximetry: understanding its basic principles facilitates appreciation of its limitations", Respiratory Medicine, 2013. DOI: 10.1016/j.rmed.2013.02.004

## Test Scenarios (Simulation)

| # | Scenario | Expected Output | Tolerance |
|---|----------|-----------------|-----------|
| 1 | Clean signal, normal SpO2 (R = 0.4, SpO2 ~99%) | 99% | ±2% |
| 2 | Mild hypoxemia (R = 0.8, SpO2 ~90%) | 90% | ±2% |
| 3 | Moderate hypoxemia (R = 1.2, SpO2 ~80%) | 80% | ±3% |
| 4 | No tissue contact (DC = 0) | Invalid, state = IDLE | exact |
| 5 | Motion artifact (0.5g burst, 3 seconds) | Suppressed during motion + 4s after | — |
| 6 | Low perfusion (PI = 0.1%) | Output suppressed | — |
| 7 | Gradual desaturation (99% → 88% over 2 min) | Tracks true trend | ±2% |
| 8 | R-ratio out of valid range (R = 2.5) | Sensor error, output invalid | — |
| 9 | Recovery from motion (motion stops, 4s settle) | Resumes output after 4s clean | ±3% |
