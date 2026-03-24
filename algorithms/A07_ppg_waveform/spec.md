# A07: PPG Waveform Analysis

## Classification
- **Category**: health-biometric
- **Layer**: Base
- **Tier**: 1 (periodic — computed once per cardiac cycle)
- **Regulatory**: Health Indicator
- **Priority**: P1 (v1.0)
- **Consumes**: CH_PPG, CH_ACCEL
- **Outputs**: float stiffness_index (m/s), float reflection_index (%), float sdppg_agi (a.u.), float augmentation_index (%)
- **Consumed by**: A08 (Vascular Age), X02 (Arterial Stiffness), C05 (Cardiovascular Age)

## Channel Input

| Channel | Sample Rate | Bit Depth | Purpose in This Algorithm |
|---------|-------------|-----------|---------------------------|
| CH_PPG (Green LED) | 200 Hz | 18-bit | High-resolution waveform for morphology analysis |
| CH_ACCEL | 50 Hz | 16-bit | Motion artifact rejection |

- **PPG Mode**: Green

## Algorithm

### Method

1. **Preprocessing**:
   - Bandpass filter: 4th-order Butterworth, 0.5–8.0 Hz at 200 Hz sample rate. Wider bandwidth than HR to preserve waveform morphology (dicrotic notch, diastolic peak).
   - DC removal via high-pass at 0.1 Hz.
   - Motion rejection: if IMU motion_level > 0.3g, defer analysis (waveform features are motion-sensitive).

2. **Beat Segmentation**:
   - Use A01 peak detection timestamps (systolic peaks) to segment individual beats.
   - Extract one cardiac cycle: from current systolic peak (S) to next systolic peak (S+1).
   - Require at least 150 samples per beat at 200 Hz (max HR = 80 BPM for morphology analysis). At higher HR, skip morphology.
   - Normalize each beat to unit amplitude and unit time for shape comparison.

3. **Feature Extraction — First Derivative (PPG' and SDPPG)**:
   - Compute first derivative (velocity PPG, VPG): `PPG'[n] = (PPG[n+1] - PPG[n-1]) / (2/fs)`
   - Compute second derivative (acceleration PPG, APG/SDPPG): `PPG''[n] = (PPG'[n+1] - PPG'[n-1]) / (2/fs)`
   - Identify SDPPG waves a, b, c, d, e per Takazawa et al. 1998:
     - **a-wave**: Initial positive peak (early systole)
     - **b-wave**: Initial negative trough (late systole deceleration)
     - **c-wave**: Re-acceleration peak (late systole)
     - **d-wave**: Late deceleration trough (early diastole)
     - **e-wave**: Diastolic positive peak
   - Citation: Takazawa K et al. "Assessment of Vasoactive Agents and Vascular Aging by the Second Derivative of the Photoplethysmogram Waveform", Hypertension, 1998.

4. **Feature Extraction — Waveform Morphology**:
   - **Dicrotic Notch (DN)**: Locate as the local minimum between systolic and diastolic peaks in the original PPG waveform. Use zero-crossing of VPG after the systolic peak.
   - **Diastolic Peak (D)**: Local maximum after DN. May be absent in stiff arteries.
   - **Stiffness Index (SI)**: `SI = body_height / ΔTSD` where ΔTSD = time from systolic peak (S) to diastolic peak (D). Units: m/s. Millasseau et al. 2002.
   - **Reflection Index (RI)**: `RI = (D_amplitude / S_amplitude) × 100`. The ratio of diastolic to systolic peak heights. Units: %.
   - **Aging Index (AGI)**: `AGI = (b - c - d - e) / a` from SDPPG wave amplitudes. Takazawa 1998. Increases with age and arterial stiffness.
   - **Augmentation Index (AIx)**: `AIx = (P2 - P1) / PP × 100` where P1 = first systolic shoulder, P2 = peak systolic, PP = pulse pressure. Kelly et al. 1989.

5. **Output Gating**:
   - Require SQI > 0.5 to report waveform features.
   - If dicrotic notch not detectable (flat waveform), set SI = NaN, RI = 0%, and flag `notch_absent = true`.
   - If motion > 0.3g, defer analysis and hold last valid values for up to 10 seconds.
   - Average features over 8 beats before reporting (reduce beat-to-beat variability).

### Alternative Methods
- **Method A**: Template-Based Morphology (Charlton et al. 2024, pyPPG). Fit each beat to a library of PPG templates representing different vascular states. Robust but computationally expensive for MCU. Recommended for Tier 3 analysis.
- **Method B**: Gaussian Decomposition (Baruch et al. 2011). Model each PPG beat as a sum of 3-5 Gaussian curves. Provides clean separation of systolic and reflected waves. Too expensive for Tier 0-1.

### Parameters

| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| Bandpass low | 0.5 | Hz | Preserve waveform baseline |
| Bandpass high | 8.0 | Hz | Preserve dicrotic notch harmonics (Millasseau 2002) |
| Sample rate required | 200 | Hz | Minimum for notch detection (Allen 2007) |
| Max HR for morphology | 120 | BPM | Above this, beat too short for reliable notch detection |
| Beat average window | 8 | beats | Reduce beat-to-beat variability |
| Motion rejection threshold | 0.3 | g | Waveform morphology is motion-sensitive |
| Min beat samples | 150 | samples | At 200 Hz = 750ms = max ~80 BPM for full analysis |
| Body height default | 1.70 | m | Used for SI if user profile not set |
| SQI suppress threshold | 0.5 | — | Higher than HR — morphology needs clean signal |

### SQI Computation

SQI for PPG Waveform is computed from three factors:

1. **Perfusion Index** (30%): From A09. PI > 1% → SQI 1.0, PI < 0.2% → SQI 0.0.
   - `sqi_pi = clamp((pi - 0.2) / 0.8, 0.0, 1.0)`

2. **Waveform Morphology Consistency** (40%): Cross-correlation between consecutive beats. CC > 0.95 → SQI 1.0, CC < 0.7 → SQI 0.0.
   - `sqi_cc = clamp((cc - 0.7) / 0.25, 0.0, 1.0)`

3. **Motion Level** (30%): From IMU. 0g → SQI 1.0, 0.3g → SQI 0.0.
   - `sqi_motion = clamp(1.0 - motion_g / 0.3, 0.0, 1.0)`

```
SQI = 0.3 * sqi_pi + 0.4 * sqi_cc + 0.3 * sqi_motion
```
- **SQI Threshold**: 0.5 (morphology analysis is sensitive to noise)

### Power & Resources
- **Power Mode**: continuous (runs alongside HR whenever PPG active)
- **Expected Current Draw**: 0 mA additional (uses same PPG data as A01, upgraded to 200 Hz)
- **RAM Budget**: ~3 KB (512 samples at 200 Hz for two beat windows + derivative arrays + feature accumulators)

## Validation
- **Validation Dataset**: Vortal database (Charlton et al., finger PPG with simultaneous arterial tonometry)
- **Accuracy Target**: Stiffness Index correlation r ≥ 0.80 vs. carotid-femoral PWV; AGI age-group trend matches Takazawa 1998 published norms

## Output
- **Type**: AlgorithmOutput (primary: stiffness_index) + secondary getters for RI, AGI, AIx
- **Unit**: m/s (SI), % (RI, AIx), a.u. (AGI)
- **Valid Range**: SI: 5–20 m/s, RI: 0–100%, AGI: -1.5–1.5, AIx: -20–60%
- **Update Rate**: Per 8-beat window (~5–15 seconds)
- **BLE Characteristic**: UUID `12345678-1234-5678-1234-56789abcdef7`
- **Zero means**: Insufficient signal quality or motion interference

## Display
- **Layout**: multi-metric
- **Metrics**: [{ key: "si", label: "Stiffness Index", unit: "m/s", range: [5, 20] }, { key: "ri", label: "Reflection Index", unit: "%", range: [0, 100] }, { key: "agi", label: "Aging Index", unit: "", range: [-1.5, 1.5] }, { key: "aix", label: "Augmentation Idx", unit: "%", range: [-20, 60] }]
- **Primary**: "si"
- **Secondary**: [SQI bar, waveform mini-plot]
- **Chart**: line (SI trend over 5 minutes), windowSeconds: 300
- **Card Size**: 2x1

## Edge Cases

| Condition | Behavior |
|-----------|----------|
| No tissue contact | Output 0 for all metrics, state = IDLE |
| Motion artifact (>0.3g) | Defer analysis, hold last valid up to 10s, then suppress |
| HR > 120 BPM | Disable full morphology (beat too short); report PI only |
| Dicrotic notch absent | SI = invalid, RI = 0%, flag notch_absent. Common in elderly/stiff arteries |
| Very low perfusion (PI < 0.2%) | Suppress — waveform morphology unreliable at low amplitude |
| Sensor saturation (ADC clipped) | SQI = 0, suppress all outputs |
| Irregular rhythm (AFib — variable beat lengths) | Average over more beats (16 instead of 8), increase tolerance |
| User height unknown | Use 1.70m default for SI; flag "Set height for accurate SI" |

## Medical References

1. Takazawa K et al., "Assessment of Vasoactive Agents and Vascular Aging by the Second Derivative of the Photoplethysmogram Waveform", Hypertension, 1998. DOI: 10.1161/01.HYP.32.2.365
2. Millasseau SC et al., "Contour analysis of the photoplethysmographic pulse measured at the finger", J Hypertens, 2006. DOI: 10.1097/01.hjh.0000209993.32839.4d
3. Charlton PH et al., "Assessing hemodynamics from the photoplethysmogram to gain insights into vascular age: a review from VascAgeNet", Am J Physiol Heart Circ Physiol, 2022. DOI: 10.1152/ajpheart.00392.2021
4. Allen J, "Photoplethysmography and its application in clinical physiological measurement", Physiological Measurement, 2007. DOI: 10.1088/0967-3334/28/3/R01
5. Charlton PH et al., "pyPPG: A Python toolbox for comprehensive photoplethysmography signal analysis", Physiological Measurement, 2024.
6. Kelly R, Hayward C, Avolio A, O'Rourke M, "Noninvasive determination of age-related changes in the human arterial pulse", Circulation, 1989. DOI: 10.1161/01.CIR.80.6.1652

## Test Scenarios (Simulation)

| # | Scenario | Expected Output | Tolerance |
|---|----------|-----------------|-----------|
| 1 | Clean PPG, healthy 30yo, HR 70 BPM | SI ~6.5 m/s, RI ~55%, AGI ~ -0.5 | SI ±1.0, RI ±10%, AGI ±0.3 |
| 2 | Clean PPG, elderly 70yo, HR 65 BPM | SI ~12 m/s, RI ~30%, AGI ~0.8 | SI ±2.0, RI ±10%, AGI ±0.3 |
| 3 | During exercise, HR 140 BPM | Morphology suppressed (HR > 120) | — |
| 4 | No tissue contact | All 0, state = IDLE | exact |
| 5 | Motion burst (0.5g, 3 seconds) | Holds last valid, then suppresses | — |
| 6 | Low perfusion (PI = 0.1%) | Suppressed — below 0.2% threshold | — |
| 7 | Absent dicrotic notch (stiff arteries) | SI = invalid, RI = 0%, notch_absent flag | — |
| 8 | Gradual vascular change (SI 7→10 over 5 min) | Tracks trend | SI ±1.5 |
