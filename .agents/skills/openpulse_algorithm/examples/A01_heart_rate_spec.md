# A01: Heart Rate (Real-Time)

## Classification
- **Layer**: Base
- **Tier**: 0 (realtime — called every loop iteration)
- **Regulatory**: Wellness
- **Puck**: 1 (MAX86150 PPG)
- **Priority**: P0 (MVP)
- **Dependencies**: none (uses raw PPG driver directly)

## Sensor Input
- **Chip**: MAX86150
- **Channel**: PPG IR (infrared, 880nm)
- **Sample Rate**: 100 Hz
- **Bit Depth**: 18-bit unsigned
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
   - If SQI < 0.4, suppress output (state = LOW_QUALITY).
   - If < 4 valid beats collected, state = ACQUIRING.

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

2. **Peak prominence** (30%): How clearly the peaks stand out from noise. `prominence = peak_height / noise_floor`. prominence > 5 = good. Scale: 1 → SQI 0.0, 5 → SQI 1.0.

3. **Motion energy** (30%): From IMU accelerometer magnitude. `motion = |accel| - 1.0g`. motion < 0.1g = still (SQI 1.0), motion > 0.5g = moving (SQI 0.0).

```
SQI = 0.4 * sqi_perfusion + 0.3 * sqi_prominence + 0.3 * sqi_motion
```

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

## Test Vectors

| # | Input Scenario | Expected Output | Tolerance | Source |
|---|---------------|-----------------|-----------|--------|
| 1 | Clean synthetic 72 BPM PPG waveform (100Hz, 10s) | 72 BPM | ±2 BPM | Computed from known IBI of 833ms |
| 2 | Clean synthetic 40 BPM (bradycardia) | 40 BPM | ±2 BPM | IBI = 1500ms |
| 3 | Clean synthetic 180 BPM (exercise) | 180 BPM | ±3 BPM | IBI = 333ms |
| 4 | Zero signal (no finger, all zeros) | 0 BPM | exact | No peaks → no output |
| 5 | Signal with 2s motion burst in middle | Holds last valid, then recovers | ±5 BPM | Last valid before artifact, recovery after |
| 6 | Gradually increasing HR (60→120 over 30s) | Tracks within 5 BPM of true | ±5 BPM | 8-beat EMA lag expected |
| 7 | Low perfusion (amplitude 10% of normal) | Detects if PI > 0.1%, else 0 | ±3 BPM | Threshold behavior |
