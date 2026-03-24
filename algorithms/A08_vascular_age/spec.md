# A08: Vascular Age

## Classification
- **Category**: health-biometric
- **Layer**: Base
- **Tier**: 2 (on-demand — user-triggered measurement requiring 30s of stillness)
- **Regulatory**: Health Screening
- **Priority**: P1 (v1.0)
- **Consumes**: CH_PPG, CH_ACCEL (via A07 — PPG Waveform Analysis outputs)
- **Outputs**: float vascular_age_years (years), float vascular_age_offset (years)
- **Consumed by**: C04 (Biological Age), C05 (Cardiovascular Age), C08 (Health Report)

## Channel Input

| Channel | Sample Rate | Bit Depth | Purpose in This Algorithm |
|---------|-------------|-----------|---------------------------|
| CH_PPG (Green LED) | 200 Hz | 18-bit | High-resolution waveform morphology via A07 |
| CH_ACCEL | 50 Hz | 16-bit | Stillness enforcement — vascular age requires motionless subject |

- **PPG Mode**: Green
- **Buffer Size**: N/A — A08 consumes A07's per-beat outputs, not raw PPG
- **Minimum data**: 30 seconds of clean A07 data (30+ beats at rest) + user profile (chronological age, sex, height)

**Note**: A08 does NOT process raw PPG directly. It reads the waveform morphology features produced by A07 (Stiffness Index, Reflection Index, SDPPG Aging Index, Augmentation Index) and maps them to a vascular age estimate using age-normative reference curves.

## Algorithm

### Method

Vascular age reflects the functional age of the arterial system. It is estimated by comparing the user's PPG-derived arterial stiffness markers against population-normative reference curves stratified by age and sex. A user with stiffer arteries than expected for their chronological age has a higher vascular age (and vice versa).

1. **Input Collection (from A07)**:
   - Read the latest averaged values (8-beat window) from A07:
     - `SI` — Stiffness Index (m/s): primary marker of pulse wave velocity
     - `RI` — Reflection Index (%): ratio of diastolic to systolic amplitude
     - `AGI` — SDPPG Aging Index (a.u.): second-derivative waveform aging marker
     - `AIx` — Augmentation Index (%): pressure augmentation from wave reflection
   - Require A07 SQI > 0.5 for all inputs.
   - Accumulate 30 seconds of A07 outputs (≥ 4 valid 8-beat windows) and take the median of each feature to reduce beat-to-beat and window-to-window noise.
   - Citation: Charlton PH et al., "Assessing hemodynamics from the photoplethysmogram to gain insights into vascular age", Am J Physiol, 2022.

2. **User Profile**:
   - Required: chronological age (years), sex (M/F), height (cm).
   - Height is needed for Stiffness Index calculation in A07 (`SI = height / ΔTSD`).
   - If user profile is incomplete, prompt "Set your profile for vascular age" and suppress output.

3. **Age-Normative Lookup Tables**:
   - Reference data from published population studies (Takazawa 1998, Millasseau 2006, Charlton 2022) provides expected values of SI, AGI, and AIx at each decade of life, stratified by sex.
   - Simplified reference table (from aggregated literature values):

   **Stiffness Index (SI) norms — units: m/s**:

   | Age Decade | Male (mean ± SD) | Female (mean ± SD) |
   |------------|-------------------|--------------------|
   | 20–29 | 6.0 ± 0.8 | 5.8 ± 0.7 |
   | 30–39 | 6.8 ± 1.0 | 6.5 ± 0.9 |
   | 40–49 | 7.8 ± 1.2 | 7.4 ± 1.1 |
   | 50–59 | 9.0 ± 1.4 | 8.5 ± 1.3 |
   | 60–69 | 10.5 ± 1.6 | 10.0 ± 1.5 |
   | 70–79 | 12.0 ± 1.8 | 11.5 ± 1.7 |

   **SDPPG Aging Index (AGI) norms — units: a.u.**:

   | Age Decade | Mean ± SD |
   |------------|-----------|
   | 20–29 | -0.7 ± 0.3 |
   | 30–39 | -0.4 ± 0.3 |
   | 40–49 | -0.1 ± 0.3 |
   | 50–59 | 0.2 ± 0.3 |
   | 60–69 | 0.5 ± 0.4 |
   | 70–79 | 0.8 ± 0.4 |

   Citation: Takazawa 1998 (AGI norms); Millasseau 2006 (SI norms); values simplified and aggregated.

4. **Vascular Age Estimation — Multi-Feature Z-Score Approach**:
   - For each feature (SI and AGI — the two most age-predictive markers), compute the user's z-score relative to their chronological age decade:
     `z_SI = (SI_measured - SI_mean_for_age) / SI_sd_for_age`
     `z_AGI = (AGI_measured - AGI_mean_for_age) / AGI_sd_for_age`
   - Composite z-score: `z_vasc = 0.6 × z_SI + 0.4 × z_AGI`
     (SI weighted more heavily — it has stronger correlation with gold-standard cfPWV; Millasseau 2006)
   - Map z-score to vascular age offset using the reference curve slope:
     - Compute the slope of the mean feature vs. age curve (approximately linear over 20–70 range).
     - SI slope ≈ 0.12 m/s per year; AGI slope ≈ 0.03 per year.
     - `vascular_age_offset = z_vasc × 10` years (1 SD ≈ approximately one decade of vascular aging)
   - `vascular_age = chronological_age + vascular_age_offset`
   - Clamp: vascular_age ∈ [chronological_age - 20, chronological_age + 30]. Offsets beyond this are physiologically implausible and likely measurement error.
   - Citation: Charlton 2022 (VascAgeNet framework for PPG-derived vascular age).

5. **Confidence and Averaging**:
   - Compute the standard deviation of SI and AGI across the 30-second measurement session.
   - If `CV_SI > 15%` or `CV_AGI > 30%`, the measurement is too variable — request user to remain still and retry.
   - Report confidence interval: `CI_95 = vascular_age ± (2 × SD_offset)` where SD_offset is derived from feature variability.

6. **Output Gating**:
   - Require A07 SQI > 0.5 consistently for the 30-second window.
   - Require motion_level < 0.1g throughout (vascular age measurement needs stillness).
   - If user profile incomplete → suppress with message "Profile required."
   - If chronological age < 18 or > 85 → flag "Reference data limited for this age range."

### Alternative Methods
- **Method A**: Multi-feature z-score with population norms (described above). Uses SI + AGI from A07. **Recommended — best balance of accuracy and interpretability.**
- **Method B**: Machine-learning regression. Train a model (ridge regression or random forest) on features [SI, RI, AGI, AIx, HR, height, sex] → vascular age. Requires a training dataset with paired PPG + reference vascular age (carotid-femoral PWV or arterial tonometry). More accurate when trained, but needs offline dataset. Recommended for Tier 3 refinement.
- **Method C**: SI-only estimation. Use only Stiffness Index and the SI vs. age curve to estimate vascular age. Simpler, but ignores waveform shape information. Appropriate when A07 cannot reliably detect SDPPG waves (noisy signal).

### Parameters

| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| SI weight in composite z | 0.6 | — | SI has stronger cfPWV correlation (Millasseau 2006) |
| AGI weight in composite z | 0.4 | — | AGI captures waveform shape changes (Takazawa 1998) |
| Measurement window | 30 | s | ≥ 30 beats of clean data |
| Min A07 windows required | 4 | 8-beat windows | 4 × 8 = 32 beats minimum |
| Motion threshold (stillness) | 0.1 | g | Vascular measurement requires motionless subject |
| A07 SQI requirement | 0.5 | — | Quality threshold for input data |
| Vascular age offset clamp low | -20 | years | Below = measurement error |
| Vascular age offset clamp high | +30 | years | Above = measurement error |
| SI variability max (CV) | 15 | % | Beyond = retry measurement |
| AGI variability max (CV) | 30 | % | Beyond = retry measurement |
| Min chronological age | 18 | years | Reference curves validated for adults |
| Max chronological age | 85 | years | Reference curves limited beyond 85 |
| Default height | 1.70 | m | Used if user profile missing height |

### SQI Computation

SQI for Vascular Age is computed from three factors:

1. **A07 Input Quality** (40%): Mean SQI from A07 across the measurement window. A07 SQI > 0.8 → SQI 1.0, A07 SQI < 0.5 → SQI 0.0.
   - `sqi_input = clamp((mean_a07_sqi - 0.5) / 0.3, 0.0, 1.0)`

2. **Feature Stability** (35%): Inverse of the combined CV of SI and AGI. Low variability → high SQI. CV < 5% → SQI 1.0, CV > 15% → SQI 0.0.
   - `cv_combined = 0.6 * cv_SI + 0.4 * cv_AGI`
   - `sqi_stability = clamp(1.0 - (cv_combined - 0.05) / 0.10, 0.0, 1.0)`

3. **Stillness** (25%): Maximum motion during the 30s window. 0g → SQI 1.0, 0.1g → SQI 0.0.
   - `sqi_stillness = clamp(1.0 - max_motion_g / 0.1, 0.0, 1.0)`

```
SQI = 0.40 * sqi_input + 0.35 * sqi_stability + 0.25 * sqi_stillness
```
- **SQI Threshold**: 0.5 (Moderate-high — vascular age is a health-screening metric and should only be shown with reasonable confidence)

### Power & Resources
- **Power Mode**: on-demand (activated by user request; runs A07 at 200 Hz for 30 seconds, then stops)
- **Expected Current Draw**: ~0.6 mA during measurement (PPG at 200 Hz), 0 mA idle
- **RAM Budget**: ~512 bytes (stores median values of 4 features across 4 A07 windows + z-score accumulators). Most computation is in A07.

## Validation
- **Validation Dataset**: Vortal database (Charlton et al., finger PPG + simultaneous arterial tonometry and carotid-femoral PWV)
- **Accuracy Target**: Vascular age estimate within ±5 years of cfPWV-derived vascular age in 70% of subjects; correlation r ≥ 0.75 between PPG vascular age and cfPWV vascular age
- **Ground Truth Method**: Carotid-femoral pulse wave velocity (cfPWV) measured by SphygmoCor or Complior device — the gold-standard measure of arterial stiffness

## Output
- **Type**: CalibratedOutput (value + ci_low + ci_high + sqi + timestamp + valid + calibrated + calibration_age_ms)
- **Unit**: years (vascular age)
- **Valid Range**: 10–115 years (chronological age ± clamped offset)
- **Update Rate**: Once per 30-second measurement session (on-demand)
- **BLE Characteristic**: UUID `12345678-1234-5678-1234-56789abcdef8`
- **Zero means**: Measurement not taken or insufficient signal quality

### Output Metrics

| Metric | Type | Unit | Range | Primary? |
|--------|------|------|-------|----------|
| vascular_age_years | float | years | 10–115 | ✅ (getOutput) |
| vascular_age_offset | float | years | -20–+30 | secondary |
| z_score_composite | float | σ | -4.0–+4.0 | secondary (dev mode) |
| confidence_interval | float | years | 0–15 | secondary |

## Display
- **Layout**: gauge
- **Primary**: number, "Vascular Age", "years", decimals 0, range [chronological_age - 20, chronological_age + 30]
- **Zones**: [{ min: -20, max: -5, color: "#22c55e", label: "Younger" }, { min: -5, max: 5, color: "#3b82f6", label: "On Track" }, { min: 5, max: 15, color: "#f59e0b", label: "Older" }, { min: 15, max: 30, color: "#ef4444", label: "Elevated" }]
- **Note**: Zones are relative to chronological_age offset, not absolute vascular age
- **Secondary**: [SQI bar, offset badge ("+5 years" / "-3 years"), last measurement timestamp]
- **Chart**: scatter (one point per measurement session), 90 days, yRange [auto]
- **Card Size**: 1x1
- **Disclaimer**: "This is not a medical device. Consult a healthcare provider for medical decisions."

## Edge Cases

| Condition | Behavior |
|-----------|----------|
| A07 not running or unavailable | Cannot compute — display "Start PPG Waveform first" |
| A07 SQI consistently < 0.5 | "Signal too noisy — ensure still contact" |
| Motion during measurement (> 0.1g) | Abort measurement, request user to remain still |
| User profile missing (no age/sex/height) | Suppress output: "Set your profile in Settings for vascular age" |
| Chronological age < 18 | Suppress: "Vascular age reference data is for adults (18+)" |
| Chronological age > 85 | Compute but flag: "Reference data limited beyond 85 years" |
| Dicrotic notch absent (A07 flag) | Fall back to AGI-only estimation (Method C variant), lower confidence |
| SI or AGI outside reference table range | Clamp z-score to ±3.0 to limit extreme offset estimates |
| Very high feature variability (CV > threshold) | "Measurement unstable — please remain completely still and retry" |
| Cold hands / low perfusion | A07 suppresses → A08 cannot compute. Show "Warm hands and retry" |
| HR > 120 BPM (A07 disables morphology) | Cannot compute SI — "Wait until resting HR before measuring" |
| Multiple measurements in same day | Show most recent; store all for trend chart |

## Medical References

1. Charlton PH, Birch AA, Fasano A, et al., "Assessing hemodynamics from the photoplethysmogram to gain insights into vascular age: a review from VascAgeNet", Am J Physiol Heart Circ Physiol, 2022. DOI: 10.1152/ajpheart.00392.2021
2. Takazawa K, Tanaka N, Fujita M, et al., "Assessment of Vasoactive Agents and Vascular Aging by the Second Derivative of the Photoplethysmogram Waveform", Hypertension, 1998. DOI: 10.1161/01.HYP.32.2.365
3. Millasseau SC, Kelly RP, Ritter JM, Chowienczyk PJ, "Determination of age-related increases in large artery stiffness by digital pulse contour analysis", Clin Sci, 2002. DOI: 10.1042/cs1030371
4. Millasseau SC, Ritter JM, Takazawa K, Chowienczyk PJ, "Contour analysis of the photoplethysmographic pulse measured at the finger", J Hypertens, 2006. DOI: 10.1097/01.hjh.0000209993.32839.4d
5. Laurent S, Cockcroft J, Van Bortel L, et al., "Expert consensus document on arterial stiffness", Eur Heart J, 2006. DOI: 10.1093/eurheartj/ehl254
6. Reference Values for Arterial Stiffness Collaboration, "Determinants of pulse wave velocity in healthy people and in the presence of cardiovascular risk factors", Eur Heart J, 2010. DOI: 10.1093/eurheartj/ehq165

## Test Scenarios (Simulation)

| # | Scenario | Expected Output | Tolerance |
|---|----------|-----------------|-----------|
| 1 | Healthy 30yo male, SI=6.8, AGI=-0.4, at rest | Vascular age ~30, offset ~0 | ±5 years |
| 2 | Healthy 30yo with stiff arteries, SI=9.5, AGI=0.3 | Vascular age ~50, offset ~+20 | ±5 years |
| 3 | Fit 60yo, SI=8.0, AGI=-0.1 | Vascular age ~45, offset ~-15 | ±5 years |
| 4 | A07 unavailable | Output invalid, message: "Start PPG Waveform first" | exact |
| 5 | Motion during measurement (0.3g burst) | Measurement aborted, request stillness | — |
| 6 | User profile missing | Output suppressed, message: "Set your profile" | exact |
| 7 | Age 16 (below reference range) | Output suppressed, message: "Adults only" | exact |
| 8 | Noisy session (CV_SI = 20%) | Measurement rejected, request retry | — |
| 9 | Dicrotic notch absent (elderly) | AGI-only fallback, wider confidence interval | ±8 years |
