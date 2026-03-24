# <ID>: <Algorithm Name>

## Classification
- **Layer**: Base | Cross-Sensor | Composite
- **Tier**: 0 (realtime) | 1 (periodic) | 2 (on-demand) | 3 (off-device)
- **Regulatory**: Wellness | Health Indicator | Health Screening
- **Puck**: 1 | 2 | 3 | XIAO | Dashboard
- **Priority**: P0 (MVP) | P1 (v1.0) | P2 (v2.0)
- **Dependencies**: [none] | [A01, A02, ...]

## Sensor Input
- **Chip**: <chip name>
- **Channel**: <which channel/register>
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
5. **Output gating**: <SQI threshold, minimum data, no-signal behavior>

### Parameters
| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| <name> | <value> | <unit> | <citation or rationale> |

### SQI Computation
<!-- How signal quality is assessed for this specific algorithm.
     Must return 0.0 (garbage) to 1.0 (perfect).
     Below 0.4 = output suppressed. -->

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

## Test Vectors
| # | Input Scenario | Expected Output | Tolerance | Source |
|---|---------------|-----------------|-----------|--------|
| 1 | Normal physiological signal | <value> | ±<tol> | <source of expected value> |
| 2 | Boundary low (physiological minimum) | <value> | ±<tol> | |
| 3 | Boundary high (physiological maximum) | <value> | ±<tol> | |
| 4 | No signal (sensor off / no contact) | 0 or NaN | exact | |
| 5 | Motion artifact burst | hold / suppress | — | |
