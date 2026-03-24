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
  $('#console-toggle').addEventListener('click', toggleConsole);
  $('#btn-clear-console').addEventListener('click', clearConsole);
  $('#btn-toggle-console').addEventListener('click', e => { e.stopPropagation(); toggleConsole(); });
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

// ─── Console ─────────────────────────────────────────────────
function toggleConsole() {
  consoleIsExpanded = !consoleIsExpanded;
  $('#console-bar').classList.toggle('expanded', consoleIsExpanded);
  if (consoleIsExpanded) {
    consoleCount = 0;
    const badge = $('#console-badge');
    badge.style.display = 'none';
  }
}

function clearConsole() {
  $('#console-output').innerHTML = '';
  consoleCount = 0;
  $('#console-badge').style.display = 'none';
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
  $('#sb-sensors').textContent = onlineCount + ' sensor' + (onlineCount !== 1 ? 's' : '');
}

function updateSensorOnlineStatus() {
  const now = Date.now();
  CHANNEL_DEFS.forEach(s => {
    const sd = sensorData[s.key];
    if (sd) sd.online = isConnected && (now - sd.lastUpdate < 5000);
  });
  if (isConnected) { renderSensorList(); renderAlgoList(); }
}

// ─── Algorithm List Rendering ────────────────────────────────
function renderAlgoList() {
  const container = $('#algo-list');
  container.innerHTML = '';
  let count = 0;
  ALGO_REGISTRY.forEach(algo => {
    // Filter
    if (activeAlgoFilter === 'base' && algo.layer !== 'base') return;
    if (activeAlgoFilter === 'fusion' && algo.layer !== 'fusion') return;
    if (activeAlgoFilter === 'composite' && algo.layer !== 'composite') return;
    const sensorsAvailable = algo.sensors.every(sk => sensorData[sk] && sensorData[sk].online);
    if (activeAlgoFilter === 'available' && !sensorsAvailable) return;
    if (algoSearchText && !algo.name.toLowerCase().includes(algoSearchText) && !algo.id.toLowerCase().includes(algoSearchText)) return;
    count++;
    const el = document.createElement('div');
    el.className = 'algo-item' + (!sensorsAvailable && isConnected ? ' unavailable' : '') + (activePanels['algo-'+algo.id] ? ' active' : '');
    el.innerHTML = `
      <span class="algo-item-id">${algo.id}</span>
      <span class="algo-item-name">${algo.name}</span>
      <span class="algo-item-tier t${algo.tier}">T${algo.tier}</span>
      <div class="algo-avail-dot ${sensorsAvailable || !isConnected ? '' : 'missing'}"></div>`;
    el.addEventListener('click', () => toggleAlgoPanel(algo.id));
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
    const service = await bleServer.getPrimaryService(SERVICE_UUID);
    for (const cdef of CHANNEL_DEFS) {
      try {
        chars[cdef.key] = await service.getCharacteristic(cdef.uuid);
        await chars[cdef.key].startNotifications();
        chars[cdef.key].addEventListener('characteristicvaluechanged', e => onCharChanged(cdef.key, e.target.value));
        logConsole('info', 'BLE', `Subscribed: ${cdef.name} (${cdef.key})`);
      } catch (err) {
        logConsole('warn', 'BLE', `Failed to subscribe: ${cdef.name} — ${err.message}`);
      }
    }
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
        const service = await bleServer.getPrimaryService(SERVICE_UUID);
        for (const cdef of CHANNEL_DEFS) {
          try {
            chars[cdef.key] = await service.getCharacteristic(cdef.uuid);
            await chars[cdef.key].startNotifications();
            chars[cdef.key].addEventListener('characteristicvaluechanged', e => onCharChanged(cdef.key, e.target.value));
          } catch (_) {}
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
  const pid = 'algo-' + algoId;
  if (activePanels[pid]) { removePanel(pid); return; }
  const algo = ALGO_REGISTRY.find(a => a.id === algoId);
  if (!algo) return;

  const tpl = $('#tpl-algo-panel');
  const clone = tpl.content.cloneNode(true);
  const el = clone.querySelector('.panel');
  el.dataset.panelId = pid;
  el.querySelector('.panel-title').textContent = algo.id + ': ' + algo.name;
  el.querySelector('.panel-subtitle').textContent = algo.layer + ' · tier ' + algo.tier;
  el.querySelector('.algo-output-unit').textContent = algo.unit;

  // Meta tags
  const metaRow = el.querySelector('.algo-meta-row');
  metaRow.innerHTML = `
    <span class="algo-meta-tag ${algo.layer}">${algo.layer}</span>
    <span class="algo-meta-tag ${algo.classification}">${algo.classification.replace('-',' ')}</span>`;

  // Required sensors chips
  const inputsList = el.querySelector('.algo-inputs-list');
  algo.sensors.forEach(sk => {
    const sdef = SENSOR_DEFS.find(s => s.key === sk);
    const isAvail = sensorData[sk] && sensorData[sk].online;
    const chip = document.createElement('span');
    chip.className = 'algo-input-chip ' + (isAvail ? 'available' : 'missing');
    chip.innerHTML = `<span class="chip-dot"></span>${sdef ? sdef.name : sk}`;
    inputsList.appendChild(chip);
  });

  // Parameters
  const paramsList = el.querySelector('.algo-params-list');
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
      const display = row.querySelector('.param-value-display');
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        display.textContent = v;
        paramValues[p.n] = v;
        logConsole('info', algo.id, `${p.n} = ${v} ${p.unit}`);
      });
      paramsList.appendChild(row);
    });
  } else {
    paramsList.innerHTML = '<div style="color:var(--text-3);font-size:11px;padding:4px 0;">No tunable parameters</div>';
  }

  // Reset params button
  el.querySelector('.btn-reset-params').addEventListener('click', () => {
    if (!algo.params) return;
    algo.params.forEach(p => {
      paramValues[p.n] = p.default;
      const rows = paramsList.querySelectorAll('.param-row');
      rows.forEach(r => {
        if (r.querySelector('.param-label').textContent === p.n) {
          r.querySelector('.param-slider').value = p.default;
          r.querySelector('.param-value-display').textContent = p.default;
        }
      });
    });
    logConsole('info', algo.id, 'Parameters reset to defaults');
  });

  // Start/stop button
  const toggleBtn = el.querySelector('.btn-algo-toggle');
  let running = false;
  toggleBtn.addEventListener('click', () => {
    running = !running;
    const badge = el.querySelector('.algo-state-badge');
    if (running) {
      badge.dataset.state = 'acquiring';
      badge.textContent = 'ACQUIRING';
      toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      logConsole('success', algo.id, 'Algorithm started');
      // After a short delay, transition to VALID if sensors available
      setTimeout(() => {
        if (running && activePanels[pid]) {
          const allAvail = algo.sensors.every(sk => sensorData[sk] && sensorData[sk].online);
          badge.dataset.state = allAvail ? 'valid' : 'low_quality';
          badge.textContent = allAvail ? 'VALID' : 'LOW QUALITY';
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

  activePanels[pid] = { type: 'algo', algoId: algoId, element: el, algo, paramValues, running: false, history: [] };
  showPanel(el);
  renderSensorList();
  renderAlgoList();

  requestAnimationFrame(() => {
    const canvas = el.querySelector('.algo-waveform-canvas');
    if (canvas) sizeCanvas(canvas);
  });
}

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
    if (p.type === 'algo') {
      const badge = p.element.querySelector('.algo-state-badge');
      if (badge && badge.dataset.state !== 'idle') running++;
    }
  });
  $('#sb-algos').textContent = running + ' algorithm' + (running !== 1 ? 's' : '') + ' running';
}

// ─── Raw Panel Updates ───────────────────────────────────────
function updateRawPanel(panel, key, val) {
  const el = panel.element;
  const sdef = panel.sdef;
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

// ─── Algo Panel Sensor Feed ──────────────────────────────────
function updateAlgoPanelsWithSensor(sensorKey) {
  Object.values(activePanels).forEach(p => {
    if (p.type !== 'algo') return;
    if (!p.algo.sensors.includes(sensorKey)) return;
    const badge = p.element.querySelector('.algo-state-badge');
    if (!badge || badge.dataset.state === 'idle') return;

    // Simulate algorithm output from sensor data
    const sd = sensorData[sensorKey];
    if (!sd || sd.history.length < 3) return;
    const latestVal = sd.history[sd.history.length - 1];

    // Simple simulated output (passes through primary sensor with noise)
    let output = latestVal;
    const range = p.algo.range;
    output = Math.max(range[0], Math.min(range[1], output));

    // Compute simulated SQI
    const sqi = computeSimulatedSQI(p.algo, sensorKey);

    // Update display
    const outEl = p.element.querySelector('.algo-output-value');
    if (output === 0 && SENSOR_DEFS.find(s => s.key === sensorKey)?.zeroMeansOff) {
      outEl.textContent = '--';
    } else {
      outEl.textContent = output.toFixed(p.algo.unit === 'BPM' || p.algo.unit === 'steps' ? 0 : 1);
    }

    // Update SQI gauge
    updateSQIGauge(p.element, sqi);

    // Algo waveform
    p.history.push(output);
    if (p.history.length > HISTORY_MAX) p.history.shift();
    drawSparkline(p.element.querySelector('.algo-waveform-canvas'), p.history, '#6366f1');

    // Update sensor chips availability
    const inputsList = p.element.querySelector('.algo-inputs-list');
    if (inputsList) {
      const chips = inputsList.querySelectorAll('.algo-input-chip');
      chips.forEach((chip, i) => {
        const sk = p.algo.sensors[i];
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
  // Lower CV = higher quality
  let sqi = Math.max(0, Math.min(1, 1 - cv * 2));
  // Penalize if sensor is stale
  if (Date.now() - sd.lastUpdate > 3000) sqi *= 0.3;
  return sqi;
}

function updateSQIGauge(panelEl, sqi) {
  const arc = panelEl.querySelector('.sqi-arc');
  const valEl = panelEl.querySelector('.sqi-value');
  if (!arc || !valEl) return;
  const maxDash = 126; // circumference of the arc path
  arc.style.strokeDashoffset = maxDash * (1 - sqi);
  valEl.textContent = (sqi * 100).toFixed(0);
  // Color based on quality
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
