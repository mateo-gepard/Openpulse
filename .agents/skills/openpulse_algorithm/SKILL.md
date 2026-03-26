---
name: openpulse_algorithm_builder
description: >
  End-to-end algorithm builder for the OpenPulse wearable health platform.
  Two modes: Auto (describe → build) and Guided (progressive interview → build).
  Supports health-biometric AND sport/motion algorithms.
  Produces medically-correct, privacy-first, production-quality algorithm packages
  with firmware code, display modules, test vectors, and specs.
---

# OpenPulse Algorithm Builder v2

You are building algorithms for the **OpenPulse** wearable health platform. OpenPulse runs on a **Seeed XIAO nRF52840 Sense** (ARM Cortex-M4, 256KB RAM, 1MB flash) and communicates via BLE GATT to a web dashboard.

This skill automates the **entire algorithm creation pipeline** — from natural language description to production-ready code, display module, and tests. Every output is **replicable**, **medically defensible**, **privacy-first**, and **production-quality**.

---

## 0. HOW THIS SKILL WORKS

### 0.1 Two Modes

| Mode | Trigger | Flow | User Interaction |
|------|---------|------|------------------|
| **Auto** | User describes an algorithm in natural language | AI classifies → selects sensors → picks method → generates spec → **shows spec for confirmation** → builds all files | One confirmation checkpoint |
| **Guided** | User says "help me build", "guide me", "I want to create", or provides vague requirements | AI conducts a **progressive 3–5 round interview** → generates spec → **shows spec for confirmation** → builds all files | 3–5 question rounds + confirmation |

**Mode detection heuristic:**
- User provides a specific algorithm description with clear intent AND the target metric is unambiguous (e.g., "Build a heart rate algorithm using PPG") → **Auto Mode**
- User provides a spec file or references an existing spec → **Direct Build** (skip to §11 Code Generation)
- User is vague, exploratory, or explicitly asks to be guided → **Guided Mode**
- The target is a **derived state** (fatigue, readiness, alertness, mood, cognitive load) → **Guided Mode** (requires disambiguation)
- The description maps to a **composite** (score, report, recommendation) → **Guided Mode** (requires dependency check)
- When in doubt → **Guided Mode** (safer for medical algorithms)

**After mode detection, ALWAYS run the Registry Lookup (§1.4) before proceeding.**

### 0.2 Output File Set

Every algorithm build produces this **exact** file set:

```
algorithms/<ID>_<name>/
├── spec.md              ← Algorithm specification (the contract)
├── display.js           ← Dashboard render module (layout, zones, chart config)
└── test_vectors.h       ← Simulated test scenarios (C++ struct array)

firmware/src/algorithms/<base|fusion>/
├── Algo_<ID>.h          ← Header (class declaration inheriting AlgorithmBase)
└── Algo_<ID>.cpp        ← Implementation (state machine, SQI, algorithm logic)
```

For **Tier 3 (off-device)** algorithms, ALSO generate:
```
dev/dashboard/algorithms/
└── algo_<id>.js         ← Browser-side computation module
```

### 0.3 ID Scheme

| Prefix | Range | Meaning | Assigned by |
|--------|-------|---------|-------------|
| A | A01–A27 | Core base algorithms (single-sensor) | Reserved — documented in registry |
| X | X01–X17 | Core cross-sensor fusion | Reserved — documented in registry |
| C | C01–C10 | Core composite scores | Reserved — documented in registry |
| **U** | **U01–U99** | **User-created algorithms** | **Auto-assigned: scan `algorithms/U*` dirs, take next available** |

To assign the next U-series ID:
1. List all directories matching `algorithms/U[0-9][0-9]_*/`
2. Extract the numeric parts, find the maximum
3. Next ID = max + 1 (or U01 if none exist)

---

## 1. ALGORITHM CATEGORY ROUTER

Before generating anything, classify the algorithm into one of three categories. This determines which rule sets apply.

### 1.1 Category Decision Tree

```
User describes algorithm
         │
         ▼
Does it measure a PHYSIOLOGICAL VITAL SIGN?
(HR, SpO2, BP, temp, HRV, EDA, respiratory rate, sleep stages)
    │                    │
   YES                  NO
    │                    │
    ▼                    ▼
HEALTH path        Does it detect MOVEMENT PATTERNS?
                   (steps, sport technique, gestures, posture, activity type)
                        │                    │
                       YES                  NO
                        │                    │
                        ▼                    ▼
                  SPORT/MOTION path    Does it combine BOTH?
                                      (calorie burn, workout HR zones,
                                       stress vs exercise, sleep+motion)
                                            │          │
                                           YES        NO
                                            │          │
                                            ▼          ▼
                                      HYBRID path   Is it a DERIVED STATE?
                                                    (fatigue, readiness, alertness,
                                                     mood, cognitive load, overtraining)
                                                          │          │
                                                         YES        NO → Guided Mode
                                                          │           (need more info)
                                                          ▼
                                                    HYBRID path
                                                    (default — interview
                                                     determines sensors)
```

**Derived states** are higher-order interpretations of multiple biomarkers that don't fit neatly into "vital sign" or "movement pattern." Examples: exercise fatigue (HR drift + movement quality), mental fatigue (HRV + EDA trend), overtraining (resting HR trend + HRV + sleep). These always route to **Hybrid** and require Guided Mode to disambiguate the specific variant.

### 1.2 Rule Set by Category

| Category | Medical Citations | Physiological Clamping | SQI Required | Motion Rejection | Biomechanical Validation | Display Default |
|----------|-------------------|----------------------|--------------|------------------|--------------------------|-----------------|
| `health-biometric` | **MANDATORY** — peer-reviewed | **MANDATORY** — hard clamp to ranges in §6.2 | **MANDATORY** | If PPG/ECG used | No | `gauge` |
| `sport-motion` | Optional — cite biomechanics lit if available | Range-check (not physiological clamp) | Recommended | N/A — motion IS the signal | **MANDATORY** — validate movement model | `multi-metric` |
| `hybrid` | **MANDATORY** for health components | **MANDATORY** for health outputs | **MANDATORY** for health outputs | Context-dependent | For motion components | `gauge` or `multi-metric` |

### 1.3 Sport/Motion — Acceptable Reference Sources

For sport/motion algorithms, acceptable citations include:
1. **Biomechanics journals** (Journal of Biomechanics, Sports Engineering, Sensors)
2. **IMU motion analysis papers** (Camomilla et al. 2018, Rawashdeh et al. 2016)
3. **Validated open-source implementations** (OpenSense, IMU-based human activity recognition literature)
4. **Sports science textbooks** (Hamill & Knutzen "Biomechanical Basis of Human Movement")
5. **Validated IMU datasets** (UCI HAR, PAMAP2, WISDM, sport-specific datasets)

### 1.4 Registry Lookup (Mandatory Before Building)

Before generating any new algorithm, **search `resources/algorithm_registry.md`** for existing entries:

1. **Exact match** — An algorithm with the same purpose already exists (e.g., user asks "heart rate" and A01 exists). → Tell the user: *"A01_heart_rate already covers this. Do you want to extend it, create a variant, or do something else?"*
2. **Overlapping match** — A similar algorithm exists but differs in scope (e.g., user asks "resting heart rate trend" and A06 exists). → Tell the user what exists and ask how theirs differs.
3. **No match** — Proceed with a new algorithm. Assign the next available ID in the correct series (A/X/C/U).

**ID assignment rules:**
- Core algorithms (A01–A27, X01–X17, C01–C10) are pre-assigned. If the user's algorithm matches a planned core algo, use that ID.
- User-created algorithms use U-series: U01, U02, … U99.
- Never reuse or reassign an existing ID.

### 1.5 Dependency Resolution (Composites & Cross-Sensor)

Composite (C-series) and some cross-sensor (X-series) algorithms depend on sub-algorithms. Before building, **trace the full dependency tree**:

```
Example: C01_recovery_score
├── A01_heart_rate (Tier 0) — exists? ✓
├── A02_hrv (Tier 1) — exists? ✗ (spec only)
├── A23_sleep_detection (Tier 1) — exists? ✗
└── X05_autonomic_balance (Tier 1) — exists? ✗
    └── A02_hrv — (already listed)
```

**Resolution options (present to user):**
1. **Build chain** — Build missing dependencies first, bottom-up. Recommended for production.
2. **Build with stubs** — Generate the composite now with `// STUB: requires A02_hrv` placeholders. Faster for prototyping.
3. **Start with a leaf** — Build the deepest missing dependency first, then revisit the composite.

**Rule:** Never silently skip dependency checks. If a composite references `getHR()` or `getHRV()`, verify those algorithms exist and their output types match expectations.

---

## 2. DATA CHANNEL ARCHITECTURE

### 2.1 CRITICAL RULE: Algorithms Are Hardware-Agnostic

**Algorithm specs MUST declare only abstract data channels (CH_PPG, CH_ECG, CH_ACCEL, etc.) — NEVER specific chip names, I2C addresses, bus types, or puck positions.** The v6 firmware architecture decouples algorithms from physical sensors entirely:

- The **driver layer** (firmware/src/drivers/) translates physical chips → abstract channels
- The **PuckDetector** discovers connected sensors at runtime via I2C scan
- **ANY I2C sensor** that provides the correct channel data works — today's MAX86150 could be replaced by a MAX30101, ADPD4101, or any future PPG chip
- Algorithms call `getChannelData(CH_PPG)` — they never see chip registers, bus addresses, or puck positions

**In algorithm specs:**
- ✅ `CH_PPG at 100 Hz, 18-bit minimum` — correct (channel + data requirements)
- ✅ `PPG Mode: Red+IR` — correct (signal requirement, not chip command)
- ❌ `MAX86150 at 100 Hz on Puck 1` — WRONG (hardcodes chip and position)
- ❌ `Wire, 0x5E` — WRONG (bus detail belongs in driver, not algorithm)

### 2.2 Channel Capabilities Reference

This table describes what each channel provides. It is a **driver-level reference** for understanding channel capabilities — NOT for copying into algorithm specs.

```
┌─────────────────────┬─────────────┬──────────┬──────────────────────────────────────┐
│ Channel             │ Max Rate    │ Bits     │ Signal Description                   │
├─────────────────────┼─────────────┼──────────┼──────────────────────────────────────┤
│ CH_PPG (Green LED)  │ 100/200 Hz  │ 18-bit   │ Optical blood volume (green λ)       │
│ CH_PPG (Red+IR LED) │ 100/200 Hz  │ 18-bit   │ Dual-wavelength optical (red + IR λ) │
│ CH_ECG              │ 100/200 Hz  │ 18-bit   │ Cardiac electrical (Lead I)           │
│ CH_SKIN_TEMP        │ 1 Hz        │ 16-bit   │ Skin surface temperature (±0.1°C)    │
│ CH_EDA              │ 10 Hz       │ 16-bit   │ Electrodermal activity / GSR          │
│ CH_BIOZ             │ On-demand   │ 12-bit   │ Bioelectrical impedance spectrum      │
│ CH_ACCEL            │ 12.5–416 Hz │ 16-bit   │ 3-axis linear acceleration           │
│ CH_GYRO             │ 12.5–416 Hz │ 16-bit   │ 3-axis angular velocity              │
│ CH_MIC              │ 16000 Hz    │ 16-bit   │ Audio / acoustic envelope             │
└─────────────────────┴─────────────┴──────────┴──────────────────────────────────────┘
```

**PPG LED mode selection** (algorithm declares which mode it needs — firmware handles the physical switch):
- **Green LED** — HR, HRV, perfusion index. Better motion tolerance. Default for most algorithms.
- **Red + IR LED** — SpO2 (requires dual-wavelength ratio). Also vascular age, PPG waveform morphology.

**IMU rate selection** (algorithm declares the rate it needs — firmware configures the ODR register):
- **Default: 50 Hz** — sufficient for step counting, activity recognition, sleep detection.
- **High-rate: 104–208 Hz** — sport technique analysis (tennis serve, golf swing, running gait).
- **Low-rate: 12.5–26 Hz** — long-duration monitoring where power savings matter (sleep, sedentary).

### 2.3 Channel Declaration Rules

**Rule: Not every channel needs to be used.** An algorithm declares ONLY the channels it actually reads. A heart rate algorithm uses CH_PPG and CH_ACCEL (for motion rejection) — it does NOT declare CH_EDA, CH_SKIN_TEMP, CH_MIC, etc., even though those sensors may be physically present.

---

## 3. SENSOR VALIDATION ENGINE

Before generating any spec, run these validation checks. **These are non-negotiable.** If the user requests a nonsensical sensor configuration, **explain the problem clearly and suggest the correct configuration.**

### 3.1 Channel Requirement Matrix

| Algorithm Type | Required Channels | Recommended Additions | Invalid Channels (explain if requested) |
|---|---|---|---|
| Heart rate / HRV | CH_PPG | CH_ACCEL (motion rejection) | CH_MIC — "Microphone captures audio, not cardiac rhythm. PPG measures blood volume changes via light." |
| SpO2 | CH_PPG (Red + IR) | CH_ACCEL (motion rejection) | CH_MIC, CH_BIOZ — "SpO2 requires dual-wavelength optical measurement (red + infrared light ratio)." |
| Blood pressure (PTT) | CH_PPG + CH_ECG | CH_ACCEL (motion rejection) | CH_MIC — "Blood pressure via PTT requires synchronized PPG+ECG to measure pulse transit time." |
| ECG rhythm | CH_ECG | CH_ACCEL (motion artifact marking) | — |
| EDA / Stress | CH_EDA | CH_PPG (HRV fusion for holistic stress) | CH_MIC — "Stress is measured via galvanic skin response (EDA), not sound." |
| Temperature-based (fever, circadian, ovulation) | CH_SKIN_TEMP | — | CH_MIC — "Temperature is measured by thermistor, not derived from audio." |
| Body composition | CH_BIOZ | — | CH_MIC — "Body composition requires bioimpedance (electrical impedance through tissue)." |
| Step counting | CH_ACCEL | — | CH_MIC, CH_PPG — "Steps are detected from accelerometer peaks during walking motion." |
| Activity recognition | CH_ACCEL + CH_GYRO | — | CH_MIC (unless audio context needed) |
| Sport technique (swing, form, cadence) | CH_ACCEL + CH_GYRO | — | CH_MIC — "Racket swings, running form, and movement patterns are captured by the 6-axis IMU (accelerometer + gyroscope), not audio." |
| Snoring / respiratory sounds | CH_MIC | CH_PPG (SpO2 for apnea screening) | CH_BIOZ — "Snoring is an audio phenomenon detected by the PDM microphone." |
| Sleep detection | CH_ACCEL | CH_PPG (HR/HRV), CH_SKIN_TEMP, CH_EDA | — |
| Composite scores | Varies — depends on sub-algorithms | — | — |

### 3.2 Mandatory Pre-Flight Check

Execute this checklist before generating any spec:

```
PRE-FLIGHT SENSOR VALIDATION:
1. Map user's intent → required signal types
2. Map signal types → channels from §3.1 matrix
3. CHECK: No channel is included without justification
4. CHECK: No critical channel is missing (compare against §3.1 Required)
5. CHECK: If user explicitly requested a sensor that doesn't make sense:
   → EXPLAIN clearly why it's wrong
   → SUGGEST the correct channel(s) with rationale
   → WAIT for user acknowledgment before proceeding
6. ADD motion rejection: If algorithm uses CH_PPG or CH_ECG, add CH_ACCEL
7. NEVER hardcode chip names, puck positions, or I2C addresses in specs — channels only
8. STRIP unused channels: Algorithm declares ONLY what it actually reads
```

### 3.3 Common Mistakes to Catch

These are errors users commonly make. If detected, **correct them proactively with a clear explanation**:

| User Says | Problem | Correct Response |
|---|---|---|
| "Heart rate from microphone" | Microphone captures sound, not cardiac rhythm | "Heart rate is measured via PPG (photoplethysmography) — light shines through skin and measures blood volume changes. You need CH_PPG, not CH_MIC." |
| "Tennis swing detection with PPG" | PPG measures blood flow, not motion | "Racket swing detection needs the 6-axis IMU: CH_ACCEL + CH_GYRO. PPG can't detect arm angle or swing speed." |
| "Stress from accelerometer" | Accelerometer measures motion, not autonomic nervous system | "Stress is measured via EDA (galvanic skin response, CH_EDA) and/or HRV (derived from CH_PPG). Accelerometer can distinguish stress from exercise but isn't the primary stress signal." |
| "Body fat from temperature" | Temperature doesn't measure tissue composition | "Body composition requires bioimpedance (CH_BIOZ) — it sends a tiny current through tissue and measures impedance to estimate fat/muscle/water ratios." |
| "SpO2 from ECG" | ECG measures electrical activity, SpO2 needs optical | "SpO2 requires dual-wavelength optical measurement (PPG Red + IR). ECG measures heart's electrical signals, not blood oxygen saturation." |
| Algorithm uses 6 sensors but only actually needs 2 | Over-provisioning wastes power and complexity | "Your algorithm only processes accelerometer data for step counting. I've stripped the unused channels (PPG, ECG, EDA, Temp, Mic) to reduce power draw and complexity." |

---

## 4. AUTO MODE PIPELINE

When the user describes an algorithm and provides enough information to build it:

### 4.1 Sequence

```
Step 1: CLASSIFY
  ├── Parse natural language description
  ├── Category: health-biometric | sport-motion | hybrid
  ├── Layer: base | cross-sensor | composite
  └── Tier: 0 (realtime) | 1 (periodic) | 2 (on-demand) | 3 (off-device)

Step 1.5: REGISTRY LOOKUP & DEPENDENCY CHECK
  ├── Search algorithm_registry.md for existing/overlapping algorithms (§1.4)
  ├── If match found → inform user, ask how to proceed
  ├── If composite/cross-sensor → trace dependency tree (§1.5)
  ├── If dependencies missing → present resolution options to user
  └── Assign algorithm ID (core ID if planned, else next U-series)

Step 2: VALIDATE SENSORS
  ├── Select channels from §3.1 matrix
  ├── Run pre-flight check (§3.2)
  └── Determine puck configuration (§2.2)

Step 3: SELECT ALGORITHM METHOD
  ├── For HEALTH: pick proven, peer-reviewed method with citations
  ├── For SPORT: pick validated biomechanical approach
  ├── For HYBRID: pick appropriate method for each component
  └── Always define at least 2 alternative methods with trade-offs

Step 4: GENERATE SPEC
  ├── Use spec template (§8)
  ├── Fill every field — NO blanks, NO TODOs
  ├── Include: parameters, SQI computation, edge cases, test scenarios
  ├── Include: display configuration (§12)
  └── Include: references with DOIs where available

Step 5: ▶▶▶ CHECKPOINT — SHOW SPEC + VISUALIZATION TO USER ◀◀◀
  ├── Present the complete spec.md
  ├── Present a visualization concept (same format as Guided Mode Round 2):
  │   • Describe what the panel will look like in 2–3 sentences
  │   • Sketch the layout (ASCII or prose): what elements, where, how they animate
  │   • Explain why this visualization fits the algorithm's output
  │   • Mention any special canvases (heatmaps, waveforms, radar charts, etc.)
  ├── Say: "Here's the algorithm spec and my visualization concept.
  │         Review both and confirm to proceed, or tell me what to change."
  └── WAIT for user confirmation

Step 6: BUILD (after user confirms)
  ├── Generate all output files (§0.2)
  ├── Update algorithm_registry.md
  └── Report: list of created files with brief description
```

### 4.2 Classification Heuristics

| User Describes | Category | Layer | Tier |
|---|---|---|---|
| "heart rate", "pulse", "HR", "BPM" | health-biometric | base | 0 (realtime) |
| "HRV", "heart rate variability", "RMSSD" | health-biometric | base | 1 (periodic) |
| "SpO2", "blood oxygen", "oxygen saturation" | health-biometric | base | 0 (realtime) |
| "blood pressure", "BP", "PTT" | health-biometric | cross-sensor | 1 (periodic) |
| "ECG", "EKG", "rhythm" | health-biometric | base | 2 (on-demand) |
| "temperature", "fever", "ovulation" | health-biometric | base | 3 (off-device) |
| "EDA", "stress", "GSR", "galvanic" | health-biometric | base | 1 (periodic) |
| "body fat", "muscle mass", "hydration", "bioimpedance" | health-biometric | base | 2 (on-demand) |
| "step count", "pedometer" | sport-motion | base | 0 (realtime) |
| "activity recognition", "walking/running/cycling" | sport-motion | base | 1 (periodic) |
| "tennis", "golf swing", "running form", "punch", "rowing" | sport-motion | base | 1 (periodic) |
| "cadence", "stride", "gait" | sport-motion | base | 1 (periodic) |
| "snoring", "cough", "respiratory sound" | health-biometric | base | 1 (periodic) |
| "sleep stages", "sleep score" | hybrid | cross-sensor | 3 (off-device) |
| "recovery score", "readiness" | hybrid | composite | 3 (off-device) |
| "calorie burn", "energy expenditure" | hybrid | cross-sensor | 3 (off-device) |
| "stress vs exercise" | hybrid | cross-sensor | 1 (periodic) |
| "biological age", "health score" | hybrid | composite | 3 (off-device) |

---

## 5. GUIDED MODE PIPELINE

When the user needs guidance or provides vague requirements:

### 5.1 Round 1 — Intent & Scope

Ask the user:

```
QUESTIONS FOR ROUND 1:
1. "What do you want to measure or detect?"
   → Free text. Examples: "heart rate during swimming", "tennis serve speed",
     "stress level", "sleep quality", "running cadence"

2. "What category best describes this?"
   → Options:
     a) Health vital sign (HR, SpO2, BP, temperature, HRV)
     b) Stress / mental health (EDA, stress score, relaxation)
     c) Sleep analysis (phases, quality, snoring)
     d) Sport / movement technique (swing form, cadence, reps)
     e) Activity / fitness (steps, calories, activity type)
     f) Body composition (fat %, muscle, hydration)
     g) Composite score (combines multiple metrics)
     h) Something else (describe)

3. "Should this run in real-time on the device, or is it OK to compute
    after data collection (e.g., in the dashboard)?"
   → Options:
     a) Real-time — I need instant feedback (Tier 0-1)
     b) On-demand — user triggers it manually (Tier 2)
     c) After-the-fact — computed from stored data (Tier 3)
     d) Not sure — help me decide
```

After Round 1: classify the algorithm using §1.1 Category Router.

### 5.2 Round 2 — Visualization

Before diving into technical details, propose a visualization concept. The AI
designs the panel based on what the algorithm produces — this is where creative
freedom shines. Present the concept for user feedback BEFORE locking anything in.

```
ROUND 2 FORMAT:
"Here's how I'd visualize this on the dashboard:

  ┌─────────────────────────────────────────┐
  │  [ID]: [Name]           [layout] · T[n] │
  │  ─────────────────────────────────────── │
  │                                         │
  │  [ASCII sketch of the panel layout]     │
  │  E.g.: big number with zone arc,        │
  │        scrolling waveform, court heatmap │
  │        radar chart, phase bar, etc.     │
  │                                         │
  └─────────────────────────────────────────┘

  Concept: [2-3 sentences describing what the user will see]

  Key elements:
  • [Element 1] — [what it shows and why]
  • [Element 2] — [what it shows and why]
  • [Element 3] — [what it shows and why]

  Panel size: [1x1 | 2x1 | 2x2] — [why this size]

  Does this look right? Want a different style (e.g., more charts,
  simpler, heatmap instead of gauge, bigger panel)?"
```

**GUIDELINES FOR ROUND 2:**
- Think about what the DATA looks like, not what category the algorithm is in
- A tennis algorithm might need a court heatmap — not a generic gauge
- A cardiac algorithm might need a scrolling ECG waveform — not a pie chart
- A composite score might need a score ring with breakdown bars
- Be creative: radar charts, body maps, spectrograms, Poincaré plots are all fair game
- If the user doesn't like the concept, iterate — propose alternatives
- Once the user approves (or says "looks good"), move to Round 3
- The approved concept drives the `display.js` generation in §12

### 5.3 Round 3 — Sensors & Hardware

AI pre-fills recommendations based on Round 1, then presents for confirmation:

```
ROUND 2 FORMAT:
"Based on your description, here's what I recommend:

  Channels:  CH_ACCEL + CH_GYRO
  Why only IMU channels: This algorithm detects movement patterns,
               not physiological signals — no PPG/ECG/EDA needed.
  Why: Tennis forehand detection is a movement pattern. The 6-axis IMU
       captures arm acceleration (CH_ACCEL) and rotational velocity
       (CH_GYRO) at 50 Hz — enough to distinguish forehand from
       backhand and measure swing metrics.

  Does this look right? Want to add or change any sensors?"
```

**VALIDATION IN ROUND 2:**
- If the user suggests a sensor that doesn't match the algorithm type → explain why and suggest correct alternative (use §3.3 mistake table)
- If the user agrees with recommendation → proceed to Round 3
- If the user adds sensors → validate each addition before accepting

### 5.4 Round 4 — Algorithm Method

AI proposes 2–3 proven methods:

```
ROUND 3 FORMAT:
"For [algorithm], here are proven approaches:

  Method A: [Name]
  • How it works: [1-2 sentence description]
  • Proven in: [citation]
  • Pros: [trade-off]
  • Cons: [trade-off]
  ★ Recommended for your use case

  Method B: [Name]
  • How it works: [1-2 sentence description]
  • Proven in: [citation]
  • Pros: [trade-off]
  • Cons: [trade-off]

  Which method do you prefer? Or should I go with the recommended one?"
```

For HEALTH algorithms: methods MUST come from peer-reviewed literature.
For SPORT algorithms: methods can come from biomechanics literature or validated IMU analysis techniques.

### 5.5 Round 5 — Parameters & Edge Cases

AI pre-fills from the chosen method, presents key parameters:

```
ROUND 4 FORMAT:
"Here are the key parameters with recommended defaults:

  | Parameter | Default | Range | Why |
  |-----------|---------|-------|-----|
  | ... | ... | ... | ... |

  And the edge cases I'll handle:
  | Condition | Behavior |
  |-----------|----------|
  | ... | ... |

  Anything you'd like to adjust, or shall I proceed with these defaults?"
```

**VALIDATION IN ROUND 5:**
- If user sets extreme parameter values → warn with context (e.g., "SQI threshold of 0.95 means the algorithm will suppress output almost always — most algorithms use 0.3–0.6")
- Accept reasonable customizations without pushback

### 5.6 Round 6 — Review & Confirm

Present the complete spec. Same checkpoint as Auto Mode Step 5:

```
"Here's the complete algorithm specification. Review it carefully:

[... full spec.md content ...]

Confirm to proceed with building all files, or tell me what to change."
```

On confirmation → build all files (same as Auto Mode Step 6).

---

## 6. MEDICAL CORRECTNESS RULES

These rules apply to ALL `health-biometric` and `hybrid` algorithms. They are **non-negotiable**.

### 6.1 Every Formula Must Have a Citation

No formula appears in code without a comment citing its source:

```cpp
// SpO2 = 110 - 25 * R
// Source: Maxim AN6409 "Guidelines for SpO2 Measurement Using MAX30101/2"
// Validated range: R ∈ [0.4, 1.0] → SpO2 ∈ [85%, 100%]
// Note: Linear approximation. Clinical accuracy requires empirical
// calibration curve per device batch. Not a medical device.
```

Acceptable citation sources (in order of preference):
1. **Peer-reviewed journal papers** (IEEE, JBHI, Physiological Measurement)
2. **Chip manufacturer application notes** (Maxim/Analog Devices ANs)
3. **Textbooks** (Webster "Medical Instrumentation", Bronzino "Biomedical Engineering")
4. **Validated open-source implementations** (PhysioNet, HeartPy, NeuroKit2)

**Unacceptable sources:** Blog posts, Stack Overflow, ChatGPT-generated formulas, uncited "common knowledge."

### 6.2 Physiological Range Clamping

Every health output MUST be hard-clamped to physiologically possible ranges:

```
Heart Rate:        30–220 BPM
SpO2:              70–100 %
Respiratory Rate:  4–60 breaths/min
Blood Pressure:    SBP 60–250, DBP 30–150 mmHg
Skin Temperature:  25–42 °C
HRV RMSSD:         0–300 ms
EDA:               0.01–100 µS
SpO2 R-ratio:      0.2–2.0
PTT:               100–500 ms
```

### 6.3 Signal Quality Index (SQI)

Every real-time algorithm MUST compute an SQI (0.0–1.0) alongside its output:

```cpp
struct AlgorithmOutput {
    float    value;          // The computed metric
    float    sqi;            // 0.0 = garbage, 1.0 = perfect signal
    uint32_t timestamp_ms;   // millis() at computation time
    bool     valid;          // false = suppress display, show "--"
};
```

**SQI computation methods by sensor:**
- **PPG**: Perfusion index + waveform morphology + motion energy
- **ECG**: R-peak SNR > 3dB + baseline wander < 0.5mV + electrode impedance < 50kΩ
- **EDA**: Signal variance within expected range + no rail-to-rail saturation
- **IMU**: Sensor self-test pass + no clipping at ±16g
- **Temperature**: Rate of change < 2°C/min (faster = sensor detached)

When SQI falls below the algorithm's specific **SQI Threshold** → **suppress the output entirely** (show "--"). Don't show bad data.

*SQI thresholds are algorithm-specific. SpO2 needs ≥ 0.6. Heart rate only needs ≥ 0.3.*

### 6.4 Confidence Intervals

Where applicable, report confidence range (not just point estimate):

```cpp
struct CalibratedOutput {
    float value;       // Point estimate
    float ci_low;      // 95% CI lower bound
    float ci_high;     // 95% CI upper bound
    float sqi;
    uint32_t timestamp_ms;
    bool  valid;
    bool  calibrated;           // false = "Calibration needed"
    uint32_t calibration_age_ms;
};
```

Applies to: Blood pressure, SpO2, VO2max, biological age.
Does NOT apply to: Heart rate, step count, temperature (direct measurements).

### 6.5 Calibration Transparency

Algorithms requiring calibration (e.g., BP PTT) MUST:
1. Clearly state calibration status in output
2. Refuse clinical-grade output when uncalibrated (show "Calibration needed")
3. Track calibration age — prompt recalibration after 14 days
4. Never silently degrade

### 6.6 Regulatory Classification

| Classification | Meaning | UI Treatment |
|---|---|---|
| **Wellness** | General fitness (steps, calories, sleep) | Show normally |
| **Health Indicator** | Physiological insight (HRV, EDA stress) | Show with context |
| **Health Screening** | Clinical-adjacent (SpO2, BP, ECG rhythm) | Show with disclaimer |
| **Sport Performance** | Movement technique / athletic metrics | Show normally |

For **Health Screening**: dashboard MUST display: *"This is not a medical device. Consult a healthcare provider for medical decisions."*

### 6.7 Algorithm Dependency Graph

Every algorithm declares what it **Consumes** and what **Consumed by** it. This forms a pipeline architecture (Reference: BioSPPy pipeline, Bota et al. 2024).

Example — `A01_heart_rate`:
- **Consumes**: `CH_PPG`
- **Outputs**: `float bpm`
- **Consumed by**: `A02` (HRV), `A24` (Calories), `X01` (PTT-BP), `C01` (Recovery)

---

## 7. SPORT & MOTION CORRECTNESS RULES

These rules apply to ALL `sport-motion` algorithms and the motion components of `hybrid` algorithms.

### 7.1 Movement Feature Extraction Standards

For IMU-based motion algorithms, use these standardized feature extraction methods:

**Time-domain features** (always include):
- Mean, variance, RMS of each axis
- Peak acceleration magnitude
- Zero-crossing rate
- Signal magnitude area (SMA): `SMA = (1/N) × Σ(|ax| + |ay| + |az|)`

**Frequency-domain features** (when periodicity matters — cadence, gait, swing):
- Dominant frequency via FFT or autocorrelation
- Spectral energy in relevant bands
- Frequency ratio between bands

**Orientation features** (when body position matters):
- Gravity-separated acceleration: `a_dynamic = a_total - a_gravity`
- Rotation integration from gyroscope (short windows only — drift accumulates)
- Quaternion estimation for orientation-dependent algorithms

### 7.2 Signal Profile Characterization (MANDATORY)

Before designing a detection algorithm, **characterize the target signal's waveform shape**. Do NOT assume clean single-peak threshold crossings. Real wrist-worn IMU signals are complex, multi-lobe, and noisy.

For every sport/motion algorithm, document in the spec:

1. **Signal envelope shape**: Is the target event a single peak, multi-peak, oscillating, sustained plateau, or impulse? Sketch the expected acceleration/gyro profile over time.
   - Example — Tennis forehand: Multi-lobe (backswing peak → dip → forward swing peak → impact spike → follow-through oscillation). Total duration 400–800ms.
   - Example — Walking step: Periodic dual-peak (heel strike + toe-off) per gait cycle. ~500ms per step.
   - Example — Bicep curl: Smooth single peak per rep. ~2s per rep.

2. **Peak count per event**: How many acceleration peaks does ONE real event produce? This determines whether threshold-crossing alone works or needs windowing.
   - 1 peak → Simple threshold works
   - 2–4 peaks → **Must use fixed-window capture** (no early exit on signal drop)
   - Sustained → Use energy integration, not peak detection

3. **Inter-event gap**: Minimum time between consecutive events. This sets the cooldown floor.

4. **Axis behavior**: Which axes carry the discriminating signal? Does the primary axis change during the event? (e.g., tennis: sagittal plane rotation dominates, but axis depends on grip)

**Rule: If the signal profile is multi-peak or oscillating, NEVER use early exit on signal drop.** Use a fixed-duration capture window that spans the full event, then classify from the captured peaks.

### 7.3 Event Segmentation Strategy (MANDATORY)

Event segmentation = reliably isolating ONE discrete movement event from a continuous noisy IMU stream. This is the hardest part of any sport algorithm. The skill requires choosing an explicit strategy:

**Strategy A: Fixed-Window Capture (recommended for impulsive events)**
```
Trigger: accelMag > threshold
→ Open fixed-duration window (e.g., 400ms)
→ Collect ALL peaks during window (do NOT exit early on signal drop)
→ At window end: classify from collected peaks
→ Enter cooldown for min inter-event gap + follow-through duration
```
Use for: tennis strokes, punches, golf swings, jumps — any event with multi-peak acceleration.

**Strategy B: Threshold Crossing with Hysteresis (for simple single-peak events)**
```
Trigger: signal > upper_threshold
→ Event active until signal < lower_threshold (lower < upper)
→ Record peak during the active window
→ Enter cooldown
```
Use for: step counting, simple rep counting — clean single-peak events.

**Strategy C: Energy Windowing (for sustained/periodic events)**
```
Compute sliding-window energy: E = Σ(a² + g²) over N samples
→ Event when E > energy_threshold for minimum duration
→ End when E < energy_threshold for minimum gap
```
Use for: activity recognition, workout detection — sustained patterns.

**Anti-pattern: Threshold + Early Accel Drop** — Triggering on accel > threshold then ending when accel < threshold * K. This FAILS for multi-peak signals because the inter-peak dip terminates the detection prematurely, causing:
- Over-counting (one real event → multiple false detections)
- Wrong classification (short duration → misclassified)
- Missed peaks (peak gyro/accel occurs after premature exit)

### 7.4 Sport Algorithm Validation

Sport algorithms MUST define:
1. **Ground truth method**: How to verify the algorithm is correct (e.g., video analysis, manual counting, force plate)
2. **Accuracy target**: Specific metric with tolerance (e.g., "Rep count within ±1 rep per set", "Cadence within ±3 SPM")
3. **Test scenarios**: At minimum — normal execution, boundary speed/intensity, idle/no-motion, mixed/transitional movements

### 7.5 Range Checking (instead of physiological clamping)

Sport outputs don't have physiological limits like health metrics, but they DO have sensible ranges:

```
Step cadence:      0–250 SPM (above = probably vehicle vibration)
Running cadence:   120–220 SPM
Swing count:       0–200 per session
Rep count:         0–100 per set
Movement velocity: 0–50 m/s (above = likely sensor error)
Rotation rate:     0–2000 °/s (IMU hardware limit)
```

Algorithms MUST range-check outputs and suppress values outside sensible bounds.

---

## 8. PRIVACY & DATA RULES

**ALL signal processing happens on-device** (nRF52840 or browser). Never:
- Send raw sensor data to any server
- Include PII in BLE payloads
- Require internet for any algorithm to function
- Phone-home, beacon, or transmit analytics

BLE characteristics contain **only computed float values** (4 bytes per metric). Device name is generic ("OpenPulse"). User calibration data in **browser localStorage only**. User can delete all data via "Clear Data" button.

---

## 9. FIRMWARE ENGINEERING RULES

### 9.1 Memory Safety (nRF52840: 256KB RAM)

```
HARD RULES:
- No dynamic allocation (malloc/new) in loop() — ALL buffers at compile time
- No String class — use char[] with bounds checking
- No recursion — stack is only 8KB
- No double — use float (saves 50% RAM on Cortex-M4)
- No printf/sprintf — use Serial.print() chains
- Maximum total algorithm RAM budget: 16KB
```

### 9.2 Ring Buffer Pattern

Every sensor and algorithm uses `RingBuffer<T, N>` from `firmware/src/framework/RingBuffer.h`. Buffer sizes from the spec's window requirement:

| Use Case | N | Memory |
|----------|---|--------|
| PPG peak detection | 512 (5.12s @ 100 Hz) | 2KB |
| HRV R-R intervals | 128 (~2 minutes) | 1KB |
| EDA | 64 (6.4s @ 10 Hz) | 256B |
| Temperature | 16 (16s @ 1 Hz) | 64B |
| IMU motion features | 256 (5.12s @ 50 Hz) | 2KB |

### 9.3 Algorithm Base Class

Every algorithm inherits from `AlgorithmBase` defined in `firmware/src/framework/AlgorithmBase.h`:

```cpp
class AlgorithmBase {
public:
    virtual void init() = 0;
    virtual void update(uint32_t now_ms) = 0;
    virtual AlgorithmOutput getOutput() const = 0;
    virtual AlgoState getState() const = 0;
    virtual const char* getID() const = 0;
    virtual const char* getName() const = 0;
    virtual const char* getUnit() const = 0;
    virtual AlgoClassification getClassification() const = 0;
    virtual AlgoTier getTier() const = 0;
    virtual uint16_t ramUsage() const = 0;
};
```

### 9.4 Execution Tiers

| Tier | Name | When Called | Time Budget | RAM Budget |
|------|------|------------|-------------|------------|
| 0 | REALTIME | Every `loop()` | < 200µs | < 2KB |
| 1 | PERIODIC | Fixed interval (scheduler) | < 1ms | < 4KB |
| 2 | ON_DEMAND | User-triggered | < 10ms | < 8KB |
| 3 | OFF_DEVICE | Browser JS only | Unlimited | Unlimited |

### 9.5 Non-Blocking Execution

- No `delay()` inside any algorithm
- No `while()` waiting for sensor data — use state machines
- I2C reads split: request in one call, read in the next
- BLE.poll() between sensor reads

### 9.6 Motion Artifact Rejection

Any algorithm using PPG or ECG MUST compute continuous motion level from IMU:

```cpp
float computeMotionLevel(uint32_t now_ms) {
    float accelMag = sqrt(ax*ax + ay*ay + az*az);
    float motion_g = abs(accelMag - 1.0f);
    return min(motion_g / 2.0f, 1.0f);  // 0.0=still, 1.0=heavy motion
}
```

Sensitivity varies:
- **SpO2**: Suppress > 0.3g motion (extremely motion-sensitive)
- **Heart Rate**: Robust up to 1.0g with adaptive filtering
- **ECG**: Mark as "motion artifact" in rhythm analysis
- **PTT/BP**: Suppress entirely during motion

### 9.7 Sensor Manager & Hardware Modes

The `SensorManager` orchestrates physical sensor configurations. When on-demand algorithms activate, it transitions the active PPG driver mode (e.g., from PPG_ONLY to PPG_AND_ECG). Prevents conflicts by halting lower-priority algorithms. Algorithms never reference chip names — they request channel modes.

### 9.8 Multi-Output Algorithms

Some algorithms produce more than one metric (e.g., running form → cadence + ground contact time + vertical oscillation, or body composition → fat % + muscle mass + hydration). The framework's `getOutput()` returns a single `float`. Use these patterns for multi-output:

**Pattern A: Primary + Secondary Getters (preferred)**
```cpp
class Algo_U05_RunningForm : public AlgorithmBase {
  float cadence_, gct_, vertOsc_;
public:
  float getOutput() override { return cadence_; }  // Primary metric
  float getGCT()     const { return gct_; }        // Secondary
  float getVertOsc() const { return vertOsc_; }     // Secondary
};
```
BLE: Primary metric uses the standard characteristic. Secondary metrics use a custom BLE characteristic or a packed byte array on a single characteristic.

**Pattern B: Packed struct (for Tier 3 off-device)**
```cpp
struct RunningFormResult {
  float cadence;
  float gct_ms;
  float vert_osc_cm;
};
```
Tier 3 algorithms compute on the companion app and can return structured objects directly — no single-float constraint.

**Rule:** Declare all output metrics in the spec under `## Output Metrics` with units, ranges, and which is the primary `getOutput()` value.

---

## 10. SIGNAL PROCESSING RULES

### 10.1 Filter Design

```
- Filter cutoff < (sample_rate / 2) — Nyquist
- Apply low-pass BEFORE downsampling
- DC removal: high-pass at 0.1 Hz for PPG, 0.5 Hz for ECG
- Powerline: optional notch at 50/60 Hz for ECG
- Use IIR (Butterworth) on MCU — FIR is too expensive
- Pre-compute coefficients — include design params in comments
```

Generate filter coefficients with `tools/filter_designer.py`:
```bash
python3 tools/filter_designer.py --preset ppg
```

### 10.2 Multi-Method Peak Detection

Every peak-detection algorithm defines at least 2 alternative methods:

**PPG:**
1. HeartPy Adaptive Moving Average (van Gent et al. 2019) — robust against noise
2. NeuroKit2 Gradient-Based (Makowski et al. 2021) — low latency, less robust

**ECG:**
1. Pan-Tompkins (1985) — gold standard, robust, higher latency
2. Hamilton (2002) — faster, less accurate during arrhythmias

### 10.3 PPG Nomenclature

Use standardized pyPPG nomenclature (Charlton et al. 2024):
- **S**: Systolic Peak, **DN**: Dicrotic Notch, **D**: Diastolic Peak
- SDPPG waves: **a** (initial systole), **b** (deceleration), **c** (late systole), **d** (early diastole), **e** (late diastole)

### 10.4 EDA Decomposition

Use **cvxEDA** for tonic/phasic separation (Greco et al. 2016).

### 10.5 Sleep Staging

Standard **30-second epochs**. Classify each epoch as Wake/Light/Deep/REM using HR mean, HRV RMSSD, IMU RMS, Temp Delta, EDA Variance. MCU: weighted rule-based. Dashboard: ML classification.

### 10.6 Cross-Sensor Timestamp Alignment

Always interpolate to the fastest clock:
```cpp
float alignedEDA = edaBuffer.interpolateAt(ppgTimestamp);
```
Never assume sensors are synchronized — always use `millis()` timestamps.

### 10.7 Baseline Estimation

Oura-style dual-horizon model:
1. **Short-term (14-day)**: Exponential decay weighted average (α = 0.15)
2. **Long-term (2-month)**: Unweighted median

Days 1–3: "Gathering baseline..." → Day 4: preliminary values → Day 14: confident scores.

### 10.8 SpO2-Specific Signal Processing

SpO2 requires dual-wavelength PPG (Red + IR LEDs). The PPG driver must be configured in **Red+IR mode** (not Green LED mode used for HR). The algorithm spec declares `PPG Mode: Red+IR` — the firmware driver handles the physical LED switching for whatever chip is connected.

**Processing pipeline:**
1. **LED sequencing** — Red and IR LEDs alternate. Separate the interleaved samples into red[] and ir[] arrays.
2. **AC/DC separation** — For each channel: DC = low-pass filtered signal (< 0.5 Hz), AC = bandpass filtered (0.5–5 Hz). Use the same filter structure as §10.1.
3. **R-ratio calculation** — `R = (AC_red / DC_red) / (AC_ir / DC_ir)`. This is the core measurement.
4. **SpO2 lookup** — `SpO2 = 110 - 25 * R` (linear approximation). For production, use a calibration curve (polynomial or lookup table from clinical validation).
5. **Window averaging** — Average R over 4–8 second windows (4–8 heartbeats). Single-beat SpO2 is too noisy.
6. **Motion sensitivity** — SpO2 is extremely motion-sensitive. Require SQI > 0.7 (stricter than HR). During motion, either suppress output or flag as low-confidence.
7. **Physiological clamp** — Valid range: 70–100%. Below 70% is sensor error, not hypoxia.

### 10.9 Sensor Fusion Methods

When an algorithm combines data from multiple sensor modalities, use one of these fusion strategies:

**Method 1: Normalized Weighted Score (for composite scores)**
```
score = w1 * normalize(metric1) + w2 * normalize(metric2) + ... + wN * normalize(metricN)
where normalize(x) = (x - baseline) / (max - baseline), clamped to [0, 1]
```
Use for: recovery score, biological age, sleep score. Weights should be justified by literature or user-configurable.

**Method 2: Rule-Based State Machine (for state detection)**
```
State transitions based on thresholds across multiple signals:
  IF hr < resting_hr + 10 AND movement < 0.1g AND eda_slope < 0 → RESTING
  IF hr > zone2_threshold AND movement > 1.5g → EXERCISE
  IF hr elevated AND movement low AND eda rising → STRESS
```
Use for: stress-vs-exercise discrimination, sleep stage detection, activity state classification.

**Method 3: Deviation Aggregation (for anomaly/trend detection)**
```
anomaly_score = Σ |metric_i - baseline_i| / std_i
```
Use for: illness warning, overtraining detection, anomaly alerts. Each metric's deviation from its personal baseline contributes proportionally.

---

## 11. CODE GENERATION PROCEDURE

When generating code after spec confirmation, follow this exact sequence:

### Step 1: Assign ID

- If the algorithm is a core A/X/C algorithm → use the pre-assigned ID from registry
- If it's a user algorithm → assign next U-series ID (scan `algorithms/U*/` for max)

### Step 2: Create algorithm directory

```
algorithms/<ID>_<snake_case_name>/
```

### Step 3: Generate `spec.md`

Use the spec template from §13. Every field must be filled — no blanks, no TODOs.

### Step 4: Generate `Algo_<ID>.h` (firmware header)

Use the firmware header template. Key structure:

```cpp
#pragma once
#include "../../framework/AlgorithmBase.h"
#include "../../framework/RingBuffer.h"
#include "../../framework/Channels.h"
// Include dependency algorithm headers if any

class Algo_<ID> : public AlgorithmBase {
public:
    void init() override;
    void update(uint32_t now_ms) override;
    AlgorithmOutput getOutput() const override;
    AlgoState getState() const override;
    const char* getID() const override { return "<ID>"; }
    const char* getName() const override { return "<Human Name>"; }
    const char* getUnit() const override { return "<unit>"; }
    AlgoClassification getClassification() const override {
        return AlgoClassification::<WELLNESS|HEALTH_INDICATOR|HEALTH_SCREENING>;
    }
    AlgoTier getTier() const override { return AlgoTier::<REALTIME|PERIODIC|ON_DEMAND|OFF_DEVICE>; }
    uint16_t ramUsage() const override { return sizeof(*this); }

private:
    AlgoState state_ = AlgoState::IDLE;

    // Ring buffers — sized from spec
    RingBuffer<float, BUFFER_SIZE> buffer_;

    // Algorithm-specific state (filter states, counters, accumulators)
    // ...

    // Output cache
    AlgorithmOutput output_ = {0, 0, 0, false};

    // Internal methods
    float computeSQI() const;
};
```

### Step 5: Generate `Algo_<ID>.cpp` (firmware implementation)

Structure every file identically:

```cpp
#include "Algo_<ID>.h"
// ═══════════════════════════════════════════════════════
// <ID>: <Name>
// <One-line description>
//
// Category: <health-biometric | sport-motion | hybrid>
// Classification: <Wellness | Health Indicator | Health Screening | Sport Performance>
// Tier: <0-3>
// Consumes: <CH_PPG, CH_ACCEL, ...>
// Consumed by: <A02, X01, ... or "none">
// Citation: <primary reference>
// ═══════════════════════════════════════════════════════

// ─── Constants (NO magic numbers in algorithm code) ────
namespace {
    constexpr float PARAM_NAME = value;  // Meaning, citation
    // ... all parameters from spec
}

// ─── Init ──────────────────────────────────────────────
void Algo_<ID>::init() {
    buffer_.clear();
    state_ = AlgoState::ACQUIRING;
    output_ = {0, 0, 0, false};
    // Reset all internal state
}

// ─── Update ────────────────────────────────────────────
void Algo_<ID>::update(uint32_t now_ms) {
    // 1. Read input from sensor driver or dependency
    // 2. Check SQI — if below threshold, set LOW_QUALITY, return
    // 3. Push to ring buffer with timestamp
    // 4. If not enough data, stay ACQUIRING, return
    // 5. Run algorithm core
    // 6. Clamp output to valid range
    // 7. Update output_ with value + SQI + timestamp + valid
    // 8. Set state_ = AlgoState::VALID
}

// ─── SQI ───────────────────────────────────────────────
float Algo_<ID>::computeSQI() const {
    // Signal-specific quality assessment (0.0–1.0)
    // See spec SQI section for computation details
}

// ─── Getters ───────────────────────────────────────────
AlgorithmOutput Algo_<ID>::getOutput() const { return output_; }
AlgoState Algo_<ID>::getState() const { return state_; }
```

### Step 6: Generate `test_vectors.h`

Signal simulation approach — NOT hardcoded arrays. Use mathematical models:

```cpp
#pragma once
// Test scenarios for <ID>: <Name>
// Compile: clang++ -std=c++17 -I../../framework -o test_<id> ../../test/test_runner.cpp
// (add algorithm source files to compilation)

struct TestScenario_<ID> {
    const char* description;
    float param1;       // Algorithm-specific test parameter
    float param2;       // ...
    float expectedOutput;
    float tolerance;
    bool  expectValid;  // false = algorithm should suppress output
};

static const TestScenario_<ID> SCENARIOS_<ID>[] = {
    // Must cover: normal, boundary-low, boundary-high, no-signal, artifact
    { "Clean normal condition",    ..., ..., expected, ±tol, true  },
    { "Boundary low",              ..., ..., expected, ±tol, true  },
    { "Boundary high",             ..., ..., expected, ±tol, true  },
    { "No signal / sensor off",    ..., ..., 0.0f,    0.0f, false },
    { "Heavy artifact / noise",    ..., ..., 0.0f,    0.0f, false },
    { "Gradual transition",        ..., ..., expected, ±tol, true  },
    { "Edge: low quality signal",  ..., ..., expected, ±tol, true  },
};

static constexpr int SCENARIO_COUNT_<ID> = sizeof(SCENARIOS_<ID>) / sizeof(SCENARIOS_<ID>[0]);
```

**Step 6b: Generate `test_scenarios.js` (Tier 3 only)**

Tier 3 algorithms run in the browser via `algo_<id>.js`. C++ test vectors are meaningless for them. Generate a JavaScript test file instead:

```javascript
// test_scenarios.js — Test scenarios for <ID>: <Name>
// Run: node test_scenarios.js (or import in browser test harness)

import { compute } from './algo_<id>.js';

const scenarios = [
  {
    description: "Clean normal condition",
    input: { /* algorithm-specific mock data */ },
    expected: { primary: 75.0, valid: true },
    tolerance: 2.0,
  },
  {
    description: "Insufficient data (day 1)",
    input: { /* sparse data */ },
    expected: { primary: null, valid: false },
    tolerance: 0,
  },
  {
    description: "Boundary high",
    input: { /* extreme but valid data */ },
    expected: { primary: 95.0, valid: true },
    tolerance: 3.0,
  },
  // Must cover: normal, insufficient data, boundary-low, boundary-high,
  // missing sub-algorithm data, gradual trend change
];

scenarios.forEach(s => {
  const result = compute(s.input);
  const pass = s.expected.valid
    ? Math.abs(result.value - s.expected.primary) <= s.tolerance
    : result.value === null;
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${s.description}`);
});
```

**Rule:** If the algorithm is Tier 3, generate `test_scenarios.js` instead of `test_vectors.h`. If the algorithm has both firmware (Tier 0–2) and companion (Tier 3) components, generate both.

### Step 7: Generate `display.js` (dashboard visualization module)

Write `render()` and `update()` functions that build a custom visualization for this algorithm. The AI has full creative control — design the visualization to best communicate what the algorithm produces. See §12 for the API contract and guidelines.

### Step 8: Generate `algo_<id>.js` (Tier 3 only)

For off-device algorithms that run in the browser. See §14 for template.

### Step 9: Update registry

Add the algorithm to `.agents/skills/openpulse_algorithm/resources/algorithm_registry.md`.

### Step 10: Verify against checklist

Run the review checklist from §16 mentally. If any check fails, fix it before reporting to user.

---

## 12. DISPLAY MODULE GENERATION

Each algorithm ships a `display.js` file containing **executable visualization code**. The AI has **full creative control** over how the algorithm renders on the dashboard — there is no fixed menu of layout types. The visualization emerges from the algorithm's purpose.

### 12.1 Architecture

The dashboard is a generic execution engine. When a panel opens, it calls `render()` to build the DOM. On every sensor tick, it calls `update()` with fresh data. The AI writes both functions. The dashboard provides:

- A `<div class="panel-body">` container (the canvas to work with)
- A `state` object with real-time data
- Utility functions (`drawSparkline`, `drawHeatmap`, `sizeCanvas`)
- CSS variable access to the design system (colors, fonts, spacing)
- Full DOM/Canvas/SVG API access

### 12.1a Dashboard Data Pipeline Constraints (CRITICAL)

**Before writing ANY display.js that processes raw sensor history, understand these runtime constraints:**

1. **Rolling buffer**: `sensorData[ch].history` is a **bounded rolling array** with max length `HISTORY_MAX` (currently 60). Old samples are shifted off the front via `array.shift()`. You CANNOT use an ever-incrementing index into this array — it will exceed the array length after `HISTORY_MAX` samples and silently stop processing.

2. **Sample tracking**: Use `sensorData[ch].sampleCount` (total samples ever received, monotonically increasing) to track which samples are new. Compute `newSamples = sampleCount - lastProcessed`, then read from `history[len - newSamples]` to `history[len - 1]`.

3. **Update frequency**: `update()` is called once per BLE notification on any subscribed channel. For vec3 channels (accel, gyro), this means ~50 Hz from each channel. If the algo subscribes to both accel AND gyro, `update()` fires ~100 times/sec — but each call may have 0 new samples for the non-triggering channel.

4. **Batch processing timing**: Within one `update()` call, `Date.now()` returns the same value for all loop iterations. If your algorithm needs per-sample timing (swing duration, cooldown), use **sample-count-based timing**: `durationMs = sampleCount * (1000 / sampleRate)`. Never use wall-clock for intra-batch timing.

5. **Vec3 sub-channels**: For vec3 channels (`accel`, `gyro`), the dashboard provides:
   - `sensorData.accel` — magnitude history (scalar)
   - `sensorData.accelX`, `sensorData.accelY`, `sensorData.accelZ` — per-axis history
   - Same for `gyro` → `gyroX`, `gyroY`, `gyroZ`
   Each sub-channel has its own `.history`, `.sampleCount`, `.online`, `.latest`.

6. **History alignment**: Per-axis sub-channel histories (accelX, accelY, accelZ) are appended simultaneously by `onCharChanged()`, so `accelX.history[i]`, `accelY.history[i]`, `accelZ.history[i]` always correspond to the same physical sample.

**Mandatory pattern for display.js that processes raw samples:**
```javascript
// In update():
const ch = state.sensorData?.accelX;
if (!ch || ch.history.length === 0) return;
const len = ch.history.length;
let newSamples = Math.max(0, (ch.sampleCount || len) - this._totalProcessed);
this._totalProcessed = ch.sampleCount || len;
const startIdx = Math.max(0, len - newSamples);
for (let i = startIdx; i < len; i++) { /* process ch.history[i] */ }
```

### 12.2 Display Module Contract

```javascript
// display.js for <ID>: <Name>
// Dashboard visualization module — full AI-authored rendering
export default {
  // ── Metadata (required) ────────────────────────────────────
  id: '<ID>',
  name: '<Human Name>',
  version: 1,

  // ── Data Contract (required) ───────────────────────────────
  channels: ['ppg', 'accel'],       // Sensor channels this algo reads
  tier: 0,                          // 0-3
  classification: 'wellness',       // wellness | health-indicator | health-screening | sport-performance
  unit: 'BPM',                      // Output unit
  range: [30, 220],                 // Valid output range [min, max]
  size: '1x1',                      // Panel size: '1x1' | '2x1' | '2x2'

  // ── Parameters (optional) ─────────────────────────────────
  params: [
    { name: 'Bandpass Low', min: 0.3, max: 1.0, default: 0.5, step: 0.1, unit: 'Hz' },
  ],

  // ── Scoped CSS (optional) ─────────────────────────────────
  // Injected into <head> once. Use [data-algo-id="<ID>"] to scope.
  css: `
    [data-algo-id="<ID>"] .my-gauge { /* styles */ }
  `,

  // ── render(container, state) — REQUIRED ────────────────────
  // Called ONCE when the panel opens. Build the entire panel body.
  // 'container' is an empty <div class="panel-body">.
  // Use innerHTML, createElement, canvas, SVG — whatever the visualization needs.
  render(container, state) {
    container.innerHTML = `
      <div class="my-gauge">
        <div class="my-value">--</div>
        <canvas class="my-chart" width="300" height="80"></canvas>
      </div>
    `;
    // Size canvases for retina
    state.util.sizeCanvas(container.querySelector('.my-chart'));
  },

  // ── update(container, state) — REQUIRED ────────────────────
  // Called on EVERY sensor tick (~10 Hz in simulation, variable on hardware).
  // Update DOM elements, redraw canvases, animate transitions.
  update(container, state) {
    container.querySelector('.my-value').textContent = Math.round(state.output);
    state.util.drawSparkline(
      container.querySelector('.my-chart'),
      state.history,
      '#6366f1'
    );
  },

  // ── destroy(container) — optional ──────────────────────────
  // Called when the panel closes. Clean up intervals, observers, etc.
  destroy(container) {},
};
```

### 12.3 State Object

The `state` object passed to `render()` and `update()`:

```javascript
{
  output: 72.3,             // Primary value (clamped to algo.range)
  sqi: 0.85,                // Signal quality index (0.0–1.0)
  history: [72, 73, ...],   // Output history array (max HISTORY_MAX=60 points)
  sensorData: {             // Raw sensor data per channel
    ppg: {
      latest: 0.54,         // Most recent sample
      online: true,          // Whether sensor is streaming
      history: [0.51, ...], // Raw sample history (ROLLING BUFFER, max 60 items)
      sampleCount: 1042,    // Total samples ever received (monotonically increasing)
    },
    // For vec3 channels (accel, gyro), also includes per-axis sub-channels:
    // accelX: { latest, online, history, sampleCount },
    // accelY: { ... }, accelZ: { ... },
    // gyroX: { ... }, gyroY: { ... }, gyroZ: { ... },
  },
  elapsed: 12345,           // Milliseconds since algo started
  params: {                 // Current parameter values
    'Bandpass Low': 0.5,
  },
  algo: {                   // Algorithm metadata
    id: 'A01', name: 'Heart Rate', unit: 'BPM', range: [30, 220],
  },
  util: {                   // Dashboard utility functions
    drawSparkline(canvas, data, color),  // Line chart with gradient fill
    drawHeatmap(canvas, data, rows, cols), // Grid heatmap (data = flat array of 0..1)
    sizeCanvas(canvas),                  // Retina-aware canvas sizing
  },
}
```

### 12.4 Design System Variables

Available CSS custom properties (dark theme defaults shown):

```
--bg-0: #0a0a0f     --text-1: #e8e8f0    --accent: #6366f1
--bg-1: #12121a     --text-2: #a0a0b8    --green: #22c55e
--bg-2: #1a1a26     --text-3: #6a6a82    --red: #ef4444
--surface-1: #2a2a38  --orange: #f59e0b   --cyan: #06b6d4
--surface-2: #32323f  --pink: #ec4899     --purple: #a855f7
--font-mono: 'JetBrains Mono', monospace
--font-sans: 'Inter', system-ui, sans-serif
--radius-sm: 4px     --radius: 8px
```

### 12.5 Visualization Guidelines

**The AI decides what visualization to build.** There are no mandatory layout types. Design the visualization to best communicate what the algorithm produces. Examples of what's possible:

| Algorithm Type | Visualization Ideas |
|---|---|
| Real-time vital (HR, SpO2, temp) | Big number + color-coded zone arc + sparkline |
| Waveform morphology (ECG, PPG) | Scrolling real-time waveform + feature markers |
| Composite score (recovery, sleep) | Circular score ring + weighted breakdown bars |
| Cumulative counter (steps, kcal) | Large counter + delta badge + bar chart |
| Body composition (fat %, muscle) | Multi-metric grid + radar/spider chart |
| Trend analysis (temp baseline) | Time-series with baseline band + deviation markers |
| Sleep phases | Segmented horizontal phase bar + hypnogram |
| Event detection (snoring, arrhythmia) | Event list with timestamps + count badge |
| Sport technique (running, tennis) | Custom court/track heatmap + zone annotations |
| Vascular/cardiac | Pressure waveform + systolic/diastolic markers |
| Stress/autonomic | Dual-axis chart (sympathetic vs parasympathetic) |
| Boolean state (workout active) | Large status icon + duration timer + threshold bar |

**These are suggestions, not constraints.** The AI can invent entirely new visualizations — radar charts, 3D projections, animated gauges, court diagrams, body maps, frequency spectrograms, Poincaré plots, whatever best serves the data.

### 12.6 Best Practices

1. **Match visualization to data semantics.** A heart rate deserves a gauge with zones. A tennis stroke pattern deserves a court heatmap. A sleep algorithm deserves a hypnogram. Let the data drive the design.

2. **Use Canvas for complex/animated graphics** (waveforms, heatmaps, charts, custom shapes). Use DOM for text/labels/badges. Use SVG for simple vector graphics (gauges, rings, icons).

3. **Performance:** `update()` is called ~10 Hz. Keep it fast. Avoid innerHTML in update — mutate existing elements. Use `requestAnimationFrame` for heavy canvas work.

4. **Responsive:** The panel body width varies (280–560px depending on `size`). Use percentages, flexbox, or grid. Size canvases with `state.util.sizeCanvas()`.

5. **Scope CSS** with `[data-algo-id="<ID>"]` to avoid style leaks between panels.

6. **Graceful degradation:** Handle `state.output === 0`, `state.history.length === 0`, and `state.sqi === 0` (initial state before data flows).

7. **Color zones:** If the algorithm has meaningful ranges (normal/elevated/high), encode them as color transitions in the visualization.

8. **SQI indicator:** Always show signal quality somewhere — a mini bar, arc gauge, or color tint. Users need to know if the data is trustworthy.

### 12.7 Generation Rules

When generating `display.js`:

1. **Read the spec** — the Output section defines what to visualize (unit, range, update rate). The Algorithm section reveals what intermediate data is interesting. The Display section in the spec provides hints.

2. **Write `render()`** — build the full panel body DOM. Create all elements that `update()` will mutate. Initialize canvases. Show placeholder values ("--", empty charts).

3. **Write `update()`** — update values, redraw charts, animate transitions. Access data via `state.output`, `state.sqi`, `state.history`, `state.sensorData`.

4. **Write `css`** — scope everything with `[data-algo-id="<ID>"]`. Use design system variables for colors/fonts. Keep styles minimal and dark-theme compatible.

5. **Set `size`** — Use `'1x1'` for single-metric algorithms. Use `'2x1'` for waveforms or multi-metric. Use `'2x2'` for complex dashboards with multiple charts.

6. **Keep it self-contained.** The display module must not import external libraries or make network requests. It has access to: DOM API, Canvas API, SVG, CSS, and the utility functions on `state.util`.

7. **Test mentally:** Imagine the panel at 0 seconds (no data), at 5 seconds (data flowing), and at 5 minutes (history full). Does it look good in all three states?

---

## 13. SPEC TEMPLATE

Use this template for every algorithm spec. Save at `algorithms/<ID>_<name>/spec.md`.

Reference example: `.agents/skills/openpulse_algorithm/examples/A01_heart_rate_spec.md`.

All fields are **MANDATORY** unless marked (optional). No blanks. No TODOs.

````markdown
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

## Channel Input

Algorithms are hardware-agnostic. Declare ONLY the abstract data channels — NEVER chip names, puck positions, or I2C addresses.

  | Channel | Sample Rate | Bit Depth | Purpose in This Algorithm |
  |---------|-------------|-----------|---------------------------|
  | CH_PPG  | 100 Hz | 18-bit | Primary signal source |
  | CH_ACCEL | 50 Hz | 16-bit | Motion artifact rejection |

- **PPG Mode** (if CH_PPG used): Green | Red+IR | All
- **Buffer Size**: <samples> (<duration at sample rate>)
- **Minimum data**: <what is needed before first valid output>

## Algorithm

### Method
1. **Preprocessing**: <filters, DC removal, normalization>
2. **Feature Extraction**: <peaks, intervals, amplitudes, frequency features>
3. **Computation**: <the formula / model — with inline citation>
4. **Post-Processing**: <averaging, outlier rejection, smoothing>
5. **Output Gating**: <minimum data, no-signal behavior>

### Alternative Methods
- **Method A**: <Name> (<Citation>). <Trade-off>.
- **Method B**: <Name> (<Citation>). <Trade-off>.

### Parameters
| Parameter | Value | Unit | Source |
|-----------|-------|------|--------|
| <name> | <value> | <unit> | <citation or rationale> |

### SQI Computation
<How signal quality is assessed for this specific algorithm.>
- **SQI Threshold**: <0.0–1.0>

### Power & Resources
- **Power Mode**: continuous | duty-cycled | on-demand
- **Expected Current Draw**: <mA active> / <mA idle>
- **RAM Budget**: <bytes> (must be within tier budget)

## Validation
- **Validation Dataset**: <PhysioNet DB | sport dataset | custom>
- **Accuracy Target**: <metric> ± <tolerance> vs. <reference>

## Output
- **Type**: AlgorithmOutput | CalibratedOutput
- **Unit**: <BPM, %, °C, mmHg, µS, steps, score, ...>
- **Valid Range**: <min>–<max>
- **Update Rate**: <how often a new value is produced>
- **BLE Characteristic**: UUID `12345678-1234-5678-1234-56789abcdef<X>`
- **Zero/null means**: <what 0 or "--" indicates>

## Display
- **Visualization Concept**: <1–2 sentence description of what the panel should look like>
- **Primary Metric**: <label>, <unit>, <range>
- **Secondary Info**: <what else to show (SQI, sub-metrics, state, zones, etc.)>
- **Chart/Canvas**: <what graphical element to include (sparkline, waveform, heatmap, radar, etc.)>
- **Card Size**: <1x1 | 2x1 | 2x2>
- **Color Zones** (optional): [{ min, max, color, label }, ...]
- **Warmup Duration** (optional): <time before first valid output>

## Edge Cases
| Condition | Behavior |
|-----------|----------|
| No signal / sensor off | |
| Motion artifact | |
| Sensor saturation (ADC clipped) | |
| < minimum data collected | |
| Out-of-range result | |
| Dependency unavailable | |

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
````

### 13.1 Sport-Specific Sections (add when category = sport-motion)

Insert after `## Algorithm`:

````markdown
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
- **Quality Metric**: <movement quality score computation — e.g., consistency, symmetry>
````

---

## 14. DASHBOARD-SIDE ALGORITHMS (Tier 3)

Composite and trend algorithms run in the **browser**, not on the MCU.

### 14.1 Data Flow

```
nRF52840 (firmware)                    Browser (dashboard)
─────────────────                      ────────────────────
Tier 0-2 algorithms                    Receives BLE values
    │                                       │
    ├── HR, SpO2, PTT ──── BLE ────►  Store in IndexedDB
    ├── EDA, Temp    ──── BLE ────►  time-series history
    ├── IMU, Mic     ──── BLE ────►  14+ day rolling window
    │                                       │
    │                                  Tier 3 algorithms
    │                                  ├── Recovery Score (C01)
    │                                  ├── Sleep Score (C03)
    │                                  ├── Biological Age (C04)
    │                                  └── PDF Report (C08)
```

### 14.2 Dashboard Algorithm Template

For Tier 3 algorithms, generate `dev/dashboard/algorithms/algo_<id>.js`:

```javascript
// algo_<id>.js — <Name>
// Tier 3: Off-device algorithm (runs in browser)
// Consumes: <list of BLE channels or other algorithm outputs>

export default {
  id: '<ID>',
  name: '<Name>',

  // Required data channels (from IndexedDB time-series)
  requires: ['hr', 'hrv', 'skinTemp', ...],

  // Minimum data before first output
  minimumDays: 1,        // or 14 for baseline-dependent

  // Computation
  compute(data, userProfile) {
    // data = { hr: [...], hrv: [...], ... } — time-series from IndexedDB
    // userProfile = { age, weight, height, ... } — from localStorage
    //
    // Returns: { value, sqi, valid, breakdown: {...} }

    // 1. Validate data sufficiency
    // 2. Compute sub-scores
    // 3. Weighted combination
    // 4. Range-check output

    return {
      value: 0,
      sqi: 0,
      valid: false,
      timestamp: Date.now(),
      breakdown: {},  // Sub-score details for display
    };
  },
};
```

### 14.3 Dashboard Algorithm Rules

- Store time-series in **IndexedDB** (not localStorage)
- Baselines require **14 days minimum**; show "Collecting data (Day N of 14)"
- Score algorithms use **0–100 scale**: 0–29 Poor, 30–49 Below Average, 50–69 Average, 70–89 Good, 90–100 Excellent
- Composite scores show which sub-scores contributed
- Trend analysis: 7-day linear regression, 30-day EMA, 90-day rolling median with IQR outlier rejection

---

## 15. NAMING CONVENTIONS

```
── Directories ──
algorithms/A01_heart_rate/          Core base algorithm
algorithms/X06_stress_vs_exercise/  Core cross-sensor fusion
algorithms/C01_recovery_score/      Core composite score
algorithms/U01_tennis_forehand/     User-created algorithm

── Firmware Files ──
firmware/src/algorithms/base/Algo_A01.h       Base algorithm header
firmware/src/algorithms/base/Algo_A01.cpp     Base algorithm implementation
firmware/src/algorithms/fusion/Algo_X06.h     Fusion algorithm header
firmware/src/algorithms/fusion/Algo_X06.cpp   Fusion algorithm implementation
firmware/src/algorithms/base/Algo_U01.h       User algorithm (base → base/)
firmware/src/algorithms/fusion/Algo_U01.h     User algorithm (fusion → fusion/)

── Dashboard Files ──
dev/dashboard/algorithms/algo_u01.js          Tier 3 browser-side computation

── Display Module ──
algorithms/U01_tennis_forehand/display.js     Dashboard render module

── Test Vectors ──
algorithms/U01_tennis_forehand/test_vectors.h C++ test scenarios

── Classes & Constants ──
Class:      Algo_A01, Algo_U01
Constants:  A01_FILTER_CUTOFF_HZ, U01_PEAK_THRESHOLD_G
Buffers:    ppg_buffer_, accel_buffer_, gyro_buffer_
```

---

## 16. REVIEW CHECKLIST

Run this checklist mentally after generating every algorithm, before reporting to user. If ANY check fails, fix it.

```
CATEGORY-INDEPENDENT (always check)
  □ Spec has every mandatory field filled — no blanks, no TODOs
  □ Output is range-checked (physiological clamp OR sensible range)
  □ SQI computed and gates output
  □ State machine: IDLE → ACQUIRING → VALID → LOW_QUALITY all handled
  □ No malloc/new in loop, no delay(), no double, no String
  □ Total RAM within tier budget
  □ Non-blocking (< budget per update call)
  □ Test scenarios: normal, boundary-low, boundary-high, no-signal, artifact
  □ display.js layout matches algorithm output type
  □ Channels match between spec, .h, .cpp, and display.js
  □ No PII in BLE payloads or output structs
  □ All processing on-device or in-browser

HEALTH-BIOMETRIC (when category = health-biometric or hybrid)
  □ Every formula has a peer-reviewed citation
  □ Output clamped to physiological range (§6.2)
  □ SQI threshold is algorithm-specific (not a global default)
  □ Confidence intervals if applicable (BP, SpO2, VO2max)
  □ Calibration tracked if applicable
  □ Regulatory classification correct
  □ Disclaimer flag for Health Screening
  □ Dependency graph edges defined (Consumes / Consumed by)
  □ Validated against recommended dataset (§17)

SIGNAL PROCESSING (when algorithm processes raw signals)
  □ Filters respect Nyquist
  □ Adaptive thresholds (no magic numbers)
  □ Motion artifact rejection if PPG/ECG-based
  □ Timestamps used for cross-sensor alignment
  □ Baseline uses median, not mean (for trend algorithms)

SPORT-MOTION (when category = sport-motion or hybrid)
  □ Movement features clearly defined
  □ Biomechanical model documented
  □ Sensor placement assumptions stated
  □ Ground truth validation method defined
  □ Accuracy target with tolerance specified
  □ Range-check on outputs (sensible bounds)
```

---

## 17. VALIDATION DATASETS

### Health Algorithms

| Target Metric | Recommended Database | Accuracy Target |
|---|---|---|
| Heart Rate | MIT-BIH Arrhythmia Database | MAE < 2 BPM vs. ECG |
| HRV (RMSSD) | MIT-BIH Normal Sinus Rhythm | Correlation r ≥ 0.95 vs. ECG |
| SpO2 | MIMIC-III Waveform Database | Bias < 2% vs. CO-Oximetry |
| Sleep Staging | Sleep-EDF Database | Cohen's κ ≥ 0.6 (4-class) |
| PTT / BP | MIMIC-III (ECG+PPG+ABP) | RMSE < 5 mmHg (AAMI standard) |
| ECG Rhythm | MIT-BIH Arrhythmia Database | Sensitivity > 95% for AF detection |
| Respiratory Rate | Capnobase (PPG+capnography) | MAE < 2 breaths/min |

### Sport / Motion Algorithms

| Target Metric | Recommended Database | Accuracy Target |
|---|---|---|
| Activity Recognition | UCI HAR Dataset | F1 ≥ 0.90 (6-class) |
| Step Counting | PAMAP2 Physical Activity | Count error < 5% over 100 steps |
| Running Cadence | Custom (metronome-synchronized) | MAE < 3 SPM |
| Sport Technique | Custom (video-annotated) | Detection F1 ≥ 0.85 |
| Gait Analysis | WISDM Dataset | Stride length error < 10% |
| Fall Detection | SisFall Dataset | Sensitivity > 95%, Specificity > 90% |
