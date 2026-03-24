# A01: Heart Rate (Real-Time)

## Classification
- **Layer**: Base
- **Tier**: 0 (realtime — called every loop iteration)
- **Regulatory**: Wellness
- **Hardware**: Any providing CH_PPG
- **Priority**: P0 (MVP)
- **Consumes**: CH_PPG
- **Outputs**: float bpm
- **Consumed by**: A02 (HRV), A24 (Calories), X01 (PTT-BP), C01 (Recovery Score)

## Channel Input
- **Channel**: CH_PPG
- **Sample Rate**: 100 Hz
- **Bit Depth**: 18-bit unsigned (minimum)
- **Buffer Size**: 512 samples (5.12 seconds at 100 Hz)
- **Minimum data**: 4 valid beats before first output

## Algorithm

### Method

1. **DC Removal**: High-pass IIR filter at 0.5 Hz removes baseline wander caused by respiration and motion.

2. **Bandpass Filtering**: 4th-order Butterworth bandpass, 0.5–4.0 Hz. This passes heart rates of 30–240 BPM while rejecting respiratory modulation (below 0.5 Hz) and high-frequency noise (above 4 Hz).
   - Coefficients pre-computed for 100 Hz sample rate via `scipy.signal.butter(4, [0.5, 4.0], btype='band', fs=100)`.

3. **Adaptive Peak Detection**:
   - Compute running mean and standard deviation over 3-second window (300 samples).
   - Dynamic threshold = mean + 0.6 × stddev.
   - A peak is registered when the filtered signal crosses above the threshold and then falls back below.
   - Refractory period: 250 ms (max detectable HR = 240 BPM).
   - Peak validation: the slope before the peak must be positive and > 20% of peak amplitude.

4. **Inter-Beat Interval (IBI)**:
   - IBI = time between consecutive validated peaks (in ms).
   - Debounce: reject IBIs < 300 ms (>200 BPM) — likely noise.
   - Gap detection: if IBI > 2000 ms (< 30 BPM), reset the averaging window (finger likely repositioned).

5. **Beat Averaging**:
   - 8-beat exponential moving average (EMA).
   - Require ≥ 4 valid beats before reporting any value.
   - BPM = 60000.0 / IBI_ms.

6. **Outlier Rejection**:
   - If a new BPM deviates by > 30% from the current average AND the signal quality is < 0.7, reject the beat.
   - If it deviates by > 30% but SQI > 0.7, accept it (genuine rapid HR change, e.g., exercise onset).

7. **Output Gating**:
   - If finger not detected (perfusion index < 0.1%), output 0 and state = IDLE.
   - If < 4 valid beats collected, state = ACQUIRING.

### Alternative Methods
- **Method A**: HeartPy Adaptive Moving Average (van Gent et al. 2019). Highly robust against motion artifacts; preferred for daily tracking.
- **Method B**: NeuroKit2 Gradient-Based (Makowski et al. 2021). Low latency, computationally cheaper; preferred when patient is strictly resting.

### Parameters

| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| Filter order | 4 | — | Standard for biomedical PPG (Elgendi 2012) |
| Bandpass low | 0.5 | Hz | Covers 30 BPM minimum |
| Bandpass high | 4.0 | Hz | Covers 240 BPM maximum |
| Peak threshold k | 0.6 | × σ | Elgendi "Optimal PPG peak detection" (2013) |
| Refractory period | 250 | ms | 240 BPM maximum physiological HR |
| EMA window | 8 | beats | Balance: responsiveness vs. stability |
| Min valid beats | 4 | beats | ~3–4 seconds to first reading |
| Min IBI | 300 | ms | >200 BPM = likely artifact |
| Max IBI | 2000 | ms | <30 BPM = finger repositioned |
| Outlier threshold | 30 | % | Reject if new beat deviates >30% and SQI low |
| SQI suppress threshold | 0.4 | — | Below this = signal too noisy |
| Perfusion index threshold | 0.1 | % | Below this = no finger detected |

### SQI Computation

SQI is computed from three factors (weighted average):

1. **Perfusion Index** (40%): `PI = (AC_amplitude / DC_level) × 100`. PI > 1% = good. Scale linearly: 0% → SQI 0.0, 2% → SQI 1.0.

1. **Perfusion Index** (40%): `PI = (AC_amplitude / DC_level) × 100`. PI > 1% = good. Scale linearly: 0% → SQI 0.0, 2% → SQI 1.0.

2. **Peak prominence** (30%): How clearly the peaks stand out from noise. `prominence = peak_height / noise_floor`. prominence > 5 = good. Scale: 1 → SQI 0.0, 5 → SQI 1.0.

3. **Motion energy** (30%): Based on IMU continuous motion_level `[0.0 - 1.0]`. Heart rate is robust up to ~1.0g motion. Scale: 0.1g → SQI 1.0, 1.0g → SQI 0.0.

```
SQI = 0.4 * sqi_perfusion + 0.3 * sqi_prominence + 0.3 * sqi_motion
```
- **SQI Threshold**: 0.3 (Minimum quality required to emit output. HR is relatively robust.)

### Power & Resources
- **Power Mode**: continuous
- **Expected Current Draw**: 0.6 mA active / 0.1 mA idle

## Validation
- **Validation Dataset**: MIT-BIH Arrhythmia Database
- **Accuracy Target**: MAE < 2 BPM vs. ECG reference

## Output
- **Type**: AlgorithmOutput (value + sqi + timestamp + valid)
- **Unit**: BPM (beats per minute)
- **Valid Range**: 30–220 BPM (outside → clamp and flag)
- **Update Rate**: Per beat (~0.5–2 Hz depending on heart rate)
- **BLE Characteristic**: UUID `12345678-1234-5678-1234-56789abcdef1`
- **Zero means**: No finger detected or insufficient data

## Edge Cases

| Condition | Behavior |
|-----------|----------|
| No finger (PI < 0.1%) | Output 0, state = IDLE, clear average after 3 seconds |
| Motion artifact (accel > 1.5g) | Hold last valid for 5s, then suppress. SQI drops. |
| Very low HR (<40 BPM, e.g., athlete) | Accept if SQI > 0.6 (genuine bradycardia vs. missed beats) |
| Very high HR (>180 BPM, exercise) | Accept if multiple consecutive fast beats confirm pattern |
| Irregular rhythm (AFib) | Report instantaneous HR — average will show variability |
| Sensor saturation (ADC clipped) | Detect flat-top peaks → SQI = 0, suppress output |
| Finger repositioning | Detect IBI gap > 2s → reset averaging window |
| Cold hands (low perfusion) | Lower PI threshold detection, show "Weak signal" in UI |

## Medical References

1. Elgendi M, "Fast QRS Detection with an Optimized Knowledge-Based Method", PLOS ONE, 2013. DOI: 10.1371/journal.pone.0084018
2. Elgendi M, "Optimal Signal Quality Index for PPG Signals", Bioengineering, 2016. DOI: 10.3390/bioengineering3040021
3. Tamura T et al., "Wearable Photoplethysmographic Sensors — Past and Present", Electronics, 2014. DOI: 10.3390/electronics3020282
4. Pan J, Tompkins WJ, "A Real-Time QRS Detection Algorithm", IEEE Trans. Biomed. Eng., 1985. (Adapted for PPG context)
5. Maxim Integrated, "AN6409: Guidelines for SpO2 Measurement Using the MAX30101/MAX30102", 2018.

## Test Scenarios (Simulation)

| # | Scenario | Expected Output | Tolerance |
|---|----------|-----------------|-----------|
| 1 | Clean synthetic 72 BPM PPG waveform, high SNR | 72 BPM | ±2 BPM |
| 2 | Bradycardia 40 BPM, high SNR | 40 BPM | ±2 BPM |
| 3 | Tachycardia 180 BPM, medium SNR | 180 BPM | ±3 BPM |
| 4 | Zero signal (no finger, all zeros) | 0 BPM | exact |
| 5 | Signal with 2s heavy motion burst (1.5g) | Holds last valid | ±5 BPM |
| 6 | Gradually increasing HR (60→120 over 30s) | Tracks true | ±5 BPM |
| 7 | Low perfusion (amplitude 10% of normal) | Detects if PI > 0.1% | ±3 BPM |
