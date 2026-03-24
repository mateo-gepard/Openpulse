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

#### Channel-Based Algorithm Availability

When sensors connect, the dashboard determines which data channels are online (e.g., `CH_PPG_RED`, `CH_ACCEL`, `CH_TEMP`). Each algorithm in the sidebar shows per-channel pills indicating its requirements. Three visual states:

| State | Appearance | Meaning |
|-------|------------|---------|
| **Available** | Green border, full opacity | All required channels are live — click to open |
| **Partial** | Orange border, 55% opacity | Some channels detected but not all — cannot run |
| **Unavailable** | Grayed out, non-interactive | No required channels online |

Algorithms auto-sort with available ones at the top.

#### Custom Algorithm Import

Import community or user-built `display.js` modules directly into the dashboard:

1. Click **Import Custom Algorithm** in the sidebar
2. Select a `display.js` file (uses `export default {}` or `module.exports = {}` format)
3. The parser extracts: `id`, `label`, `channels`, `sampleRateHz`, `metrics[]`, `breakdown[]`, `parameters`
4. A live panel appears with multi-metric grid, score breakdown bars, SQI gauge, waveform canvas, and tunable parameters
5. Imported algorithms persist in localStorage across sessions

To create a `display.js` file for your algorithm, use the template at `.agents/skills/openpulse_algorithm/templates/display_module_template.js`.

### Usage
```bash
# Option 1: Open directly (requires HTTPS for Web Bluetooth on some browsers)
open dev/dashboard/index.html

# Option 2: Local server
cd dev/dashboard && python3 -m http.server 8080
# Then open http://localhost:8080
```
