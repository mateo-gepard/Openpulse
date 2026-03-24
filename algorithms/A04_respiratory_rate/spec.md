# A04: Respiratory Rate

## Classification
- **Category**: health-biometric
- **Layer**: Base
- **Tier**: 1 (periodic — computed every 10 seconds from buffered PPG data)
- **Regulatory**: Health Indicator
- **Priority**: P0 (MVP)
- **Consumes**: CH_PPG, CH_ACCEL
- **Outputs**: float breaths_per_minute (BrPM)
- **Consumed by**: X07 (Illness Warning), X11 (Sleep Phases), C01 (Recovery Score — respiratory component)

## Channel Input

| Channel | Sample Rate | Bit Depth | Purpose in This Algorithm |
|---------|-------------|-----------|---------------------------|
| CH_PPG (Green LED) | 100 Hz | 18-bit | Extract respiratory modulation from PPG waveform |
| CH_ACCEL | 50 Hz | 16-bit | Motion artifact rejection + secondary respiratory estimate from chest/wrist movement |

- **PPG Mode**: Green
- **Buffer Size**: 3000 samples (30 seconds at 100 Hz)
- **Minimum data**: 20 seconds of clean PPG before first output

## Algorithm

### Method

Respiratory rate is extracted from the PPG signal via three respiratory-induced modulations, then fused for robustness. This approach is well-validated in wrist-worn pulse oximeters.

1. **Preprocessing**:
   - Bandpass filter the raw PPG signal: 0.5–4.0 Hz (4th-order Butterworth) to isolate cardiac pulses.
   - Run A01's peak detector (or equivalent) to identify systolic peaks (S-points) in the cardiac waveform.
   - Require ≥ 15 valid peaks per 30-second window to proceed.

2. **Three Respiratory Modulation Extraction**:
   Each modulation is extracted from the peak-detected PPG over a 30-second window:

   - **a) Respiratory-Induced Intensity Variation (RIIV)**: The DC baseline of the PPG fluctuates with breathing because thoracic pressure changes modulate venous return.
     - Extract the DC envelope: apply a 0.1 Hz low-pass EMA (α ≈ 0.006 at 100 Hz) to the raw PPG.
     - Interpolate the DC values at each beat timestamp to create a beat-synchronous DC series.
     - Citation: Karlen et al., "Multiparameter Respiratory Rate Estimation from the Photoplethysmogram", IEEE TBME, 2013.

   - **b) Respiratory-Induced Frequency Variation (RIFV)**: Heart rate fluctuates with breathing (respiratory sinus arrhythmia — RSA). Inspiration raises HR, expiration lowers it.
     - Compute IBI (inter-beat interval) from consecutive peaks.
     - The IBI series itself oscillates at the respiratory frequency.
     - Citation: Charlton et al., "Breathing Rate Estimation from the Electrocardiogram and Photoplethysmogram: A Review", IEEE Reviews in BME, 2018.

   - **c) Respiratory-Induced Amplitude Variation (RIAV)**: The AC amplitude (peak-to-trough height) of each pulse modulates with breathing.
     - Compute the peak-to-trough amplitude for each beat.
     - The amplitude series oscillates at the respiratory frequency.
     - Citation: Lázaro et al., "Deriving Respiration from the Pulse Photoplethysmographic Signal", Computing in Cardiology, 2011.

3. **Frequency Estimation per Modulation**:
   For each of the three modulation signals (RIIV, RIFV, RIAV):
   - Resample to 4 Hz (uniform grid) via linear interpolation of beat-synchronous values.
   - Apply a 120-sample (30-second) Hanning window.
   - Compute FFT (or autocorrelation — see Method B).
   - Find the dominant peak in the respiratory band [0.1–1.0 Hz] (6–60 BrPM).
   - Record the peak frequency and its power (spectral prominence).
   - Reject if the spectral prominence ratio (peak power / total band power) < 0.15 — no clear respiratory peak.
   - Citation: Karlen et al. 2013.

4. **Multi-Modulation Fusion**:
   - Each of the three estimates (f_RIIV, f_RIFV, f_RIAV) votes. Weight by spectral prominence:
     `RR = (p_RIIV × f_RIIV + p_RIFV × f_RIFV + p_RIAV × f_RIAV) / (p_RIIV + p_RIFV + p_RIAV)`
   - If only 1 modulation has a clear peak, use it (but lower SQI).
   - If 0 modulations have a clear peak, suppress output entirely.
   - Final BrPM = RR × 60.
   - Citation: Karlen et al. 2013 (smart fusion algorithm).

5. **Smoothing**:
   - Apply 3-point median filter over successive 30-second windows (overlap 50%) to reject outlier estimates.
   - Then EMA smoothing (α = 0.3) for display stability.

6. **Motion Rejection**:
   - If IMU motion_level > 0.5g, suppress respiratory rate output entirely — PPG modulations are corrupted by motion.
   - After motion subsides, require 15 seconds of clean data before resuming.
   - Citation: Charlton et al. 2018 — respiratory modulations are subtle and easily masked by motion.

7. **Output Gating**:
   - Clamp to 4–60 BrPM. Outside = physiologically implausible in resting/awake adults.
   - Require SQI > 0.4 to emit output.
   - Require ≥ 2 of 3 modulations contributing (otherwise SQI penalty).

### Alternative Methods
- **Method A**: FFT-based (Karlen et al. 2013, described above). Best accuracy when PPG quality is high. Requires 30s windows. **Recommended — default method.**
- **Method B**: Autocorrelation-based (Charlton et al. 2018). Compute autocorrelation of each modulation signal, find peak in [1–10 second] lag range. Lower computational cost, slightly less robust to noisy modulation signals. Good fallback for constrained MCU budgets.
- **Method C**: Count-based (zero-crossing counting of bandpass-filtered PPG baseline). Simplest. Count upward zero-crossings of the RIIV signal in the respiratory band [0.1–0.6 Hz]. Least accurate but minimal computation.

### Parameters

| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| Respiratory band low | 0.1 | Hz | 6 BrPM — lower limit for spontaneous breathing |
| Respiratory band high | 1.0 | Hz | 60 BrPM — upper limit (tachypnea) |
| Window length | 30 | s | ~5–10 breath cycles at normal rate (Karlen et al. 2013) |
| Window overlap | 50 | % | 15s step → update every 15s, smoothed to 10s display |
| Resample rate | 4 | Hz | Uniform grid for FFT of beat-synchronous modulations |
| Spectral prominence threshold | 0.15 | — | Reject modulation if peak not prominent (Karlen 2013) |
| EMA alpha (output smoothing) | 0.3 | — | Balance responsiveness and stability |
| Median filter depth | 3 | windows | Reject outlier windows |
| Motion threshold | 0.5 | g | Respiratory modulations easily corrupted by motion |
| Post-motion settle time | 15 | s | Conservative — respiratory modulations are subtle |
| BrPM clamp low | 4 | BrPM | Below = not spontaneous breathing |
| BrPM clamp high | 60 | BrPM | Above = sensor artifact or hyperventilation not measurable from PPG |
| Min peaks per window | 15 | beats | Need enough cardiac cycles for modulation extraction |
| SQI suppress threshold | 0.4 | — | Moderate — respiratory rate is inherently noisier than HR |
| PPG bandpass low | 0.5 | Hz | Cardiac rhythm isolation |
| PPG bandpass high | 4.0 | Hz | Covers up to 240 BPM |
| DC envelope alpha | 0.006 | — | ~0.1 Hz cutoff at 100 Hz sample rate |

### SQI Computation

SQI for respiratory rate is computed from four factors:

1. **Modulation Agreement** (30%): Concordance among the three respiratory estimates. If all three agree within ±2 BrPM → SQI 1.0. If spread > 8 BrPM → SQI 0.0.
   - `spread = max(f_RIIV, f_RIFV, f_RIAV) - min(f_RIIV, f_RIFV, f_RIAV)` (in BrPM)
   - `sqi_agree = clamp(1.0 - (spread - 2.0) / 6.0, 0.0, 1.0)`

2. **Spectral Prominence** (25%): Average prominence ratio across active modulations. Mean prominence > 0.3 → SQI 1.0, < 0.15 → SQI 0.0.
   - `sqi_prom = clamp((mean_prominence - 0.15) / 0.15, 0.0, 1.0)`

3. **Perfusion Index** (20%): PI of the PPG signal. PI > 1% → SQI 1.0, PI < 0.3% → SQI 0.0.
   - `sqi_pi = clamp((pi - 0.3) / 0.7, 0.0, 1.0)`

4. **Motion Level** (25%): From IMU. 0g → SQI 1.0, 0.5g → SQI 0.0.
   - `sqi_motion = clamp(1.0 - motion_g / 0.5, 0.0, 1.0)`

```
SQI = 0.30 * sqi_agree + 0.25 * sqi_prom + 0.20 * sqi_pi + 0.25 * sqi_motion
```
- **SQI Threshold**: 0.4 (Moderate — respiratory rate is inherently noisier than HR or SpO2)

### Power & Resources
- **Power Mode**: duty-cycled (reuses PPG data from A01 when running; computes on a 10–15 second cycle)
- **Expected Current Draw**: ~0.1 mA incremental (piggybacks on A01's PPG driver, only adds computation)
- **RAM Budget**: ~3 KB (3000 PPG samples down-processed to 120 beat-synchronous values × 3 modulations + FFT scratch)

## Validation
- **Validation Dataset**: CapnoBase (Karlen et al. 2010) — 42 subjects, simultaneous PPG + capnography reference
- **Accuracy Target**: MAE < 2 BrPM vs. capnography reference in the range 6–30 BrPM (resting)
- **Ground Truth Method**: Capnographic CO₂ waveform breath counting

## Output
- **Type**: AlgorithmOutput (value + sqi + timestamp + valid)
- **Unit**: BrPM (breaths per minute)
- **Valid Range**: 4–60 BrPM
- **Update Rate**: Every 10–15 seconds (overlapping 30s windows)
- **BLE Characteristic**: UUID `12345678-1234-5678-1234-56789abcdef4`
- **Zero means**: Insufficient signal quality, motion interference, or sensor off

## Display
- **Layout**: gauge
- **Primary**: number, "Resp Rate", "BrPM", decimals 0, range [4, 60]
- **Zones**: [{ min: 4, max: 10, color: "#3b82f6", label: "Low" }, { min: 10, max: 20, color: "#22c55e", label: "Normal" }, { min: 20, max: 30, color: "#f59e0b", label: "Elevated" }, { min: 30, max: 60, color: "#ef4444", label: "High" }]
- **Secondary**: [SQI bar, active modulation count (dev mode only)]
- **Chart**: line, 300 seconds, yRange [8, 30]
- **Card Size**: 1x1

## Edge Cases

| Condition | Behavior |
|-----------|----------|
| No tissue contact (DC < 1000) | Output 0, state = IDLE |
| Motion artifact (> 0.5g) | Suppress output; require 15s clean data to resume |
| < 15 peaks in 30s window | State = ACQUIRING, suppress output (HR too irregular or sensor settling) |
| Only 1 of 3 modulations clear | Use single estimate, SQI penalty (SQI ≤ 0.5) |
| 0 modulations clear | Suppress entirely |
| Respiratory rate very low (< 6 BrPM, e.g., deep meditation) | Accept if SQI > 0.6 — genuine bradypnea is physiologically possible |
| Respiratory rate very high (> 40 BrPM) | Accept if SQI > 0.5 — could be post-exercise tachypnea |
| Talking / sighing | Irregular breathing disrupts periodicity → SQI drops → may suppress |
| A01 not running (no peak data) | Cannot extract beat-synchronous modulations → fall back to Method C (zero-crossing) with SQI cap of 0.4 |
| Sleep (very low respiratory rate 8–14 BrPM) | Normal range — extend window to 45s if signal allows for better low-frequency resolution |

## Medical References

1. Karlen W, Raman S, Ansermino JM, Dumont GA, "Multiparameter Respiratory Rate Estimation from the Photoplethysmogram", IEEE Trans. Biomed. Eng., 2013. DOI: 10.1109/TBME.2013.2246160
2. Charlton PH, Birrenkott DA, Bonnici T, Clifton DA, et al., "Breathing Rate Estimation from the Electrocardiogram and Photoplethysmogram: A Review", IEEE Reviews in Biomedical Engineering, 2018. DOI: 10.1109/RBME.2017.2763681
3. Lázaro J, Gil E, Bailón R, Mincholé A, Laguna P, "Deriving Respiration from the Pulse Photoplethysmographic Signal", Computing in Cardiology, 2011.
4. Karlen W, Garde A, Myers D, Scheffer C, Ansermino JM, Dumont GA, "Estimation of Respiratory Rate from Photoplethysmographic Imaging Videos Compared to Pulse Oximetry", IEEE J. Biomed. Health Inform., 2015. DOI: 10.1109/JBHI.2014.2310823
5. Nilsson L, Johansson A, Kalman S, "Respiratory variations in the reflection mode photoplethysmographic signal", J. Clinical Monitoring and Computing, 2003. DOI: 10.1023/B:JOCM.0000004885.02752.0a

## Test Scenarios (Simulation)

| # | Scenario | Expected Output | Tolerance |
|---|----------|-----------------|-----------|
| 1 | Clean PPG, normal breathing 16 BrPM (0.267 Hz modulation) | 16 BrPM | ±2 BrPM |
| 2 | Slow deep breathing 8 BrPM | 8 BrPM | ±2 BrPM |
| 3 | Fast breathing 28 BrPM (post-exercise) | 28 BrPM | ±3 BrPM |
| 4 | No tissue contact (DC = 0) | Invalid, state = IDLE | exact |
| 5 | Motion artifact (0.8g for 10 seconds) | Suppressed during + 15s after | — |
| 6 | Only RIIV modulation present (RIFV and RIAV noisy) | Uses RIIV only, SQI ≤ 0.5 | ±3 BrPM |
| 7 | Gradual rate change 16 → 24 BrPM over 2 min | Tracks true trend | ±3 BrPM |
| 8 | Very low rate 5 BrPM (meditation) | 5 BrPM if SQI > 0.6 | ±2 BrPM |
| 9 | No clear respiratory peak in any modulation | Suppressed, SQI < 0.4 | — |
