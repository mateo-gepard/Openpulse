# <ID>: <Algorithm Name>

## Classification
- **Layer**: Base | Cross-Sensor | Composite
- **Tier**: 0 (realtime) | 1 (periodic) | 2 (on-demand) | 3 (off-device)
- **Regulatory**: Wellness | Health Indicator | Health Screening
- **Puck**: 1 | 2 | 3 | XIAO | Dashboard
- **Priority**: P0 (MVP) | P1 (v1.0) | P2 (v2.0)
- **Dependencies**: [none] | [A01, A02, ...]

## Channel Input
- **Channel**: <CH_PPG, CH_ECG, CH_SKIN_TEMP, etc.>
- **Sample Rate**: <Hz>
- **Bit Depth**: <bits>
- **Buffer Size**: <samples> (<duration at sample rate>)
- **Minimum data**: <what is needed before first valid output>

## Algorithm

### Method
<!-- Describe the algorithm step by step. Be specific about: -->
1. **Preprocessing**: <filters, DC removal, normalization>
2. **Feature extraction**: <peaks, intervals, amplitudes, frequency decomposition>
3. **Computation**: <the actual formula / model>
4. **Post-processing**: <averaging, outlier rejection, smoothing>
5. **Output gating**: <minimum data, no-signal behavior>

### Alternative Methods
- **Method A**: <Name, Reference, Tradeoff>
- **Method B**: <Name, Reference, Tradeoff>

### Parameters
| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| <name> | <value> | <unit> | <citation or rationale> |

### SQI Computation
<!-- How signal quality is assessed for this specific algorithm. Incorporate IMU motion-level. -->
- **SQI Threshold**: <0.0–1.0> (Minimum quality required to emit output)

### Power & Resources
- **Power Mode**: continuous | duty-cycled | on-demand
- **Expected Current Draw**: <mA active> / <mA idle>

## Validation
- **Validation Dataset**: <PhysioNet DB Name | Custom>
- **Accuracy Target**: <Metric> ± <Tolerance> vs. <Reference>

## Output
- **Type**: AlgorithmOutput | CalibratedOutput
- **Unit**: <BPM, %, °C, mmHg, µS, g, dB, ...>
- **Valid Range**: <min>–<max> (physiological limits)
- **Update Rate**: <how often a new value is produced>
- **BLE Characteristic**: UUID `12345678-1234-5678-1234-56789abcdef<X>`
- **Zero/null means**: <what 0 or "--" indicates>

## Edge Cases
| Condition | Behavior |
|-----------|----------|
| No signal / sensor off | |
| Motion artifact | |
| Sensor saturation (ADC clipped) | |
| < minimum data collected | |
| Out-of-range result | |
| Dependency unavailable | |

## Medical References
1. <Author>, "<Title>", <Journal>, <Year>. DOI: <doi>
2. <Manufacturer>, "<App Note Title>", <Year>.

## Test Scenarios (Simulation)
| # | Scenario | Expected Output | Tolerance |
|---|----------|-----------------|-----------|
| 1 | <Clean 72 BPM, SNR 20dB> | <value> | ±<tol> |
| 2 | <Boundary low> | <value> | ±<tol> |
| 3 | <Boundary high> | <value> | ±<tol> |
| 4 | <No signal> | 0 or NaN | exact |
| 5 | <Heavy motion artifact> | hold / suppress | — |
