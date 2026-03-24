# A02: Heart Rate Variability (HRV)

## Classification
- **Category**: health-biometric
- **Layer**: Base
- **Tier**: 1 (periodic — computed every 5 seconds from accumulated IBI data)
- **Regulatory**: Health Indicator
- **Priority**: P0 (MVP)
- **Consumes**: CH_PPG, CH_ACCEL
- **Outputs**: float rmssd (ms), float sdnn (ms), float pnn50 (%), float lf_hf_ratio (a.u.)
- **Consumed by**: A04 (Respiratory Rate — HRV-derived respiratory sinus arrhythmia), X01 (Blood Pressure), X05 (Autonomic Balance), X07 (Illness Warning), X09 (Recovery raw), X11 (Sleep Phases), X14 (Stress Resilience), C01 (Recovery Score), C05 (Cardiovascular Age)

## Channel Input

| Channel | Sample Rate | Bit Depth | Purpose in This Algorithm |
|---------|-------------|-----------|---------------------------|
| CH_PPG (Green LED) | 100 Hz | 18-bit | IBI extraction via A01 peak timestamps |
| CH_ACCEL | 50 Hz | 16-bit | Motion artifact rejection — HRV is extremely motion-sensitive |

- **PPG Mode**: Green
- **Buffer Size**: 128 IBIs (~2 minutes at 60 BPM)
- **Minimum data**: 60 seconds of valid IBIs before first output

## Algorithm

### Method

1. **IBI Collection**: Receive inter-beat intervals (IBI) from A01's peak detection timestamps. Each detected peak produces an IBI = time(peak_n) - time(peak_n-1) in milliseconds.
   - Store IBIs in a RingBuffer<float, 128> (capacity ~2 minutes at 60 BPM).
   - Only accept IBIs where A01 SQI > 0.6 and both peaks passed validation.

2. **IBI Preprocessing — Artifact Removal**:
   - **Ectopic beat filter**: Remove IBIs that deviate > 20% from the local median of the 5 surrounding IBIs (Lipponen & Tarvainen 2019). Replace with interpolated value.
   - **Range filter**: Reject IBIs < 300ms (>200 BPM) or > 2000ms (<30 BPM).
   - Track the number of artifacts in the analysis window; if > 20% of IBIs are artifacted, set SQI = 0.

3. **Time-Domain HRV Metrics** (computed over a 60-second window, updated every 5 seconds):
   - **RMSSD** (Root Mean Square of Successive Differences): 
     `RMSSD = sqrt( (1/N) × Σ(IBI[i+1] - IBI[i])² )` where N = number of successive differences.
     Primary parasympathetic (vagal) marker. Citation: Task Force of ESC/NASPE 1996.
   - **SDNN** (Standard Deviation of NN intervals):
     `SDNN = stddev(IBI[])` over the analysis window.
     Reflects overall HRV (sympathetic + parasympathetic). For short-term (5-min): labeled SDNN-index.
   - **pNN50** (Percentage of successive differences > 50ms):
     `pNN50 = (count(|IBI[i+1] - IBI[i]| > 50ms) / N) × 100`
     Another parasympathetic marker, correlated with RMSSD.
   - **Mean IBI**: `mean_ibi = mean(IBI[])` — used internally, also useful for context.

4. **Frequency-Domain HRV** (optional, computed when ≥ 120s of clean data available):
   - Resample IBI series to uniform 4 Hz using cubic interpolation.
   - Apply Welch's method (256-point FFT, Hanning window, 50% overlap).
   - **LF Power**: Spectral power in 0.04–0.15 Hz band (sympathetic + parasympathetic).
   - **HF Power**: Spectral power in 0.15–0.40 Hz band (parasympathetic, respiratory-linked).
   - **LF/HF Ratio**: `lf_hf = LF_power / HF_power`. Sympathovagal balance index.
   - Citation: Shaffer & Ginsberg 2017, "An Overview of Heart Rate Variability Metrics and Norms."

5. **Output Gating**:
   - Require minimum 30 valid IBIs for time-domain (~30 seconds at 60 BPM).
   - Require minimum 120s clean data for frequency-domain.
   - If motion > 0.5g sustained for > 3s, flag window as "motion-contaminated" — report with reduced SQI.
   - Clamp: RMSSD 0–300ms, SDNN 0–300ms, pNN50 0–100%, LF/HF 0–20.

### Alternative Methods
- **Method A**: Time-Domain Only (Task Force 1996). Compute RMSSD and SDNN from R-R intervals directly. Simplest, lowest computational cost, works well for short-term (5-min) recordings. **Recommended for Tier 1 on-device.**
- **Method B**: Poincaré Plot Analysis (Brennan et al. 2001). Plot IBI(n) vs IBI(n+1), compute SD1 (short-term variability ≈ RMSSD/√2) and SD2 (long-term variability). Visual and intuitive for trend display.
- **Method C**: Detrended Fluctuation Analysis (Peng et al. 1995). Compute scaling exponent α1 (short-term) and α2 (long-term). Better for long recordings (>1h). Too expensive for Tier 1.

### Parameters

| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| Analysis window | 60 | s | Short-term HRV standard (Task Force 1996) |
| Update interval | 5 | s | Sliding window, update every 5s |
| Min IBIs for output | 30 | count | ~30s at 60 BPM — minimum for reliable RMSSD |
| Min duration for freq-domain | 120 | s | 2 minutes minimum for LF band resolution |
| Ectopic threshold | 20 | % deviation | Lipponen & Tarvainen 2019 |
| Max artifact rate | 20 | % | Above this, SQI = 0 (too much interpolation) |
| IBI range low | 300 | ms | >200 BPM = noise |
| IBI range high | 2000 | ms | <30 BPM = missed beats |
| A01 SQI threshold for IBI acceptance | 0.6 | — | Only use high-quality beats |
| Motion threshold for HRV | 0.5 | g | HRV is sensitive to motion artifact |
| RMSSD clamp range | 0–300 | ms | Physiological range |
| SDNN clamp range | 0–300 | ms | Physiological range |
| pNN50 clamp range | 0–100 | % | Mathematical range |
| LF/HF clamp range | 0–20 | — | Physiological range |
| SQI suppress threshold | 0.5 | — | HRV needs clean signal |

### SQI Computation

SQI for HRV is computed from three factors:

1. **IBI Artifact Rate** (50%): Percentage of IBIs that were ectopic/removed. 0% artifacts → SQI 1.0, 20% → SQI 0.0.
   - `sqi_artifact = clamp(1.0 - artifact_rate / 0.20, 0.0, 1.0)`

2. **A01 Average SQI** (30%): Mean SQI from the HR algorithm over the analysis window. Passes through upstream signal quality.
   - `sqi_hr = mean(a01_sqi_values[])`

3. **Motion Level** (20%): Mean IMU motion over the analysis window. 0g → SQI 1.0, 0.5g → SQI 0.0.
   - `sqi_motion = clamp(1.0 - mean_motion / 0.5, 0.0, 1.0)`

```
SQI = 0.5 * sqi_artifact + 0.3 * sqi_hr + 0.2 * sqi_motion
```
- **SQI Threshold**: 0.5 (HRV is sensitive to artifacts — even one bad IBI skews RMSSD)

### Power & Resources
- **Power Mode**: continuous (passive — uses A01 beat timestamps, no additional sensor reads)
- **Expected Current Draw**: 0 mA additional (piggybacks on A01 PPG data)
- **RAM Budget**: ~1.5 KB (128-element IBI ring buffer + 60s IBI window + metric accumulators)

## Validation
- **Validation Dataset**: MIT-BIH Normal Sinus Rhythm Database (PhysioNet)
- **Accuracy Target**: RMSSD correlation r ≥ 0.95 vs. ECG-derived RR intervals (gold standard)

## Output
- **Type**: AlgorithmOutput (primary: rmssd) + secondary getters for SDNN, pNN50, LF/HF
- **Unit**: ms (RMSSD, SDNN), % (pNN50), ratio (LF/HF)
- **Valid Range**: RMSSD 0–300 ms, SDNN 0–300 ms, pNN50 0–100%, LF/HF 0–20
- **Update Rate**: Every 5 seconds (sliding 60s window)
- **BLE Characteristic**: UUID `12345678-1234-5678-1234-56789abcdef2`
- **Zero means**: Insufficient valid IBIs or signal quality too low

## Display
- **Layout**: multi-metric
- **Metrics**: [{ key: "rmssd", label: "RMSSD", unit: "ms", range: [0, 150] }, { key: "sdnn", label: "SDNN", unit: "ms", range: [0, 150] }, { key: "pnn50", label: "pNN50", unit: "%", range: [0, 50] }, { key: "lf_hf", label: "LF/HF", unit: "", range: [0, 10] }]
- **Primary**: "rmssd"
- **Zones**: [{ min: 0, max: 20, color: "#ef4444", label: "Low" }, { min: 20, max: 50, color: "#f59e0b", label: "Below Avg" }, { min: 50, max: 100, color: "#22c55e", label: "Good" }, { min: 100, max: 150, color: "#3b82f6", label: "Excellent" }]
- **Secondary**: [SQI bar, SDNN number, pNN50 number]
- **Chart**: line (RMSSD trend), windowSeconds: 300
- **Card Size**: 2x1

## Edge Cases

| Condition | Behavior |
|-----------|----------|
| Fewer than 30 valid IBIs | State = ACQUIRING, output invalid, show "Collecting data..." |
| No hear rate signal (A01 idle) | State = IDLE, no HRV output possible |
| Motion artifact (>0.5g sustained) | Continue collecting IBIs but flag window; reduce SQI proportionally |
| Ectopic beats (>20% of window) | SQI = 0, suppress output — too many artifacts for reliable HRV |
| Very low HRV (RMSSD < 10ms, elderly/stressed) | Accept and report — genuinely low HRV is clinically meaningful |
| Very high HRV (RMSSD > 200ms, athlete at rest) | Accept if SQI > 0.7 — athletes can have very high resting HRV |
| Atrial fibrillation (highly irregular rhythm) | Report RMSSD (will be very high) but flag "Irregular rhythm — HRV may not reflect autonomic tone" |
| Transition (rest → exercise) | Window contains mixed states; allow output but reduced SQI. Full window refresh in 60s |
| Single missed beat (false IBI gap) | Ectopic filter catches it; interpolated value used |

## Medical References

1. Task Force of the European Society of Cardiology and the North American Society of Pacing and Electrophysiology, "Heart Rate Variability: Standards of Measurement, Physiological Interpretation, and Clinical Use", Circulation, 1996. DOI: 10.1161/01.CIR.93.5.1043
2. Shaffer F, Ginsberg JP, "An Overview of Heart Rate Variability Metrics and Norms", Front Public Health, 2017. DOI: 10.3389/fpubh.2017.00258
3. Lipponen JA, Tarvainen MP, "A robust algorithm for heart rate variability time series artefact correction using novel beat classification", J Med Eng Technol, 2019. DOI: 10.1080/03091902.2019.1640306
4. Brennan M, Palaniswami M, Kamen P, "Do existing measures of Poincaré plot geometry reflect nonlinear features of heart rate variability?", IEEE Trans Biomed Eng, 2001. DOI: 10.1109/10.959330
5. Berntson GG et al., "Heart rate variability: origins, methods, and interpretive caveats", Psychophysiology, 1997. DOI: 10.1111/j.1469-8986.1997.tb02140.x
6. Electrophysiology Task Force, "Heart rate variability: standards of measurement", Eur Heart J, 1996.

## Test Scenarios (Simulation)

| # | Scenario | Expected Output | Tolerance |
|---|----------|-----------------|-----------|
| 1 | Clean sinus rhythm, 60 BPM, RMSSD ~42ms | RMSSD 42ms, SDNN ~50ms | RMSSD ±5ms |
| 2 | Low HRV (stressed/elderly), constant ~800ms IBI | RMSSD ~12ms | ±3ms |
| 3 | High HRV (athlete, deep rest), variable IBIs 750–1100ms | RMSSD ~120ms | ±15ms |
| 4 | No HR signal (A01 idle) | Invalid output, state = IDLE | exact |
| 5 | 25% ectopic beats in window | SQI = 0, output suppressed | — |
| 6 | Motion burst (0.7g, 5 seconds in 60s window) | Report with reduced SQI (~0.4) | — |
| 7 | Fewer than 30 IBIs (just started) | Invalid, state = ACQUIRING | exact |
| 8 | Gradual HRV decrease (resting → stress, RMSSD 80→25 over 5 min) | Tracks true trend | ±8ms |
