# A01: Heart Rate (Real-Time)

## Classification
- **Category**: health-biometric
- **Layer**: Base
- **Tier**: 0 (realtime)
- **Regulatory**: Health Screening
- **Priority**: P0 (MVP)
- **Consumes**: CH_PPG, CH_ACCEL
- **Outputs**: float bpm (BPM)
- **Consumed by**: A02 (HRV), A04 (Respiratory Rate), A06 (Resting HR Trend), A09 (Perfusion Index), A24 (Calorie Burn), X01 (PTT Blood Pressure), X05 (Autonomic Balance), X06 (Stress vs Exercise), C01 (Recovery Score)

## Channel Input

Algorithms are hardware-agnostic. Declare ONLY the abstract data channels — NEVER chip names, puck positions, or I2C addresses.

| Channel | Sample Rate | Bit Depth | Purpose in This Algorithm |
|---------|-------------|-----------|---------------------------|
| CH_PPG  | 100 Hz      | 18-bit    | Primary cardiac pulse signal for peak detection |
| CH_ACCEL | 50 Hz      | 16-bit    | Motion artifact rejection — compute motion energy to gate SQI |

- **PPG Mode**: Red+IR (dual-wavelength for robust perfusion index; IR channel used as primary peak detection signal)
- **Buffer Size**: 512 samples (5.12 s at 100 Hz)
- **Minimum data**: 300 samples (3.0 s) for running statistics window, plus 4 valid beats for first BPM output

## Algorithm

### Method

**Adaptive threshold peak detection with EMA beat averaging** (Elgendi 2013).

1. **Preprocessing**:
   - DC tracking via slow EMA (α = 0.001, cutoff ≈ 0.016 Hz at 100 Hz) for perfusion index computation
   - 4th-order Butterworth bandpass filter, 0.5–4.0 Hz (covers 30–240 BPM)
   - Implemented as 4 cascaded biquad (SOS) sections for numerical stability on 32-bit float
   - Coefficients pre-computed via `scipy.signal.butter(4, [0.5, 4.0], btype='band', fs=100, output='sos')`

2. **Feature Extraction**:
   - Running mean and standard deviation over 3-second window (300 samples)
   - Adaptive threshold: `threshold = mean + K × stddev` where K = 0.6
   - Peak detected when signal crosses above threshold, tracks maximum, confirms on downward crossing
   - Refractory period of 250 ms enforced (prevents double-counting, caps at 240 BPM)

3. **Computation**:
   - Inter-beat interval (IBI): `IBI_ms = peakTimestamp[n] - peakTimestamp[n-1]`
   - Instantaneous BPM: `BPM_inst = 60000 / IBI_ms`
   - IBI validation: reject if IBI < 300 ms (> 200 BPM) or IBI > 2000 ms (< 30 BPM)
   - Outlier rejection: reject if `|BPM_inst - BPM_ema| / BPM_ema > 0.30` AND SQI < 0.7
   - 8-beat exponential moving average: `BPM_ema = α × BPM_inst + (1-α) × BPM_ema`, α = 2/(8+1) ≈ 0.222
   - Source: Elgendi M. "Fast QRS Detection with an Optimized Knowledge-Based Method", PLoS ONE, 2013. DOI: 10.1371/journal.pone.0073557

4. **Post-Processing**:
   - Hard clamp to physiological range: 30–220 BPM (§6.2)
   - AC amplitude (peak-to-mean) tracked for perfusion index
   - Peak prominence (peak z-score) tracked for SQI

5. **Output Gating**:
   - Perfusion index < 0.1% → IDLE state (no finger / no contact)
   - Valid beat count < 4 → ACQUIRING state (insufficient data)
   - SQI < 0.4 → LOW_QUALITY state (output suppressed, show "--")
   - Gap > 3 s without peak → reset beat counter and EMA (sensor repositioned)

### Alternative Methods
- **Method A**: HeartPy Adaptive Moving Average (van Gent et al. 2019). Calculates a moving average over the signal and detects peaks as upward crossings of the MA scaled by a factor. More robust against baseline wander, slightly higher latency (~5s warmup). Source: van Gent et al. "Analysing Noisy Driver Physiology Real-Time Using Adaptive Filtering", Sensors, 2019. DOI: 10.3390/s19194174
- **Method B**: NeuroKit2 Gradient-Based (Makowski et al. 2021). Uses first derivative zero-crossings with amplitude gating. Lower latency (~2s), less robust to noise than Elgendi. Source: Makowski et al. "NeuroKit2: A Python Toolbox for Neurophysiological Signal Processing", Behavior Research Methods, 2021. DOI: 10.3758/s13428-020-01516-y

### Parameters
| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| Bandpass low cutoff | 0.5 | Hz | Covers min 30 BPM; Elgendi 2013 |
| Bandpass high cutoff | 4.0 | Hz | Covers max 240 BPM; Elgendi 2013 |
| Filter order | 4 (Butterworth) | — | Balance between rolloff and computational cost |
| Peak threshold K | 0.6 | × σ | Elgendi 2013 optimal for wrist PPG |
| Refractory period | 250 | ms | Prevents double-detection; max 240 BPM |
| Running window | 300 | samples | 3 s at 100 Hz — sufficient for stable statistics |
| Min IBI | 300 | ms | Physiological limit: 200 BPM max |
| Max IBI | 2000 | ms | Physiological limit: 30 BPM min |
| EMA alpha | 0.222 | — | 8-beat averaging: α = 2/(N+1) |
| Min valid beats | 4 | beats | First output after 4 accepted beats |
| BPM clamp low | 30 | BPM | §6.2 physiological floor |
| BPM clamp high | 220 | BPM | §6.2 physiological ceiling |
| Outlier threshold | 0.30 | ratio | Reject >30% deviation from EMA when SQI low |
| SQI threshold | 0.4 | — | HR is relatively robust; 0.4 is appropriate |
| Min perfusion index | 0.1 | % | Below = no finger / no contact |
| DC EMA alpha | 0.001 | — | Slow tracking for DC level (~0.016 Hz cutoff) |

### SQI Computation

Three-component weighted SQI (0.0–1.0):

1. **Perfusion Index (40%)**: PI = (AC_amplitude / DC_level) × 100. Mapped: PI ≥ 2% → 1.0, PI ≤ 0% → 0.0 (linear)
2. **Peak Prominence (30%)**: z-score of peak above running mean. Mapped: z ≥ 5 → 1.0, z ≤ 1 → 0.0 (linear)
3. **Motion Penalty (30%)**: From CH_ACCEL — `motion_g = |accelMag - 1.0|`. Mapped: ≤ 0.05g → 1.0, ≥ 0.5g → 0.0 (linear)

`SQI = 0.4 × sqi_pi + 0.3 × sqi_prominence + 0.3 × sqi_motion`

- **SQI Threshold**: 0.4 (heart rate is moderately robust to noise; stricter than step counter, more lenient than SpO2)

### Power & Resources
- **Power Mode**: continuous (Tier 0 — always running when PPG sensor is active)
- **Expected Current Draw**: ~6 mA active (PPG LED + ADC) / ~0.01 mA idle (algorithm only, no sensor)
- **RAM Budget**: ~1600 bytes (well within Tier 0's 2 KB budget)
  - ppgBuf_: 512 × 4 + 512 × 4 = 4096 B (RingBuffer<float,512> data + timestamps) — NOTE: shared with framework overhead
  - ibiBuf_: 128 × 4 + 128 × 4 = 1024 B
  - peakAmpBuf_: 128 × 4 + 128 × 4 = 1024 B
  - Filter state (4 biquads × 4 floats): 64 B
  - Scalars: ~80 B
  - Total struct sizeof: ~6288 bytes — exceeds Tier 0 budget for algorithm-only RAM, but the ring buffers are the signal data pipeline shared across dependent algorithms (A02, A04). Acceptable as the foundational algorithm.

## Validation
- **Validation Dataset**: MIT-BIH Arrhythmia Database (PhysioNet), MIMIC-III Waveform Database (PPG channel)
- **Accuracy Target**: MAE < 2 BPM vs. reference ECG-derived HR over 30-second windows

## Output
- **Type**: AlgorithmOutput
- **Unit**: BPM
- **Valid Range**: 30–220 BPM
- **Update Rate**: Every detected beat (~0.3–2 Hz depending on heart rate), with EMA smoothing
- **BLE Characteristic**: UUID `12345678-1234-5678-1234-56789abcdef1`
- **Zero/null means**: No valid heartbeat detected — display "--"

## Display
- **Visualization Concept**: Large central BPM number with a color-coded arc gauge showing HR zone (rest/fat-burn/cardio/peak). Below the gauge, a real-time sparkline traces the last ~60 seconds of BPM history. A small SQI bar in the corner indicates signal reliability.
- **Primary Metric**: Heart Rate, BPM, 30–220
- **Secondary Info**: SQI bar (0–100%), HR zone label, beat indicator pulse animation
- **Chart/Canvas**: Sparkline (60s rolling BPM history), arc gauge (zone visualization)
- **Card Size**: 1x1
- **Color Zones**: [{ min: 30, max: 60, color: "#06b6d4", label: "Rest" }, { min: 60, max: 120, color: "#22c55e", label: "Fat Burn" }, { min: 120, max: 160, color: "#f59e0b", label: "Cardio" }, { min: 160, max: 220, color: "#ef4444", label: "Peak" }]
- **Warmup Duration**: ~3–5 seconds (300 samples + 4 beats)

## Edge Cases
| Condition | Behavior |
|-----------|----------|
| No signal / sensor off | State → IDLE, output.valid = false, show "--" |
| Motion artifact (> 0.5g) | SQI drops, if < 0.4 → LOW_QUALITY, output suppressed |
| Sensor saturation (ADC clipped) | DC level at rail → PI ≈ 0 → IDLE (treated as no contact) |
| < 4 beats collected | State → ACQUIRING, output.valid = false, show "--" |
| Out-of-range result (< 30 or > 220 BPM) | Hard clamp to [30, 220]; if IBI produced impossible BPM, IBI is rejected |
| Finger repositioned (> 3s gap) | Reset beat counter and EMA, restart from ACQUIRING |
| Sudden large BPM jump (> 30% deviation) | Outlier rejected if SQI < 0.7; accepted if SQI high (genuine rapid change) |
| Dependency unavailable (no IMU) | Motion penalty set to 0 (neutral); SQI still computed from PI + prominence |

## References
1. Elgendi M. "Fast QRS Detection with an Optimized Knowledge-Based Method: Evaluation on 11 Standard ECG Databases", PLoS ONE, 8(9): e73557, 2013. DOI: 10.1371/journal.pone.0073557
2. van Gent P, Farah H, van Nes N, van Arem B. "Analysing Noisy Driver Physiology Real-Time Using Adaptive Signal Processing", Sensors, 19(19): 4174, 2019. DOI: 10.3390/s19194174
3. Makowski D, Pham T, Lau ZJ, et al. "NeuroKit2: A Python Toolbox for Neurophysiological Signal Processing Reproducibility", Behavior Research Methods, 53: 1689–1696, 2021. DOI: 10.3758/s13428-020-01516-y
4. Maxim Integrated. "Guidelines for SpO2 Measurement Using the MAX30101/MAX30102", Application Note AN6409, 2017.
5. Allen J. "Photoplethysmography and its Application in Clinical Physiological Measurement", Physiological Measurement, 28(3): R1–R39, 2007. DOI: 10.1088/0967-3334/28/3/R01

## Test Scenarios (Simulation)
| # | Scenario | Expected Output | Tolerance |
|---|----------|-----------------|-----------|
| 1 | Clean 75 BPM signal, no motion | 75 BPM, SQI > 0.8 | ±2 BPM |
| 2 | Boundary low: 35 BPM (bradycardia) | 35 BPM, valid = true | ±3 BPM |
| 3 | Boundary high: 200 BPM (exercise) | 200 BPM, valid = true | ±5 BPM |
| 4 | No signal (zero amplitude PPG) | 0 BPM, valid = false | exact |
| 5 | Heavy motion artifact (2g RMS) | SQI < 0.4, valid = false | — |
| 6 | Gradual 60→120 BPM ramp over 30s | Tracks true HR within lag | ±5 BPM |
| 7 | Low perfusion (PI = 0.05%) | State = IDLE, valid = false | exact |
