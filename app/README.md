# OpenPulse Mobile App

Production app for the OpenPulse platform (Phase 2+).

## Architecture

```
src/
├── modules/       → Module engine (load/unload algorithm modules)
├── data/          → Data layer (SQLite/Realm, BLE receiver)
├── screens/       → UI screens (dashboard, settings, reports)
├── onboarding/    → Profile selection flow
└── components/    → Reusable UI components
```

## Status

Scaffolding only. Development begins in Phase 2 (Q3 2026).

## Tech Stack

- React Native or Flutter (TBD)
- SQLite or Realm for local storage
- BLE via react-native-ble-plx or flutter_blue
