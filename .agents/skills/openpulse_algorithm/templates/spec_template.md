# <ID>: <Algorithm Name>

## Classification
- **Category**: health-biometric | sport-motion | hybrid
- **Layer**: Base | Cross-Sensor | Composite
- **Tier**: 0 (realtime) | 1 (periodic) | 2 (on-demand) | 3 (off-device)
- **Regulatory**: Wellness | Health Indicator | Health Screening | Sport Performance
- **Priority**: P0 (MVP) | P1 (v1.0) | P2 (v2.0)
- **Consumes**: CH_PPG, CH_ACCEL, ... (list ALL channels read)
- **Outputs**: <type> <name> (<unit>)
- **Consumed by**: [A02, X01, ...] | [none]

## Hardware
- **Required Pucks**: Puck 1 + XIAO | Puck 1 + Puck 2 + XIAO | All
- **Channels Used**:

| Channel | Puck | Chip | Sample Rate | Purpose in This Algorithm |
|---------|------|------|-------------|---------------------------|
| CH_PPG  | Puck 1 | MAX86150 | 100 Hz | Primary signal source |
| CH_ACCEL | XIAO | LSM6DS3 | 50 Hz | Motion artifact rejection |

- **Buffer Size**: <samples> (<duration at sample rate>)
- **Minimum data**: <what is needed before first valid output>

## Algorithm

### Method
<!-- Describe the algorithm step by step. Be specific about: -->
1. **Preprocessing**: <filters, DC removal, normalization>
2. **Feature Extraction**: <peaks, intervals, amplitudes, frequency decomposition>
3. **Computation**: <the actual formula / model — with inline citation>
4. **Post-Processing**: <averaging, outlier rejection, smoothing>
5. **Output Gating**: <minimum data, no-signal behavior>

### Alternative Methods
- **Method A**: <Name> (<Citation>). <Trade-off>.
- **Method B**: <Name> (<Citation>). <Trade-off>.

<!-- ═══ INSERT FOR sport-motion CATEGORY ONLY ═══
## Biomechanical Model
- **Movement Type**: <swing | stride | rep | posture | gesture>
- **Body Segment**: <arm | leg | torso | wrist | full-body>
- **Sensor Placement**: <wrist-worn — describe orientation expectations>
- **Key Kinematic Features**:
  | Feature | Axis | Description | Expected Range |
  |---------|------|-------------|----------------|
  | Peak angular velocity | Gyro Z | Wrist rotation during swing | 200–1500 °/s |
  | Impact acceleration | Accel magnitude | Ball contact shock | 3–15 g |

## Movement Features
- **Detection Method**: <threshold-based | template-matching | state-machine | ML classifier>
- **Window Size**: <samples> (<duration at sample rate>)
- **Segmentation**: <how individual movements are isolated from continuous stream>
- **Quality Metric**: <movement quality score computation>
═══ END sport-motion SECTION ═══ -->

### Parameters
| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| <name> | <value> | <unit> | <citation or rationale> |

### SQI Computation
<!-- How signal quality is assessed for this specific algorithm. Incorporate IMU motion-level if PPG/ECG-based. -->
- **SQI Threshold**: <0.0–1.0> (Minimum quality required to emit output)

### Power & Resources
- **Power Mode**: continuous | duty-cycled | on-demand
- **Expected Current Draw**: <mA active> / <mA idle>
- **RAM Budget**: <bytes> (must be within tier budget)

## Validation
- **Validation Dataset**: <PhysioNet DB Name | Sport Dataset | Custom>
- **Accuracy Target**: <Metric> ± <Tolerance> vs. <Reference>
- **Ground Truth Method**: <how correctness is verified — video, manual count, reference device>

## Output
- **Type**: AlgorithmOutput | CalibratedOutput
- **Unit**: <BPM, %, °C, mmHg, µS, steps, score, SPM, ...>
- **Valid Range**: <min>–<max>
- **Update Rate**: <how often a new value is produced>
- **BLE Characteristic**: UUID `12345678-1234-5678-1234-56789abcdef<X>`
- **Zero/null means**: <what 0 or "--" indicates>

## Display
- **Layout**: <gauge | waveform | score | counter | multi-metric | timeline | phases | event-log | status>
- **Primary**: <type>, <label>, <unit>, <decimals>, <range>
- **Zones** (optional): [{ min, max, color, label }, ...]
- **Secondary**: [SQI bar, sub-metrics, state badge, ...]
- **Chart**: <line|bar|scatter|segments|none>, <window seconds>
- **Card Size**: <1x1 | 2x1 | 2x2 | 1x2>

## Edge Cases
| Condition | Behavior |
|-----------|----------|
| No signal / sensor off | |
| Motion artifact | |
| Sensor saturation (ADC clipped) | |
| < minimum data collected | |
| Out-of-range result | |
| Dependency unavailable | |
<!-- ═══ ADD FOR sport-motion CATEGORY ═══
| Non-target movement (e.g., walking during tennis algo) | |
| Movement too slow / too fast for detection window | |
| Wrist orientation differs from expected | |
| Repeated false triggers from daily activity | |
═══ END sport-motion EDGE CASES ═══ -->

## References
1. <Author>, "<Title>", <Journal>, <Year>. DOI: <doi>
2. <Manufacturer>, "<App Note Title>", <Year>.

## Test Scenarios (Simulation)
| # | Scenario | Expected Output | Tolerance |
|---|----------|-----------------|-----------|
| 1 | Normal clean signal | <value> | ±<tol> |
| 2 | Boundary low | <value> | ±<tol> |
| 3 | Boundary high | <value> | ±<tol> |
| 4 | No signal | 0 or NaN | exact |
| 5 | Heavy artifact / noise | hold / suppress | — |
| 6 | Gradual transition | tracks true | ±<tol> |
| 7 | Low quality signal | detects if above threshold | ±<tol> |
