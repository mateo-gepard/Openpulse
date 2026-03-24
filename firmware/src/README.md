# Firmware Source

Production firmware for the OpenPulse platform.

## Structure

```
src/
├── framework/      → Shared types, ring buffers, filter functions
│   ├── AlgorithmBase.h
│   ├── RingBuffer.h
│   └── SensorDriverBase.h
├── drivers/        → Sensor I2C/SPI drivers (one per chip)
├── algorithms/
│   ├── base/       → Single-sensor algorithms (A01–A27)
│   └── fusion/     → Cross-sensor algorithms (X01–X17)
└── ble/            → BLE GATT service + characteristics
```

## Current State

The `sensor_dashboard.ino` in the parent directory is the v5 dev prototype.
Once the new sensors arrive, firmware will migrate to this modular structure.

## Testing

```bash
# Run desktop tests (no hardware needed)
chmod +x ../../tools/run_tests.sh
../../tools/run_tests.sh
```
