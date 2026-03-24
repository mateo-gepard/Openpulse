# A06: Resting Heart Rate Trend

## Classification
- **Category**: health-biometric
- **Layer**: Base
- **Tier**: 3 (off-device — computed in the browser from accumulated daily resting HR values)
- **Regulatory**: Health Indicator
- **Priority**: P1 (v1.0)
- **Consumes**: A01 output (HR BPM values), A23 output (sleep/rest state), CH_ACCEL (indirectly — for rest detection)
- **Outputs**: float resting_hr_bpm (BPM), float rhr_7d_trend (BPM/day), float rhr_baseline (BPM)
- **Consumed by**: C01 (Recovery Score — resting HR component), C04 (Biological Age), X07 (Illness Warning — elevated RHR is early illness marker)

## Channel Input

| Channel | Sample Rate | Bit Depth | Purpose in This Algorithm |
|---------|-------------|-----------|---------------------------|
| CH_PPG (Green LED) | 100 Hz | 18-bit | Heart rate via A01 — not read directly by A06 |
| CH_ACCEL | 50 Hz | 16-bit | Rest detection (< 0.1g motion for ≥ 5 min) — via A23 or local threshold |

- **PPG Mode**: Green (inherited from A01)
- **Buffer Size**: N/A — Tier 3, operates on daily aggregated values stored in browser localStorage
- **Minimum data**: 3 days of resting HR samples before first trend output; 14 days for confident baseline

**Note**: A06 does NOT read raw sensor data. It consumes daily resting HR aggregates produced by the firmware (A01 + rest-detection logic). The firmware identifies rest periods (low motion + stable HR for ≥ 5 minutes) and transmits the median HR during those rest periods via BLE. A06 runs entirely in the browser, processing stored daily values.

## Algorithm

### Method

Resting heart rate (RHR) is the lowest stable HR during prolonged rest. Daily RHR is the most validated single biomarker for cardiovascular fitness and early illness detection. Trend analysis reveals overtraining, fitness adaptation, and impending illness.

1. **Daily RHR Estimation (firmware side — transmitted via BLE)**:
   - During each day, the firmware identifies rest windows: periods where IMU motion_level < 0.1g for ≥ 5 consecutive minutes AND A01 is producing valid output.
   - For each rest window, compute the median HR (more robust than mean against occasional artifacts).
   - Daily RHR = **lowest 5-minute median HR** in the 24-hour period.
   - Preferred window: 02:00–06:00 (deep sleep lowest HR) if sleep detection (A23) is available.
   - If no valid rest window detected (e.g., device not worn during sleep), mark day as missing.
   - Citation: Quer et al., "Wearable sensor data and self-reported symptoms for COVID-19 detection", Nature Medicine, 2021.

2. **Baseline Computation (browser side — A06 core)**:
   - **Short-term baseline (14-day)**: Exponential moving average of daily RHR values.
     `baseline_short[d] = α × RHR[d] + (1-α) × baseline_short[d-1]`, where α = 0.15.
   - **Long-term baseline (60-day)**: Median of the most recent 60 daily RHR values.
     `baseline_long = median(RHR[d-59 .. d])`
   - During days 1–3: display "Gathering baseline..." — insufficient data.
   - Days 4–13: use short-term baseline only, flag as "preliminary."
   - Day 14+: both baselines active and confident.
   - Citation: Oura Ring documentation (dual-horizon baseline model); Radin et al., "Harnessing wearable device data to improve state-level real-time surveillance of influenza-like illness", npj Digital Medicine, 2020.

3. **Trend Computation**:
   - 7-day trend: Linear regression slope (least-squares fit) over the most recent 7 daily RHR values.
     `trend_7d = slope of linear fit to [RHR[d-6], ..., RHR[d]]` in BPM/day.
   - A rising trend (> +0.5 BPM/day sustained for 3+ days) may indicate illness onset, overtraining, or accumulated stress.
   - A falling trend (< -0.3 BPM/day sustained for 2+ weeks) typically indicates improved cardiovascular fitness.
   - Citation: Quer et al. 2021; Javaid et al., "Medicine and the Rise of the Wearables", EMAJ, 2015.

4. **Anomaly Detection**:
   - Compute z-score of today's RHR relative to the 14-day baseline:
     `z = (RHR_today - baseline_short) / std_14d`
   - If |z| > 2.0 → flag as anomaly (significantly different from recent pattern).
   - If z > 2.0 for 2+ consecutive days → suggest possible illness or overtraining.
   - If z < -2.0 for 2+ consecutive days → suggest possible increased fitness or medication change.
   - Citation: Mishra et al., "Pre-symptomatic detection of COVID-19 from smartwatch data", Nature Biomedical Engineering, 2020.

5. **Missing Data Handling**:
   - If a day is missing (device not worn during sleep), skip that day in all computations.
   - Require ≥ 5 of the last 7 days to have valid RHR for trend computation.
   - If > 3 consecutive days missing, reset the short-term baseline on resumption (use the first new value as seed).

### Alternative Methods
- **Method A**: Lowest 5-minute median during sleep (described above). Most accurate — reflects true physiological resting state. **Recommended — requires A23 sleep detection or at minimum motion-based rest detection.**
- **Method B**: Morning wake-up HR (first 5-minute stable reading after waking). Slightly higher than Method A but easier to detect (first low-motion + stable HR after a sleep→wake transition). Good fallback if sleep detection is unavailable.
- **Method C**: 24-hour HR histogram — 5th percentile of all valid HR readings in 24 hours. Robust to activity contamination but may include some non-resting samples. Simplest to implement.

### Parameters

| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| Rest detection motion threshold | 0.1 | g | Very low motion for true rest (Quer et al. 2021) |
| Minimum rest window | 5 | min | At least 5 min continuous rest for reliable RHR |
| Preferred rest time | 02:00–06:00 | hours | Deep sleep window for lowest HR |
| Short-term baseline α | 0.15 | — | ~7 effective day window (similar to Oura) |
| Long-term baseline window | 60 | days | Captures seasonal and fitness adaptation |
| Trend regression window | 7 | days | Balanced: responsive to changes, not too noisy |
| Anomaly z-score threshold | 2.0 | σ | 2σ = ~5% chance of false positive per day |
| Rising trend threshold | +0.5 | BPM/day | Sustained rise suggests illness/overtraining |
| Falling trend threshold | -0.3 | BPM/day | Sustained drop suggests fitness improvement |
| Min days for first output | 3 | days | Need ≥ 3 points before showing any trend |
| Min days for confident baseline | 14 | days | Short-term EMA is reasonably converged |
| Min valid days for 7-day trend | 5 | days | Require 5 of 7 days with data |
| BPM clamp low | 30 | BPM | Below = sensor error or severe bradycardia (athletes: 30–40 is possible) |
| BPM clamp high | 120 | BPM | Resting HR above 120 is rare — likely not truly resting |

### SQI Computation

SQI for resting HR trend is computed per-day from the quality of the underlying rest-period HR data:

1. **Rest Window Duration** (40%): Longer rest windows with stable HR yield better RHR estimates. ≥ 30 min → SQI 1.0, < 5 min → SQI 0.0.
   - `sqi_duration = clamp((rest_minutes - 5) / 25, 0.0, 1.0)`

2. **HR Stability During Rest** (30%): CV (coefficient of variation) of HR during the selected rest window. CV < 3% → SQI 1.0, CV > 10% → SQI 0.0.
   - `sqi_stability = clamp(1.0 - (cv_hr - 0.03) / 0.07, 0.0, 1.0)`

3. **Data Completeness** (30%): Fraction of the last 7 days with valid RHR values. 7/7 → SQI 1.0, 3/7 → SQI 0.0.
   - `sqi_completeness = clamp((valid_days - 3) / 4, 0.0, 1.0)`

```
SQI_daily = 0.40 * sqi_duration + 0.30 * sqi_stability + 0.30 * sqi_completeness
```
- **SQI Threshold**: 0.3 (Low threshold — even rough RHR estimates have trend value over days)

### Power & Resources
- **Power Mode**: Tier 3 — off-device. Zero MCU power (firmware only transmits the daily RHR aggregate via BLE, which is a byproduct of A01 + rest detection).
- **Expected Current Draw**: 0 mA (browser computation only)
- **RAM Budget**: N/A (runs in browser JS). Firmware: ~64 bytes for daily RHR accumulator (median of 5-min windows).

## Validation
- **Validation Dataset**: Fitbit Research Dataset (Quer et al. 2021) — wearable RHR vs. self-reported illness; UCSF TemPredict Study (Mishra et al. 2020) — wearable RHR anomalies predicting pre-symptomatic COVID-19
- **Accuracy Target**: Daily RHR within ±3 BPM of polysomnography-derived resting HR; Trend detection: sensitivity > 80% for illness-onset RHR elevation (z > 2.0 for 2+ days) vs. self-reported illness within 3 days
- **Ground Truth Method**: Clinical resting HR measurement (supine, 5-min average, morning protocol) or polysomnography HR during N3 sleep

## Output
- **Type**: AlgorithmOutput (multi-output — see Output Metrics below)
- **Unit**: BPM (resting heart rate), BPM/day (trend slope)
- **Valid Range**: RHR 30–120 BPM; Trend -5.0 to +5.0 BPM/day
- **Update Rate**: Once per day (after new daily RHR value arrives)
- **BLE Characteristic**: UUID `12345678-1234-5678-1234-56789abcdef6`
- **Zero means**: Insufficient data or no valid rest periods detected today

### Output Metrics

| Metric | Type | Unit | Range | Primary? |
|--------|------|------|-------|----------|
| resting_hr_bpm | float | BPM | 30–120 | ✅ (getOutput) |
| rhr_7d_trend | float | BPM/day | -5.0 to +5.0 | secondary |
| rhr_baseline_short | float | BPM | 30–120 | secondary |
| rhr_baseline_long | float | BPM | 30–120 | secondary |
| anomaly_z_score | float | σ | -5.0 to +5.0 | secondary |
| data_days | int | days | 0–365 | secondary |

## Display
- **Layout**: timeline
- **Primary**: number, "Resting HR", "BPM", decimals 0, range [40, 100]
- **Zones**: [{ min: 40, max: 50, color: "#3b82f6", label: "Athletic" }, { min: 50, max: 65, color: "#22c55e", label: "Excellent" }, { min: 65, max: 75, color: "#a3e635", label: "Good" }, { min: 75, max: 85, color: "#f59e0b", label: "Above Average" }, { min: 85, max: 100, color: "#ef4444", label: "Elevated" }]
- **Secondary**: [7-day trend arrow (↑/→/↓ with BPM/day value), baseline line on chart, anomaly badge if |z| > 2.0]
- **Chart**: line, 30 days (one point per day), yRange [auto ± 10 BPM around baseline]
- **Card Size**: 2x1

## Edge Cases

| Condition | Behavior |
|-----------|----------|
| Device not worn during sleep (no rest window) | Mark day as missing; skip in baseline/trend calculations |
| Only 1–2 days of data | Show today's RHR number; suppress trend and baseline ("Gathering baseline...") |
| 3–13 days of data | Show RHR + preliminary trend; flag baseline as "preliminary" |
| 14+ days | Full confidence — show all metrics |
| > 3 consecutive missing days | Reset short-term baseline on next valid day (seed with new value) |
| Athlete with very low RHR (35 BPM) | Accept — within valid range. Zone shows "Athletic" |
| Sudden RHR spike (+10 BPM vs baseline) | Anomaly detection fires (z > 2.0); show alert badge; do NOT diagnose illness |
| Gradual RHR decline over weeks | Show falling trend; suggest fitness improvement in UI context |
| User wearing device during naps only | Use nap data for RHR; may be slightly higher than sleep RHR — still useful |
| Irregular HR (AFib episodes) | Median filtering during rest windows reduces impact; RHR may be higher/noisier |
| Timezone change / travel | Daily boundary shifts; may cause one day with unusual rest timing — handle gracefully |

## Medical References

1. Quer G, Gouda P, Galarnyk M, Topol EJ, Steinhubl SR, "Inter- and intraindividual variability in daily resting heart rate and its associations with age, sex, sleep, BMI, and time of year", PLOS ONE, 2020. DOI: 10.1371/journal.pone.0227709
2. Quer G, Radin JM, Gadaleta M, et al., "Wearable sensor data and self-reported symptoms for COVID-19 detection", Nature Medicine, 2021. DOI: 10.1038/s41591-020-1123-x
3. Mishra T, Wang M, Metwally AA, et al., "Pre-symptomatic detection of COVID-19 from smartwatch data", Nature Biomedical Engineering, 2020. DOI: 10.1038/s41551-020-00640-6
4. Radin JM, Wineinger NE, Topol EJ, Steinhubl SR, "Harnessing wearable device data to improve state-level real-time surveillance of influenza-like illness in the USA", npj Digital Medicine, 2020. DOI: 10.1038/s41746-019-0212-5
5. Reimers AK, Knapp G, Reimers CD, "Does physical activity increase life expectancy? A review of the literature", Journal of Aging Research, 2012. DOI: 10.1155/2012/243958

## Test Scenarios (Simulation)

| # | Scenario | Expected Output | Tolerance |
|---|----------|-----------------|-----------|
| 1 | 14 days of stable RHR at 62 BPM | RHR: 62, trend: ~0.0, baseline: 62 | ±2 BPM, trend ±0.2 |
| 2 | Day 1 only — single RHR value 70 BPM | RHR: 70, trend: null, baseline: "preliminary" | exact |
| 3 | 7 days with gradual rise (60, 61, 62, 63, 64, 65, 66) | Trend: +1.0 BPM/day | ±0.3 BPM/day |
| 4 | Sudden spike: baseline 60, today 75 | z-score > 2.0, anomaly flagged | — |
| 5 | 3 consecutive missing days, then new value | Reset short-term baseline, use new value as seed | — |
| 6 | Athlete: RHR consistently 38 BPM | RHR: 38, zone "Athletic", no anomaly | ±2 BPM |
| 7 | Fitness progression: 75 → 65 over 8 weeks | Falling trend visible on chart, negative slope | trend < -0.1 |
| 8 | No rest periods detected (constant motion) | Day marked missing, no RHR output | exact |
| 9 | Mixed: 5 valid days + 2 missing in 7-day window | Trend computed from 5 valid days, SQI slightly lower | ±0.5 BPM/day |
