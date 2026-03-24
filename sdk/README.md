# OpenPulse Developer SDK

SDK for building custom algorithm modules (Phase 3+).

## Languages

- `js/` — JavaScript SDK
- `python/` — Python SDK
- `examples/` — Reference module implementations

## Module Interface

Every module implements three methods:

```javascript
module.exports = {
    // Which sensors does this module need?
    requiredSensors: () => ['ppg', 'imu'],

    // Process new data (called by engine)
    process: (data, history) => {
        // Your algorithm here
        return { value: 72, unit: 'BPM', sqi: 0.9 };
    },

    // Card rendering data
    output: (result) => ({
        title: 'Heart Rate',
        value: result.value,
        unit: result.unit,
        chart: result.history
    })
};
```

## Status

Scaffolding only. Development begins in Phase 3 (Q4 2026).
