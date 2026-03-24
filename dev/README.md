# Development Tools

This directory contains development and debugging tools for the OpenPulse platform.
These are **not** part of the production firmware or app — they exist to help developers
test algorithms, tune parameters, and debug sensor behavior.

## Contents

### `dashboard/`
Web-based DevWorkbench. Open `dashboard/index.html` in Chrome to:
- Connect to the board via Web Bluetooth
- Discover connected sensor modules in real-time
- Test algorithms with live parameter tuning
- Inspect raw waveforms and signal quality

### Usage
```bash
# Option 1: Open directly (requires HTTPS for Web Bluetooth on some browsers)
open dev/dashboard/index.html

# Option 2: Local server
cd dev/dashboard && python3 -m http.server 8080
# Then open http://localhost:8080
```
