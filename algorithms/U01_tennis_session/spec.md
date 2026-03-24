# U01: Tennis Session Analytics

## Classification
- **Category**: sport-motion
- **Layer**: Base
- **Tier**: 1 (periodic)
- **Regulatory**: Sport Performance
- **Priority**: P2 (v2.0)
- **Consumes**: CH_ACCEL, CH_GYRO
- **Outputs**: float stroke_count (strokes), float last_stroke_type (enum), float last_swing_speed (km/h)
- **Consumed by**: none

## Channel Input

Algorithms are hardware-agnostic. Declare ONLY the abstract data channels — NEVER chip names, puck positions, or I2C addresses.

| Channel  | Sample Rate | Bit Depth | Purpose in This Algorithm |
|----------|-------------|-----------|---------------------------|
| CH_ACCEL | 104 Hz      | 16-bit    | Stroke detection (impact acceleration) and active/rest classification |
| CH_GYRO  | 104 Hz      | 16-bit    | Stroke classification (wrist rotation direction) and swing speed estimation |

- **PPG Mode**: N/A (no PPG used)
- **Buffer Size**: 64 samples per channel (~615 ms at 104 Hz)
- **Minimum data**: 1 detected stroke event for first valid output

## Algorithm

### Method

**Threshold + state machine stroke detection with gyroscope-based classification** (Srivastava et al. 2015, Whiteside et al. 2017).

1. **Preprocessing**:
   - Compute accelerometer magnitude: `accelMag = sqrt(ax² + ay² + az²)`
   - Compute gyroscope magnitude: `gyroMag = sqrt(gx² + gy² + gz²)`
   - No bandpass filter needed — strokes are impulsive events, threshold detection is sufficient
   - Gravity removal implicit in magnitude thresholding (resting accelMag ≈ 1.0g)

2. **Feature Extraction**:
   - **Stroke trigger**: `accelMag > STROKE_THRESHOLD` (3.0g) while not in cooldown period
   - **Peak tracking**: Track maximum accelMag and gyroMag during the swing window (150–400 ms after trigger)
   - **Gyro Z sign**: Dominant axis rotation during swing — positive = forehand (pronation), negative = backhand (supination)
   - **Vertical acceleration**: Peak Y-axis accel during swing — high upward component = serve
   - **Swing duration**: Time from threshold crossing to return below threshold — short (< 200ms) = volley

3. **Computation**:
   - **Stroke classification** (state machine, evaluated at swing window end):
     ```
     IF peakAccelY > SERVE_VERTICAL_THRESHOLD AND gyroMag > 400°/s → SERVE
     ELSE IF swingDuration < VOLLEY_MAX_DURATION → VOLLEY
     ELSE IF peakGyroZ > 0 → FOREHAND
     ELSE IF peakGyroZ < 0 → BACKHAND
     ELSE → UNCLASSIFIED
     ```
   - **Swing speed estimate**: `speed_kmh = peakGyroMag × SPEED_SCALE_FACTOR`
     - Scale factor 0.42 km/h per °/s derived from Whiteside et al. 2017 wrist-mounted IMU calibration
     - Maps peak angular velocity to approximate racket-head speed
     - Source: Whiteside et al. "Monitoring hitting load in tennis using inertial sensors", JSSM, 2017
   - **Active/rest classification**: 5-second sliding window of accelMag RMS
     - RMS > ACTIVE_THRESHOLD (0.3g above gravity) → active rally period
     - RMS ≤ ACTIVE_THRESHOLD → rest period (between points/games)
   - Source: Srivastava et al. "Wearable sensor based multimodal human activity recognition", Sensors, 2015

4. **Post-Processing**:
   - Increment stroke counts by type on each classified event
   - Update session timers (total time, active time, rest time)
   - Store last stroke speed for BLE transmission
   - No averaging — each stroke is an independent event

5. **Output Gating**:
   - No strokes detected → ACQUIRING state (session not started)
   - First stroke event → VALID state
   - No stroke for > 30 minutes → session presumed ended, maintain last counts

### Alternative Methods
- **Method A**: Dynamic Time Warping (DTW) template matching (Kos & Kramberger 2017). Records personal stroke templates, classifies via DTW distance. More personalized but requires per-user calibration session. Higher compute cost.
- **Method B**: Machine learning classifier (Random Forest on time/frequency features, Büthe et al. 2016). Better accuracy for ambiguous strokes but requires training data and is too heavy for MCU.

### Parameters
| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| Stroke detection threshold | 3.0 | g | Srivastava et al. 2015; empirical for wrist-worn during tennis |
| Stroke cooldown period | 400 | ms | Prevents double-counting from post-impact vibration |
| Swing window duration | 400 | ms | Captures full swing signature from backswing to follow-through |
| Serve vertical threshold | 2.5 | g | Overhead arm acceleration component (Y-axis) |
| Volley max duration | 200 | ms | Short contact, minimal backswing characteristic of volleys |
| Forehand/backhand gyro axis | Z | — | Dominant wrist rotation axis for pronation/supination |
| Speed scale factor | 0.42 | km/h per °/s | Whiteside et al. 2017 wrist-to-racket-head calibration |
| Active/rest RMS threshold | 0.3 | g (above gravity) | 5-second window IMU RMS for rally detection |
| Active/rest window | 520 | samples | 5 seconds at 104 Hz |
| Session timeout | 1800000 | ms | 30 minutes of inactivity = session end |
| Speed clamp low | 0 | km/h | Floor |
| Speed clamp high | 250 | km/h | Above = sensor artifact, not a real swing |
| Cadence clamp max | 60 | strokes/min | Above = vibration, not real strokes |
| IMU sample rate | 104 | Hz | Captures full swing kinematics |
| Buffer size | 64 | samples | ~615ms swing analysis window |

### SQI Computation

Two-component weighted SQI (0.0–1.0):

1. **Stroke clarity (60%)**: Peak acceleration z-score above running mean during detected stroke. Mapped: z ≥ 5 → 1.0, z ≤ 1.5 → 0.0 (linear). Clear impulsive strokes score high.
2. **Sensor stability (40%)**: Accelerometer magnitude variance in rest windows. Low variance (< 0.01g²) → 1.0, high variance (> 0.1g²) → 0.0. Ensures IMU is firmly attached.

`SQI = 0.6 × sqi_clarity + 0.4 × sqi_stability`

- **SQI Threshold**: 0.3 (sport detection is relatively noise-tolerant)

## Biomechanical Model
- **Movement Type**: swing (forehand, backhand, serve, volley)
- **Body Segment**: arm + wrist (dominant hand)
- **Sensor Placement**: Wrist-worn on dominant (racket) hand. Watch face orientation: screen facing up (dorsal wrist). IMU axes: X = radial-ulnar, Y = proximal-distal (forearm axis), Z = dorsal-palmar.
- **Key Kinematic Features**:
  | Feature | Axis | Description | Expected Range |
  |---------|------|-------------|----------------|
  | Impact acceleration | Accel magnitude | Ball contact + racket deceleration | 3–15 g |
  | Wrist pronation/supination | Gyro Z | Forehand = positive, backhand = negative rotation | 200–800 °/s |
  | Overhead motion | Accel Y | Serve toss + upward arm extension | 2.5–8 g peak |
  | Peak angular velocity | Gyro magnitude | Correlated to racket-head speed | 300–1500 °/s |
  | Swing duration | Time | Threshold crossing to return | 150–400 ms |

## Movement Features
- **Detection Method**: Threshold-based state machine (acceleration magnitude trigger + gyroscope classification)
- **Window Size**: 64 samples (~615 ms at 104 Hz)
- **Segmentation**: Strokes segmented by acceleration threshold crossing with cooldown timer. Each event is a discrete stroke.
- **Quality Metric**: Consistency score = 1 − (CV of swing speeds within stroke type). Range 0–1. High consistency = repeatable technique.

### Power & Resources
- **Power Mode**: continuous during session (Tier 1 — scheduled at IMU sample rate)
- **Expected Current Draw**: ~0.9 mA active (IMU only, no optical sensors) / ~0.01 mA idle
- **RAM Budget**: ~1800 bytes (within Tier 1's 4 KB budget)
  - accelMagBuf_: RingBuffer<float, 64> = 512 bytes
  - gyroZBuf_: RingBuffer<float, 64> = 512 bytes
  - Stroke history (last 32): 32 × 12 = 384 bytes
  - Per-type counters + session state: ~200 bytes
  - Scalars + filter state: ~192 bytes
  - Total: ~1800 bytes

## Validation
- **Validation Dataset**: Custom — video-annotated tennis session with manual stroke count and type labels
- **Accuracy Target**: Stroke count error < 5% over 100 strokes. Type classification F1 ≥ 0.85 (4-class: forehand/backhand/serve/volley). Swing speed within ±15% of radar gun measurement.

## Output
- **Type**: AlgorithmOutput (multi-output pattern A)
- **Unit**: strokes (primary), km/h (secondary)
- **Valid Range**: 0–999 strokes (session total), 0–250 km/h (swing speed)
- **Update Rate**: On each detected stroke event (~0.5–3 Hz during active play)
- **BLE Characteristic**: UUID `12345678-1234-5678-1234-56789abcdeU1`
- **Multi-output BLE format**: Packed 12-byte struct: [uint16_t totalStrokes, uint8_t lastType, uint8_t pad, float lastSpeed_kmh, float activeRatio]
- **Zero/null means**: No strokes detected yet — display "Waiting for first stroke..."

## Display
- **Visualization Concept**: 2×2 panel with four zones. Top-left: court heatmap showing stroke type × direction distribution. Top-right: session summary (total strokes, time, avg/max speed) with horizontal bar breakdown by type. Bottom: scatter-timeline of swing speed per stroke over session, color-coded by type, revealing fatigue and peak moments.
- **Primary Metric**: Total Strokes, strokes, 0–999
- **Secondary Info**: Stroke breakdown (FH/BH/SV/VO counts), avg/max swing speed, active/rest ratio, session duration
- **Chart/Canvas**: Court heatmap (canvas), stroke breakdown bars (DOM), speed scatter-timeline (canvas)
- **Card Size**: 2x2
- **Color Zones**: [{ type: "forehand", color: "#6366f1", label: "FH" }, { type: "backhand", color: "#06b6d4", label: "BH" }, { type: "serve", color: "#f59e0b", label: "SV" }, { type: "volley", color: "#22c55e", label: "VO" }, { type: "unclassified", color: "#6a6a82", label: "??" }]

## Edge Cases
| Condition | Behavior |
|-----------|----------|
| No signal / sensor off | State → IDLE, output.valid = false, show "No IMU data" |
| No strokes (walking/idle) | State → ACQUIRING, accumulate rest time, show "Waiting for first stroke..." |
| Racket vibration (double-hit) | 400 ms cooldown prevents double-counting |
| Ambiguous stroke type | Classify as UNCLASSIFIED, still counted in total |
| Very slow stroke (warmup) | Below 3.0g threshold → not counted. User can lower threshold in params. |
| Extremely fast swing (>250 km/h) | Clamp speed to 250. Likely sensor saturation or artifact. |
| Stroke rate > 60/min | Reject — impossibly fast, likely shaking or transport vibration |
| Session timeout (30 min inactivity) | Maintain last counts, stop accumulating time |
| IMU sensor saturation (>16g) | Flag stroke but mark speed estimate as unreliable (SQI penalty) |
| Dependency unavailable | N/A — no dependencies on other algorithms |

## References
1. Srivastava R, Paternain S, Bhatt G. "Wearable Sensor Based Multimodal Human Activity Recognition", Sensors, 2015.
2. Whiteside D, Cant O, Connolly M, Reid M. "Monitoring Hitting Load in Tennis Using Inertial Sensors", International Journal of Sports Physiology and Performance, 12(9): 1212–1217, 2017. DOI: 10.1123/ijspp.2016-0683
3. Kos M, Kramberger I. "A Wearable Device and System for Movement and Biometric Data Acquisition for Sports Applications", IEEE Access, 5: 6411–6420, 2017. DOI: 10.1109/ACCESS.2017.2675538
4. Büthe L, Blanke U, Tröster G. "Automatic Detection of Tennis Strokes from Wrist-Worn IMU Data", Proceedings of the 2016 ACM International Symposium on Wearable Computers, 2016.
5. Rawashdeh SA, Rafeldt DA, Uhl TL. "Wearable IMU for Shoulder Injury Prevention in Overhead Sports", Sensors, 16(11): 1847, 2016. DOI: 10.3390/s16111847
6. Camomilla V, Bergamini E, Fantozzi S, Vannozzi G. "Trends Supporting the In-Field Use of Wearable Inertial Sensors for Sport Performance Evaluation", Sensors, 18(3): 873, 2018. DOI: 10.3390/s18030873

## Test Scenarios (Simulation)
| # | Scenario | Expected Output | Tolerance |
|---|----------|-----------------|-----------|
| 1 | Clean forehand swing (5g peak, gyroZ +400°/s) | 1 forehand stroke, ~168 km/h | ±20 km/h |
| 2 | Clean backhand swing (4.5g peak, gyroZ −350°/s) | 1 backhand stroke, ~147 km/h | ±20 km/h |
| 3 | Serve motion (6g peak, accelY 3.0g, gyroMag 600°/s) | 1 serve stroke, ~252→250 km/h (clamped) | exact clamp |
| 4 | Volley (3.5g, short 150ms duration) | 1 volley stroke | type correct |
| 5 | No motion (idle, 1.0g) | 0 strokes, valid = false | exact |
| 6 | Walking between courts (1.5g peaks) | 0 strokes (below threshold) | exact |
| 7 | Rapid forehand-backhand rally (10 strokes) | 10 total, mixed FH/BH | count ±1 |
