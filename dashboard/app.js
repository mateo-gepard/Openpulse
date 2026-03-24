/* ═══════════════════════════════════════════════════════════════
   Sensor Dashboard — Web Bluetooth + Data Visualization
   ═══════════════════════════════════════════════════════════════ */

// ─── BLE UUIDs (must match firmware) ─────────────────────────
const SERVICE_UUID       = '12345678-1234-5678-1234-56789abcdef0';
const CHAR_HR_UUID       = '12345678-1234-5678-1234-56789abcdef1';
const CHAR_SPO2_UUID     = '12345678-1234-5678-1234-56789abcdef2';
const CHAR_TEMP_BME_UUID = '12345678-1234-5678-1234-56789abcdef3';
const CHAR_HUMIDITY_UUID = '12345678-1234-5678-1234-56789abcdef4';
const CHAR_PRESSURE_UUID = '12345678-1234-5678-1234-56789abcdef5';
const CHAR_TEMP_MCP_UUID = '12345678-1234-5678-1234-56789abcdef6';
const CHAR_ACCEL_UUID    = '12345678-1234-5678-1234-56789abcdef7';
const CHAR_GYRO_UUID     = '12345678-1234-5678-1234-56789abcdef8';
const CHAR_MIC_UUID      = '12345678-1234-5678-1234-56789abcdef9';

// ─── State ───────────────────────────────────────────────────
let bleDevice     = null;
let bleServer     = null;
let isConnected   = false;
let debugMode     = false;
let pollingHandle = null;
let currentTheme  = 'light';
let reconnectAttempts = 0;        // v4: auto-reconnect
const MAX_RECONNECT_ATTEMPTS = 3; // v4: max retries before giving up
let reconnectTimer = null;        // v4: pending reconnect timeout

const HISTORY_MAX = 60;
const history = {
  hr: [], spo2: [], tempBme: [], humidity: [], pressure: [], tempMcp: [],
  accelX: [], accelY: [], accelZ: [],
  gyroX: [],  gyroY: [],  gyroZ: [],
  mic: [],
};

const chars = {};

// ─── DOM helpers ─────────────────────────────────────────────
const $ = (s) => document.querySelector(s);

const valEls = {
  hr:       () => $('#val-hr'),
  spo2:     () => $('#val-spo2'),
  tempBme:  () => $('#val-temp-bme'),
  humidity: () => $('#val-humidity'),
  pressure: () => $('#val-pressure'),
  tempMcp:  () => $('#val-temp-mcp'),
  mic:      () => $('#val-mic'),
};

const imuValEls = {
  accel: { x: () => $('#val-accel-x'), y: () => $('#val-accel-y'), z: () => $('#val-accel-z') },
  gyro:  { x: () => $('#val-gyro-x'),  y: () => $('#val-gyro-y'),  z: () => $('#val-gyro-z') },
};

const canvasEls = {
  hr:       () => $('#chart-hr'),
  spo2:     () => $('#chart-spo2'),
  tempBme:  () => $('#chart-temp-bme'),
  humidity: () => $('#chart-humidity'),
  pressure: () => $('#chart-pressure'),
  tempMcp:  () => $('#chart-temp-mcp'),
  accel:    () => $('#chart-accel'),
  gyro:     () => $('#chart-gyro'),
  mic:      () => $('#chart-mic'),
};

const statEls = {
  hr:       { min: () => $('#stat-hr-min'),   max: () => $('#stat-hr-max'),   avg: () => $('#stat-hr-avg') },
  spo2:     { min: () => $('#stat-spo2-min'), max: () => $('#stat-spo2-max'), avg: () => $('#stat-spo2-avg') },
  tempBme:  { min: () => $('#stat-tb-min'),   max: () => $('#stat-tb-max'),   avg: () => $('#stat-tb-avg') },
  humidity: { min: () => $('#stat-hum-min'),  max: () => $('#stat-hum-max'),  avg: () => $('#stat-hum-avg') },
  pressure: { min: () => $('#stat-pres-min'), max: () => $('#stat-pres-max'), avg: () => $('#stat-pres-avg') },
  tempMcp:  { min: () => $('#stat-tm-min'),   max: () => $('#stat-tm-max'),   avg: () => $('#stat-tm-avg') },
  mic:      { min: () => $('#stat-mic-min'),  max: () => $('#stat-mic-max'),  avg: () => $('#stat-mic-avg') },
};

const imuStatEls = {
  accel: { x: () => $('#stat-ax'), y: () => $('#stat-ay'), z: () => $('#stat-az') },
  gyro:  { x: () => $('#stat-gx'), y: () => $('#stat-gy'), z: () => $('#stat-gz') },
};

const chartColors = {
  hr:       { light: '#dc2626', dark: '#f87171' },
  spo2:     { light: '#ea580c', dark: '#fb923c' },
  tempBme:  { light: '#7c3aed', dark: '#a78bfa' },
  humidity: { light: '#0891b2', dark: '#22d3ee' },
  pressure: { light: '#059669', dark: '#34d399' },
  tempMcp:  { light: '#d97706', dark: '#fbbf24' },
  accel:    { light: '#2563eb', dark: '#60a5fa' },
  gyro:     { light: '#9333ea', dark: '#c084fc' },
  mic:      { light: '#e11d48', dark: '#fb7185' },
};

const IMU_AXIS_COLORS = {
  x: { light: '#ef4444', dark: '#f87171' },
  y: { light: '#22c55e', dark: '#4ade80' },
  z: { light: '#3b82f6', dark: '#60a5fa' },
};

function getChartColor(key) {
  return chartColors[key]?.[currentTheme] || chartColors[key]?.light || '#888';
}

function getAxisColor(axis) {
  return IMU_AXIS_COLORS[axis][currentTheme];
}

// ─── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  $('#connect-btn').addEventListener('click', toggleConnection);
  $('#debug-toggle').addEventListener('click', toggleDebug);
  $('#btn-clear-debug').addEventListener('click', clearDebug);
  $('#btn-close-debug').addEventListener('click', () => { debugMode = true; toggleDebug(); });
  $('#theme-toggle').addEventListener('click', toggleTheme);

  const saved = localStorage.getItem('sensor-dash-theme');
  applyTheme(saved === 'dark' ? 'dark' : 'light');

  requestAnimationFrame(sizeCanvases);
  window.addEventListener('resize', sizeCanvases);
  startIdleAnimation();
});

function sizeCanvases() {
  Object.values(canvasEls).forEach(fn => {
    const c = fn();
    if (!c) return;
    const rect = c.parentElement.getBoundingClientRect();
    c.width  = Math.round(rect.width * devicePixelRatio);
    c.height = Math.round(rect.height * devicePixelRatio);
  });
  // Redraw existing sparklines
  Object.keys(canvasEls).forEach(key => {
    if (key === 'accel' || key === 'gyro') {
      const prefix = key === 'accel' ? 'accel' : 'gyro';
      if (history[prefix + 'X'].length > 1) drawImuSparkline(key);
    } else {
      if (history[key].length > 1) drawSparkline(key);
    }
  });
}

// ─── Theme ───────────────────────────────────────────────────
function toggleTheme() {
  applyTheme(currentTheme === 'light' ? 'dark' : 'light');
}

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sensor-dash-theme', theme);

  const sunIcon  = $('#icon-sun');
  const moonIcon = $('#icon-moon');
  if (theme === 'dark') {
    sunIcon.style.display  = 'none';
    moonIcon.style.display = 'block';
  } else {
    sunIcon.style.display  = 'block';
    moonIcon.style.display = 'none';
  }

  // Redraw sparklines with new colors
  Object.keys(canvasEls).forEach(key => {
    if (key === 'accel' || key === 'gyro') {
      const prefix = key === 'accel' ? 'accel' : 'gyro';
      if (history[prefix + 'X'].length > 1) drawImuSparkline(key);
    } else {
      if (history[key].length > 1) drawSparkline(key);
    }
  });
}

// ─── Bluetooth Connection ────────────────────────────────────
async function toggleConnection() {
  if (isConnected) { disconnect(); } else { await connect(); }
}

function resetAllData() {
  // Clear all history
  Object.keys(history).forEach(k => { history[k] = []; });

  // Reset displayed values
  Object.values(valEls).forEach(fn => {
    const el = fn();
    if (el) el.textContent = '--';
  });
  Object.values(imuValEls).forEach(group => {
    Object.values(group).forEach(fn => {
      const el = fn();
      if (el) el.textContent = '--';
    });
  });

  // Reset stats
  Object.values(statEls).forEach(group => {
    Object.values(group).forEach(fn => {
      const el = fn();
      if (el) el.textContent = '--';
    });
  });
  Object.values(imuStatEls).forEach(group => {
    Object.values(group).forEach(fn => {
      const el = fn();
      if (el) el.textContent = '--';
    });
  });

  // Clear canvases
  Object.values(canvasEls).forEach(fn => {
    const c = fn();
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
  });

  // Show overlays
  document.querySelectorAll('.no-data-overlay').forEach(el => {
    el.classList.remove('hidden');
  });

  logDebug('TX', 'All data reset');
}

async function connect() {
  resetAllData();
  try {
    setStatus('Scanning\u2026');
    logDebug('TX', 'Requesting BLE device with service ' + SERVICE_UUID);

    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
    });

    bleDevice.addEventListener('gattserverdisconnected', onDisconnected);
    logDebug('RX', 'Device found: ' + bleDevice.name);
    setStatus('Connecting\u2026');

    bleServer = await bleDevice.gatt.connect();
    logDebug('RX', 'GATT server connected');

    const service = await bleServer.getPrimaryService(SERVICE_UUID);
    logDebug('RX', 'Service discovered');

    // Standard float characteristics
    chars.hr       = await service.getCharacteristic(CHAR_HR_UUID);
    chars.spo2     = await service.getCharacteristic(CHAR_SPO2_UUID);
    chars.tempBme  = await service.getCharacteristic(CHAR_TEMP_BME_UUID);
    chars.humidity = await service.getCharacteristic(CHAR_HUMIDITY_UUID);
    chars.pressure = await service.getCharacteristic(CHAR_PRESSURE_UUID);
    chars.tempMcp  = await service.getCharacteristic(CHAR_TEMP_MCP_UUID);
    // IMU: 12-byte characteristics (3 x float32)
    chars.accel    = await service.getCharacteristic(CHAR_ACCEL_UUID);
    chars.gyro     = await service.getCharacteristic(CHAR_GYRO_UUID);
    chars.mic      = await service.getCharacteristic(CHAR_MIC_UUID);
    logDebug('RX', 'All 9 characteristics ready');

    for (const [key, char] of Object.entries(chars)) {
      await char.startNotifications();
      char.addEventListener('characteristicvaluechanged', (e) => {
        onCharChanged(key, e.target.value);
      });
    }
    logDebug('RX', 'Subscribed to notifications');

    setConnected(true);
    pollingHandle = setInterval(pollCharacteristics, 2000);

  } catch (err) {
    logDebug('RX', 'Error: ' + err.message);
    setStatus('Connection failed');
    console.error(err);
    setTimeout(() => setConnected(false), 2000);
  }
}

function disconnect() {
  // v4: cancel any pending reconnect
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // prevent auto-reconnect on manual disconnect
  if (pollingHandle) { clearInterval(pollingHandle); pollingHandle = null; }
  if (bleDevice && bleDevice.gatt.connected) bleDevice.gatt.disconnect();
  setConnected(false);
  reconnectAttempts = 0; // reset for next manual connect
  logDebug('TX', 'Disconnected by user');
}

function onDisconnected() {
  if (pollingHandle) { clearInterval(pollingHandle); pollingHandle = null; }
  setConnected(false);
  logDebug('RX', 'Device disconnected');

  // v4: auto-reconnect if we didn't manually disconnect
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && bleDevice) {
    reconnectAttempts++;
    const attempt = reconnectAttempts;
    logDebug('TX', `Auto-reconnect attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS} in 2s...`);
    setStatus(`Reconnecting (${attempt}/${MAX_RECONNECT_ATTEMPTS})…`);
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      if (isConnected) return; // already reconnected
      try {
        setStatus('Reconnecting…');
        bleServer = await bleDevice.gatt.connect();
        logDebug('RX', 'GATT server reconnected');

        const service = await bleServer.getPrimaryService(SERVICE_UUID);
        chars.hr       = await service.getCharacteristic(CHAR_HR_UUID);
        chars.spo2     = await service.getCharacteristic(CHAR_SPO2_UUID);
        chars.tempBme  = await service.getCharacteristic(CHAR_TEMP_BME_UUID);
        chars.humidity = await service.getCharacteristic(CHAR_HUMIDITY_UUID);
        chars.pressure = await service.getCharacteristic(CHAR_PRESSURE_UUID);
        chars.tempMcp  = await service.getCharacteristic(CHAR_TEMP_MCP_UUID);
        chars.accel    = await service.getCharacteristic(CHAR_ACCEL_UUID);
        chars.gyro     = await service.getCharacteristic(CHAR_GYRO_UUID);
        chars.mic      = await service.getCharacteristic(CHAR_MIC_UUID);

        for (const [key, char] of Object.entries(chars)) {
          await char.startNotifications();
          char.addEventListener('characteristicvaluechanged', (e) => {
            onCharChanged(key, e.target.value);
          });
        }

        reconnectAttempts = 0;
        setConnected(true);
        pollingHandle = setInterval(pollCharacteristics, 2000);
        logDebug('RX', 'Auto-reconnect successful');
      } catch (err) {
        logDebug('RX', 'Reconnect failed: ' + err.message);
        onDisconnected(); // will retry if attempts remain
      }
    }, 2000);
  } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logDebug('RX', 'Max reconnect attempts reached — click Connect to retry');
    setStatus('Connection lost');
    reconnectAttempts = 0;
  }
}

async function pollCharacteristics() {
  if (!bleServer || !bleServer.connected) return;
  // v4: try each characteristic individually so one failure doesn't kill all
  for (const [key, char] of Object.entries(chars)) {
    try {
      const val = await char.readValue();
      onCharChanged(key, val);
    } catch (_) {
      // Individual read failed — skip this characteristic, continue others
    }
  }
}

// ─── Data Handling ───────────────────────────────────────────
function onCharChanged(key, dataView) {
  // IMU characteristics: 12 bytes (3 x float32)
  if (key === 'accel' || key === 'gyro') {
    onImuChanged(key, dataView);
    return;
  }

  const val = dataView.getFloat32(0, true);
  const hex = Array.from(new Uint8Array(dataView.buffer))
    .map(b => b.toString(16).padStart(2, '0')).join(' ');

  logDebug('RX', `[${key}] ${val.toFixed(4)}  (0x ${hex})`);

  history[key].push(val);
  if (history[key].length > HISTORY_MAX) history[key].shift();

  updateValue(key, val);
  drawSparkline(key);
  updateStats(key);

  const card = valEls[key]()?.closest('.sensor-card');
  if (card) {
    const overlay = card.querySelector('.no-data-overlay');
    if (overlay) overlay.classList.add('hidden');
  }
}

function onImuChanged(key, dataView) {
  if (dataView.byteLength < 12) return;

  const x = dataView.getFloat32(0, true);
  const y = dataView.getFloat32(4, true);
  const z = dataView.getFloat32(8, true);

  const hex = Array.from(new Uint8Array(dataView.buffer))
    .map(b => b.toString(16).padStart(2, '0')).join(' ');
  logDebug('RX', `[${key}] X:${x.toFixed(3)} Y:${y.toFixed(3)} Z:${z.toFixed(3)}  (0x ${hex})`);

  const prefix = key === 'accel' ? 'accel' : 'gyro';
  history[prefix + 'X'].push(x);
  history[prefix + 'Y'].push(y);
  history[prefix + 'Z'].push(z);
  if (history[prefix + 'X'].length > HISTORY_MAX) {
    history[prefix + 'X'].shift();
    history[prefix + 'Y'].shift();
    history[prefix + 'Z'].shift();
  }

  // Update displayed values
  const decimals = key === 'accel' ? 3 : 1;
  const els = imuValEls[key];
  setImuValue(els.x(), x, decimals);
  setImuValue(els.y(), y, decimals);
  setImuValue(els.z(), z, decimals);

  // Update stat row (current values)
  const stats = imuStatEls[key];
  if (stats.x()) stats.x().textContent = x.toFixed(decimals);
  if (stats.y()) stats.y().textContent = y.toFixed(decimals);
  if (stats.z()) stats.z().textContent = z.toFixed(decimals);

  drawImuSparkline(key);

  // Hide overlay
  const card = els.x()?.closest('.sensor-card');
  if (card) {
    const overlay = card.querySelector('.no-data-overlay');
    if (overlay) overlay.classList.add('hidden');
  }
}

function setImuValue(el, val, decimals) {
  if (!el) return;
  const text = val.toFixed(decimals);
  if (el.textContent !== text) {
    el.textContent = text;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }
}

function updateValue(key, val) {
  const el = valEls[key]();
  if (!el) return;

  let text;
  switch (key) {
    case 'hr':       text = val > 0 ? Math.round(val).toString() : '--'; break;
    case 'spo2':     text = val > 0 ? val.toFixed(1) : '--'; break;
    case 'tempBme':  text = val !== 0 ? val.toFixed(1) : '--'; break;
    case 'humidity': text = val !== 0 ? val.toFixed(1) : '--'; break;
    case 'pressure': text = val !== 0 ? val.toFixed(0) : '--'; break;
    case 'mic':      text = val > 0 ? val.toFixed(1) : '--'; break;
    case 'tempMcp':  text = val !== 0 ? val.toFixed(2) : '--'; break;
    default:         text = val.toFixed(2);
  }

  if (el.textContent !== text) {
    el.textContent = text;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }
}

function updateStats(key) {
  const data = history[key].filter(v => v !== 0);
  if (data.length === 0) return;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const avg = data.reduce((a, b) => a + b, 0) / data.length;

  const els = statEls[key];
  if (!els) return;

  const d = key === 'pressure' ? 0 : key === 'tempMcp' ? 2 : key === 'mic' ? 1 : 1;
  if (els.min()) els.min().textContent = min.toFixed(d);
  if (els.max()) els.max().textContent = max.toFixed(d);
  if (els.avg()) els.avg().textContent = avg.toFixed(d);
}

// ─── Sparkline Drawing ──────────────────────────────────────
function drawSparkline(key) {
  const canvas = canvasEls[key]();
  if (!canvas) return;
  const ctx  = canvas.getContext('2d');
  const data = history[key];
  const w    = canvas.width;
  const h    = canvas.height;
  const color = getChartColor(key);

  ctx.clearRect(0, 0, w, h);
  if (data.length < 2) return;

  const nonZero = data.filter(v => v !== 0);
  if (nonZero.length < 2) return;

  let min = Math.min(...nonZero);
  let max = Math.max(...nonZero);
  if (max === min) { max += 1; min -= 1; }
  const pad = h * 0.12;

  const pts = data.map((v, i) => ({
    x: (i / (HISTORY_MAX - 1)) * w,
    y: h - pad - ((v - min) / (max - min)) * (h - pad * 2),
  }));

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, color + '20');
  grad.addColorStop(1, color + '02');
  ctx.beginPath();
  ctx.moveTo(pts[0].x, h);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(cpx, pts[i - 1].y, cpx, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 * devicePixelRatio;
  ctx.stroke();

  // End dot
  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3 * devicePixelRatio, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// ─── IMU Sparkline (3 lines: X, Y, Z) ──────────────────────
function drawImuSparkline(key) {
  const canvas = canvasEls[key]();
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w   = canvas.width;
  const h   = canvas.height;

  const prefix = key === 'accel' ? 'accel' : 'gyro';
  const dataX = history[prefix + 'X'];
  const dataY = history[prefix + 'Y'];
  const dataZ = history[prefix + 'Z'];

  ctx.clearRect(0, 0, w, h);
  if (dataX.length < 2) return;

  // Global min/max across all 3 axes
  const all = [...dataX, ...dataY, ...dataZ];
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (max === min) { max += 1; min -= 1; }
  const pad = h * 0.12;

  function makePoints(data) {
    return data.map((v, i) => ({
      x: (i / (HISTORY_MAX - 1)) * w,
      y: h - pad - ((v - min) / (max - min)) * (h - pad * 2),
    }));
  }

  function drawLine(pts, color) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const cpx = (pts[i - 1].x + pts[i].x) / 2;
      ctx.bezierCurveTo(cpx, pts[i - 1].y, cpx, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * devicePixelRatio;
    ctx.stroke();

    // Dot
    const last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 2.5 * devicePixelRatio, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  const ptsX = makePoints(dataX);
  const ptsY = makePoints(dataY);
  const ptsZ = makePoints(dataZ);

  drawLine(ptsX, getAxisColor('x'));
  drawLine(ptsY, getAxisColor('y'));
  drawLine(ptsZ, getAxisColor('z'));
}

// ─── Debug Console ──────────────────────────────────────────
function toggleDebug() {
  debugMode = !debugMode;
  $('#debug-panel').classList.toggle('visible', debugMode);
  $('#debug-toggle').classList.toggle('active', debugMode);
}

function logDebug(dir, msg) {
  const con = $('#debug-console');
  if (!con) return;

  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const line = document.createElement('div');
  line.className = 'debug-line';
  line.innerHTML =
    `<span class="debug-ts">${ts}</span>` +
    `<span class="debug-dir ${dir.toLowerCase()}">${dir}</span>` +
    `<span class="debug-data">${escapeHtml(msg)}</span>`;
  con.appendChild(line);
  con.scrollTop = con.scrollHeight;

  while (con.children.length > 300) con.removeChild(con.firstChild);
}

function clearDebug() {
  const con = $('#debug-console');
  if (con) con.innerHTML = '';
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ─── UI State ────────────────────────────────────────────────
function setConnected(connected) {
  isConnected = connected;
  const btn = $('#connect-btn');
  const dot = $('#status-dot');
  const txt = $('#status-text');

  if (connected) {
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 0 1-12.73 0"/><path d="M15.54 9.46a5 5 0 0 1-7.07 0"/><line x1="12" y1="12" x2="12" y2="12.01"/></svg>' +
      'Disconnect';
    btn.classList.add('connected');
    dot.classList.add('connected');
    txt.textContent = bleDevice?.name || 'Connected';
  } else {
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11"/></svg>' +
      'Connect';
    btn.classList.remove('connected');
    dot.classList.remove('connected');
    txt.textContent = 'Disconnected';

    document.querySelectorAll('.no-data-overlay').forEach(el => {
      el.classList.remove('hidden');
    });
  }
}

function setStatus(text) {
  const el = $('#status-text');
  if (el) el.textContent = text;
}

// ─── Idle animation ─────────────────────────────────────────
function startIdleAnimation() {
  const keys = Object.keys(canvasEls);
  let frame = 0;

  function tick() {
    if (isConnected) { requestAnimationFrame(tick); return; }
    frame++;

    keys.forEach((key, idx) => {
      const canvas = canvasEls[key]();
      if (!canvas) return;
      // Check if any data exists for this key
      const prefix = key === 'accel' ? 'accel' : key === 'gyro' ? 'gyro' : null;
      const hasData = prefix
        ? history[prefix + 'X'].length > 0
        : history[key]?.length > 0;
      if (hasData) return;

      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const color = getChartColor(key);

      ctx.clearRect(0, 0, w, h);
      const midY = h * 0.55;
      const amp  = h * 0.06;

      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const t = (x / w) * Math.PI * 2 + frame * 0.015 + idx * 0.7;
        const y = midY + Math.sin(t) * amp;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color + '18';
      ctx.lineWidth = 1 * devicePixelRatio;
      ctx.stroke();
    });

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
