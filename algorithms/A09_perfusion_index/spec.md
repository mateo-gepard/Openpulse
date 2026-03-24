# A09: Perfusion Index

## Classification
- **Category**: health-biometric
- **Layer**: Base
- **Tier**: 0 (realtime — called every loop iteration)
- **Regulatory**: Wellness
- **Priority**: P0 (MVP)
- **Consumes**: CH_PPG
- **Outputs**: float pi_percent (%)
- **Consumed by**: A01 (HR — SQI component), A07 (PPG Waveform — amplitude gating)

## Channel Input

| Channel | Sample Rate | Bit Depth | Purpose in This Algorithm |
|---------|-------------|-----------|---------------------------|
| CH_PPG (Green LED) | 100 Hz | 18-bit | Primary signal — AC/DC ratio extraction |

- **PPG Mode**: Green

## Algorithm

### Method

1. **DC Baseline Estimation**: Apply a first-order exponential moving average (EMA) to the raw PPG signal with a time constant of ~3 seconds (α = 1/(fs × τ) = 1/(100 × 3) ≈ 0.0033). This yields the slowly varying DC component representing non-pulsatile tissue absorption.
   - `DC[n] = α × PPG[n] + (1 - α) × DC[n-1]`

2. **AC Extraction**: Compute the AC component as the difference between the raw PPG and the DC baseline:
   - `AC[n] = PPG[n] - DC[n]`
   - Track the peak-to-trough amplitude of the AC waveform over each cardiac cycle using a sliding window max/min detector (window = 1.5× median IBI, or 1.5 seconds default).

3. **Perfusion Index Calculation**: Compute PI as the ratio of pulsatile (AC) to non-pulsatile (DC) components:
   - `PI = (AC_amplitude / DC_level) × 100`
   - Where AC_amplitude = peak - trough within the cardiac cycle window.
   - Citation: Shelley 2007, "Photoplethysmography: Beyond the Calculation of Arterial Oxygen Saturation and Heart Rate."

4. **Smoothing**: Apply a 4-beat EMA to the PI value to reduce beat-to-beat variability.
   - `PI_smooth = α_beat × PI_raw + (1 - α_beat) × PI_smooth_prev` where α_beat = 0.25.

5. **Output Gating**: 
   - If DC level < 1000 ADC counts (no tissue contact), output 0 and state = IDLE.
   - If AC amplitude is flat (AC < 0.01% of DC), output 0 — no pulsatile component detected.
   - Clamp output to valid range: 0.02–20.0%.

### Alternative Methods
- **Method A**: Beat-by-Beat Peak Detection (Shelley 2007). Track systolic peak and diastolic trough per beat using the R-peak from HR algorithm as a timing reference. Most accurate but requires A01 to be running. Preferred when HR is available.
- **Method B**: Sliding Window Min/Max (Allen 2007). Use a fixed 1.5s sliding window to find AC amplitude without beat synchronization. Simpler, independent of HR algorithm. Slightly noisier.

### Parameters

| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| DC EMA alpha | 0.0033 | — | τ = 3s at 100 Hz (standard for DC tracking) |
| Cardiac window | 1.5 | s | ~1.5× typical IBI, covers 40–150 BPM range |
| Beat EMA alpha | 0.25 | — | 4-beat smoothing (balance: responsiveness vs. noise) |
| Min DC threshold | 1000 | ADC counts | Below = no tissue contact (empirical, 18-bit PPG ADC) |
| Min AC ratio | 0.01 | % | Below = no pulsatile signal |
| PI valid range low | 0.02 | % | Barely detectable perfusion (cold extremities) |
| PI valid range high | 20.0 | % | Maximum physiological PI (vasodilated, warm skin) |
| SQI suppress threshold | 0.2 | — | PI is a raw measurement, tolerant of noise |

### SQI Computation

SQI for Perfusion Index is computed from two factors:

1. **Signal Stability** (60%): Coefficient of variation (CV) of the last 8 PI values. CV < 10% → SQI 1.0, CV > 50% → SQI 0.0. Linear interpolation between.
   - `sqi_stability = clamp(1.0 - (cv - 0.10) / 0.40, 0.0, 1.0)`

2. **DC Level Adequacy** (40%): How far above the minimum threshold the DC level is. DC at 5000+ → SQI 1.0, DC at 1000 → SQI 0.0.
   - `sqi_dc = clamp((dc - 1000) / 4000, 0.0, 1.0)`

```
SQI = 0.6 * sqi_stability + 0.4 * sqi_dc
```
- **SQI Threshold**: 0.2 (PI is a direct measurement; even noisy data gives useful trend information)

### Power & Resources
- **Power Mode**: continuous (runs whenever PPG is active)
- **Expected Current Draw**: 0 mA additional (piggybacks on PPG already running for HR)
- **RAM Budget**: ~200 bytes (DC accumulator, AC min/max trackers, 8-beat history, output)

## Validation
- **Validation Dataset**: MIMIC-III Waveform Database (PPG records with simultaneous pulse oximetry PI)
- **Accuracy Target**: Correlation r ≥ 0.90 vs. clinical pulse oximeter PI, bias < 0.5%

## Output
- **Type**: AlgorithmOutput (value + sqi + timestamp + valid)
- **Unit**: % (percent)
- **Valid Range**: 0.02–20.0%
- **Update Rate**: Per cardiac cycle (~0.5–2 Hz)
- **BLE Characteristic**: UUID `12345678-1234-5678-1234-56789abcdef9`
- **Zero means**: No tissue contact or no pulsatile signal detected

## Display
- **Layout**: gauge
- **Primary**: number, "Perfusion Index", "%", decimals 2, range [0, 20]
- **Zones**: [{ min: 0, max: 0.5, color: "#ef4444", label: "Very Low" }, { min: 0.5, max: 2.0, color: "#f59e0b", label: "Low" }, { min: 2.0, max: 7.0, color: "#22c55e", label: "Normal" }, { min: 7.0, max: 20.0, color: "#3b82f6", label: "High" }]
- **Secondary**: [SQI bar]
- **Chart**: line, 60 seconds, yRange [0, 10]
- **Card Size**: 1x1

## Edge Cases

| Condition | Behavior |
|-----------|----------|
| No tissue contact (DC < 1000) | Output 0, state = IDLE |
| No pulsatile signal (AC < 0.01% of DC) | Output 0, state = LOW_QUALITY |
| Very low PI (<0.1%, cold extremities) | Report value, flag "Weak signal" in UI |
| Very high PI (>15%, exercise vasodilation) | Report value, valid — physiologically possible |
| Motion artifact (AC oscillation not cardiac) | SQI drops from stability factor; hold last valid if SQI < threshold |
| Sensor saturation (DC at ADC max) | Detect clipping → SQI = 0, suppress output |
| Sudden PI change (>200% in 1 beat) | Accept if SQI > 0.5 (genuine autonomic change); reject otherwise |
| Ambient light interference | DC baseline shifts — EMA tracks it; AC ratio remains valid |

## Medical References

1. Shelley KH, "Photoplethysmography: Beyond the Calculation of Arterial Oxygen Saturation and Heart Rate", Anesth Analg, 2007. DOI: 10.1213/01.ane.0000269512.82836.c9
2. Allen J, "Photoplethysmography and its application in clinical physiological measurement", Physiological Measurement, 2007. DOI: 10.1088/0967-3334/28/3/R01
3. Lima AP, Beelen P, Bakker J, "Use of a peripheral perfusion index derived from the pulse oximetry signal as a noninvasive indicator of perfusion", Critical Care Medicine, 2002. DOI: 10.1097/00003246-200206000-00022
4. van Genderen ME et al., "Peripheral perfusion index as an early predictor for central hypovolemia in awake healthy volunteers", Anesth Analg, 2013. DOI: 10.1213/ANE.0b013e318286c82c
5. Maxim Integrated, "AN6409: Guidelines for SpO2 Measurement Using the MAX30101/MAX30102", 2018.

## Test Scenarios (Simulation)

| # | Scenario | Expected Output | Tolerance |
|---|----------|-----------------|-----------|
| 1 | Clean PPG, normal perfusion (PI ~2.5%) | 2.5% | ±0.3% |
| 2 | Low perfusion, cold hands (PI ~0.2%) | 0.2% | ±0.05% |
| 3 | High perfusion, exercise vasodilation (PI ~12%) | 12.0% | ±1.0% |
| 4 | No tissue contact (DC = 0) | 0% | exact |
| 5 | Motion artifact (2s burst, AC corrupted) | Holds last valid | ±0.5% |
| 6 | Gradual decrease (warm → cold, 5%→0.5% over 60s) | Tracks true | ±0.3% |
| 7 | Flat signal (no AC component, constant DC) | 0% | exact |
| 8 | Sensor saturation (ADC clipped at max) | 0%, SQI = 0 | exact |
