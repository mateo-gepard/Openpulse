/* ═══════════════════════════════════════════════════════════════
   OpenPulse DevWorkbench v6 — Building-Block Development UI
   ═══════════════════════════════════════════════════════════════ */

// ─── BLE UUIDs (must match firmware Channels enum) ────────────
const OP_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';

// ─── Channel Definitions ────────────────────────────────────
// Channels replace sensors. The UI doesn't care what chip sends
// the data, only what type of data it is.
const CHANNEL_DEFS = [
  { key: 'ppg',       uuid: '12345678-1234-5678-1234-56789abcdef1', name: 'PPG / Optics',     unit: 'raw',   decimals: 0, type: 'float' },
  { key: 'ecg',       uuid: '12345678-1234-5678-1234-56789abcdef2', name: 'ECG',              unit: 'mV',    decimals: 3, type: 'float' },
  { key: 'skinTemp',  uuid: '12345678-1234-5678-1234-56789abcdef3', name: 'Skin Temp',        unit: '°C',    decimals: 2, type: 'float' },
  { key: 'eda',       uuid: '12345678-1234-5678-1234-56789abcdef4', name: 'EDA / GSR',        unit: 'µS',    decimals: 2, type: 'float' },
  { key: 'bioz',      uuid: '12345678-1234-5678-1234-56789abcdef5', name: 'BioZ',             unit: 'Ω',     decimals: 1, type: 'float' },
  { key: 'envTemp',   uuid: '12345678-1234-5678-1234-56789abcdef6', name: 'Ambient Temp',     unit: '°C',    decimals: 1, type: 'float' },
  { key: 'accel',     uuid: '12345678-1234-5678-1234-56789abcdef7', name: 'Accelerometer',    unit: 'g',     decimals: 3, type: 'vec3' },
  { key: 'gyro',      uuid: '12345678-1234-5678-1234-56789abcdef8', name: 'Gyroscope',        unit: 'dps',   decimals: 1, type: 'vec3' },
  { key: 'mic',       uuid: '12345678-1234-5678-1234-56789abcdef9', name: 'Microphone RMS',   unit: 'dB',    decimals: 1, type: 'float' },
  { key: 'humidity',  uuid: '12345678-1234-5678-1234-56789abcdefa', name: 'Humidity',         unit: '%',     decimals: 1, type: 'float' },
  { key: 'pressure',  uuid: '12345678-1234-5678-1234-56789abcdefb', name: 'Pressure',         unit: 'hPa',   decimals: 0, type: 'float' },
];

// ─── Algorithm Registry ─────────────────────────────────────
// Every algorithm the platform supports, with metadata and tunable params
// `channels` maps to the new channel-based architecture.
const ALGO_REGISTRY = [
  // ── Phase 1: Base Algorithms ──
  { id:'A01', name:'Heart Rate',           layer:'base', tier:0, channels:['ppg'],               unit:'BPM',  range:[30,220],  classification:'wellness',
    params:[{n:'Bandpass Low',min:0.3,max:1.0,default:0.5,step:0.1,unit:'Hz'},{n:'Bandpass High',min:2.0,max:6.0,default:4.0,step:0.5,unit:'Hz'},{n:'Peak Threshold k',min:0.3,max:1.0,default:0.6,step:0.05,unit:'×σ'},{n:'EMA Window',min:4,max:16,default:8,step:1,unit:'beats'},{n:'Refractory Period',min:150,max:400,default:250,step:10,unit:'ms'},{n:'SQI Threshold',min:0.2,max:0.8,default:0.4,step:0.05,unit:''}] },
  { id:'A02', name:'HRV (RMSSD)',          layer:'base', tier:1, channels:['ppg'],               unit:'ms',   range:[0,300],   classification:'health-indicator',
    params:[{n:'Min R-R Intervals',min:10,max:60,default:30,step:5,unit:''},{n:'Outlier Threshold',min:10,max:50,default:20,step:5,unit:'%'}] },
  { id:'A03', name:'SpO2',                 layer:'base', tier:0, channels:['ppg'],               unit:'%',    range:[70,100],  classification:'health-screening',
    params:[{n:'R-Ratio Calibration A',min:100,max:115,default:104,step:1,unit:''},{n:'R-Ratio Calibration B',min:10,max:30,default:17,step:1,unit:''},{n:'Min Beats',min:2,max:8,default:4,step:1,unit:''}] },
  { id:'A04', name:'Respiratory Rate',     layer:'base', tier:1, channels:['ppg'],               unit:'br/m', range:[4,60],    classification:'wellness',
    params:[{n:'Bandpass Low',min:0.1,max:0.2,default:0.15,step:0.01,unit:'Hz'},{n:'Bandpass High',min:0.3,max:0.6,default:0.4,step:0.05,unit:'Hz'}] },
  { id:'A05', name:'ECG Rhythm Check',     layer:'base', tier:2, channels:['ecg'],               unit:'',     range:[0,1],     classification:'health-screening',
    params:[{n:'Analysis Window',min:5,max:30,default:10,step:5,unit:'s'}] },
  { id:'A06', name:'Resting HR Trend',     layer:'base', tier:3, channels:['ppg'],               unit:'BPM',  range:[30,120],  classification:'wellness', params:[] },
  { id:'A07', name:'PPG Waveform',         layer:'base', tier:2, channels:['ppg'],               unit:'',     range:[0,1],     classification:'health-indicator', params:[] },
  { id:'A08', name:'Vascular Age',         layer:'base', tier:2, channels:['ppg'],               unit:'yrs',  range:[18,100],  classification:'health-screening', params:[] },
  { id:'A09', name:'Perfusion Index',      layer:'base', tier:0, channels:['ppg'],               unit:'%',    range:[0,20],    classification:'wellness',
    params:[{n:'DC Alpha',min:0.99,max:0.999,default:0.995,step:0.001,unit:''}] },
  { id:'A10', name:'Skin Temp Baseline',   layer:'base', tier:3, channels:['skinTemp'],          unit:'°C',   range:[25,42],   classification:'wellness', params:[] },
  { id:'A11', name:'Fever Warning',        layer:'base', tier:3, channels:['skinTemp'],          unit:'°C',   range:[25,42],   classification:'health-indicator',
    params:[{n:'Fever Threshold',min:37.0,max:38.5,default:37.5,step:0.1,unit:'°C'}] },
  { id:'A12', name:'Circadian Rhythm',     layer:'base', tier:3, channels:['skinTemp'],          unit:'score',range:[0,100],   classification:'wellness', params:[] },
  { id:'A13', name:'Ovulation Detection',  layer:'base', tier:3, channels:['skinTemp'],          unit:'',     range:[0,1],     classification:'health-indicator', params:[] },
  { id:'A14', name:'EDA Stress Level',     layer:'base', tier:1, channels:['eda'],               unit:'µS',   range:[0,100],   classification:'health-indicator',
    params:[{n:'Tonic Low Pass',min:0.01,max:0.1,default:0.05,step:0.01,unit:'Hz'},{n:'SCR Threshold',min:0.01,max:0.1,default:0.05,step:0.01,unit:'µS'}] },
  { id:'A15', name:'EDA Stress Timeline',  layer:'base', tier:3, channels:['eda'],               unit:'',     range:[0,1],     classification:'health-indicator', params:[] },
  { id:'A16', name:'Relaxation Biofeedback',layer:'base',tier:1, channels:['eda'],               unit:'score',range:[0,100],   classification:'wellness', params:[] },
  { id:'A17', name:'Sleep EDA Patterns',   layer:'base', tier:3, channels:['eda'],               unit:'',     range:[0,1],     classification:'wellness', params:[] },
  { id:'A18', name:'Body Fat %',           layer:'base', tier:2, channels:['bioz'],              unit:'%',    range:[3,60],    classification:'health-indicator', params:[] },
  { id:'A19', name:'Muscle Mass',          layer:'base', tier:2, channels:['bioz'],              unit:'kg',   range:[10,100],  classification:'health-indicator', params:[] },
  { id:'A20', name:'Hydration Level',      layer:'base', tier:2, channels:['bioz'],              unit:'%',    range:[0,100],   classification:'health-indicator', params:[] },
  { id:'A21', name:'Step Counter',         layer:'base', tier:0, channels:['accel'],             unit:'steps',range:[0,99999], classification:'wellness',
    params:[{n:'Step Threshold',min:0.5,max:2.0,default:1.2,step:0.1,unit:'g'},{n:'Min Step Interval',min:200,max:500,default:300,step:50,unit:'ms'}] },
  { id:'A22', name:'Activity Recognition', layer:'base', tier:1, channels:['accel','gyro'],      unit:'',     range:[0,5],     classification:'wellness', params:[] },
  { id:'A23', name:'Sleep Detection',      layer:'base', tier:1, channels:['accel','ppg'],       unit:'',     range:[0,1],     classification:'wellness', params:[] },
  { id:'A24', name:'Calorie Burn',         layer:'base', tier:3, channels:['accel','ppg'],       unit:'kcal', range:[0,9999],  classification:'wellness', params:[] },
  { id:'A25', name:'Snoring Detection',    layer:'base', tier:1, channels:['mic'],               unit:'',     range:[0,1],     classification:'wellness',
    params:[{n:'dB Threshold',min:30,max:70,default:50,step:5,unit:'dB'},{n:'Duration Min',min:0.5,max:3,default:1,step:0.5,unit:'s'}] },
  { id:'A26', name:'Workout Detection',    layer:'base', tier:1, channels:['accel','ppg'],       unit:'',     range:[0,1],     classification:'wellness', params:[] },
  { id:'A27', name:'Running Cadence',      layer:'base', tier:1, channels:['accel'],             unit:'spm',  range:[0,240],   classification:'wellness', params:[] },
  // ── Phase 2: Cross-Sensor Fusion ──
  { id:'X01', name:'Blood Pressure (PTT)', layer:'fusion', tier:1, channels:['ppg','ecg'],       unit:'mmHg', range:[60,250],  classification:'health-screening',
    params:[{n:'Calibration SBP',min:90,max:180,default:120,step:1,unit:'mmHg'},{n:'Calibration DBP',min:50,max:110,default:80,step:1,unit:'mmHg'},{n:'PTT Window',min:5,max:30,default:10,step:5,unit:'beats'}] },
  { id:'X02', name:'Arterial Stiffness',   layer:'fusion', tier:2, channels:['ppg','ecg'],       unit:'m/s',  range:[4,20],    classification:'health-screening', params:[] },
  { id:'X03', name:'Pre-Ejection Period',  layer:'fusion', tier:1, channels:['ppg','ecg'],       unit:'ms',   range:[50,200],  classification:'health-indicator', params:[] },
  { id:'X04', name:'Cardiac Output',       layer:'fusion', tier:2, channels:['ppg','ecg'],       unit:'L/m',  range:[2,12],    classification:'health-screening', params:[] },
  { id:'X05', name:'Autonomic Balance',    layer:'fusion', tier:1, channels:['ppg','ecg'],       unit:'',     range:[0,10],    classification:'health-indicator', params:[] },
  { id:'X06', name:'Stress vs Exercise',   layer:'fusion', tier:1, channels:['eda','ppg','accel'], unit:'', range:[0,1],   classification:'health-indicator', params:[] },
  { id:'X07', name:'Illness Warning',      layer:'fusion', tier:3, channels:['skinTemp','ppg'],  unit:'score',range:[0,100],   classification:'health-indicator', params:[] },
  { id:'X08', name:'ANS Mapping',          layer:'fusion', tier:3, channels:['ppg','eda','skinTemp'], unit:'', range:[0,1], classification:'health-indicator', params:[] },
  { id:'X09', name:'Recovery Score',       layer:'fusion', tier:3, channels:['ppg','accel','skinTemp'], unit:'score', range:[0,100], classification:'wellness', params:[] },
  { id:'X10', name:'Strain Score',         layer:'fusion', tier:3, channels:['ppg','eda','accel','skinTemp'], unit:'score', range:[0,21], classification:'wellness', params:[] },
  { id:'X11', name:'Sleep Phases',         layer:'fusion', tier:3, channels:['accel','ppg','skinTemp','eda'], unit:'', range:[0,4], classification:'wellness', params:[] },
  { id:'X12', name:'Biological Age',       layer:'fusion', tier:3, channels:['ppg','accel','skinTemp','eda'], unit:'yrs', range:[18,100], classification:'health-screening', params:[] },
  { id:'X13', name:'Chronotype Detection', layer:'fusion', tier:3, channels:['skinTemp','ppg','accel'], unit:'', range:[0,3], classification:'wellness', params:[] },
  { id:'X14', name:'Stress Resilience',    layer:'fusion', tier:3, channels:['eda','ppg'],       unit:'score',range:[0,100],   classification:'health-indicator', params:[] },
  { id:'X15', name:'Hydration + Temp',     layer:'fusion', tier:2, channels:['bioz','skinTemp'], unit:'%', range:[0,100],  classification:'health-indicator', params:[] },
  { id:'X16', name:'Body Comp + Activity', layer:'fusion', tier:3, channels:['bioz','accel','ppg'], unit:'', range:[0,1], classification:'health-indicator', params:[] },
  { id:'X17', name:'Sleep Apnea Screen',   layer:'fusion', tier:1, channels:['mic','ppg'],       unit:'AHI',  range:[0,60],    classification:'health-screening',
    params:[{n:'Desat Threshold',min:2,max:5,default:3,step:0.5,unit:'%'},{n:'Apnea Duration',min:5,max:15,default:10,step:1,unit:'s'}] },

  // ── Phase 3: Composite Scores ──
  { id:'C01', name:'Recovery Score',       layer:'composite', tier:3, channels:['ppg','accel','skinTemp'], unit:'0-100', range:[0,100], classification:'wellness', params:[] },
  { id:'C02', name:'Strain Score',         layer:'composite', tier:3, channels:['ppg','eda','accel'], unit:'0-21',  range:[0,21],  classification:'wellness', params:[] },
  { id:'C03', name:'Sleep Score',          layer:'composite', tier:3, channels:['accel','ppg','skinTemp'], unit:'0-100', range:[0,100], classification:'wellness', params:[] },
  { id:'C04', name:'Biological Age',       layer:'composite', tier:3, channels:['ppg','accel','skinTemp','eda'], unit:'yrs', range:[18,100], classification:'health-screening', params:[] },
  { id:'C05', name:'Cardiovascular Age',   layer:'composite', tier:3, channels:['ppg'],         unit:'yrs',  range:[18,100],  classification:'health-screening', params:[] },
  { id:'C06', name:'Training Rec',         layer:'composite', tier:3, channels:['ppg','accel'], unit:'',     range:[0,1],     classification:'wellness', params:[] },
  { id:'C07', name:'Sleep Rec',            layer:'composite', tier:3, channels:['accel','ppg'],  unit:'',     range:[0,1],     classification:'wellness', params:[] },
  { id:'C08', name:'Health Report (PDF)',   layer:'composite', tier:3, channels:['ppg','skinTemp','accel'], unit:'', range:[0,1], classification:'wellness', params:[] },
  { id:'C09', name:"Women's Health",       layer:'composite', tier:3, channels:['skinTemp','ppg','accel'], unit:'', range:[0,1], classification:'health-indicator', params:[] },
  { id:'C10', name:'Personalized Insights',layer:'composite', tier:3, channels:['ppg','skinTemp','eda','accel','mic'], unit:'', range:[0,1], classification:'wellness', params:[] },
];

// ─── Custom Algorithm Registry ──────────────────────────────
// Loaded at runtime from display.js files (U-series algorithms)
const CUSTOM_ALGOS = [];

// Aliases for legacy naming (SENSOR_DEFS / SERVICE_UUID used in some places)
const SENSOR_DEFS = CHANNEL_DEFS;
const SERVICE_UUID = OP_SERVICE_UUID;

// ─── Display Configuration System ──────────────────────────
// Assigns visual layout, zones, secondary metrics, warm-up, and size to every algorithm.
// This drives the flexible panel renderer so each algo renders with the appropriate layout.

const ALGO_LAYOUT_MAP = {
  // Waveform — real-time scrolling signal
  A05:'waveform', A07:'waveform',
  // Score — composite scores with breakdown
  C01:'score', C02:'score', C03:'score', X09:'score', X10:'score',
  // Counter — cumulative numbers
  A21:'counter', A24:'counter',
  // Multi-metric — grid of values
  A18:'multi-metric', A19:'multi-metric', X04:'multi-metric',
  X16:'multi-metric', C04:'multi-metric', C05:'multi-metric', X12:'multi-metric',
  // Timeline — long-term trend chart
  A06:'timeline', A10:'timeline', A12:'timeline', A15:'timeline',
  A17:'timeline', X08:'timeline', C10:'timeline',
  // Phases — segmented state bar
  A22:'phases', A23:'phases', X05:'phases', X11:'phases', X13:'phases',
  // Event-log — detection events
  A25:'event-log', A26:'event-log',
  // Status — binary/alert state
  A08:'status', A11:'status', A13:'status', X02:'status',
  X06:'status', X07:'status', C06:'status', C07:'status', C08:'status', C09:'status',
  // Everything else → gauge (default)
};

const ALGO_SIZE_MAP = {
  A05:'2x1', A06:'2x1', A07:'2x1', A10:'2x1', A12:'2x1',
  A15:'2x1', A17:'2x1', X08:'2x1', X11:'2x1',
  C01:'2x1', C03:'2x1', C10:'2x1',
};

const ALGO_ZONE_MAP = {
  A01:[{min:30,max:50,color:'#3b82f6',label:'Low'},{min:50,max:100,color:'#22c55e',label:'Normal'},{min:100,max:150,color:'#f59e0b',label:'Elevated'},{min:150,max:220,color:'#ef4444',label:'High'}],
  A02:[{min:0,max:20,color:'#ef4444',label:'Low'},{min:20,max:50,color:'#22c55e',label:'Normal'},{min:50,max:100,color:'#f59e0b',label:'Elevated'},{min:100,max:300,color:'#3b82f6',label:'Athletic'}],
  A03:[{min:70,max:90,color:'#ef4444',label:'Critical'},{min:90,max:94,color:'#f59e0b',label:'Low'},{min:94,max:100,color:'#22c55e',label:'Normal'}],
  A04:[{min:4,max:12,color:'#22c55e',label:'Normal'},{min:12,max:20,color:'#f59e0b',label:'Elevated'},{min:20,max:60,color:'#ef4444',label:'High'}],
  A06:[{min:40,max:50,color:'#3b82f6',label:'Athletic'},{min:50,max:65,color:'#22c55e',label:'Excellent'},{min:65,max:75,color:'#a3e635',label:'Good'},{min:75,max:100,color:'#ef4444',label:'Elevated'}],
  A09:[{min:0,max:1,color:'#ef4444',label:'Low'},{min:1,max:5,color:'#f59e0b',label:'Moderate'},{min:5,max:20,color:'#22c55e',label:'Good'}],
  A14:[{min:0,max:20,color:'#22c55e',label:'Calm'},{min:20,max:50,color:'#f59e0b',label:'Moderate'},{min:50,max:100,color:'#ef4444',label:'Stressed'}],
  A16:[{min:0,max:40,color:'#ef4444',label:'Tense'},{min:40,max:70,color:'#f59e0b',label:'Moderate'},{min:70,max:100,color:'#22c55e',label:'Relaxed'}],
  A20:[{min:0,max:40,color:'#ef4444',label:'Dehydrated'},{min:40,max:60,color:'#f59e0b',label:'Low'},{min:60,max:100,color:'#22c55e',label:'Hydrated'}],
  A27:[{min:0,max:140,color:'#f59e0b',label:'Low'},{min:140,max:190,color:'#22c55e',label:'Optimal'},{min:190,max:240,color:'#ef4444',label:'High'}],
  X01:[{min:60,max:90,color:'#3b82f6',label:'Low'},{min:90,max:120,color:'#22c55e',label:'Normal'},{min:120,max:140,color:'#f59e0b',label:'Elevated'},{min:140,max:250,color:'#ef4444',label:'High'}],
  X14:[{min:0,max:30,color:'#ef4444',label:'Low'},{min:30,max:60,color:'#f59e0b',label:'Moderate'},{min:60,max:100,color:'#22c55e',label:'Resilient'}],
  X17:[{min:0,max:5,color:'#22c55e',label:'Normal'},{min:5,max:15,color:'#f59e0b',label:'Mild'},{min:15,max:30,color:'#ef4444',label:'Moderate'},{min:30,max:60,color:'#dc2626',label:'Severe'}],
  C01:[{min:0,max:33,color:'#ef4444',label:'Low'},{min:33,max:66,color:'#f59e0b',label:'Moderate'},{min:66,max:100,color:'#22c55e',label:'Recovered'}],
  C02:[{min:0,max:7,color:'#22c55e',label:'Low'},{min:7,max:14,color:'#f59e0b',label:'Moderate'},{min:14,max:21,color:'#ef4444',label:'Overreaching'}],
  C03:[{min:0,max:50,color:'#ef4444',label:'Poor'},{min:50,max:70,color:'#f59e0b',label:'Fair'},{min:70,max:85,color:'#22c55e',label:'Good'},{min:85,max:100,color:'#3b82f6',label:'Excellent'}],
};

const ALGO_SECONDARY_MAP = {
  A01:[{key:'perfusion',label:'Perfusion',unit:'%'},{key:'ibi',label:'IBI',unit:'ms'}],
  A02:[{key:'sdnn',label:'SDNN',unit:'ms'},{key:'pnn50',label:'pNN50',unit:'%'}],
  A03:[{key:'rRatio',label:'R-Ratio',unit:''},{key:'perfusion',label:'Perf',unit:'%'}],
  A04:[{key:'confidence',label:'Conf',unit:'%'}],
  A06:[{key:'trend7d',label:'7d Trend',unit:'BPM/d'},{key:'baseline',label:'Baseline',unit:'BPM'}],
  A07:[{key:'ri',label:'RI',unit:'%'},{key:'si',label:'SI',unit:'m/s'},{key:'aix',label:'AIx',unit:'%'}],
  A09:[{key:'dcLevel',label:'DC',unit:'raw'},{key:'acAmp',label:'AC',unit:'raw'}],
  A14:[{key:'tonic',label:'Tonic',unit:'µS'},{key:'scrCount',label:'SCRs',unit:'/min'}],
  X01:[{key:'sbp',label:'SBP',unit:'mmHg'},{key:'dbp',label:'DBP',unit:'mmHg'},{key:'ptt',label:'PTT',unit:'ms'}],
  X17:[{key:'ahi',label:'AHI',unit:''},{key:'odiCount',label:'ODI',unit:''}],
};

// Warmup durations in seconds — how long the algo needs before valid output
const ALGO_WARMUP_MAP = {
  A02:30,A04:15,A05:10,A06:604800,A07:10,A08:30,A10:86400,A11:86400,
  A12:604800,A13:1209600,A14:15,A15:86400,A17:86400,A22:10,A23:300,
  A25:5,A26:10,X01:10,X02:30,X04:30,X05:60,X06:60,X07:86400,
  X08:86400,X09:86400,X10:86400,X11:3600,X12:604800,X13:604800,
  X14:86400,X15:300,X16:86400,X17:3600,
  C01:86400,C02:86400,C03:28800,C04:604800,C05:86400,C06:86400,
  C07:28800,C08:604800,C09:1209600,C10:604800,
};

// Score breakdown definitions for composite algos
const ALGO_BREAKDOWN_MAP = {
  C01:[{key:'hrv',label:'HRV',weight:0.30},{key:'rhr',label:'Resting HR',weight:0.25},{key:'sleep',label:'Sleep',weight:0.25},{key:'strain',label:'Prior Strain',weight:0.20}],
  C02:[{key:'hr',label:'Heart Rate',weight:0.40},{key:'duration',label:'Duration',weight:0.30},{key:'intensity',label:'Intensity',weight:0.30}],
  C03:[{key:'duration',label:'Duration',weight:0.30},{key:'efficiency',label:'Efficiency',weight:0.25},{key:'restfulness',label:'Restfulness',weight:0.25},{key:'latency',label:'Latency',weight:0.20}],
  X09:[{key:'hrv',label:'HRV',weight:0.35},{key:'rhr',label:'Resting HR',weight:0.30},{key:'temp',label:'Temperature',weight:0.20},{key:'activity',label:'Activity',weight:0.15}],
  X10:[{key:'cardio',label:'Cardiovascular',weight:0.45},{key:'muscular',label:'Muscular',weight:0.30},{key:'thermal',label:'Thermal',weight:0.25}],
};

// Multi-metric definitions
const ALGO_METRICS_MAP = {
  A18:[{key:'bodyFat',label:'Body Fat',unit:'%',range:[3,60]},{key:'fatMass',label:'Fat Mass',unit:'kg',range:[1,100]},{key:'leanMass',label:'Lean Mass',unit:'kg',range:[20,100]}],
  A19:[{key:'muscleMass',label:'Muscle Mass',unit:'kg',range:[10,100]},{key:'smm',label:'Skeletal MM',unit:'kg',range:[5,60]},{key:'bmi',label:'BMI',unit:'',range:[15,40]}],
  X04:[{key:'co',label:'Cardiac Output',unit:'L/min',range:[2,12]},{key:'sv',label:'Stroke Vol',unit:'mL',range:[40,150]},{key:'svr',label:'SVR',unit:'dyn',range:[800,2000]}],
  X16:[{key:'bodyFat',label:'Body Fat',unit:'%',range:[5,50]},{key:'metabolism',label:'Metabolism',unit:'kcal/d',range:[1200,3000]},{key:'fitness',label:'Fitness',unit:'score',range:[0,100]}],
  C04:[{key:'bioAge',label:'Bio Age',unit:'yrs',range:[18,100]},{key:'delta',label:'Delta',unit:'yrs',range:[-20,20]},{key:'conf',label:'Confidence',unit:'%',range:[0,100]}],
  C05:[{key:'cvAge',label:'CV Age',unit:'yrs',range:[18,100]},{key:'delta',label:'Delta',unit:'yrs',range:[-20,20]},{key:'pwv',label:'PWV',unit:'m/s',range:[4,20]}],
  X12:[{key:'bioAge',label:'Bio Age',unit:'yrs',range:[18,100]},{key:'hrAge',label:'HR Age',unit:'yrs',range:[18,100]},{key:'actAge',label:'Activity Age',unit:'yrs',range:[18,100]}],
};

// Phase definitions for phase-type algos
const ALGO_PHASES_MAP = {
  A22:[{key:'still',label:'Still',color:'#6b7280'},{key:'walk',label:'Walking',color:'#22c55e'},{key:'run',label:'Running',color:'#f59e0b'},{key:'bike',label:'Cycling',color:'#3b82f6'},{key:'other',label:'Other',color:'#a855f7'}],
  A23:[{key:'awake',label:'Awake',color:'#f59e0b'},{key:'sleep',label:'Asleep',color:'#6366f1'}],
  X05:[{key:'symp',label:'Sympathetic',color:'#ef4444'},{key:'para',label:'Parasympathetic',color:'#22c55e'},{key:'balanced',label:'Balanced',color:'#3b82f6'}],
  X11:[{key:'wake',label:'Wake',color:'#f59e0b'},{key:'light',label:'Light',color:'#60a5fa'},{key:'deep',label:'Deep',color:'#6366f1'},{key:'rem',label:'REM',color:'#a855f7'}],
  X13:[{key:'earlyBird',label:'Morning',color:'#f59e0b'},{key:'intermediate',label:'Neither',color:'#22c55e'},{key:'nightOwl',label:'Evening',color:'#6366f1'}],
};

// Layout icon SVGs
const LAYOUT_ICONS = {
  gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z"/><path d="M12 6v6l4 2"/></svg>',
  waveform: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h4l3-9 4 18 3-9h4"/></svg>',
  score: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  counter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg>',
  'multi-metric': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  timeline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-8"/></svg>',
  phases: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="5" height="10" rx="1"/><rect x="9" y="4" width="5" height="16" rx="1"/><rect x="16" y="9" width="5" height="6" rx="1"/></svg>',
  'event-log': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  status: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  heatmap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="3" height="3" fill="currentColor" opacity="0.3"/><rect x="11" y="7" width="3" height="3" fill="currentColor" opacity="0.6"/><rect x="7" y="11" width="3" height="3" fill="currentColor" opacity="0.8"/><rect x="11" y="11" width="3" height="3" fill="currentColor" opacity="0.4"/></svg>',
  canvas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
};

// Assign display config to every algorithm in the registry
ALGO_REGISTRY.forEach(algo => {
  const layout = ALGO_LAYOUT_MAP[algo.id] || 'gauge';
  algo.display = {
    layout,
    size: ALGO_SIZE_MAP[algo.id] || (layout === 'timeline' || layout === 'waveform' ? '2x1' : '1x1'),
    zones: ALGO_ZONE_MAP[algo.id] || null,
    secondary: ALGO_SECONDARY_MAP[algo.id] || [],
    warmupSeconds: ALGO_WARMUP_MAP[algo.id] || 0,
    breakdown: ALGO_BREAKDOWN_MAP[algo.id] || null,
    metrics: ALGO_METRICS_MAP[algo.id] || null,
    phases: ALGO_PHASES_MAP[algo.id] || null,
  };
});

// ─── State ───────────────────────────────────────────────────
let bleDevice = null, bleServer = null, isConnected = false;
let pollingHandle = null, currentTheme = 'dark';
let reconnectAttempts = 0, reconnectTimer = null;
const MAX_RECONNECT = 3;
const HISTORY_MAX = 60;
const chars = {};
const sensorData = {};    // key -> { history:[], lastUpdate:0, sampleCount:0, online:false }
const activePanels = {};  // panelId -> { type, key, algoId, element, ... }
let panelCounter = 0;
let connectionTime = 0;
let consoleCount = 0;
let consoleIsExpanded = false;
let activeAlgoFilter = 'all';
let algoSearchText = '';

// Init sensor data stores
SENSOR_DEFS.forEach(s => {
  if (s.type === 'vec3') {
    sensorData[s.key+'X'] = { history:[], lastUpdate:0, sampleCount:0, online:false };
    sensorData[s.key+'Y'] = { history:[], lastUpdate:0, sampleCount:0, online:false };
    sensorData[s.key+'Z'] = { history:[], lastUpdate:0, sampleCount:0, online:false };
  }
  sensorData[s.key] = { history:[], lastUpdate:0, sampleCount:0, online:false };
});

// ─── DOM ─────────────────────────────────────────────────────
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ─── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('openpulse-theme');
  if (savedTheme) applyTheme(savedTheme);
  else applyTheme('dark');

  $('#btn-connect').addEventListener('click', toggleConnection);
  $('#btn-theme').addEventListener('click', () => applyTheme(currentTheme === 'dark' ? 'light' : 'dark'));
  $('#btn-toggle-console').addEventListener('click', e => { e.stopPropagation(); toggleConsole(); });
  $('#btn-clear-active').addEventListener('click', clearActivePane);
  initConsoleTabs();
  initSerialMonitor();
  initCollapsibleSections();
  initSimulation();
  $('#algo-search').addEventListener('input', e => { algoSearchText = e.target.value.toLowerCase(); renderAlgoList(); });

  $$('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeAlgoFilter = btn.dataset.filter;
      renderAlgoList();
    });
  });

  renderAlgoList();
  renderSensorList();
  initCustomAlgoImport();
  logConsole('info', 'SYS', 'DevWorkbench v6 ready. Click Connect to pair with board.');
  setInterval(updateUptime, 1000);
  setInterval(updateSensorOnlineStatus, 2000);
});

// ─── Theme ───────────────────────────────────────────────────
function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('openpulse-theme', theme);
}

// ─── Console Tabs ────────────────────────────────────────────
let activeConsoleTab = 'console';

function initConsoleTabs() {
  $$('.console-tab').forEach(tab => {
    tab.addEventListener('click', e => {
      e.stopPropagation();
      switchConsoleTab(tab.dataset.tab);
      if (!consoleIsExpanded) toggleConsole();
    });
  });
}

function initCollapsibleSections() {
  $$('.sidebar-section-header[data-collapsible]').forEach(header => {
    header.addEventListener('click', () => {
      header.closest('.sidebar-section').classList.toggle('collapsed');
    });
  });
}

function switchConsoleTab(tabId) {
  activeConsoleTab = tabId;
  $$('.console-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  $$('.console-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === tabId));
}

function toggleConsole() {
  consoleIsExpanded = !consoleIsExpanded;
  $('#console-bar').classList.toggle('expanded', consoleIsExpanded);
  if (consoleIsExpanded) {
    consoleCount = 0;
    const badge = $('#console-badge');
    badge.style.display = 'none';
  }
}

function clearActivePane() {
  if (activeConsoleTab === 'console') {
    $('#console-output').innerHTML = '';
    consoleCount = 0;
    $('#console-badge').style.display = 'none';
  } else {
    $('#serial-output').innerHTML = '';
  }
}

function logConsole(level, tag, msg) {
  const con = $('#console-output');
  if (!con) return;
  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const line = document.createElement('div');
  line.className = 'console-line ' + level;
  line.innerHTML = `<span class="ts">${ts}</span><span class="tag">[${tag}]</span><span class="msg">${escapeHtml(msg)}</span>`;
  con.appendChild(line);
  con.scrollTop = con.scrollHeight;
  while (con.children.length > 300) con.removeChild(con.firstChild);

  if (!consoleIsExpanded) {
    consoleCount++;
    const badge = $('#console-badge');
    badge.textContent = consoleCount;
    badge.style.display = '';
  }
}

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ─── Uptime ──────────────────────────────────────────────────
function updateUptime() {
  if (!connectionTime) { $('#sb-uptime').textContent = '00:00:00'; return; }
  const d = Math.floor((Date.now() - connectionTime) / 1000);
  const h = String(Math.floor(d / 3600)).padStart(2, '0');
  const m = String(Math.floor((d % 3600) / 60)).padStart(2, '0');
  const s = String(d % 60).padStart(2, '0');
  $('#sb-uptime').textContent = `${h}:${m}:${s}`;
}

// ─── Sensor List Rendering ──────────────────────────────────
function renderSensorList() {
  const container = $('#sensor-list');
  container.innerHTML = '';
  if (!isConnected) {
    container.innerHTML = '<div class="sensor-empty">Connect board to discover sensors</div>';
    $('#sensor-count').textContent = '0';
    return;
  }
  let onlineCount = 0;
  CHANNEL_DEFS.forEach(s => {
    const sd = sensorData[s.key];
    const isOnline = sd && sd.online;
    if (isOnline) onlineCount++;
    const el = document.createElement('div');
    el.className = 'sensor-item' + (activePanels['raw-'+s.key] ? ' active' : '');
    el.dataset.sensorKey = s.key;
    const lastVal = sd && sd.history.length > 0 ? sd.history[sd.history.length-1] : null;
    let valText = '--';
    if (s.type === 'vec3') {
      const dx = sensorData[s.key+'X'];
      if (dx && dx.history.length > 0) valText = dx.history[dx.history.length-1].toFixed(1) + '…';
    } else if (lastVal !== null && (lastVal !== 0 || !s.zeroMeansOff)) {
      valText = lastVal.toFixed(s.decimals);
    }
    el.innerHTML = `
      <div class="sensor-dot ${isOnline ? 'online' : 'offline'}"></div>
      <div class="sensor-item-info">
        <span class="sensor-item-name">${s.name}</span>
        <span class="sensor-item-chip">${s.chip} · ${s.unit}</span>
      </div>
      <span class="sensor-item-value">${valText}</span>`;
    el.addEventListener('click', () => toggleRawPanel(s.key));
    container.appendChild(el);
  });
  $('#sensor-count').textContent = onlineCount;
  $('#sb-sensors').textContent = onlineCount + ' channel' + (onlineCount !== 1 ? 's' : '');

  // Active channels summary strip
  let strip = container.parentElement.querySelector('.active-channels-strip');
  if (!strip) {
    strip = document.createElement('div');
    strip.className = 'active-channels-strip';
    container.parentElement.appendChild(strip);
  }
  if (isConnected && onlineCount > 0) {
    const online = getOnlineChannels();
    strip.innerHTML = '<span class="strip-label">Active:</span> ' +
      [...online].map(k => `<span class="strip-ch">${CH_LABELS[k] || k}</span>`).join('');
    strip.style.display = '';
  } else {
    strip.style.display = 'none';
  }
}

function updateSensorOnlineStatus() {
  const now = Date.now();
  CHANNEL_DEFS.forEach(s => {
    const sd = sensorData[s.key];
    if (sd) sd.online = isConnected && (now - sd.lastUpdate < 5000);
  });
  if (isConnected) { renderSensorList(); renderAlgoList(); }
}

// ─── Channel helpers ─────────────────────────────────────────
function getOnlineChannels() {
  const online = new Set();
  CHANNEL_DEFS.forEach(c => {
    if (sensorData[c.key] && sensorData[c.key].online) online.add(c.key);
  });
  return online;
}

// Short labels for channel keys shown in the sidebar pills
const CH_LABELS = {
  ppg:'PPG', ecg:'ECG', skinTemp:'Temp', eda:'EDA', bioz:'BioZ',
  envTemp:'Env', humidity:'Hum', pressure:'Pres', accel:'Acc', gyro:'Gyr', mic:'Mic'
};

// ─── Algorithm List Rendering ────────────────────────────────
function getAllAlgos() {
  return [...ALGO_REGISTRY, ...CUSTOM_ALGOS];
}

function renderAlgoList() {
  const container = $('#algo-list');
  container.innerHTML = '';
  const onlineCh = getOnlineChannels();
  let count = 0;

  // Build items with availability info so we can sort
  const items = [];
  getAllAlgos().forEach(algo => {
    const channels = algo.sensors || algo.channels || [];
    const isCustom = !!algo.custom;
    // Layer / type filter
    if (activeAlgoFilter === 'base' && algo.layer !== 'base') return;
    if (activeAlgoFilter === 'fusion' && algo.layer !== 'fusion') return;
    if (activeAlgoFilter === 'composite' && algo.layer !== 'composite') return;
    if (activeAlgoFilter === 'custom' && !isCustom) return;
    // Per-channel availability
    const chStatus = channels.map(ch => ({ key: ch, online: onlineCh.has(ch) }));
    const metCount = chStatus.filter(c => c.online).length;
    const allMet = channels.length > 0 && metCount === channels.length;
    const noneMet = metCount === 0;
    // "Available" filter — only show fully met
    if (activeAlgoFilter === 'available' && (!allMet || !isConnected)) return;
    // Search
    if (algoSearchText && !algo.name.toLowerCase().includes(algoSearchText) && !algo.id.toLowerCase().includes(algoSearchText)) return;
    items.push({ algo, channels, isCustom, chStatus, metCount, allMet, noneMet });
  });

  // Sort: when connected, available-first, then partial, then unavailable
  if (isConnected) {
    items.sort((a, b) => {
      if (a.allMet !== b.allMet) return a.allMet ? -1 : 1;
      if (a.metCount !== b.metCount) return b.metCount - a.metCount;
      return 0;
    });
  }

  items.forEach(({ algo, channels, isCustom, chStatus, allMet, noneMet, metCount }) => {
    count++;
    const panelKey = isCustom ? 'custom-' + algo.id : 'algo-' + algo.id;
    const isActive = !!activePanels[panelKey];
    // Availability class
    let availClass = '';
    if (isConnected && channels.length > 0) {
      if (allMet) availClass = 'available';
      else if (noneMet) availClass = 'unavailable';
      else availClass = 'partial';
    }

    const el = document.createElement('div');
    el.className = ['algo-item', isCustom ? 'custom' : '', availClass, isActive ? 'active' : ''].filter(Boolean).join(' ');

    // Build channel pills HTML
    let chPillsHtml = '';
    if (isConnected && channels.length > 0) {
      chPillsHtml = '<div class="algo-ch-pills">' +
        chStatus.map(c =>
          `<span class="ch-pill ${c.online ? 'ch-on' : 'ch-off'}">${CH_LABELS[c.key] || c.key}</span>`
        ).join('') + '</div>';
    }

    el.innerHTML = `
      <div class="algo-item-top">
        <span class="algo-item-id">${algo.id}</span>
        <span class="algo-item-name">${algo.name}</span>
        ${isCustom ? '<span class="algo-item-custom-badge">USR</span>' : ''}
        <span class="algo-item-tier t${algo.tier}">T${algo.tier}</span>
        ${isCustom ? '<button class="algo-item-delete" title="Remove algorithm">×</button>' : ''}
      </div>
      ${chPillsHtml}`;

    // Delete button for custom algos
    if (isCustom) {
      const delBtn = el.querySelector('.algo-item-delete');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeCustomAlgo(algo.id);
        });
      }
    }

    // Only allow click if not connected, or channels are fully met
    if (!isConnected || allMet || channels.length === 0) {
      el.addEventListener('click', () => {
        if (isCustom) toggleCustomAlgoPanel(algo.id);
        else toggleAlgoPanel(algo.id);
      });
    }
    container.appendChild(el);
  });

  $('#algo-filter-count').textContent = count;
}

// ─── BLE Connection ──────────────────────────────────────────
async function toggleConnection() {
  if (isConnected) disconnect(); else await connect();
}

async function connect() {
  try {
    setStatus('Scanning…');
    logConsole('ble', 'BLE', 'Requesting device with service ' + SERVICE_UUID.slice(0,8) + '…');
    bleDevice = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE_UUID] }] });
    bleDevice.addEventListener('gattserverdisconnected', onDisconnected);
    logConsole('success', 'BLE', 'Device found: ' + (bleDevice.name || 'unknown'));
    setStatus('Connecting…');
    bleServer = await bleDevice.gatt.connect();
    logConsole('success', 'BLE', 'GATT connected');

    logConsole('info', 'BLE', 'Discovering service…');
    const service = await Promise.race([
      bleServer.getPrimaryService(SERVICE_UUID),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Service discovery timeout (10s)')), 10000))
    ]);
    logConsole('success', 'BLE', 'Service discovered');

    let subscribed = 0;
    for (const cdef of CHANNEL_DEFS) {
      try {
        chars[cdef.key] = await service.getCharacteristic(cdef.uuid);
        await chars[cdef.key].startNotifications();
        chars[cdef.key].addEventListener('characteristicvaluechanged', e => onCharChanged(cdef.key, e.target.value));
        logConsole('info', 'BLE', `Subscribed: ${cdef.name} (${cdef.key})`);
        subscribed++;
      } catch (err) {
        chars[cdef.key] = null;
        logConsole('warn', 'BLE', `No characteristic: ${cdef.name}`);
      }
    }
    logConsole('info', 'BLE', `${subscribed}/${CHANNEL_DEFS.length} channels active`);
    setConnected(true);
    connectionTime = Date.now();
    pollingHandle = setInterval(pollChars, 2500);
  } catch (err) {
    logConsole('error', 'BLE', 'Connection error: ' + err.message);
    setStatus('Connection failed');
    setTimeout(() => { if (!isConnected) setConnected(false); }, 2000);
  }
}

function disconnect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  reconnectAttempts = MAX_RECONNECT;
  if (pollingHandle) { clearInterval(pollingHandle); pollingHandle = null; }
  if (bleDevice && bleDevice.gatt.connected) bleDevice.gatt.disconnect();
  setConnected(false);
  reconnectAttempts = 0;
  connectionTime = 0;
  logConsole('info', 'BLE', 'Disconnected by user');
}

function onDisconnected() {
  if (pollingHandle) { clearInterval(pollingHandle); pollingHandle = null; }
  setConnected(false);
  logConsole('warn', 'BLE', 'Device disconnected');
  if (reconnectAttempts < MAX_RECONNECT && bleDevice) {
    reconnectAttempts++;
    logConsole('info', 'BLE', `Auto-reconnect ${reconnectAttempts}/${MAX_RECONNECT} in 2s…`);
    setStatus(`Reconnecting (${reconnectAttempts}/${MAX_RECONNECT})…`);
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      if (isConnected) return;
      try {
        bleServer = await bleDevice.gatt.connect();
        const service = await Promise.race([
          bleServer.getPrimaryService(SERVICE_UUID),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);
        for (const cdef of CHANNEL_DEFS) {
          try {
            chars[cdef.key] = await service.getCharacteristic(cdef.uuid);
            await chars[cdef.key].startNotifications();
            chars[cdef.key].addEventListener('characteristicvaluechanged', e => onCharChanged(cdef.key, e.target.value));
          } catch (_) { chars[cdef.key] = null; }
        }
        reconnectAttempts = 0;
        setConnected(true);
        pollingHandle = setInterval(pollChars, 2500);
        logConsole('success', 'BLE', 'Reconnected');
      } catch (err) { logConsole('error', 'BLE', 'Reconnect failed: ' + err.message); onDisconnected(); }
    }, 2000);
  } else {
    logConsole('warn', 'BLE', 'Max reconnect attempts — click Connect to retry');
    setStatus('Connection lost');
    reconnectAttempts = 0;
  }
}

async function pollChars() {
  if (!bleServer || !bleServer.connected) return;
  for (const [key, ch] of Object.entries(chars)) {
    if (!ch) continue;
    try { const v = await ch.readValue(); onCharChanged(key, v); } catch (_) {}
  }
}

// ─── Data Handling ───────────────────────────────────────────
function onCharChanged(key, dataView) {
  const cdef = CHANNEL_DEFS.find(s => s.key === key);
  if (!cdef) return;

  if (cdef.type === 'vec3') {
    if (dataView.byteLength < 12) return;
    const x = dataView.getFloat32(0, true);
    const y = dataView.getFloat32(4, true);
    const z = dataView.getFloat32(8, true);
    const now = Date.now();
    ['X','Y','Z'].forEach((axis, i) => {
      const sd = sensorData[key + axis];
      sd.history.push([x,y,z][i]);
      if (sd.history.length > HISTORY_MAX) sd.history.shift();
      sd.lastUpdate = now;
      sd.sampleCount++;
      sd.online = true;
    });
    const mag = Math.sqrt(x*x + y*y + z*z);
    sensorData[key].history.push(mag);
    if (sensorData[key].history.length > HISTORY_MAX) sensorData[key].history.shift();
    sensorData[key].lastUpdate = now;
    sensorData[key].online = true;
    sensorData[key].sampleCount++;
    // Update raw panel if open
    const panel = activePanels['raw-' + key];
    if (panel) updateRawVec3Panel(panel, key, x, y, z);
    // Feed algo panels
    updateAlgoPanelsWithSensor(key);
    return;
  }

  const val = dataView.getFloat32(0, true);
  const sd = sensorData[key];
  sd.history.push(val);
  if (sd.history.length > HISTORY_MAX) sd.history.shift();
  sd.lastUpdate = Date.now();
  sd.sampleCount++;
  sd.online = true;

  // Update raw panel
  const panel = activePanels['raw-' + key];
  if (panel) updateRawPanel(panel, key, val);
  // Feed algo panels
  updateAlgoPanelsWithSensor(key);
}

// ─── Panel Management ────────────────────────────────────────
function toggleRawPanel(channelKey) {
  const pid = 'raw-' + channelKey;
  if (activePanels[pid]) { removePanel(pid); return; }
  const cdef = CHANNEL_DEFS.find(s => s.key === channelKey);
  if (!cdef) return;

  const tpl = $('#tpl-raw-panel');
  const clone = tpl.content.cloneNode(true);
  const el = clone.querySelector('.panel');
  el.dataset.panelId = pid;
  el.querySelector('.panel-title').textContent = cdef.name;
  el.querySelector('.panel-subtitle').textContent = 'Channel · ' + cdef.key;
  el.querySelector('.raw-unit').textContent = cdef.unit;
  el.querySelector('.panel-badge').textContent = 'Tier ' + (cdef.type === 'vec3' ? '3-axis' : 'scalar');

  // Sensor icon
  const icon = el.querySelector('.panel-icon');
  icon.innerHTML = sensorIcon(cdef.key);

  el.querySelector('.btn-panel-close').addEventListener('click', () => removePanel(pid));

  activePanels[pid] = { type: 'raw', key: channelKey, element: el, cdef };
  showPanel(el);
  renderSensorList();
  renderAlgoList();

  // Init canvas
  requestAnimationFrame(() => {
    const canvas = el.querySelector('.waveform-canvas');
    if (canvas) sizeCanvas(canvas);
  });
}

function toggleAlgoPanel(algoId) {
  const isCustom = CUSTOM_ALGOS.find(a => a.id === algoId);
  const pid = (isCustom ? 'custom-' : 'algo-') + algoId;
  if (activePanels[pid]) { removePanel(pid); return; }
  const algo = isCustom || ALGO_REGISTRY.find(a => a.id === algoId);
  if (!algo) return;

  const display = algo.display || { layout:'gauge', size:'1x1', zones:null, secondary:[], warmupSeconds:0 };
  const layout = display.layout || 'gauge';
  const channels = algo.sensors || algo.channels || [];

  // Create panel element from template
  const tpl = $('#tpl-algo-panel');
  const clone = tpl.content.cloneNode(true);
  const el = clone.querySelector('.panel');
  el.dataset.panelId = pid;
  el.dataset.layout = layout;

  // Panel sizing
  if (display.size === '2x1') el.classList.add('panel-wide');
  if (display.size === '2x2') el.classList.add('panel-wide', 'panel-tall');
  if (isCustom) el.classList.add('custom-panel');

  // Header
  el.querySelector('.panel-title').textContent = algo.id + ': ' + algo.name;
  el.querySelector('.panel-subtitle').textContent = layout + ' · ' + algo.layer + ' · T' + algo.tier;
  const iconEl = el.querySelector('.panel-icon');
  iconEl.innerHTML = LAYOUT_ICONS[layout] || LAYOUT_ICONS.gauge;
  // Color icon per layout
  const iconColors = { gauge:'algo-icon', waveform:'waveform-icon', score:'score-icon', counter:'counter-icon',
    'multi-metric':'multi-icon', timeline:'timeline-icon', phases:'phases-icon',
    'event-log':'eventlog-icon', status:'status-icon', heatmap:'heatmap-icon', canvas:'canvas-icon' };
  iconEl.className = 'panel-icon ' + (iconColors[layout] || 'algo-icon');

  // Build panel body based on layout
  const body = el.querySelector('.panel-body');
  body.innerHTML = '';

  // ── Meta tags ──
  const metaRow = document.createElement('div');
  metaRow.className = 'algo-meta-row';
  metaRow.innerHTML = `
    <span class="algo-meta-tag ${algo.layer}">${algo.layer}</span>
    <span class="algo-meta-tag ${layout}">${layout.replace('-',' ')}</span>
    <span class="algo-meta-tag ${algo.classification}">${(algo.classification||'wellness').replace('-',' ')}</span>
    ${isCustom ? '<span class="algo-meta-tag custom">custom</span>' : ''}`;
  body.appendChild(metaRow);

  // ── Warmup banner ──
  if (display.warmupSeconds > 0) {
    const warmBanner = document.createElement('div');
    warmBanner.className = 'algo-warmup-banner';
    warmBanner.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      <span>Needs <strong>${formatWarmup(display.warmupSeconds)}</strong> of data before first valid output</span>`;
    body.appendChild(warmBanner);
  }

  // ── Visualization: custom render() or built-in layout ──
  if (algo.displayModule && typeof algo.displayModule.render === 'function') {
    // Inject scoped CSS from display module if provided
    if (algo.displayModule.css && !document.querySelector(`style[data-algo-css="${algo.id}"]`)) {
      const styleEl = document.createElement('style');
      styleEl.dataset.algoCss = algo.id;
      styleEl.textContent = algo.displayModule.css;
      document.head.appendChild(styleEl);
    }
    el.dataset.algoId = algo.id;
    const renderState = {
      output: 0, sqi: 0, history: [],
      sensorData: {}, elapsed: 0, params: {},
      algo: { id: algo.id, name: algo.name, unit: algo.unit, range: algo.range },
      util: { drawSparkline, drawHeatmap, sizeCanvas },
    };
    try { algo.displayModule.render(body, renderState); } catch (err) {
      body.innerHTML += `<div style="color:var(--red);font-size:11px;padding:8px;">render() error: ${err.message}</div>`;
      logConsole('error', algo.id, 'render() failed: ' + err.message);
    }
  } else {
    buildLayoutBody(body, layout, algo, display, channels);
  }

  // ── Sensor chips ──
  const inputsSection = document.createElement('div');
  inputsSection.className = 'algo-inputs-section';
  inputsSection.innerHTML = '<div class="section-label">Required Sensors</div>';
  const inputsList = document.createElement('div');
  inputsList.className = 'algo-inputs-list';
  channels.forEach(sk => {
    const sdef = SENSOR_DEFS.find(s => s.key === sk);
    const isAvail = sensorData[sk] && sensorData[sk].online;
    const chip = document.createElement('span');
    chip.className = 'algo-input-chip ' + (isAvail ? 'available' : 'missing');
    chip.innerHTML = `<span class="chip-dot"></span>${sdef ? sdef.name : sk}`;
    inputsList.appendChild(chip);
  });
  inputsSection.appendChild(inputsList);
  body.appendChild(inputsSection);

  // ── Parameters ──
  const paramsSection = document.createElement('div');
  paramsSection.className = 'algo-params-section';
  paramsSection.innerHTML = '<div class="section-label">Parameters <button class="btn-reset-params" title="Reset to defaults">↻</button></div>';
  const paramsList = document.createElement('div');
  paramsList.className = 'algo-params-list';
  const paramValues = {};
  if (algo.params && algo.params.length > 0) {
    algo.params.forEach(p => {
      paramValues[p.n] = p.default;
      const row = document.createElement('div');
      row.className = 'param-row';
      row.innerHTML = `
        <span class="param-label">${p.n}</span>
        <input type="range" class="param-slider" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.default}">
        <span class="param-value-display">${p.default}</span>
        <span class="param-unit">${p.unit}</span>`;
      const slider = row.querySelector('.param-slider');
      const display2 = row.querySelector('.param-value-display');
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        display2.textContent = v;
        paramValues[p.n] = v;
        logConsole('info', algo.id, `${p.n} = ${v} ${p.unit}`);
      });
      paramsList.appendChild(row);
    });
  } else {
    paramsList.innerHTML = '<div style="color:var(--text-3);font-size:11px;padding:4px 0;">No tunable parameters</div>';
  }
  paramsSection.appendChild(paramsList);
  body.appendChild(paramsSection);

  // Reset params
  paramsSection.querySelector('.btn-reset-params').addEventListener('click', () => {
    if (!algo.params) return;
    algo.params.forEach(p => {
      paramValues[p.n] = p.default;
      paramsList.querySelectorAll('.param-row').forEach(r => {
        if (r.querySelector('.param-label').textContent === p.n) {
          r.querySelector('.param-slider').value = p.default;
          r.querySelector('.param-value-display').textContent = p.default;
        }
      });
    });
    logConsole('info', algo.id, 'Parameters reset to defaults');
  });

  // ── Start/Stop ──
  const toggleBtn = el.querySelector('.btn-algo-toggle');
  let running = false;
  toggleBtn.addEventListener('click', () => {
    running = !running;
    const badge = el.querySelector('.algo-state-badge');
    if (running) {
      badge.dataset.state = 'acquiring';
      badge.textContent = 'ACQUIRING';
      toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      logConsole('success', algo.id, `Algorithm started [${layout}]`);
      setTimeout(() => {
        if (running && activePanels[pid]) {
          const allAvail = channels.every(sk => sensorData[sk] && sensorData[sk].online);
          if (display.warmupSeconds > 0) {
            badge.dataset.state = 'warmup';
            badge.textContent = 'WARMING UP';
          } else {
            badge.dataset.state = allAvail ? 'valid' : 'low_quality';
            badge.textContent = allAvail ? 'VALID' : 'LOW QUALITY';
          }
        }
      }, 2000);
    } else {
      badge.dataset.state = 'idle';
      badge.textContent = 'IDLE';
      toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      logConsole('info', algo.id, 'Algorithm stopped');
    }
    updateRunningCount();
  });

  el.querySelector('.btn-panel-close').addEventListener('click', () => removePanel(pid));

  // ── Store panel state ──
  activePanels[pid] = {
    type: 'algo', algoId, element: el, algo, paramValues,
    running: false, history: [], algoChannels: channels, layout,
    metricHistories: {}, events: [], startTime: 0,
  };
  if (display.metrics) {
    display.metrics.forEach(m => { activePanels[pid].metricHistories[m.key] = []; });
  }

  showPanel(el);
  renderSensorList();
  renderAlgoList();

  requestAnimationFrame(() => {
    el.querySelectorAll('canvas').forEach(c => sizeCanvas(c));
  });
}

// ─── Format warmup duration for display ─────────────────────
function formatWarmup(sec) {
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.round(sec / 60) + ' minutes';
  if (sec < 86400) return Math.round(sec / 3600) + ' hours';
  return Math.round(sec / 86400) + ' days';
}

// ─── Layout Body Builders ───────────────────────────────────
// Each layout type populates the panel body differently.

function buildLayoutBody(body, layout, algo, display, channels) {
  switch (layout) {
    case 'gauge':      return buildGaugeBody(body, algo, display);
    case 'waveform':   return buildWaveformBody(body, algo, display);
    case 'score':      return buildScoreBody(body, algo, display);
    case 'counter':    return buildCounterBody(body, algo, display);
    case 'multi-metric': return buildMultiMetricBody(body, algo, display);
    case 'timeline':   return buildTimelineBody(body, algo, display);
    case 'phases':     return buildPhasesBody(body, algo, display);
    case 'event-log':  return buildEventLogBody(body, algo, display);
    case 'status':     return buildStatusBody(body, algo, display);
    case 'heatmap':    return buildHeatmapBody(body, algo, display);
    default:           return buildGaugeBody(body, algo, display);
  }
}

// ── GAUGE: big number + zone bar + SQI + sparkline ──
function buildGaugeBody(body, algo, display) {
  // Zone bar
  if (display.zones && display.zones.length > 0) {
    const zoneBar = document.createElement('div');
    zoneBar.className = 'algo-zone-bar';
    const track = document.createElement('div');
    track.className = 'zone-bar-track';
    const full = algo.range[1] - algo.range[0];
    display.zones.forEach(z => {
      const seg = document.createElement('div');
      seg.className = 'zone-bar-segment';
      seg.style.background = z.color;
      seg.style.flex = ((z.max - z.min) / full);
      seg.title = z.label;
      track.appendChild(seg);
    });
    zoneBar.appendChild(track);
    const needle = document.createElement('div');
    needle.className = 'zone-bar-needle';
    zoneBar.appendChild(needle);
    const labels = document.createElement('div');
    labels.className = 'zone-bar-labels';
    display.zones.forEach(z => {
      const l = document.createElement('span');
      l.textContent = z.label;
      l.style.color = z.color;
      labels.appendChild(l);
    });
    zoneBar.appendChild(labels);
    body.appendChild(zoneBar);
  }

  // Top row: big number + SQI
  body.appendChild(buildTopRow(algo));

  // Secondary metrics
  if (display.secondary && display.secondary.length > 0) {
    body.appendChild(buildSecondaryRow(display.secondary));
  }

  // Sparkline
  body.appendChild(buildSparklineSection());
}

// ── WAVEFORM: metrics strip + large scrolling canvas ──
function buildWaveformBody(body, algo, display) {
  // Small metrics strip at top
  if (display.secondary && display.secondary.length > 0) {
    const strip = document.createElement('div');
    strip.className = 'algo-metrics-strip';
    display.secondary.forEach(m => {
      strip.innerHTML += `<div class="strip-metric"><span class="strip-val" data-key="${m.key}">--</span><span class="strip-lbl">${m.label}</span><span class="strip-unit">${m.unit}</span></div>`;
    });
    body.appendChild(strip);
  }

  // Large waveform canvas
  const wfSection = document.createElement('div');
  wfSection.className = 'algo-waveform-section waveform-large';
  wfSection.innerHTML = '<canvas class="algo-waveform-canvas"></canvas>';
  body.appendChild(wfSection);

  // SQI small
  const sqiRow = document.createElement('div');
  sqiRow.className = 'algo-sqi-row';
  sqiRow.innerHTML = '<span class="sqi-mini-label">SQI</span><div class="sqi-mini-bar"><div class="sqi-mini-fill"></div></div><span class="sqi-mini-val">--</span>';
  body.appendChild(sqiRow);
}

// ── SCORE: ring gauge + breakdown bars ──
function buildScoreBody(body, algo, display) {
  // Score ring
  const scoreTop = document.createElement('div');
  scoreTop.className = 'algo-score-top';
  scoreTop.innerHTML = `
    <div class="score-ring">
      <svg viewBox="0 0 120 120" class="score-ring-svg">
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-2)" stroke-width="10"/>
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--accent)" stroke-width="10" class="score-ring-arc"
          stroke-dasharray="327" stroke-dashoffset="327" stroke-linecap="round" transform="rotate(-90 60 60)"/>
      </svg>
      <div class="score-ring-center">
        <div class="algo-output-value">--</div>
        <div class="algo-output-unit">${algo.unit}</div>
      </div>
    </div>`;
  body.appendChild(scoreTop);

  // Breakdown bars
  if (display.breakdown && display.breakdown.length > 0) {
    const bkSection = document.createElement('div');
    bkSection.className = 'algo-breakdown-section';
    bkSection.innerHTML = '<div class="section-label">Score Breakdown</div>';
    const bars = document.createElement('div');
    bars.className = 'breakdown-bars';
    display.breakdown.forEach(b => {
      const row = document.createElement('div');
      row.className = 'breakdown-row';
      row.innerHTML = `
        <span class="breakdown-label">${b.label}</span>
        <div class="breakdown-track"><div class="breakdown-fill" data-key="${b.key}" style="width:0%"></div></div>
        <span class="breakdown-weight">${(b.weight * 100).toFixed(0)}%</span>
        <span class="breakdown-value" data-key="${b.key}">--</span>`;
      bars.appendChild(row);
    });
    bkSection.appendChild(bars);
    body.appendChild(bkSection);
  }

  // Small sparkline
  body.appendChild(buildSparklineSection('sparkline-sm'));
}

// ── COUNTER: big integer + delta badge + bar chart ──
function buildCounterBody(body, algo, display) {
  const topRow = document.createElement('div');
  topRow.className = 'algo-top-row counter-top';
  topRow.innerHTML = `
    <div class="algo-output-section">
      <div class="algo-output-value counter-value">0</div>
      <div class="algo-output-unit">${algo.unit}</div>
    </div>
    <div class="counter-delta-badge">
      <span class="delta-arrow">↑</span>
      <span class="delta-value">0</span>
      <span class="delta-period">/min</span>
    </div>`;
  body.appendChild(topRow);

  // Bar chart area
  const chartSection = document.createElement('div');
  chartSection.className = 'algo-waveform-section';
  chartSection.innerHTML = '<canvas class="algo-waveform-canvas"></canvas>';
  body.appendChild(chartSection);
}

// ── MULTI-METRIC: grid of metric cards ──
function buildMultiMetricBody(body, algo, display) {
  const grid = document.createElement('div');
  grid.className = 'algo-metrics-grid';
  const metrics = display.metrics || [{key:'value',label:algo.name,unit:algo.unit,range:algo.range}];
  metrics.forEach(m => {
    const cell = document.createElement('div');
    cell.className = 'metric-cell';
    cell.dataset.metricKey = m.key;
    cell.innerHTML = `
      <div class="metric-value" data-key="${m.key}">--</div>
      <div class="metric-label">${m.label}</div>
      <div class="metric-unit">${m.unit}</div>`;
    grid.appendChild(cell);
  });
  body.appendChild(grid);

  // SQI row
  body.appendChild(buildSQIRow());

  // Sparkline
  body.appendChild(buildSparklineSection('sparkline-sm'));
}

// ── TIMELINE: big number + wide time-series chart ──
function buildTimelineBody(body, algo, display) {
  body.appendChild(buildTopRow(algo));

  if (display.secondary && display.secondary.length > 0) {
    body.appendChild(buildSecondaryRow(display.secondary));
  }

  // Wide chart
  const chartSection = document.createElement('div');
  chartSection.className = 'algo-waveform-section timeline-chart';
  chartSection.innerHTML = '<canvas class="algo-waveform-canvas"></canvas>';
  body.appendChild(chartSection);
}

// ── PHASES: current phase badge + segmented bar + legend ──
function buildPhasesBody(body, algo, display) {
  const phases = display.phases || [{key:'unknown',label:'Unknown',color:'#6b7280'}];

  // Current phase badge
  const phaseTop = document.createElement('div');
  phaseTop.className = 'algo-phase-top';
  phaseTop.innerHTML = `
    <div class="phase-current-badge" style="background:${phases[0].color}20;color:${phases[0].color};border:1px solid ${phases[0].color}40">
      <span class="phase-dot" style="background:${phases[0].color}"></span>
      <span class="phase-current-label">${phases[0].label}</span>
    </div>
    <div class="phase-duration">--</div>`;
  body.appendChild(phaseTop);

  // Phase bar (segmented)
  const phaseBar = document.createElement('div');
  phaseBar.className = 'algo-phase-bar';
  const barTrack = document.createElement('div');
  barTrack.className = 'phase-bar-track';
  phaseBar.appendChild(barTrack);
  body.appendChild(phaseBar);

  // Legend
  const legend = document.createElement('div');
  legend.className = 'algo-phase-legend';
  phases.forEach(p => {
    legend.innerHTML += `<span class="phase-legend-item"><span class="phase-legend-dot" style="background:${p.color}"></span>${p.label}</span>`;
  });
  body.appendChild(legend);

  // SQI
  body.appendChild(buildSQIRow());
}

// ── EVENT-LOG: event count + scrolling event list ──
function buildEventLogBody(body, algo, display) {
  // Event summary
  const summary = document.createElement('div');
  summary.className = 'algo-event-summary';
  summary.innerHTML = `
    <div class="event-count-big"><span class="event-count-num">0</span><span class="event-count-label">events detected</span></div>
    <div class="event-last-time">Last: --</div>`;
  body.appendChild(summary);

  // Event list
  const listSection = document.createElement('div');
  listSection.className = 'algo-event-list';
  listSection.innerHTML = '<div class="event-list-empty">No events yet</div>';
  body.appendChild(listSection);

  // SQI
  body.appendChild(buildSQIRow());
}

// ── STATUS: icon + status text + threshold bar ──
function buildStatusBody(body, algo, display) {
  const statusTop = document.createElement('div');
  statusTop.className = 'algo-status-top';
  statusTop.innerHTML = `
    <div class="status-icon-big">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    </div>
    <div class="status-text-big">INACTIVE</div>
    <div class="status-sub-text">${algo.name}</div>`;
  body.appendChild(statusTop);

  // Threshold bar (if algo has simple range)
  if (algo.range[1] !== 1) {
    const bar = document.createElement('div');
    bar.className = 'algo-status-bar';
    bar.innerHTML = `
      <div class="status-bar-track"><div class="status-bar-fill"></div></div>
      <div class="status-bar-labels"><span>${algo.range[0]}</span><span>${algo.unit}</span><span>${algo.range[1]}</span></div>`;
    body.appendChild(bar);
  }

  // Sparkline
  body.appendChild(buildSparklineSection('sparkline-sm'));
}

// ── HEATMAP: canvas + legend + metrics ──
function buildHeatmapBody(body, algo, display) {
  if (display.secondary && display.secondary.length > 0) {
    body.appendChild(buildSecondaryRow(display.secondary));
  }

  const heatSection = document.createElement('div');
  heatSection.className = 'algo-heatmap-section';
  heatSection.innerHTML = '<canvas class="algo-heatmap-canvas"></canvas>';
  body.appendChild(heatSection);

  // Legend gradient
  const legend = document.createElement('div');
  legend.className = 'heatmap-legend';
  legend.innerHTML = '<span>Low</span><div class="heatmap-gradient"></div><span>High</span>';
  body.appendChild(legend);
}

// ─── Shared body-building helpers ───────────────────────────

function buildTopRow(algo) {
  const topRow = document.createElement('div');
  topRow.className = 'algo-top-row';
  topRow.innerHTML = `
    <div class="algo-output-section">
      <div class="algo-output-value">--</div>
      <div class="algo-output-unit">${algo.unit}</div>
    </div>
    <div class="algo-sqi-section">
      <div class="sqi-gauge">
        <svg viewBox="0 0 100 60" class="sqi-svg">
          <path d="M10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--surface-3)" stroke-width="8" stroke-linecap="round"/>
          <path d="M10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round" class="sqi-arc" stroke-dasharray="126" stroke-dashoffset="126"/>
        </svg>
        <div class="sqi-label">
          <span class="sqi-value">--</span>
          <span class="sqi-text">SQI</span>
        </div>
      </div>
    </div>`;
  return topRow;
}

function buildSecondaryRow(secondaryDefs) {
  const row = document.createElement('div');
  row.className = 'algo-secondary-row';
  secondaryDefs.forEach(m => {
    const card = document.createElement('div');
    card.className = 'secondary-card';
    card.innerHTML = `
      <span class="secondary-val" data-key="${m.key}">--</span>
      <span class="secondary-label">${m.label}</span>
      ${m.unit ? `<span class="secondary-unit">${m.unit}</span>` : ''}`;
    row.appendChild(card);
  });
  return row;
}

function buildSparklineSection(extraClass) {
  const section = document.createElement('div');
  section.className = 'algo-waveform-section' + (extraClass ? ' ' + extraClass : '');
  section.innerHTML = '<canvas class="algo-waveform-canvas"></canvas>';
  return section;
}

function buildSQIRow() {
  const row = document.createElement('div');
  row.className = 'algo-sqi-row';
  row.innerHTML = '<span class="sqi-mini-label">SQI</span><div class="sqi-mini-bar"><div class="sqi-mini-fill"></div></div><span class="sqi-mini-val">--</span>';
  return row;
}

// Keep legacy name for backward compat with sidebar click handler
function toggleCustomAlgoPanel(algoId) { toggleAlgoPanel(algoId); }

function removePanel(pid) {
  const p = activePanels[pid];
  if (!p) return;
  p.element.style.animation = 'none';
  p.element.style.opacity = '0';
  p.element.style.transform = 'scale(0.95)';
  p.element.style.transition = 'all 0.2s ease';
  setTimeout(() => {
    p.element.remove();
    delete activePanels[pid];
    updateEmptyState();
    renderSensorList();
    renderAlgoList();
    updateRunningCount();
  }, 200);
}

function showPanel(el) {
  $('#panels-grid').appendChild(el);
  updateEmptyState();
}

function updateEmptyState() {
  const hasP = Object.keys(activePanels).length > 0;
  $('#workspace-empty').classList.toggle('hidden', hasP);
}

function updateRunningCount() {
  let running = 0;
  Object.values(activePanels).forEach(p => {
    if (p.type === 'algo' || p.type === 'custom-algo') {
      const badge = p.element.querySelector('.algo-state-badge');
      if (badge && badge.dataset.state !== 'idle') running++;
    }
  });
  $('#sb-algos').textContent = running + ' algorithm' + (running !== 1 ? 's' : '') + ' running';
}

// ─── Raw Panel Updates ───────────────────────────────────────
function updateRawPanel(panel, key, val) {
  const el = panel.element;
  const sdef = panel.cdef || panel.sdef;
  const display = el.querySelector('.raw-value');
  let text = '--';
  if (sdef.zeroMeansOff && val === 0) text = '--';
  else text = val.toFixed(sdef.decimals);
  if (display.textContent !== text) {
    display.textContent = text;
    display.classList.remove('flash');
    void display.offsetWidth;
    display.classList.add('flash');
  }
  // Stats
  const data = sensorData[key].history.filter(v => !sdef.zeroMeansOff || v !== 0);
  if (data.length > 0) {
    const min = Math.min(...data), max = Math.max(...data);
    const avg = data.reduce((a,b) => a+b, 0) / data.length;
    const std = Math.sqrt(data.reduce((a,v) => a + (v-avg)**2, 0) / data.length);
    const d = sdef.decimals;
    el.querySelector('.raw-min').textContent = min.toFixed(d);
    el.querySelector('.raw-max').textContent = max.toFixed(d);
    el.querySelector('.raw-avg').textContent = avg.toFixed(d);
    el.querySelector('.raw-std').textContent = std.toFixed(d > 0 ? d : 1);
    const rate = sensorData[key].sampleCount > 1 ? Math.round(1000 / ((Date.now() - connectionTime) / sensorData[key].sampleCount)) : 0;
    el.querySelector('.raw-rate').textContent = rate > 0 ? rate + '/s' : '--';
  }
  // Waveform
  drawSparkline(el.querySelector('.waveform-canvas'), sensorData[key].history, getChartColor(key));
}

function updateRawVec3Panel(panel, key, x, y, z) {
  const el = panel.element;
  const display = el.querySelector('.raw-value');
  display.textContent = `${x.toFixed(1)} ${y.toFixed(1)} ${z.toFixed(1)}`;
  display.classList.remove('flash'); void display.offsetWidth; display.classList.add('flash');
  // Draw 3-axis sparkline
  const canvas = el.querySelector('.waveform-canvas');
  drawVec3Sparkline(canvas, sensorData[key+'X'].history, sensorData[key+'Y'].history, sensorData[key+'Z'].history);
}

// ─── Algo Panel Sensor Feed (unified for all layouts) ────────
function updateAlgoPanelsWithSensor(sensorKey) {
  Object.values(activePanels).forEach(p => {
    if (p.type !== 'algo') return;
    const channels = p.algoChannels || p.algo.sensors || p.algo.channels || [];
    if (!channels.includes(sensorKey)) return;
    const badge = p.element.querySelector('.algo-state-badge');
    if (!badge || badge.dataset.state === 'idle') return;

    const sd = sensorData[sensorKey];
    if (!sd || sd.history.length < 3) return;
    const latestVal = sd.history[sd.history.length - 1];
    const range = p.algo.range;
    let output = Math.max(range[0], Math.min(range[1], latestVal));
    const sqi = computeSimulatedSQI(p.algo, sensorKey);
    const display = p.algo.display || {};
    const layout = p.layout || 'gauge';
    const el = p.element;

    // ── Custom update() from display module ──
    if (p.algo.displayModule && typeof p.algo.displayModule.update === 'function') {
      p.history.push(output);
      if (p.history.length > HISTORY_MAX) p.history.shift();
      const sDataEntries = {};
      channels.forEach(ch => {
        sDataEntries[ch] = {
          latest: sensorData[ch]?.history?.slice(-1)[0] ?? 0,
          online: sensorData[ch]?.online ?? false,
          history: sensorData[ch]?.history ?? [],
          sampleCount: sensorData[ch]?.sampleCount ?? 0,
        };
        const cd = CHANNEL_DEFS.find(c => c.key === ch);
        if (cd?.type === 'vec3') {
          ['X','Y','Z'].forEach(axis => {
            sDataEntries[ch + axis] = {
              latest: sensorData[ch+axis]?.history?.slice(-1)[0] ?? 0,
              online: sensorData[ch+axis]?.online ?? false,
              history: sensorData[ch+axis]?.history ?? [],
              sampleCount: sensorData[ch+axis]?.sampleCount ?? 0,
            };
          });
        }
      });
      const state = {
        output, sqi, history: p.history,
        sensorData: sDataEntries,
        elapsed: p.startTime ? Date.now() - p.startTime : 0,
        params: p.paramValues || {},
        algo: { id: p.algo.id, name: p.algo.name, unit: p.algo.unit, range: p.algo.range },
        util: { drawSparkline, drawHeatmap, sizeCanvas },
      };
      try {
        p.algo.displayModule.update(el.querySelector('.panel-body') || el, state);
      } catch (err) {
        logConsole('error', p.algo.id, 'update() error: ' + err.message);
      }
      // Still update sensor chip availability
      const inputsList2 = el.querySelector('.algo-inputs-list');
      if (inputsList2) {
        inputsList2.querySelectorAll('.algo-input-chip').forEach((chip, i) => {
          const sk = channels[i];
          const isAvail = sensorData[sk] && sensorData[sk].online;
          chip.className = 'algo-input-chip ' + (isAvail ? 'available' : 'missing');
        });
      }
      return;  // skip built-in layout update
    }

    // ── Zone-colored value ──
    const outEl = el.querySelector('.algo-output-value');
    if (outEl) {
      const intUnits = ['BPM','steps','kcal','spm','score','0-100','0-21','yrs','AHI'];
      outEl.textContent = intUnits.includes(p.algo.unit) ? Math.round(output) : output.toFixed(1);
      // Apply zone color
      if (display.zones) {
        const zone = display.zones.find(z => output >= z.min && output < z.max) || display.zones[display.zones.length - 1];
        if (zone) outEl.style.color = zone.color;
      }
    }

    // ── Zone bar needle position ──
    const needle = el.querySelector('.zone-bar-needle');
    if (needle && range[1] !== range[0]) {
      const pct = Math.max(0, Math.min(100, ((output - range[0]) / (range[1] - range[0])) * 100));
      needle.style.left = pct + '%';
    }

    // ── SQI gauge (arc style) ──
    updateSQIGauge(el, sqi);

    // ── SQI mini bar ──
    const sqiMiniFill = el.querySelector('.sqi-mini-fill');
    const sqiMiniVal = el.querySelector('.sqi-mini-val');
    if (sqiMiniFill) {
      sqiMiniFill.style.width = (sqi * 100) + '%';
      sqiMiniFill.style.background = sqi > 0.7 ? 'var(--green)' : sqi > 0.4 ? 'var(--orange)' : 'var(--red)';
    }
    if (sqiMiniVal) sqiMiniVal.textContent = (sqi * 100).toFixed(0);

    // ── Sparkline / waveform ──
    p.history.push(output);
    if (p.history.length > HISTORY_MAX) p.history.shift();
    const canvas = el.querySelector('.algo-waveform-canvas');
    const lineColors = { gauge:'#6366f1', waveform:'#22c55e', score:'#f59e0b', counter:'#3b82f6',
      'multi-metric':'#a855f7', timeline:'#6366f1', phases:'#a855f7', 'event-log':'#ef4444',
      status:'#f59e0b', heatmap:'#22c55e' };
    if (canvas) drawSparkline(canvas, p.history, lineColors[layout] || '#6366f1');

    // ── Secondary metrics (simulated) ──
    if (display.secondary) {
      display.secondary.forEach(m => {
        const valEl = el.querySelector(`.secondary-val[data-key="${m.key}"], .strip-val[data-key="${m.key}"]`);
        if (valEl) {
          const sim = output * (0.8 + Math.random() * 0.4);
          valEl.textContent = sim.toFixed(m.decimals ?? 1);
        }
      });
    }

    // ── Score ring arc ──
    if (layout === 'score') {
      const arc = el.querySelector('.score-ring-arc');
      if (arc && range[1] > range[0]) {
        const pct = Math.max(0, Math.min(1, (output - range[0]) / (range[1] - range[0])));
        arc.style.strokeDashoffset = 327 * (1 - pct);
        // Color the arc per zone
        if (display.zones) {
          const zone = display.zones.find(z => output >= z.min && output < z.max) || display.zones[display.zones.length - 1];
          if (zone) arc.style.stroke = zone.color;
        }
      }
    }

    // ── Score breakdown (simulated) ──
    if (layout === 'score' && display.breakdown) {
      display.breakdown.forEach(b => {
        const subVal = Math.max(0, Math.min(100, 50 + (Math.random() - 0.5) * 40));
        const fillEl = el.querySelector(`.breakdown-fill[data-key="${b.key}"]`);
        const valEl2 = el.querySelector(`.breakdown-value[data-key="${b.key}"]`);
        if (fillEl) fillEl.style.width = subVal + '%';
        if (valEl2) valEl2.textContent = subVal.toFixed(0);
      });
    }

    // ── Counter delta ──
    if (layout === 'counter') {
      const deltaEl = el.querySelector('.delta-value');
      if (deltaEl && p.history.length > 10) {
        const recent = p.history.slice(-10);
        const delta = recent[recent.length - 1] - recent[0];
        deltaEl.textContent = delta > 0 ? '+' + Math.round(delta) : Math.round(delta);
      }
    }

    // ── Multi-metric grid ──
    if (layout === 'multi-metric' && display.metrics) {
      display.metrics.forEach(m => {
        const sim = output + (Math.random() - 0.5) * ((m.range ? m.range[1] - m.range[0] : 10) * 0.05);
        const clamped = m.range ? Math.max(m.range[0], Math.min(m.range[1], sim)) : sim;
        const valEl2 = el.querySelector(`.metric-value[data-key="${m.key}"]`);
        if (valEl2) valEl2.textContent = clamped.toFixed(1);
        if (p.metricHistories[m.key]) {
          p.metricHistories[m.key].push(clamped);
          if (p.metricHistories[m.key].length > HISTORY_MAX) p.metricHistories[m.key].shift();
        }
      });
    }

    // ── Phases ──
    if (layout === 'phases' && display.phases) {
      const idx = Math.floor(Math.random() * display.phases.length);
      const phase = display.phases[idx];
      const badgeEl = el.querySelector('.phase-current-badge');
      if (badgeEl) {
        badgeEl.style.background = phase.color + '20';
        badgeEl.style.color = phase.color;
        badgeEl.style.borderColor = phase.color + '40';
        badgeEl.querySelector('.phase-dot').style.background = phase.color;
        badgeEl.querySelector('.phase-current-label').textContent = phase.label;
      }
      // Add segment to phase bar
      const track = el.querySelector('.phase-bar-track');
      if (track) {
        const seg = document.createElement('div');
        seg.className = 'phase-bar-seg';
        seg.style.background = phase.color;
        track.appendChild(seg);
        // Keep max ~100 segments
        while (track.children.length > 100) track.removeChild(track.firstChild);
      }
    }

    // ── Event-log ──
    if (layout === 'event-log') {
      // Simulate occasional events
      if (Math.random() < 0.05) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        p.events.push({ time: timeStr, value: output.toFixed(1) });
        if (p.events.length > 50) p.events.shift();
        const countEl = el.querySelector('.event-count-num');
        if (countEl) countEl.textContent = p.events.length;
        const lastEl = el.querySelector('.event-last-time');
        if (lastEl) lastEl.textContent = 'Last: ' + timeStr;
        const listEl = el.querySelector('.algo-event-list');
        if (listEl) {
          listEl.innerHTML = p.events.slice(-8).reverse().map(e =>
            `<div class="event-list-item"><span class="event-time">${e.time}</span><span class="event-val">${e.value} ${p.algo.unit}</span></div>`
          ).join('');
        }
      }
    }

    // ── Status ──
    if (layout === 'status') {
      const active = output > (range[0] + range[1]) / 2;
      const textEl = el.querySelector('.status-text-big');
      const iconEl = el.querySelector('.status-icon-big');
      if (textEl) {
        textEl.textContent = active ? 'ACTIVE' : 'INACTIVE';
        textEl.style.color = active ? 'var(--green)' : 'var(--text-3)';
      }
      if (iconEl) iconEl.style.color = active ? 'var(--green)' : 'var(--text-3)';
      const fill = el.querySelector('.status-bar-fill');
      if (fill && range[1] !== range[0]) {
        fill.style.width = ((output - range[0]) / (range[1] - range[0]) * 100) + '%';
      }
    }

    // ── Sensor chip updates ──
    const inputsList = el.querySelector('.algo-inputs-list');
    if (inputsList) {
      const chips = inputsList.querySelectorAll('.algo-input-chip');
      chips.forEach((chip, i) => {
        const sk = channels[i];
        const isAvail = sensorData[sk] && sensorData[sk].online;
        chip.className = 'algo-input-chip ' + (isAvail ? 'available' : 'missing');
      });
    }
  });
}

function computeSimulatedSQI(algo, sensorKey) {
  const sd = sensorData[sensorKey];
  if (!sd || sd.history.length < 5) return 0;
  const recent = sd.history.slice(-10);
  const mean = recent.reduce((a,b) => a+b, 0) / recent.length;
  const variance = recent.reduce((a,v) => a + (v-mean)**2, 0) / recent.length;
  const cv = mean !== 0 ? Math.sqrt(variance) / Math.abs(mean) : 1;
  let sqi = Math.max(0, Math.min(1, 1 - cv * 2));
  if (Date.now() - sd.lastUpdate > 3000) sqi *= 0.3;
  return sqi;
}

function updateSQIGauge(panelEl, sqi) {
  const arc = panelEl.querySelector('.sqi-arc');
  const valEl = panelEl.querySelector('.sqi-value');
  if (!arc || !valEl) return;
  const maxDash = 126;
  arc.style.strokeDashoffset = maxDash * (1 - sqi);
  valEl.textContent = (sqi * 100).toFixed(0);
  if (sqi > 0.7) arc.style.stroke = 'var(--green)';
  else if (sqi > 0.4) arc.style.stroke = 'var(--orange)';
  else arc.style.stroke = 'var(--red)';
}

// ─── Waveform Drawing ────────────────────────────────────────
function sizeCanvas(canvas) {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.round(rect.width * devicePixelRatio);
  canvas.height = Math.round(rect.height * devicePixelRatio);
}

function drawSparkline(canvas, data, color) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!data || data.length < 2) return;
  const nonZero = data.filter(v => v !== 0);
  if (nonZero.length < 2) return;
  let min = Math.min(...nonZero), max = Math.max(...nonZero);
  if (max === min) { max += 1; min -= 1; }
  const pad = h * 0.12;
  const pts = data.map((v, i) => ({ x: (i / (HISTORY_MAX - 1)) * w, y: h - pad - ((v - min) / (max - min)) * (h - pad * 2) }));

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, color + '20'); grad.addColorStop(1, color + '02');
  ctx.beginPath(); ctx.moveTo(pts[0].x, h);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length-1].x, h); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // Line
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i-1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(cpx, pts[i-1].y, cpx, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.strokeStyle = color; ctx.lineWidth = 1.5 * devicePixelRatio; ctx.stroke();

  // End dot
  const last = pts[pts.length-1];
  ctx.beginPath(); ctx.arc(last.x, last.y, 3 * devicePixelRatio, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
}

// ─── Heatmap Canvas Renderer ─────────────────────────────────
function drawHeatmap(canvas, data, rows, cols) {
  if (!canvas || !data || data.length === 0) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const cellW = w / cols, cellH = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = data[r * cols + c] || 0; // 0..1
      // Interpolate: green → yellow → red
      let cr, cg, cb;
      if (val < 0.5) {
        const t = val * 2;
        cr = Math.round(34 + t * (245 - 34));
        cg = Math.round(197 - t * (197 - 158));
        cb = Math.round(94 - t * (94 - 11));
      } else {
        const t = (val - 0.5) * 2;
        cr = Math.round(245 + t * (239 - 245));
        cg = Math.round(158 - t * (158 - 68));
        cb = Math.round(11 + t * (68 - 11));
      }
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(c * cellW, r * cellH, cellW - 1, cellH - 1);
    }
  }
}

function drawVec3Sparkline(canvas, dataX, dataY, dataZ) {
  if (!canvas || !dataX || dataX.length < 2) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const all = [...dataX, ...dataY, ...dataZ];
  let min = Math.min(...all), max = Math.max(...all);
  if (max === min) { max += 1; min -= 1; }
  const pad = h * 0.12;
  const colors = ['#f87171', '#4ade80', '#60a5fa'];
  [dataX, dataY, dataZ].forEach((data, ci) => {
    const pts = data.map((v, i) => ({ x: (i / (HISTORY_MAX - 1)) * w, y: h - pad - ((v - min) / (max - min)) * (h - pad * 2) }));
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const cpx = (pts[i-1].x + pts[i].x) / 2;
      ctx.bezierCurveTo(cpx, pts[i-1].y, cpx, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = colors[ci]; ctx.lineWidth = 1.5 * devicePixelRatio; ctx.stroke();
    const last = pts[pts.length-1];
    ctx.beginPath(); ctx.arc(last.x, last.y, 2.5 * devicePixelRatio, 0, Math.PI * 2);
    ctx.fillStyle = colors[ci]; ctx.fill();
  });
}

// Chart colors per channel
const CHART_COLORS = { ppg:'#f87171', ecg:'#fb923c', envTemp:'#a78bfa', humidity:'#22d3ee', pressure:'#34d399', skinTemp:'#fbbf24', eda:'#f472b6', bioz:'#38bdf8', accel:'#60a5fa', gyro:'#c084fc', mic:'#fb7185' };
function getChartColor(key) { return CHART_COLORS[key] || '#6366f1'; }

// ─── UI State ────────────────────────────────────────────────
function setConnected(connected) {
  isConnected = connected;
  const btn = $('#btn-connect');
  const dot = $('#status-dot');
  if (connected) {
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 0 1-12.73 0"/><path d="M15.54 9.46a5 5 0 0 1-7.07 0"/><line x1="12" y1="12" x2="12" y2="12.01"/></svg><span>Disconnect</span>';
    btn.classList.add('connected');
    dot.className = 'status-dot connected';
    $('#status-text').textContent = bleDevice?.name || 'Connected';
    $('#sb-connection').innerHTML = '<span class="sb-dot connected"></span> Connected';
    $('#btn-record').disabled = false;
  } else {
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11"/></svg><span>Connect</span>';
    btn.classList.remove('connected');
    dot.className = 'status-dot disconnected';
    $('#status-text').textContent = 'Disconnected';
    $('#sb-connection').innerHTML = '<span class="sb-dot disconnected"></span> Disconnected';
    $('#btn-record').disabled = true;
    // Mark all sensors offline
    Object.values(sensorData).forEach(sd => { sd.online = false; });
  }
  renderSensorList();
  renderAlgoList();
}

function setStatus(text) {
  const el = $('#status-text');
  if (el) el.textContent = text;
  const dot = $('#status-dot');
  if (text.includes('Scanning') || text.includes('Connecting') || text.includes('Reconnecting'))
    dot.className = 'status-dot connecting';
}

// Sensor icons
function sensorIcon(key) {
  const icons = {
    ppg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    ecg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
    envTemp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>',
    humidity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
    pressure: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    skinTemp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>',
    eda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>',
    bioz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>',
    accel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    gyro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>',
  };
  return icons[key] || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>';
}

// ─── Custom Algorithm Import ─────────────────────────────────
function initCustomAlgoImport() {
  const btn = $('#btn-import-algo');
  const input = $('#algo-file-input');
  if (!btn || !input) return;

  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => loadCustomAlgoFile(file));
    input.value = '';
  });

  // Load any previously saved custom algos from localStorage
  try {
    const saved = JSON.parse(localStorage.getItem('openpulse-custom-algos') || '[]');
    let count = 0;
    saved.forEach(entry => {
      try {
        const config = entry.source ? parseDisplayModule(entry.source) : entry;
        registerCustomAlgo(config, entry.source || null, false);
        count++;
      } catch (_) {}
    });
    if (count > 0) {
      renderAlgoList();
      logConsole('info', 'SYS', `Restored ${count} custom algorithm(s) from storage`);
    }
  } catch (_) {}
}

function loadCustomAlgoFile(file) {
  if (!file.name.endsWith('.js')) {
    logConsole('error', 'IMPORT', 'Only .js files accepted (expected display.js)');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const source = e.target.result;
      const config = parseDisplayModule(source);
      if (!config || !config.id || !config.name) {
        logConsole('error', 'IMPORT', `Invalid display module: missing id or name in ${file.name}`);
        return;
      }
      // Check for duplicates
      if (getAllAlgos().find(a => a.id === config.id)) {
        logConsole('warn', 'IMPORT', `Algorithm ${config.id} already exists — skipping`);
        return;
      }
      registerCustomAlgo(config, source, true);
      renderAlgoList();
      logConsole('success', 'IMPORT', `Loaded custom algorithm: ${config.id} — ${config.name}`);
    } catch (err) {
      logConsole('error', 'IMPORT', `Failed to parse ${file.name}: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

function parseDisplayModule(source) {
  // Evaluate the display module — supports full JavaScript including
  // render(), update(), css, and any computed values.
  // Replaces "export default" / "module.exports =" with a return statement
  // then wraps in new Function for scoped execution.
  const wrapped = source
    .replace(/^\s*export\s+default\s+/m, 'return ')
    .replace(/^\s*module\.exports\s*=\s*/m, 'return ');
  try {
    const fn = new Function('drawSparkline', 'drawHeatmap', 'sizeCanvas', wrapped);
    return fn(drawSparkline, drawHeatmap, sizeCanvas);
  } catch (err) {
    throw new Error('Display module evaluation failed: ' + err.message);
  }
}

function registerCustomAlgo(config, source, persist) {
  const algo = {
    id: config.id,
    name: config.name,
    layer: config.layout === 'score' ? 'composite' : 'base',
    tier: config.tier ?? 0,
    channels: config.channels || [],
    sensors: config.channels || [],
    unit: config.unit || config.primary?.unit || '',
    range: config.range || config.primary?.range || [0, 100],
    classification: config.classification || 'wellness',
    params: (config.params || []).map(p => ({
      n: p.name, min: p.min, max: p.max, default: p.default, step: p.step, unit: p.unit || ''
    })),
    custom: true,
    layout: config.layout || 'gauge',
    displayConfig: config,
    // The full module — may contain render(), update(), css, destroy()
    displayModule: config,
    metrics: config.metrics || null,
    breakdown: config.breakdown || null,
    primaryKey: config.primary?.key || (config.metrics && config.metrics[0]?.key) || null,
    size: config.size || '1x1',
  };

  // Build .display for built-in layout fallback (used when no render() exists)
  algo.display = {
    layout: config.layout || 'gauge',
    size: config.size || '1x1',
    zones: config.primary?.zones || config.zones || null,
    secondary: (config.secondary || []).filter(s => s.type === 'number').map(s => ({
      key: s.key, label: s.label, unit: s.unit || '', decimals: s.decimals ?? 1
    })),
    warmupSeconds: config.warmupSeconds || 0,
    breakdown: config.breakdown || null,
    metrics: config.metrics || null,
    phases: config.phases || null,
  };

  CUSTOM_ALGOS.push(algo);

  if (persist && source) {
    try {
      const saved = JSON.parse(localStorage.getItem('openpulse-custom-algos') || '[]');
      saved.push({ id: config.id, source });
      localStorage.setItem('openpulse-custom-algos', JSON.stringify(saved));
    } catch (_) {}
  }
}

// ─── Remove Custom Algo ──────────────────────────────────────
function removeCustomAlgo(algoId) {
  const idx = CUSTOM_ALGOS.findIndex(a => a.id === algoId);
  if (idx === -1) return;
  // Close panel if open
  const pid = 'custom-' + algoId;
  if (activePanels[pid]) removePanel(pid);
  CUSTOM_ALGOS.splice(idx, 1);
  // Update storage
  try {
    const saved = JSON.parse(localStorage.getItem('openpulse-custom-algos') || '[]');
    const filtered = saved.filter(entry => entry.id !== algoId);
    localStorage.setItem('openpulse-custom-algos', JSON.stringify(filtered));
  } catch (_) {}
  renderAlgoList();
  logConsole('info', 'SYS', `Removed custom algorithm: ${algoId}`);
}

// ═══════════════════════════════════════════════════════════════
// Serial Monitor — Web Serial API
// ═══════════════════════════════════════════════════════════════

let serialPort = null;
let serialReader = null;
let serialWriter = null;
let serialConnected = false;
let serialLineBuffer = '';

function initSerialMonitor() {
  const btnToggle = $('#btn-serial-toggle');
  const sendBtn = $('#serial-send');
  const sendInput = $('#serial-input');

  if (!('serial' in navigator)) {
    serialLog('Web Serial API not available. Use Chrome or Edge.', true);
    btnToggle.disabled = true;
    return;
  }

  btnToggle.addEventListener('click', e => {
    e.stopPropagation();
    if (serialConnected) serialDisconnect();
    else serialConnect();
  });

  sendBtn.addEventListener('click', e => { e.stopPropagation(); serialSend(); });
  sendInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.stopPropagation(); serialSend(); }
  });

  // Prevent clicks inside serial pane from toggling the console
  const serialPane = document.querySelector('[data-pane="serial"]');
  if (serialPane) serialPane.addEventListener('click', e => e.stopPropagation());
}

async function serialConnect() {
  try {
    serialPort = await navigator.serial.requestPort();
    const baud = parseInt($('#serial-baud').value, 10);
    await serialPort.open({ baudRate: baud });

    serialConnected = true;
    $('#btn-serial-toggle').textContent = 'Disconnect';
    $('#btn-serial-toggle').classList.add('connected');
    $('#serial-status-dot').classList.add('connected');
    $('#serial-input').disabled = false;
    $('#serial-send').disabled = false;
    serialLog(`Connected at ${baud} baud`, true);
    logConsole('success', 'SER', `Serial connected at ${baud} baud`);

    if (serialPort.writable) {
      serialWriter = serialPort.writable.getWriter();
    }

    // Read loop
    serialLineBuffer = '';
    while (serialPort.readable && serialConnected) {
      serialReader = serialPort.readable.getReader();
      try {
        while (true) {
          const { value, done } = await serialReader.read();
          if (done) break;
          const text = new TextDecoder().decode(value);
          processSerialData(text);
        }
      } catch (err) {
        if (serialConnected) serialLog(`Read error: ${err.message}`, true);
      } finally {
        serialReader.releaseLock();
        serialReader = null;
      }
    }
  } catch (err) {
    if (err.name !== 'NotFoundError') {
      serialLog(`Connection failed: ${err.message}`, true);
    }
  }
}

async function serialDisconnect() {
  serialConnected = false;
  try {
    if (serialReader) { await serialReader.cancel(); serialReader = null; }
    if (serialWriter) { serialWriter.releaseLock(); serialWriter = null; }
    if (serialPort) { await serialPort.close(); serialPort = null; }
  } catch (_) {}
  $('#btn-serial-toggle').textContent = 'Connect';
  $('#btn-serial-toggle').classList.remove('connected');
  $('#serial-status-dot').classList.remove('connected');
  $('#serial-input').disabled = true;
  $('#serial-send').disabled = true;
  serialLog('Disconnected', true);
  logConsole('info', 'SER', 'Serial disconnected');
}

function processSerialData(text) {
  serialLineBuffer += text;
  const lines = serialLineBuffer.split('\n');
  // Keep the last incomplete chunk in the buffer
  serialLineBuffer = lines.pop();
  for (const line of lines) {
    const clean = line.replace(/\r$/, '');
    if (clean.length > 0) serialLog(clean, false);
  }
}

async function serialSend() {
  const input = $('#serial-input');
  const text = input.value.trim();
  if (!text || !serialWriter) return;
  try {
    await serialWriter.write(new TextEncoder().encode(text + '\n'));
    serialLog('> ' + text, false);
    input.value = '';
  } catch (err) {
    serialLog(`Send error: ${err.message}`, true);
  }
}

function serialLog(text, isSystem) {
  const output = $('#serial-output');
  if (!output) return;
  const line = document.createElement('div');
  line.className = 'serial-line' + (isSystem ? ' serial-sys' : '');

  if ($('#serial-timestamps').checked) {
    const ts = new Date().toLocaleTimeString('en-GB', { hour12: false, fractionalSecondDigits: 3 });
    line.innerHTML = `<span class="serial-ts">${ts}</span>${escapeHtml(text)}`;
  } else {
    line.textContent = text;
  }

  output.appendChild(line);
  // Cap at 2000 lines
  while (output.children.length > 2000) output.removeChild(output.firstChild);
  if ($('#serial-autoscroll').checked) output.scrollTop = output.scrollHeight;
}

// ═══════════════════════════════════════════════════════════════
// Simulation Engine
// ═══════════════════════════════════════════════════════════════

const sim = {
  running: false,
  mode: 'timespan', // 'timespan' or 'live'
  channels: new Set(),   // selected channel keys
  totalSeconds: 604800,  // 7 days default
  speed: 1000,           // 1000x default
  timer: null,
  elapsed: 0,            // simulated seconds elapsed
  sampleInterval: 0.1,   // 10 Hz base tick (seconds)
  aborted: false,
  liveStartTime: null,   // wall-clock start for live mode
};

// ─── Signal Generators ──────────────────────────────────────
// Each returns a realistic value given simulated time (seconds)
const SIM_GENERATORS = {
  ppg(t) {
    // Simulated PPG: pulsatile waveform ~72 BPM baseline with diurnal variation
    const hr = 68 + 8 * Math.sin(2 * Math.PI * t / 86400) + 4 * Math.sin(2 * Math.PI * t / 7200);
    const beatFreq = hr / 60;
    const pulse = Math.sin(2 * Math.PI * beatFreq * t);
    const dicrotic = 0.3 * Math.sin(2 * Math.PI * beatFreq * t * 2 + 1);
    return 80000 + 15000 * (pulse + dicrotic) + (Math.random() - 0.5) * 2000;
  },
  ecg(t) {
    // Simplified ECG-like waveform
    const hr = 70 + 5 * Math.sin(2 * Math.PI * t / 86400);
    const beatPeriod = 60 / hr;
    const phase = (t % beatPeriod) / beatPeriod;
    // QRS complex
    if (phase > 0.4 && phase < 0.42) return 0.8 + Math.random() * 0.1;
    if (phase > 0.42 && phase < 0.44) return -0.3;
    if (phase > 0.44 && phase < 0.46) return 0.6;
    // T wave
    if (phase > 0.55 && phase < 0.7) return 0.15 * Math.sin((phase - 0.55) / 0.15 * Math.PI);
    return 0.0 + (Math.random() - 0.5) * 0.03;
  },
  skinTemp(t) {
    // Circadian skin temp: ~33-36°C, lowest ~4am, highest ~6pm
    const hourOfDay = (t % 86400) / 3600;
    const circadian = 34.5 + 0.8 * Math.sin(2 * Math.PI * (hourOfDay - 6) / 24);
    // Slow day-to-day drift
    const drift = 0.3 * Math.sin(2 * Math.PI * t / (86400 * 14));
    return circadian + drift + (Math.random() - 0.5) * 0.1;
  },
  eda(t) {
    // EDA: tonic level ~2-8 µS with phasic spikes
    const tonic = 4 + 2 * Math.sin(2 * Math.PI * t / 86400);
    const spike = (Math.random() < 0.02) ? Math.random() * 3 : 0;
    return Math.max(0, tonic + spike + (Math.random() - 0.5) * 0.3);
  },
  bioz(t) {
    // Bioimpedance: ~400-600 Ω with slow hydration variation
    const base = 500 + 50 * Math.sin(2 * Math.PI * t / 86400);
    const hydration = 30 * Math.sin(2 * Math.PI * t / (86400 * 3));
    return base + hydration + (Math.random() - 0.5) * 10;
  },
  envTemp(t) {
    // Room temp: 20-25°C diurnal
    return 22 + 2 * Math.sin(2 * Math.PI * (t % 86400) / 86400 - Math.PI / 3) + (Math.random() - 0.5) * 0.5;
  },
  accel(t) {
    // Returns [x, y, z] — mostly gravity + activity bursts
    const hourOfDay = (t % 86400) / 3600;
    const awake = (hourOfDay > 7 && hourOfDay < 23) ? 1 : 0;
    const activity = awake * 0.3 * Math.random();
    return [
      activity * (Math.random() - 0.5),
      activity * (Math.random() - 0.5),
      -1 + activity * (Math.random() - 0.5) * 0.3
    ];
  },
  gyro(t) {
    const hourOfDay = (t % 86400) / 3600;
    const awake = (hourOfDay > 7 && hourOfDay < 23) ? 1 : 0.1;
    const scale = awake * 15;
    return [
      scale * (Math.random() - 0.5),
      scale * (Math.random() - 0.5),
      scale * (Math.random() - 0.5)
    ];
  },
  mic(t) {
    // Ambient dB: 30-55, louder when awake
    const hourOfDay = (t % 86400) / 3600;
    const base = (hourOfDay > 7 && hourOfDay < 22) ? 45 : 32;
    return base + Math.random() * 8;
  },
  humidity(t) {
    return 45 + 10 * Math.sin(2 * Math.PI * t / 86400) + (Math.random() - 0.5) * 3;
  },
  pressure(t) {
    return 1013 + 5 * Math.sin(2 * Math.PI * t / (86400 * 3)) + (Math.random() - 0.5) * 2;
  },
};

// ─── Inject a sample into the real data pipeline ────────────
function injectSimSample(key, value) {
  const cdef = CHANNEL_DEFS.find(c => c.key === key);
  if (!cdef) return;

  if (cdef.type === 'vec3' && Array.isArray(value)) {
    const buf = new ArrayBuffer(12);
    const dv = new DataView(buf);
    dv.setFloat32(0, value[0], true);
    dv.setFloat32(4, value[1], true);
    dv.setFloat32(8, value[2], true);
    onCharChanged(key, dv);
  } else {
    const buf = new ArrayBuffer(4);
    const dv = new DataView(buf);
    dv.setFloat32(0, typeof value === 'number' ? value : 0, true);
    onCharChanged(key, dv);
  }
}

// ─── Simulation Controller ──────────────────────────────────
function simStart() {
  if (sim.running) return;
  if (sim.channels.size === 0) {
    logConsole('warn', 'SIM', 'No channels selected');
    return;
  }

  sim.running = true;
  sim.mode = 'timespan';
  sim.elapsed = 0;
  sim.aborted = false;

  const totalSamples = Math.ceil(sim.totalSeconds / sim.sampleInterval);
  logConsole('info', 'SIM', `Starting simulation: ${sim.channels.size} channels, ${formatDuration(sim.totalSeconds)}, ${sim.speed === 0 ? 'instant' : sim.speed + 'x'}`);

  // Mark simulated channels as online
  sim.channels.forEach(key => {
    if (sensorData[key]) sensorData[key].online = true;
  });
  renderSensorList();
  renderAlgoList();

  // UI updates
  $('#sim-start').disabled = true;
  $('#sim-start-live').disabled = true;
  $('#sim-stop').disabled = false;
  $('#sim-progress-section').classList.remove('hidden');
  $('#btn-simulate').classList.add('btn-simulate-active');
  setStatus('Simulating…');
  const statusDot = $('#status-dot');
  statusDot.className = 'status-dot connected';
  $('#sb-connection').innerHTML = '<span class="sb-dot simulating"></span> Simulating';

  if (sim.speed === 0) {
    // Instant mode: generate all samples synchronously in chunks
    simRunInstant(totalSamples);
  } else {
    // Real-time (accelerated) mode
    const realIntervalMs = (sim.sampleInterval / sim.speed) * 1000;
    const tickMs = Math.max(16, realIntervalMs); // min 60fps
    const samplesPerTick = Math.max(1, Math.round(tickMs / realIntervalMs));

    sim.timer = setInterval(() => {
      if (sim.aborted) { simStop(); return; }
      for (let i = 0; i < samplesPerTick && sim.elapsed < sim.totalSeconds; i++) {
        simTick();
      }
      simUpdateProgress(totalSamples);
      if (sim.elapsed >= sim.totalSeconds) simStop();
    }, tickMs);
  }
}

function simRunInstant(totalSamples) {
  const CHUNK = 500;
  let done = 0;

  function processChunk() {
    if (sim.aborted) { simStop(); return; }
    const end = Math.min(done + CHUNK, totalSamples);
    for (let i = done; i < end; i++) {
      simTick();
    }
    done = end;
    simUpdateProgress(totalSamples);

    if (done < totalSamples) {
      requestAnimationFrame(processChunk);
    } else {
      simStop();
    }
  }
  requestAnimationFrame(processChunk);
}

function simTick() {
  sim.channels.forEach(key => {
    const gen = SIM_GENERATORS[key];
    if (gen) injectSimSample(key, gen(sim.elapsed));
  });
  sim.elapsed += sim.sampleInterval;
}

function simUpdateProgress(totalSamples) {
  const currentSample = Math.min(Math.ceil(sim.elapsed / sim.sampleInterval), totalSamples);
  const pct = (currentSample / totalSamples) * 100;
  $('#sim-progress-fill').style.width = pct + '%';
  $('#sim-progress-text').textContent = `${formatDuration(sim.elapsed)} / ${formatDuration(sim.totalSeconds)}  (${Math.round(pct)}%)`;
  $('#sim-stats').textContent = `${sim.channels.size} ch × ${currentSample.toLocaleString()} samples`;
}

function simStop() {
  sim.running = false;
  if (sim.timer) { clearInterval(sim.timer); sim.timer = null; }

  if (sim.mode === 'live') {
    logConsole('info', 'SIM', `Live simulation stopped after ${formatDuration(sim.elapsed)}`);
    const elapsedEl = $('#sim-live-elapsed');
    if (elapsedEl) elapsedEl.classList.add('hidden');
  } else {
    const completed = sim.elapsed >= sim.totalSeconds;
    logConsole(completed ? 'success' : 'warn', 'SIM', completed
      ? `Simulation complete: ${formatDuration(sim.totalSeconds)}`
      : `Simulation stopped at ${formatDuration(sim.elapsed)}`);
  }

  // UI cleanup
  $('#sim-start').disabled = false;
  $('#sim-start-live').disabled = false;
  $('#sim-stop').disabled = true;
  $('#btn-simulate').classList.remove('btn-simulate-active');
  if (!isConnected) {
    setStatus('Disconnected');
    $('#status-dot').className = 'status-dot disconnected';
    $('#sb-connection').innerHTML = '<span class="sb-dot disconnected"></span> Disconnected';
  }
}

// ─── Live Simulation ────────────────────────────────────────
function simStartLive() {
  if (sim.running) return;
  if (sim.channels.size === 0) {
    logConsole('warn', 'SIM', 'No channels selected');
    return;
  }

  sim.running = true;
  sim.mode = 'live';
  sim.elapsed = 0;
  sim.aborted = false;
  sim.liveStartTime = Date.now();

  logConsole('info', 'SIM', `Live mode: ${sim.channels.size} channels streaming at 10 Hz`);

  // Mark simulated channels as online
  sim.channels.forEach(key => {
    if (sensorData[key]) sensorData[key].online = true;
  });
  renderSensorList();
  renderAlgoList();

  // UI updates
  $('#sim-start-live').disabled = true;
  $('#sim-start').disabled = true;
  $('#sim-stop').disabled = false;
  $('#btn-simulate').classList.add('btn-simulate-active');
  setStatus('Live (Sim)');
  const statusDot = $('#status-dot');
  statusDot.className = 'status-dot connected';
  $('#sb-connection').innerHTML = '<span class="sb-dot simulating"></span> Live (Sim)';

  // Show live elapsed timer
  const elapsedEl = $('#sim-live-elapsed');
  if (elapsedEl) elapsedEl.classList.remove('hidden');

  // Run at real-time 10 Hz
  sim.timer = setInterval(() => {
    if (sim.aborted) { simStop(); return; }
    simLiveTick();
  }, 100);
}

function simLiveTick() {
  // Use wall-clock seconds since start so signal generators produce real-time patterns
  const wallElapsed = (Date.now() - sim.liveStartTime) / 1000;
  sim.elapsed = wallElapsed;

  sim.channels.forEach(key => {
    const gen = SIM_GENERATORS[key];
    if (gen) injectSimSample(key, gen(wallElapsed));
  });

  // Update live timer display
  const timerEl = $('#sim-live-timer');
  if (timerEl) {
    const secs = Math.floor(wallElapsed);
    const h = String(Math.floor(secs / 3600)).padStart(2, '0');
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    timerEl.textContent = `${h}:${m}:${s}`;
  }

  $('#sim-stats').textContent = `${sim.channels.size} ch · live · ${Math.ceil(sim.elapsed / sim.sampleInterval).toLocaleString()} samples`;
}

function formatDuration(seconds) {
  if (seconds < 60) return Math.round(seconds) + 's';
  if (seconds < 3600) return Math.round(seconds / 60) + 'm';
  if (seconds < 86400) return (seconds / 3600).toFixed(1) + 'h';
  return (seconds / 86400).toFixed(1) + 'd';
}

// ─── Simulation UI Wiring ───────────────────────────────────
function initSimulation() {
  // Populate channel grid
  const grid = $('#sim-channel-grid');
  CHANNEL_DEFS.forEach(cdef => {
    const item = document.createElement('div');
    item.className = 'sim-channel-item';
    item.dataset.key = cdef.key;
    item.innerHTML = `<div class="sim-channel-check"></div><span>${cdef.name}</span>`;
    item.addEventListener('click', () => {
      item.classList.toggle('selected');
      if (item.classList.contains('selected')) sim.channels.add(cdef.key);
      else sim.channels.delete(cdef.key);
    });
    grid.appendChild(item);
  });

  // Select all / deselect all
  $('#sim-select-all').addEventListener('click', () => {
    const items = grid.querySelectorAll('.sim-channel-item');
    const allSelected = sim.channels.size === CHANNEL_DEFS.length;
    items.forEach(item => {
      const key = item.dataset.key;
      if (allSelected) {
        item.classList.remove('selected');
        sim.channels.delete(key);
      } else {
        item.classList.add('selected');
        sim.channels.add(key);
      }
    });
    $('#sim-select-all').textContent = allSelected ? 'Select all' : 'Deselect all';
  });

  // Time preset buttons
  $('#sim-presets').querySelectorAll('.sim-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      $('#sim-presets').querySelectorAll('.sim-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sim.totalSeconds = parseInt(btn.dataset.seconds);
      // Sync custom inputs
      syncCustomTimeInputs(sim.totalSeconds);
    });
  });

  // Custom time inputs
  const customVal = $('#sim-custom-val');
  const customUnit = $('#sim-custom-unit');
  function onCustomTimeChange() {
    const val = parseFloat(customVal.value) || 1;
    const unitSec = parseInt(customUnit.value);
    sim.totalSeconds = val * unitSec;
    // Deselect presets
    $('#sim-presets').querySelectorAll('.sim-preset').forEach(b => b.classList.remove('active'));
    // Highlight matching preset if any
    const match = $('#sim-presets').querySelector(`[data-seconds="${sim.totalSeconds}"]`);
    if (match) match.classList.add('active');
  }
  customVal.addEventListener('input', onCustomTimeChange);
  customUnit.addEventListener('change', onCustomTimeChange);

  // Speed preset buttons
  $('#sim-speed-presets').querySelectorAll('.sim-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      $('#sim-speed-presets').querySelectorAll('.sim-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sim.speed = parseInt(btn.dataset.speed);
    });
  });

  // Start / Stop
  $('#sim-start').addEventListener('click', simStart);
  $('#sim-stop').addEventListener('click', () => { sim.aborted = true; });
  $('#sim-start-live').addEventListener('click', simStartLive);

  // Mode tab switching
  document.querySelectorAll('.sim-mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (sim.running) return; // don't switch while running
      document.querySelectorAll('.sim-mode-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      sim.mode = tab.dataset.mode;

      const isLive = sim.mode === 'live';
      // Toggle timespan-only sections
      document.querySelectorAll('.sim-timespan-only').forEach(el => {
        el.classList.toggle('sim-mode-hidden', isLive);
      });
      // Toggle live-only sections
      document.querySelectorAll('.sim-live-only').forEach(el => {
        el.classList.toggle('hidden', !isLive);
      });
      // Toggle start buttons
      $('#sim-start').classList.toggle('hidden', isLive);
      $('#sim-start-live').classList.toggle('hidden', !isLive);
    });
  });

  // Open / Close overlay
  $('#btn-simulate').addEventListener('click', () => {
    $('#sim-overlay').classList.toggle('hidden');
  });
  $('#sim-close').addEventListener('click', () => {
    $('#sim-overlay').classList.add('hidden');
  });
  // Close on backdrop click
  $('#sim-overlay').addEventListener('click', e => {
    if (e.target === $('#sim-overlay')) $('#sim-overlay').classList.add('hidden');
  });
}

function syncCustomTimeInputs(totalSeconds) {
  const customVal = $('#sim-custom-val');
  const customUnit = $('#sim-custom-unit');
  if (totalSeconds >= 604800 && totalSeconds % 604800 === 0) {
    customVal.value = totalSeconds / 604800; customUnit.value = '604800';
  } else if (totalSeconds >= 86400 && totalSeconds % 86400 === 0) {
    customVal.value = totalSeconds / 86400; customUnit.value = '86400';
  } else if (totalSeconds >= 3600 && totalSeconds % 3600 === 0) {
    customVal.value = totalSeconds / 3600; customUnit.value = '3600';
  } else {
    customVal.value = totalSeconds / 60; customUnit.value = '60';
  }
}
