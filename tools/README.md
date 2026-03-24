# OpenPulse Tools

Development tooling for the OpenPulse platform.

## Available Tools

| Tool | Language | Purpose |
|------|----------|---------|
| `filter_designer.py` | Python 3 | Generate IIR filter coefficients as C++ code |
| `run_tests.sh` | Bash | Compile and run the desktop test harness |

## Filter Designer

Generates Butterworth IIR filter coefficients for firmware algorithms.

```bash
# Install dependencies
pip3 install scipy numpy

# List available presets
python3 filter_designer.py

# Generate PPG bandpass filter
python3 filter_designer.py --preset ppg

# Generate all presets to a header file
python3 filter_designer.py --all -o ../firmware/src/framework/filters.h
```

### Presets

| Preset | Type | Cutoff | Fs | Use Case |
|--------|------|--------|----|----------|
| `ppg` | Bandpass | 0.5–4.0 Hz | 100 Hz | Heart rate from PPG |
| `ecg` | Bandpass | 5.0–15.0 Hz | 200 Hz | QRS detection |
| `resp` | Bandpass | 0.1–0.5 Hz | 100 Hz | Respiratory rate |
| `eda_lp` | Low-pass | 0.05 Hz | 10 Hz | Tonic EDA |
| `eda_hp` | High-pass | 0.05 Hz | 10 Hz | Phasic EDA |
| `ppg_dc` | High-pass | 0.5 Hz | 100 Hz | PPG DC removal |
| `step` | Bandpass | 0.5–3.0 Hz | 50 Hz | Step detection |

## Test Harness

```bash
chmod +x run_tests.sh
./run_tests.sh
```

Compiles algorithm code with `clang++` on Mac and runs test vectors without hardware.
